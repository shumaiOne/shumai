import { prisma } from '@/db'
import { s3Service } from '@/services/s3/s3'
import { transcodeService } from '@/transcode/transcode'
import { metadataService } from '@/services/metadata/metadata'
import * as path from 'path'
import * as fs from 'fs'

export interface GetMediaInfoActivityParams {
  assetId: string
  assetKey: string
  mediaType: string
}

export async function getMediaInfoActivity(params: {
  filePath: string
  assetId: string
  mediaType: string
}): Promise<PrismaJson.MediaInfo> {
  const isVideo = params.mediaType.startsWith('video/')
  const isImage = params.mediaType.startsWith('image/')

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
      format: {},
    }
    await metadataService.updateAssetMetadata(params.assetId, [
      { key: 'resolution_width', value: info.originalWidth },
      { key: 'resolution_height', value: info.originalHeight },
      { key: 'duration', value: info.duration },
      { key: 'bitRate', value: info.bitRate / 1000 },
      { key: 'frame_rate', value: info.frameRate },
    ])
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
    await metadataService.updateAssetMetadata(params.assetId, [
      { key: 'resolution_width', value: info.originalWidth },
      { key: 'resolution_height', value: info.originalHeight },
    ])
  }

  return mediaInfo
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

  await s3Service.downloadToFile(bucket, params.assetKey, filePath)

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
  const asset = await prisma.asset.findUnique({ where: { id: params.assetId } })
  if (!asset || !asset.key) throw new Error('Asset not found')

  const infoKey = path.join(path.dirname(asset.key), 'info.json')
  const buffer = Buffer.from(JSON.stringify(params.mediaInfo))
  await s3Service.putObject(bucket, infoKey, buffer, buffer.length, 'application/json')

  await prisma.asset.update({
    where: { id: params.assetId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { media: params.mediaInfo as any },
  })
}
