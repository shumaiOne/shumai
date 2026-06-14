import { metadataService } from '@shumai/core/src/metadata/metadata'
import { s3Service } from '@shumai/core/src/s3/s3'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { transcodeService } from '../transcode'
import {
  getMediaInfoActivity,
  overlayAnnotationsActivity,
  takeScreenshotsActivity,
  transcodeVideoActivity,
  updateAssetMediaActivity,
  downloadMediaToTmpActivity,
  transcodeImageActivity,
  generateSpriteActivity,
} from './transcode'

vi.mock('@shumai/core/src/s3/s3', () => ({
  s3Service: {
    getObject: vi.fn(),
    putObject: vi.fn(),
    headObject: vi.fn(),
    presign: vi.fn(),
    downloadToFile: vi.fn(),
  },
}))

vi.mock('../transcode', () => ({
  transcodeService: {
    getVideoInfo: vi.fn(),
    getImageInfo: vi.fn(),
    transcodeVideo: vi.fn(),
    transcodeImage: vi.fn(),
    generateSprite: vi.fn(),
    createTempDir: vi.fn().mockReturnValue('/tmp'),
    removeDir: vi.fn(),
    takeScreenshots: vi.fn(),
    overlayAnnotations: vi.fn(),
  },
}))

vi.mock('@shumai/core/src/metadata/metadata', () => ({
  metadataService: {
    updateAssetMetadata: vi.fn(),
  },
}))

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    readFileSync: vi.fn().mockReturnValue(Buffer.from('fake data')),
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    unlinkSync: vi.fn(),
  }
})

describe('Transcode Activities', () => {
  setupTestDbHooks()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call getVideoInfo and set file_type to video', async () => {
    const asset = await prisma.asset.create({
      data: { name: 'v.mp4', type: 'file', status: 'uploaded' },
    })
    vi.mocked(transcodeService.getVideoInfo).mockResolvedValue({
      originalWidth: 1920,
      originalHeight: 1080,
      duration: 10,
      bitRate: 1000,
      frameRate: 30,
      hasAudio: true,
      videoCodec: 'Advanced Video Coding',
      audioCodec: 'MPEG-4 Audio',
      audioChannels: 2,
      audioSampleRate: 48000,
      audioBitDepth: 16,
      mimeType: 'video/mp4',
    })

    const result = await getMediaInfoActivity({
      assetId: asset.id,
      filePath: '/tmp/v.mp4',
      mediaType: 'video/mp4',
    })

    expect(transcodeService.getVideoInfo).toHaveBeenCalledWith('/tmp/v.mp4')
    expect(result.duration).toBe(10)
    expect(result.metadata?.originalWidth).toBe(1920)
    expect(result.metadata?.videoCodec).toBe('Advanced Video Coding')
    expect(result.metadata?.audioCodec).toBe('MPEG-4 Audio')
    expect(result.metadata?.audioChannels).toBe(2)
    expect(result.metadata?.audioSampleRate).toBe(48000)
    expect(result.metadata?.audioBitDepth).toBe(16)
    expect(metadataService.updateAssetMetadata).toHaveBeenCalledWith(
      asset.id,
      expect.arrayContaining([{ key: 'file_type', value: 'video' }]),
      true,
    )
  })

  it('should call getImageInfo and set file_type to image', async () => {
    const asset = await prisma.asset.create({
      data: { name: 'i.png', type: 'file', status: 'uploaded' },
    })
    vi.mocked(transcodeService.getImageInfo).mockResolvedValue({
      originalWidth: 800,
      originalHeight: 600,
      duration: 0,
      bitRate: 0,
      frameRate: 0,
      hasAudio: false,
      mimeType: 'image/png',
    })

    const result = await getMediaInfoActivity({
      assetId: asset.id,
      filePath: '/tmp/i.png',
      mediaType: 'image/png',
    })

    expect(transcodeService.getImageInfo).toHaveBeenCalledWith('/tmp/i.png')
    expect(result.metadata?.originalWidth).toBe(800)
    expect(result.metadata?.duration).toBe(0)
    expect(metadataService.updateAssetMetadata).toHaveBeenCalledWith(
      asset.id,
      expect.arrayContaining([{ key: 'file_type', value: 'image' }]),
      true,
    )
  })

  it('should set file_type to audio for audio files', async () => {
    const asset = await prisma.asset.create({
      data: { name: 'a.mp3', type: 'file', status: 'uploaded' },
    })

    await getMediaInfoActivity({
      assetId: asset.id,
      filePath: '/tmp/a.mp3',
      mediaType: 'audio/mpeg',
    })

    expect(metadataService.updateAssetMetadata).toHaveBeenCalledWith(
      asset.id,
      expect.arrayContaining([{ key: 'file_type', value: 'audio' }]),
      true,
    )
  })

  it('should set file_type to document for pdf/text files', async () => {
    const asset = await prisma.asset.create({
      data: { name: 'd.pdf', type: 'file', status: 'uploaded' },
    })

    await getMediaInfoActivity({
      assetId: asset.id,
      filePath: '/tmp/d.pdf',
      mediaType: 'application/pdf',
    })

    expect(metadataService.updateAssetMetadata).toHaveBeenCalledWith(
      asset.id,
      expect.arrayContaining([{ key: 'file_type', value: 'document' }]),
      true,
    )
  })

  it('should set file_type to file for unknown types', async () => {
    const asset = await prisma.asset.create({
      data: { name: 'u.xyz', type: 'file', status: 'uploaded' },
    })

    await getMediaInfoActivity({
      assetId: asset.id,
      filePath: '/tmp/u.xyz',
      mediaType: 'application/octet-stream',
    })

    expect(metadataService.updateAssetMetadata).toHaveBeenCalledWith(
      asset.id,
      expect.arrayContaining([{ key: 'file_type', value: 'file' }]),
      true,
    )
  })

  it('should update asset media field', async () => {
    const asset = await prisma.asset.create({
      data: {
        name: 'v.mp4',
        storageKey: { create: { key: 'v.mp4' } },
        status: 'uploaded',
        type: 'file',
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mediaInfo: any = { duration: 123 }
    await updateAssetMediaActivity({ assetId: asset.id, mediaInfo })

    const updated = await prisma.asset.findUnique({ where: { id: asset.id } })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((updated?.media as any).duration).toBe(123)
    expect(s3Service.putObject).toHaveBeenCalled()
  })
  it('should call transcodeService.transcodeVideo', async () => {
    vi.mocked(s3Service.headObject).mockRejectedValue(new Error('Not found'))

    await transcodeVideoActivity({
      assetKey: 'v.mp4',
      filePath: '/tmp/v.mp4',
      videoSpec: { resolution: '720p', width: 1280, height: 720 },
      duration: 10,
      originalFps: 30,
    })

    expect(transcodeService.transcodeVideo).toHaveBeenCalled()
  })

  it('should call transcodeService.takeScreenshots', async () => {
    vi.mocked(transcodeService.takeScreenshots).mockResolvedValue([
      { key: 'screenshots/shot1.webp', timestamp: 1.0 },
    ])

    const result = await takeScreenshotsActivity({
      assetKey: 'v.mp4',
      assetId: 'asset-1',
      start: 0,
      end: 10,
      count: 1,
      commentTimestamp: 1.0,
      annotations: [],
    })

    expect(transcodeService.takeScreenshots).toHaveBeenCalledWith({
      assetKey: 'v.mp4',
      assetId: 'asset-1',
      start: 0,
      end: 10,
      count: 1,
      commentTimestamp: 1.0,
      annotations: [],
    })
    expect(result).toEqual([{ key: 'screenshots/shot1.webp', timestamp: 1.0 }])
  })

  it('should call transcodeService.overlayAnnotations', async () => {
    vi.mocked(transcodeService.overlayAnnotations).mockResolvedValue('annotations/ann.webp')

    const result = await overlayAnnotationsActivity({
      assetKey: 'i.png',
      assetId: 'asset-2',
      annotations: [],
    })

    expect(transcodeService.overlayAnnotations).toHaveBeenCalledWith({
      assetKey: 'i.png',
      assetId: 'asset-2',
      annotations: [],
    })
    expect(result).toBe('annotations/ann.webp')
  })

  describe('Non-retryable Error Handling', () => {
    it('should throw non-retryable ApplicationFailure when downloadMediaToTmpActivity fails with ENOENT', async () => {
      vi.mocked(s3Service.downloadToFile).mockRejectedValue({
        code: 'ENOENT',
        message: 'ENOENT: no such file or directory',
      })

      await expect(downloadMediaToTmpActivity({ assetKey: 'missing.mp4' })).rejects.toThrowError(
        /Failed to download media to tmp/,
      )
    })

    it('should throw non-retryable ApplicationFailure when getMediaInfoActivity fails with ENOENT', async () => {
      const asset = await prisma.asset.create({
        data: { name: 'missing.mp4', type: 'file', status: 'uploaded' },
      })
      vi.mocked(transcodeService.getVideoInfo).mockRejectedValue({
        code: 'ENOENT',
        message: 'ENOENT: no such file or directory',
      })

      await expect(
        getMediaInfoActivity({
          assetId: asset.id,
          filePath: '/tmp/missing.mp4',
          mediaType: 'video/mp4',
        }),
      ).rejects.toThrowError(/Failed to get media info/)
    })

    it('should throw non-retryable ApplicationFailure when transcodeVideoActivity fails with ffmpeg error', async () => {
      vi.mocked(s3Service.headObject).mockRejectedValue(new Error('Not found'))
      vi.mocked(transcodeService.transcodeVideo).mockRejectedValue(new Error('FFmpeg failed'))

      await expect(
        transcodeVideoActivity({
          assetKey: 'v.mp4',
          filePath: '/tmp/v.mp4',
          videoSpec: { resolution: '720p', width: 1280, height: 720 },
          duration: 10,
          originalFps: 30,
        }),
      ).rejects.toThrowError(/Video transcoding failed/)
    })

    it('should throw non-retryable ApplicationFailure when transcodeImageActivity fails with sharp error', async () => {
      vi.mocked(s3Service.headObject).mockRejectedValue(new Error('Not found'))
      vi.mocked(transcodeService.transcodeImage).mockRejectedValue(new Error('sharp failed'))

      await expect(
        transcodeImageActivity({
          assetKey: 'i.png',
          filePath: '/tmp/i.png',
          imageSpec: { width: 800, height: 600, quality: 90, format: 'webp' },
        }),
      ).rejects.toThrowError(/Image transcoding failed/)
    })

    it('should throw non-retryable ApplicationFailure when generateSpriteActivity fails with error', async () => {
      vi.mocked(s3Service.headObject).mockRejectedValue(new Error('Not found'))
      vi.mocked(transcodeService.generateSprite).mockRejectedValue(new Error('FFmpeg failed'))

      await expect(
        generateSpriteActivity({
          assetKey: 'v.mp4',
          filePath: '/tmp/v.mp4',
          mediaInfo: { duration: 10 } as unknown as PrismaJson.MediaInfo,
          spriteSpec: { key: 'sprite.webp', frames: 100, tileX: 10, tileY: 10 },
          posterSpec: { key: 'poster.webp' },
        }),
      ).rejects.toThrowError(/Sprite\/Poster generation failed/)
    })

    it('should throw non-retryable ApplicationFailure when takeScreenshotsActivity fails with error', async () => {
      vi.mocked(transcodeService.takeScreenshots).mockRejectedValue(new Error('FFmpeg failed'))

      await expect(
        takeScreenshotsActivity({
          assetKey: 'v.mp4',
          assetId: 'asset-1',
          start: 0,
          end: 10,
          count: 1,
          commentTimestamp: 1.0,
          annotations: [],
        }),
      ).rejects.toThrowError(/Screenshot extraction failed/)
    })

    it('should throw non-retryable ApplicationFailure when overlayAnnotationsActivity fails with error', async () => {
      vi.mocked(transcodeService.overlayAnnotations).mockRejectedValue(new Error('sharp failed'))

      await expect(
        overlayAnnotationsActivity({
          assetKey: 'i.png',
          assetId: 'asset-2',
          annotations: [],
        }),
      ).rejects.toThrowError(/Overlay annotations failed/)
    })
  })
})
