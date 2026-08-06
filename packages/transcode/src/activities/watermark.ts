import { prisma, WorkflowTaskStatus } from '@shumai/db'
import { s3Service } from '@shumai/core/src/s3/s3'
import { transcodeService } from '@shumai/core/src/transcode/transcode'
import {
  generateWatermarkSvg,
  RenderBlockImageData,
} from '@shumai/core/src/watermark/watermark-svg'
import { watermarkService } from '@shumai/core/src/watermark/watermark'
import { stemFromKey } from '@shumai/core/src/utils/filename'
import { ApplicationFailure } from '@temporalio/activity'
import * as path from 'path'
import * as fs from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import sharp from 'sharp'
import type { WatermarkConfigSpec, WatermarkBlockImage } from '@shumai/dtos'

const execFileAsync = promisify(execFile)

export interface InitWatermarkFileParams {
  assetId: string
  watermarkConfigId: string
}

export interface InitWatermarkFileResult {
  skip: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  media?: any
}

export async function initWatermarkFileActivity(
  params: InitWatermarkFileParams,
): Promise<InitWatermarkFileResult> {
  const existing = await prisma.watermarkFile.findUnique({
    where: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      assetId_watermarkConfigId: {
        assetId: params.assetId,
        watermarkConfigId: params.watermarkConfigId,
      },
    },
  })

  if (existing) {
    if (existing.status === WorkflowTaskStatus.completed) {
      return { skip: true, media: existing.media }
    }
    if (existing.status === WorkflowTaskStatus.processing) {
      return { skip: true }
    }
    // If failed, reset to processing
    await prisma.watermarkFile.update({
      where: { id: existing.id },
      data: { status: WorkflowTaskStatus.processing },
    })
    return { skip: false }
  }

  await prisma.watermarkFile.create({
    data: {
      assetId: params.assetId,
      watermarkConfigId: params.watermarkConfigId,
      status: WorkflowTaskStatus.processing,
    },
  })

  return { skip: false }
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

  const config = watermarkConfigRecord.config as unknown as WatermarkConfigSpec
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
          const meta = await sharp(buffer, { limitInputPixels: false }).metadata()
          const mimeType = meta.format ? `image/${meta.format}` : 'image/png'
          blockImagesMap.set(imgBlock.imageAssetId, {
            imageAssetId: imgBlock.imageAssetId,
            base64Data: buffer.toString('base64'),
            mimeType,
            width: meta.width || 100,
            height: meta.height || 100,
          })
        }
      } catch (err) {
        console.warn(`Failed to load watermark block image ${imgBlock.imageAssetId}:`, err)
      }
    }

    // Generate SVG overlay
    const svgString = generateWatermarkSvg(config, originalWidth, originalHeight, blockImagesMap)
    const overlayPngBuffer = await sharp(Buffer.from(svgString)).png().toBuffer()

    const mediaInfo: PrismaJson.MediaInfo = {
      duration,
      filesize: 0,
      frames: totalFrames,
      proxyType: isVideo ? 'video' : 'image',
      imageTranscodes: [],
      videoTranscodes: [],
      videoPreview: { width: originalWidth, height: originalHeight },
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
      const outFileName = `${stem}-watermark-${params.watermarkConfigId}.webp`
      const outFilePath = path.join(tmpDir, outFileName)

      await sharp(rawFilePath, { limitInputPixels: false })
        .toColorspace('srgb')
        .resize(originalWidth, originalHeight, { fit: 'inside', withoutEnlargement: true })
        .composite([{ input: overlayPngBuffer }])
        .webp({ quality: 90 })
        .toFile(outFilePath)

      const stat = fs.statSync(outFilePath)
      const outputKey = path.posix.join(path.posix.dirname(assetKey), outFileName)

      await s3Service.putObject(
        bucket,
        outputKey,
        Bun.file(outFilePath).stream(),
        stat.size,
        'image/webp',
      )

      const imageTranscode: PrismaJson.ImageTranscode = {
        key: outputKey,
        width: originalWidth,
        height: originalHeight,
        quality: 90,
        format: 'webp',
      }
      mediaInfo.imageTranscodes.push(imageTranscode)
      mediaInfo.thumbnail = imageTranscode
      mediaInfo.filesize = stat.size
    } else if (isVideo) {
      const overlayPngPath = path.join(tmpDir, 'watermarkOverlay.png')
      fs.writeFileSync(overlayPngPath, overlayPngBuffer)

      const outFileName = `${stem}-watermark-${params.watermarkConfigId}.mp4`
      const outFilePath = path.join(tmpDir, outFileName)

      const filterComplex = `[0:v][1:v]overlay=0:0[vout]`

      const args = [
        '-i',
        rawFilePath,
        '-i',
        overlayPngPath,
        '-filter_complex',
        filterComplex,
        '-map',
        '[vout]',
      ]

      if (hasAudio) {
        args.push('-map', '0:a?')
      }

      args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '26')

      if (hasAudio) {
        args.push('-c:a', 'aac', '-b:a', '128k')
      }

      args.push('-movflags', '+faststart', '-max_muxing_queue_size', '1024', outFilePath)

      await execFileAsync('ffmpeg', ['-y', '-loglevel', 'warning', ...args])

      const stat = fs.statSync(outFilePath)
      const outputKey = path.posix.join(path.posix.dirname(assetKey), outFileName)

      await s3Service.putObject(
        bucket,
        outputKey,
        Bun.file(outFilePath).stream(),
        stat.size,
        'video/mp4',
      )

      const videoTranscode: PrismaJson.VideoTranscode = {
        key: outputKey,
        width: originalWidth,
        height: originalHeight,
        resolution: `${originalHeight}p`,
      }
      mediaInfo.videoTranscodes.push(videoTranscode)
      mediaInfo.videoPreview = videoTranscode
      mediaInfo.filesize = stat.size
    }

    return mediaInfo
  } catch (err) {
    console.error('Failed to generate watermark proxy:', err)
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
  status: WorkflowTaskStatus
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      media: (params.mediaInfo as any) || undefined,
      status: params.status,
    },
    update: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      media: (params.mediaInfo as any) || undefined,
      status: params.status,
    },
  })

  if (params.shareLinkId) {
    await watermarkService.checkAndUpdateShareLinkStatus(params.shareLinkId)
  }
}
