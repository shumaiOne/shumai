import { prisma, WatermarkFileStatus } from '@shumai/db'
import '@shumai/db/src/prisma-json-types'
import { s3Service } from '@shumai/core/src/s3/s3'
import { transcodeService } from '@shumai/core/src/transcode/transcode'
import {
  generateWatermarkSvg,
  RenderBlockImageData,
} from '@shumai/core/src/watermark/watermark-svg'
import { watermarkService } from '@shumai/core/src/watermark/watermark'
import { logger } from '@shumai/core/src/logger'
import { stemFromKey } from '@shumai/core/src/utils/filename'
import { ApplicationFailure } from '@temporalio/activity'
import * as path from 'path'
import * as fs from 'fs'
import type { WatermarkConfigSpec, WatermarkBlockImage } from '@shumai/dtos'

// Max dimension for watermark block images embedded into the SVG overlay.
// Bounding this keeps the SVG (and its base64 payload) small for large logos.
const MAX_BLOCK_IMAGE_DIMENSION = 1024

export interface InitWatermarkFileParams {
  assetId: string
  watermarkConfigId: string
}

export type InitWatermarkFileAction = 'created' | 'completed' | 'processing' | 'failed'

export interface InitWatermarkFileResult {
  action: InitWatermarkFileAction
  media?: PrismaJson.MediaInfo | null
}

export async function initWatermarkFileActivity(
  params: InitWatermarkFileParams,
): Promise<InitWatermarkFileResult> {
  return await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{
        id: string
        status: WatermarkFileStatus
        media: PrismaJson.MediaInfo | null
      }>
    >`
      SELECT id, status, media
      FROM watermark_files
      WHERE asset_id = ${params.assetId}
        AND watermark_config_id = ${params.watermarkConfigId}
      FOR UPDATE
    `

    if (rows.length > 0) {
      const existing = rows[0]
      if (existing.status === WatermarkFileStatus.completed) {
        return { action: 'completed', media: existing.media }
      }
      if (existing.status === WatermarkFileStatus.failed) {
        return { action: 'failed' }
      }
      return { action: 'processing' }
    }

    await tx.watermarkFile.create({
      data: {
        assetId: params.assetId,
        watermarkConfigId: params.watermarkConfigId,
        status: WatermarkFileStatus.processing,
      },
    })

    return { action: 'created' }
  })
}

export interface WaitForWatermarkFileParams {
  assetId: string
  watermarkConfigId: string
}

export interface WaitForWatermarkFileResult {
  status: WatermarkFileStatus
  media?: PrismaJson.MediaInfo | null
}

export async function waitForWatermarkFileActivity(
  params: WaitForWatermarkFileParams,
): Promise<WaitForWatermarkFileResult> {
  const pollIntervalMs = 1000
  const maxWaitMs = 600000 // 10 minutes timeout

  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitMs) {
    const wf = await prisma.watermarkFile.findUnique({
      where: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        assetId_watermarkConfigId: {
          assetId: params.assetId,
          watermarkConfigId: params.watermarkConfigId,
        },
      },
    })

    if (wf && wf.status !== WatermarkFileStatus.processing) {
      return { status: wf.status, media: wf.media }
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
  }

  return { status: WatermarkFileStatus.failed }
}

export interface TranscodeWatermarkMediaParams {
  assetId: string
  watermarkConfigId: string
}

export async function transcodeWatermarkMediaActivity(
  params: TranscodeWatermarkMediaParams,
): Promise<PrismaJson.MediaInfo> {
  const bucket = process.env.S3_BUCKET || 'shumai'

  const watermarkConfigRecord = await prisma.watermarkConfig.findUnique({
    where: { id: params.watermarkConfigId },
  })
  if (!watermarkConfigRecord) {
    throw ApplicationFailure.create({
      message: `Watermark config not found: ${params.watermarkConfigId}`,
      nonRetryable: true,
    })
  }

  const asset = await prisma.asset.findUnique({
    where: { id: params.assetId },
    include: { storageKey: true },
  })

  if (!asset || !asset.storageKey?.key) {
    throw ApplicationFailure.create({
      message: `Asset or storage key not found: ${params.assetId}`,
      nonRetryable: true,
    })
  }

  // The config column is declared as PrismaJson.WatermarkConfigSpec, which is
  // structurally identical to the DTO type, so no cast is required.
  const config: WatermarkConfigSpec = watermarkConfigRecord.config
  const assetKey = asset.storageKey.key
  const stem = stemFromKey(assetKey)

  const tmpDir = transcodeService.createTempDir('watermark-')
  const rawFilePath = path.join(tmpDir, path.basename(assetKey))

  try {
    await s3Service.downloadToFile(bucket, assetKey, rawFilePath)

    const isVideo =
      asset.mediaType?.startsWith('video/') ||
      (asset.media as PrismaJson.MediaInfo | null)?.proxyType === 'video'
    const isImage =
      asset.mediaType?.startsWith('image/') ||
      (asset.media as PrismaJson.MediaInfo | null)?.proxyType === 'image'

    let originalWidth = 1920
    let originalHeight = 1080
    let duration = 0
    let frameRate = 30
    let totalFrames = 0
    let startTimecode = '00:00:00:00'
    let hasAudio = false

    if (isVideo) {
      const info = await transcodeService.getVideoInfo(rawFilePath)
      originalWidth = info.originalWidth
      originalHeight = info.originalHeight
      duration = info.duration
      frameRate = info.frameRate
      totalFrames = info.totalFrames
      startTimecode = info.startTimecode || '00:00:00:00'
      hasAudio = info.hasAudio
    } else if (isImage) {
      const info = await transcodeService.getImageInfo(rawFilePath)
      originalWidth = info.originalWidth
      originalHeight = info.originalHeight
    } else {
      throw ApplicationFailure.create({
        message: `Asset ${params.assetId} is neither video nor image`,
        nonRetryable: true,
      })
    }

    // Process image blocks if any
    const blockImagesMap = new Map<string, RenderBlockImageData>()
    const imageBlocks = (config.blocks || []).filter(
      (b) => b.type === 'image',
    ) as WatermarkBlockImage[]

    for (const imgBlock of imageBlocks) {
      try {
        const imgAsset = await prisma.asset.findUnique({
          where: { id: imgBlock.imageAssetId },
          include: { storageKey: true },
        })
        if (imgAsset && imgAsset.storageKey?.key) {
          const imgTmpPath = path.join(tmpDir, `block-${imgBlock.imageAssetId}`)
          await s3Service.downloadToFile(bucket, imgAsset.storageKey.key, imgTmpPath)
          const buffer = fs.readFileSync(imgTmpPath)
          // Downscale to a bounded size and normalize to PNG so large logo assets
          // don't balloon the SVG/base64 payload.
          const processed = await transcodeService.downscaleImageToPng(
            buffer,
            MAX_BLOCK_IMAGE_DIMENSION,
          )
          blockImagesMap.set(imgBlock.imageAssetId, {
            imageAssetId: imgBlock.imageAssetId,
            base64Data: processed.buffer.toString('base64'),
            mimeType: 'image/png',
            width: processed.width,
            height: processed.height,
          })
        }
      } catch (err) {
        logger.warn(
          { imageAssetId: imgBlock.imageAssetId, err },
          'Failed to load watermark block image',
        )
      }
    }

    const originalMedia = asset.media as PrismaJson.MediaInfo | null

    const mediaInfo: PrismaJson.MediaInfo = {
      duration,
      filesize: 0,
      frames: totalFrames,
      proxyType: isVideo ? 'video' : 'image',
      imageTranscodes: [],
      videoTranscodes: [],
      finishedAt: new Date().toISOString(),
      metadata: {
        originalWidth,
        originalHeight,
        duration,
        bitRate: 0,
        frameRate,
        totalFrames,
        startTimecode,
        hasAudio,
        format: {},
      },
      original: {
        key: assetKey,
        downloadUrl: '',
        filesizeInBytes: 0,
        codec: '',
      },
    }

    if (isImage) {
      const originalTranscodes = originalMedia?.imageTranscodes || []
      let totalSize = 0

      for (let i = 0; i < originalTranscodes.length; i++) {
        const it = originalTranscodes[i]
        const targetWidth = it.width || originalWidth
        const targetHeight = it.height || originalHeight

        const svgString = generateWatermarkSvg(config, targetWidth, targetHeight, blockImagesMap)
        const overlayPngBuffer = await transcodeService.renderSvgToPng(svgString)

        const outFileName = `${stem}-watermark-${params.watermarkConfigId}-${targetWidth}x${targetHeight}.webp`
        const outFilePath = path.join(tmpDir, outFileName)

        await transcodeService.compositeOverlayToWebpFile(
          rawFilePath,
          overlayPngBuffer,
          outFilePath,
          targetWidth,
          targetHeight,
        )

        const stat = fs.statSync(outFilePath)
        totalSize += stat.size
        const outputKey = path.posix.join(path.posix.dirname(assetKey), outFileName)

        await s3Service.putObject(
          bucket,
          outputKey,
          Bun.file(outFilePath).stream(),
          stat.size,
          'image/webp',
        )

        mediaInfo.imageTranscodes.push({
          key: outputKey,
          width: targetWidth,
          height: targetHeight,
          quality: it.quality ?? 90,
          format: it.format ?? 'webp',
        })
      }
      mediaInfo.filesize = totalSize
    } else if (isVideo) {
      const originalTranscodes = originalMedia?.videoTranscodes || []
      let totalSize = 0

      for (let i = 0; i < originalTranscodes.length; i++) {
        const vt = originalTranscodes[i]
        const targetWidth = vt.width || originalWidth
        const targetHeight = vt.height || originalHeight
        const resolution = vt.resolution || `${targetHeight}p`

        const svgString = generateWatermarkSvg(config, targetWidth, targetHeight, blockImagesMap)
        const overlayPngBuffer = await transcodeService.renderSvgToPng(svgString)

        const overlayPngPath = path.join(tmpDir, `watermarkOverlay-${i}.png`)
        fs.writeFileSync(overlayPngPath, overlayPngBuffer)

        const outFileName = `${stem}-watermark-${params.watermarkConfigId}-${resolution}.mp4`
        const outFilePath = path.join(tmpDir, outFileName)

        await transcodeService.transcodeVideo({
          inputFile: rawFilePath,
          outputFile: outFilePath,
          width: targetWidth,
          height: targetHeight,
          disableAudio: !hasAudio,
          overlayFile: overlayPngPath,
        })

        const stat = fs.statSync(outFilePath)
        totalSize += stat.size
        const outputKey = path.posix.join(path.posix.dirname(assetKey), outFileName)

        await s3Service.putObject(
          bucket,
          outputKey,
          Bun.file(outFilePath).stream(),
          stat.size,
          'video/mp4',
        )

        mediaInfo.videoTranscodes.push({
          key: outputKey,
          width: targetWidth,
          height: targetHeight,
          resolution,
        })
      }
      mediaInfo.filesize = totalSize
    }

    return mediaInfo
  } catch (err) {
    logger.error({ assetId: params.assetId, err }, 'Failed to generate watermark proxy')
    throw ApplicationFailure.create({
      message: `Failed to generate watermark proxy: ${err instanceof Error ? err.message : String(err)}`,
      nonRetryable: true,
      cause: err instanceof Error ? err : undefined,
    })
  } finally {
    transcodeService.removeDir(tmpDir)
  }
}

export interface CompleteWatermarkFileParams {
  assetId: string
  watermarkConfigId: string
  mediaInfo?: PrismaJson.MediaInfo | null
  status: WatermarkFileStatus
  shareLinkId?: string | null
}

export async function completeWatermarkFileActivity(
  params: CompleteWatermarkFileParams,
): Promise<void> {
  await prisma.watermarkFile.upsert({
    where: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      assetId_watermarkConfigId: {
        assetId: params.assetId,
        watermarkConfigId: params.watermarkConfigId,
      },
    },
    create: {
      assetId: params.assetId,
      watermarkConfigId: params.watermarkConfigId,
      media: params.mediaInfo ?? undefined,
      status: params.status,
    },
    update: {
      media: params.mediaInfo ?? undefined,
      status: params.status,
    },
  })

  if (params.shareLinkId) {
    await watermarkService.checkAndUpdateShareLinkStatus(params.shareLinkId)
  }
}
