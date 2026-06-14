import { prisma } from '@shumai/db'
import { s3Service } from '@shumai/core/src/s3/s3'
import { transcodeService } from '../transcode'
import { metadataService } from '@shumai/core/src/metadata/metadata'
import { ApplicationFailure } from '@temporalio/activity'
import * as path from 'path'
import * as fs from 'fs'

export interface GetMediaInfoActivityParams {
  assetId: string
  assetKey: string
  mediaType: string
}

function getErrorDetails(err: unknown): { code?: string; message: string; name?: string } {
  if (err && typeof err === 'object') {
    const record = err as Record<string, unknown>
    return {
      code: typeof record.code === 'string' ? record.code : undefined,
      message: typeof record.message === 'string' ? record.message : String(err),
      name: typeof record.name === 'string' ? record.name : undefined,
    }
  }
  return {
    message: String(err),
  }
}

export async function getMediaInfoActivity(params: {
  filePath: string
  assetId: string
  mediaType: string
}): Promise<PrismaJson.MediaInfo> {
  try {
    const isVideo = params.mediaType.startsWith('video/')
    const isImage = params.mediaType.startsWith('image/')
    const isAudio = params.mediaType.startsWith('audio/')
    const isDocument =
      params.mediaType.startsWith('text/') ||
      params.mediaType === 'application/pdf' ||
      params.mediaType.includes('msword') ||
      params.mediaType.includes('officedocument') ||
      params.mediaType.includes('vnd.ms-')

    const fileType = isVideo
      ? 'video'
      : isAudio
        ? 'audio'
        : isImage
          ? 'image'
          : isDocument
            ? 'document'
            : 'file'

    const mediaInfo: PrismaJson.MediaInfo = {
      duration: 0,
      filesize: 0,
      fps: 0,
      frames: 0,
      imageTranscodes: [],
      videoTranscodes: [],
      videoPreview: { width: 0, height: 0 },
      finishedAt: new Date().toISOString(),
      metadata: null,
      mimeType: params.mediaType,
      original: {
        key: '', // Will be filled by caller or updated later
        downloadUrl: '',
        filesizeInBytes: 0,
        codec: '',
      },
    }

    const metadataUpdates: { key: string; value: string | number }[] = [
      { key: 'file_type', value: fileType },
    ]

    if (isVideo) {
      const info = await transcodeService.getVideoInfo(params.filePath)
      mediaInfo.duration = info.duration
      mediaInfo.fps = info.frameRate
      mediaInfo.metadata = {
        originalWidth: info.originalWidth,
        originalHeight: info.originalHeight,
        duration: info.duration,
        bitRate: info.bitRate,
        frameRate: info.frameRate,
        hasAudio: info.hasAudio,
        videoCodec: info.videoCodec,
        audioCodec: info.audioCodec,
        audioChannels: info.audioChannels,
        audioSampleRate: info.audioSampleRate,
        audioBitDepth: info.audioBitDepth,
        format: {},
      }
      metadataUpdates.push(
        { key: 'resolution_width', value: info.originalWidth },
        { key: 'resolution_height', value: info.originalHeight },
        { key: 'duration', value: info.duration },
        { key: 'bitRate', value: info.bitRate / 1000 },
        { key: 'frame_rate', value: info.frameRate },
      )
      if (info.videoCodec) metadataUpdates.push({ key: 'video_codec', value: info.videoCodec })
      if (info.audioCodec) metadataUpdates.push({ key: 'audio_codec', value: info.audioCodec })
      if (info.audioChannels !== undefined)
        metadataUpdates.push({ key: 'audio_channels', value: info.audioChannels })
      if (info.audioSampleRate !== undefined)
        metadataUpdates.push({ key: 'audio_sample_rate', value: info.audioSampleRate })
      if (info.audioBitDepth !== undefined)
        metadataUpdates.push({ key: 'audio_bit_depth', value: info.audioBitDepth })
    } else if (isImage) {
      const info = await transcodeService.getImageInfo(params.filePath)
      mediaInfo.metadata = {
        originalWidth: info.originalWidth,
        originalHeight: info.originalHeight,
        duration: 0,
        bitRate: 0,
        frameRate: 0,
        hasAudio: false,
        format: {},
      }
      metadataUpdates.push(
        { key: 'resolution_width', value: info.originalWidth },
        { key: 'resolution_height', value: info.originalHeight },
      )
    }

    await metadataService.updateAssetMetadata(params.assetId, metadataUpdates, true)

    return mediaInfo
  } catch (err) {
    const { name, message } = getErrorDetails(err)
    if (name?.includes('Prisma') || message.includes('Prisma')) {
      throw err
    }
    throw ApplicationFailure.create({
      message: `Failed to get media info: ${message}`,
      nonRetryable: true,
      cause: err instanceof Error ? err : undefined,
    })
  }
}

export interface VideoActivityParams {
  assetKey: string
  filePath: string
  videoSpec: PrismaJson.VideoTranscode
  duration: number
  originalFps: number
}

export async function transcodeVideoActivity(
  params: VideoActivityParams,
): Promise<PrismaJson.VideoTranscode> {
  const bucket = process.env.S3_BUCKET || 'shumai'
  const key = path.join(path.dirname(params.assetKey), `video-${params.videoSpec.height}p.mp4`)

  try {
    await s3Service.headObject(bucket, key)
    return { ...params.videoSpec, key }
  } catch {
    // Not found
  }

  const tmpDir = path.dirname(params.filePath)
  const outputFile = path.join(tmpDir, `video-${params.videoSpec.height}p.mp4`)

  try {
    let targetFps = 0
    let disableAudio = false

    if (params.videoSpec.resolution === '180p') {
      disableAudio = true
      targetFps = 24.0
      if (params.originalFps > 0 && params.originalFps < 24.0) {
        targetFps = params.originalFps
      }
      if (params.duration * targetFps > 1600) {
        targetFps = 1600 / params.duration
      }
    }

    await transcodeService.transcodeVideo({
      inputFile: params.filePath,
      outputFile,
      width: params.videoSpec.width,
      height: params.videoSpec.height,
      frameRate: targetFps || undefined,
      disableAudio,
    })

    const buffer = fs.readFileSync(outputFile)
    await s3Service.putObject(bucket, key, buffer, buffer.length, 'video/mp4')

    return { ...params.videoSpec, key }
  } catch (err) {
    const { code, message } = getErrorDetails(err)
    const lowerMsg = message.toLowerCase()

    if (
      code === 'ENOENT' ||
      lowerMsg.includes('enoent') ||
      lowerMsg.includes('ffmpeg') ||
      lowerMsg.includes('ffprobe') ||
      lowerMsg.includes('spawn') ||
      lowerMsg.includes('format') ||
      lowerMsg.includes('no video stream found')
    ) {
      throw ApplicationFailure.create({
        message: `Video transcoding failed: ${message}`,
        nonRetryable: true,
        cause: err instanceof Error ? err : undefined,
      })
    }
    throw err
  } finally {
    if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile)
  }
}

export interface ImageActivityParams {
  assetKey: string
  filePath: string
  imageSpec: PrismaJson.ImageTranscode
}

export async function transcodeImageActivity(
  params: ImageActivityParams,
): Promise<PrismaJson.ImageTranscode> {
  const bucket = process.env.S3_BUCKET || 'shumai'
  const key = path.join(path.dirname(params.assetKey), `image-${params.imageSpec.width}p.webp`)

  try {
    await s3Service.headObject(bucket, key)
    return { ...params.imageSpec, key }
  } catch {
    // Not found
  }

  const tmpDir = path.dirname(params.filePath)
  const outputFile = path.join(tmpDir, `image-${params.imageSpec.width}p.webp`)

  try {
    await transcodeService.transcodeImage(
      params.filePath,
      outputFile,
      params.imageSpec.width,
      params.imageSpec.quality,
    )
    const buffer = fs.readFileSync(outputFile)
    await s3Service.putObject(bucket, key, buffer, buffer.length, 'image/webp')

    return { ...params.imageSpec, key }
  } catch (err) {
    const { code, message } = getErrorDetails(err)
    const lowerMsg = message.toLowerCase()

    if (
      code === 'ENOENT' ||
      lowerMsg.includes('enoent') ||
      lowerMsg.includes('sharp') ||
      lowerMsg.includes('spawn') ||
      lowerMsg.includes('format')
    ) {
      throw ApplicationFailure.create({
        message: `Image transcoding failed: ${message}`,
        nonRetryable: true,
        cause: err instanceof Error ? err : undefined,
      })
    }
    throw err
  } finally {
    if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile)
  }
}

export interface GenerateSpriteActivityParams {
  assetKey: string
  filePath: string
  mediaInfo: PrismaJson.MediaInfo
  spriteSpec: PrismaJson.SpriteInfo
  posterSpec: PrismaJson.PosterInfo
}

export async function generateSpriteActivity(params: GenerateSpriteActivityParams) {
  const bucket = process.env.S3_BUCKET || 'shumai'
  try {
    await s3Service.headObject(bucket, params.spriteSpec.key)
    await s3Service.headObject(bucket, params.posterSpec.key)
    return { sprite: params.spriteSpec, poster: params.posterSpec }
  } catch {
    // Not found
  }

  const tmpDir = path.dirname(params.filePath)
  const spriteFile = path.join(tmpDir, 'sprite.webp')
  const posterFile = path.join(tmpDir, 'poster.webp')

  try {
    await transcodeService.generateSprite(
      params.filePath,
      spriteFile,
      posterFile,
      params.mediaInfo.duration,
    )

    const spriteBuffer = fs.readFileSync(spriteFile)
    await s3Service.putObject(
      bucket,
      params.spriteSpec.key,
      spriteBuffer,
      spriteBuffer.length,
      'image/webp',
    )

    const posterBuffer = fs.readFileSync(posterFile)
    await s3Service.putObject(
      bucket,
      params.posterSpec.key,
      posterBuffer,
      posterBuffer.length,
      'image/webp',
    )

    return { sprite: params.spriteSpec, poster: params.posterSpec }
  } catch (err) {
    const { code, message } = getErrorDetails(err)
    const lowerMsg = message.toLowerCase()

    if (
      code === 'ENOENT' ||
      lowerMsg.includes('enoent') ||
      lowerMsg.includes('ffmpeg') ||
      lowerMsg.includes('ffprobe') ||
      lowerMsg.includes('spawn') ||
      lowerMsg.includes('format')
    ) {
      throw ApplicationFailure.create({
        message: `Sprite/Poster generation failed: ${message}`,
        nonRetryable: true,
        cause: err instanceof Error ? err : undefined,
      })
    }
    throw err
  } finally {
    if (fs.existsSync(spriteFile)) fs.unlinkSync(spriteFile)
    if (fs.existsSync(posterFile)) fs.unlinkSync(posterFile)
  }
}

export async function downloadMediaToTmpActivity(params: {
  assetKey: string
}): Promise<{ filePath: string; tmpDir: string }> {
  const bucket = process.env.S3_BUCKET || 'shumai'
  const tmpDir = transcodeService.createTempDir('transcode-')
  const filePath = path.join(tmpDir, path.basename(params.assetKey))

  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true })
  }

  try {
    await s3Service.downloadToFile(bucket, params.assetKey, filePath)
  } catch (err) {
    const { code, message } = getErrorDetails(err)
    const lowerMsg = message.toLowerCase()
    if (code === 'ENOENT' || lowerMsg.includes('enoent') || lowerMsg.includes('nosuchkey')) {
      throw ApplicationFailure.create({
        message: `Failed to download media to tmp: ${message}`,
        nonRetryable: true,
        cause: err instanceof Error ? err : undefined,
      })
    }
    throw err
  }

  return { filePath, tmpDir }
}

export async function cleanupTmpDirActivity(params: { tmpDir: string }): Promise<void> {
  transcodeService.removeDir(params.tmpDir)
}

export interface UpdateAssetMediaActivityParams {
  assetId: string
  mediaInfo: PrismaJson.MediaInfo
}

export async function updateAssetMediaActivity(params: UpdateAssetMediaActivityParams) {
  const bucket = process.env.S3_BUCKET || 'shumai'
  const asset = await prisma.asset.findUnique({
    where: { id: params.assetId },
    include: { storageKey: true },
  })
  const key = asset?.storageKey?.key
  if (!asset || !key) {
    throw ApplicationFailure.create({
      message: 'Asset not found or has no key',
      nonRetryable: true,
    })
  }

  const infoKey = path.join(path.dirname(key), 'info.json')
  const buffer = Buffer.from(JSON.stringify(params.mediaInfo))
  await s3Service.putObject(bucket, infoKey, buffer, buffer.length, 'application/json')

  await prisma.asset.update({
    where: { id: params.assetId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { media: params.mediaInfo as any },
  })
}

export async function takeScreenshotsActivity(params: {
  assetKey: string
  assetId: string
  start: number
  end: number
  count: number
  commentTimestamp?: number | null
  annotations?: PrismaJson.AnnotationList | null
}): Promise<Array<{ key: string; timestamp: number }>> {
  try {
    return await transcodeService.takeScreenshots(params)
  } catch (err) {
    const { code, message } = getErrorDetails(err)
    const lowerMsg = message.toLowerCase()
    if (
      code === 'ENOENT' ||
      lowerMsg.includes('enoent') ||
      lowerMsg.includes('nosuchkey') ||
      lowerMsg.includes('ffmpeg') ||
      lowerMsg.includes('sharp')
    ) {
      throw ApplicationFailure.create({
        message: `Screenshot extraction failed: ${message}`,
        nonRetryable: true,
        cause: err instanceof Error ? err : undefined,
      })
    }
    throw err
  }
}

export async function overlayAnnotationsActivity(params: {
  assetKey: string
  assetId: string
  annotations: PrismaJson.AnnotationList
}): Promise<string> {
  try {
    return await transcodeService.overlayAnnotations(params)
  } catch (err) {
    const { code, message } = getErrorDetails(err)
    const lowerMsg = message.toLowerCase()
    if (
      code === 'ENOENT' ||
      lowerMsg.includes('enoent') ||
      lowerMsg.includes('nosuchkey') ||
      lowerMsg.includes('ffmpeg') ||
      lowerMsg.includes('sharp')
    ) {
      throw ApplicationFailure.create({
        message: `Overlay annotations failed: ${message}`,
        nonRetryable: true,
        cause: err instanceof Error ? err : undefined,
      })
    }
    throw err
  }
}
