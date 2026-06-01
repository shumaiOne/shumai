import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db'
import { getMediaInfoActivity, transcodeVideoActivity, updateAssetMediaActivity } from './transcode'
import { s3Service } from '@/services/s3/s3'
import { transcodeService } from '@/transcode/transcode'

vi.mock('@/services/s3/s3', () => ({
  s3Service: {
    getObject: vi.fn(),
    putObject: vi.fn(),
    headObject: vi.fn(),
    presign: vi.fn(),
  },
}))

vi.mock('@/transcode/transcode', () => ({
  transcodeService: {
    getVideoInfo: vi.fn(),
    getImageInfo: vi.fn(),
    transcodeVideo: vi.fn(),
    createTempDir: vi.fn().mockReturnValue('/tmp'),
    removeDir: vi.fn(),
  },
}))

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    readFileSync: vi.fn().mockReturnValue(Buffer.from('fake data')),
  }
})

describe('Transcode Activities', () => {
  setupTestDbHooks()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call getVideoInfo for video assets', async () => {
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
  })

  it('should call getImageInfo for image assets', async () => {
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
})
