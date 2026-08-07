import { prisma, WatermarkFileStatus } from '@shumai/db'
import '@shumai/db/src/prisma-json-types'
import { setupTestDbHooks } from '@shumai/db/test'
import { s3Service } from '@shumai/core/src/s3/s3'
import { transcodeService } from '@shumai/core/src/transcode/transcode'
import {
  initWatermarkFileActivity,
  waitForWatermarkFileActivity,
  transcodeWatermarkMediaActivity,
  completeWatermarkFileActivity,
} from './watermark'
import * as fs from 'fs'
import * as path from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('child_process', () => ({
  execFile: vi.fn(
    (_cmd: string, args: string[], cb: (err: unknown, stdout: string, stderr: string) => void) => {
      const outFile = args[args.length - 1]
      if (outFile && typeof outFile === 'string') {
        try {
          fs.writeFileSync(outFile, 'fake-transcoded-output')
        } catch {
          // ignore directory creation errors in mock
        }
      }
      cb(null, '', '')
    },
  ),
}))

vi.mock('@shumai/core/src/s3/s3', () => ({
  s3Service: {
    getObject: vi.fn(),
    putObject: vi.fn(),
    presign: vi.fn(),
    downloadToFile: vi.fn().mockImplementation(async (_b, _k, dest) => {
      fs.writeFileSync(dest, 'fake-raw')
    }),
    downloadMediaToTmp: vi.fn().mockImplementation(async () => ({
      filePath: '/tmp/raw-file',
      tmpDir: '/tmp',
    })),
    deleteObject: vi.fn(),
  },
}))

vi.mock('@shumai/core/src/transcode/transcode', () => ({
  transcodeService: {
    getVideoInfo: vi.fn(),
    getImageInfo: vi.fn(),
    createTempDir: vi.fn().mockReturnValue('/tmp'),
    removeDir: vi.fn(),
    renderSvgToPng: vi.fn().mockResolvedValue(Buffer.from('fake-overlay-png')),
    downscaleImageToPng: vi.fn().mockResolvedValue({
      buffer: Buffer.from('fake-block-png'),
      width: 32,
      height: 32,
    }),
    compositeOverlayToWebpFile: vi.fn().mockImplementation(async (_in, _overlay, out) => {
      fs.writeFileSync(out, 'fake-webp')
    }),
    transcodeVideo: vi.fn().mockImplementation(async (params) => {
      fs.writeFileSync(params.outputFile, 'fake-mp4')
    }),
  },
}))

describe('Watermark Activities', () => {
  setupTestDbHooks()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initWatermarkFileActivity', () => {
    async function seedAssetAndConfig() {
      const asset = await prisma.asset.create({
        data: { name: 'wm-target.png', type: 'file', status: 'processed' },
      })
      const config = await prisma.watermarkConfig.create({
        data: {
          hash: 'init-hash-' + Math.random(),
          config: { blocks: [] },
        },
      })
      return { asset, config }
    }

    it('creates a processing row when none exists', async () => {
      const { asset, config } = await seedAssetAndConfig()
      const res = await initWatermarkFileActivity({
        assetId: asset.id,
        watermarkConfigId: config.id,
      })
      expect(res.action).toBe('created')
      const row = await prisma.watermarkFile.findUnique({
        where: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          assetId_watermarkConfigId: {
            assetId: asset.id,
            watermarkConfigId: config.id,
          },
        },
      })
      expect(row?.status).toBe(WatermarkFileStatus.processing)
    })

    it('returns completed action when a completed watermark file exists', async () => {
      const { asset, config } = await seedAssetAndConfig()
      await prisma.watermarkFile.create({
        data: {
          assetId: asset.id,
          watermarkConfigId: config.id,
          status: WatermarkFileStatus.completed,
        },
      })
      const res = await initWatermarkFileActivity({
        assetId: asset.id,
        watermarkConfigId: config.id,
      })
      expect(res.action).toBe('completed')
    })

    it('returns processing action when a processing row exists', async () => {
      const { asset, config } = await seedAssetAndConfig()
      await prisma.watermarkFile.create({
        data: {
          assetId: asset.id,
          watermarkConfigId: config.id,
          status: WatermarkFileStatus.processing,
        },
      })
      const res = await initWatermarkFileActivity({
        assetId: asset.id,
        watermarkConfigId: config.id,
      })
      expect(res.action).toBe('processing')
    })

    it('returns failed action when a failed row exists', async () => {
      const { asset, config } = await seedAssetAndConfig()
      await prisma.watermarkFile.create({
        data: {
          assetId: asset.id,
          watermarkConfigId: config.id,
          status: WatermarkFileStatus.failed,
        },
      })
      const res = await initWatermarkFileActivity({
        assetId: asset.id,
        watermarkConfigId: config.id,
      })
      expect(res.action).toBe('failed')
    })

    it('waits for watermark file completion in waitForWatermarkFileActivity', async () => {
      const { asset, config } = await seedAssetAndConfig()
      const wf = await prisma.watermarkFile.create({
        data: {
          assetId: asset.id,
          watermarkConfigId: config.id,
          status: WatermarkFileStatus.processing,
        },
      })

      setTimeout(async () => {
        await prisma.watermarkFile.update({
          where: { id: wf.id },
          data: { status: WatermarkFileStatus.completed },
        })
      }, 50)

      const res = await waitForWatermarkFileActivity({
        assetId: asset.id,
        watermarkConfigId: config.id,
      })
      expect(res.status).toBe(WatermarkFileStatus.completed)
    })
  })

  describe('transcodeWatermarkMediaActivity', () => {
    const bucket = process.env.S3_BUCKET || 'shumai'

    async function seedAsset(name: string, mediaType: string, key: string, proxyType: string) {
      const storageKey = await prisma.storageKey.create({ data: { key } })
      return prisma.asset.create({
        data: {
          name,
          type: 'file',
          mediaType,
          status: 'processed',
          storageKeyId: storageKey.id,
          media: {
            duration: 0,
            filesize: 0,
            frames: 0,
            proxyType,
            videoTranscodes: [{ key, width: 100, height: 100, resolution: '100p' }],
            imageTranscodes: [{ key, width: 100, height: 100, quality: 90, format: 'webp' }],
            videoPreview: { width: 100, height: 100 },
            finishedAt: new Date().toISOString(),
            metadata: {
              originalWidth: 100,
              originalHeight: 100,
              duration: 0,
              bitRate: 0,
              frameRate: 0,
              totalFrames: 0,
              startTimecode: '00:00:00:00',
              hasAudio: false,
              format: {},
            },
            original: {
              key,
              filesizeInBytes: 0,
              codec: '',
            },
          } as PrismaJson.MediaInfo,
        },
      })
    }

    async function seedConfig() {
      return prisma.watermarkConfig.create({
        data: {
          config: {
            blocks: [
              {
                id: 'b1',
                type: 'text',
                x: 0.5,
                y: 0.5,
                opacity: 0.5,
                rotation: 0,
                text: 'TEST WM',
                size: 0.2,
                color: '#FF0000',
              },
            ],
          },
          hash: 'test-hash-' + Math.random(),
        },
      })
    }

    it('produces a watermarked webp proxy for an image asset', async () => {
      const assetKey = 'files/e2e-wm/test.png'
      const asset = await seedAsset('test.png', 'image/png', assetKey, 'image')
      const config = await seedConfig()

      vi.mocked(transcodeService.getImageInfo).mockResolvedValue({
        originalWidth: 100,
        originalHeight: 100,
        duration: 0,
        bitRate: 0,
        frameRate: 0,
        totalFrames: 0,
        hasAudio: false,
        mimeType: 'image/png',
      })
      vi.mocked(s3Service.putObject).mockResolvedValue(undefined as never)

      // compositeOverlayToWebpFile is mocked, but the activity stats the output
      // file afterwards, so pre-create it at the expected path.
      const outFileName = `test-watermark-${config.id}-100x100.webp`
      const outFilePath = path.join('/tmp', outFileName)
      fs.writeFileSync(outFilePath, Buffer.from('fake webp'))

      const media = await transcodeWatermarkMediaActivity({
        assetId: asset.id,
        watermarkConfigId: config.id,
      })

      expect(media.proxyType).toBe('image')
      expect(media.imageTranscodes?.length).toBeGreaterThan(0)
      expect(media.imageTranscodes?.[0].key).toContain('watermark-')
      expect(transcodeService.renderSvgToPng).toHaveBeenCalled()
      expect(transcodeService.compositeOverlayToWebpFile).toHaveBeenCalledWith(
        expect.stringContaining('test.png'),
        Buffer.from('fake-overlay-png'),
        outFilePath,
        100,
        100,
      )
      expect(s3Service.putObject).toHaveBeenCalledWith(
        bucket,
        expect.stringContaining('watermark-'),
        expect.anything(),
        expect.any(Number),
        'image/webp',
      )

      fs.rmSync(outFilePath, { force: true })
    })

    it('skips the raw (isRaw) video transcode when generating watermark proxies', async () => {
      const assetKey = 'files/e2e-wm/raw-video.mp4'
      const asset = await seedAsset('raw-video.mp4', 'video/mp4', assetKey, 'video')
      const config = await seedConfig()

      // Simulate the media state produced by transcodeVideoWorkflow: a
      // transcoded proxy plus a raw marker entry pointing at the original file.
      await prisma.asset.update({
        where: { id: asset.id },
        data: {
          media: {
            ...(asset.media as PrismaJson.MediaInfo),
            videoTranscodes: [
              { key: assetKey, width: 100, height: 100, resolution: '100p' },
              { key: assetKey, width: 1920, height: 1080, isRaw: true },
            ],
          },
        },
      })

      vi.mocked(transcodeService.getVideoInfo).mockResolvedValue({
        originalWidth: 1920,
        originalHeight: 1080,
        duration: 10,
        bitRate: 1000,
        frameRate: 30,
        totalFrames: 300,
        startTimecode: '00:00:00:00',
        hasAudio: true,
        mimeType: 'video/mp4',
      })
      vi.mocked(s3Service.putObject).mockResolvedValue(undefined as never)

      // The ffmpeg execFile call is mocked, but the activity stats the output
      // file afterwards, so pre-create both expected output paths.
      const stem = 'raw-video'
      const configId = config.id
      const proxyOutFilePath = path.join('/tmp', `${stem}-watermark-${configId}-100p.mp4`)
      const rawOutFilePath = path.join('/tmp', `${stem}-watermark-${configId}-1080p.mp4`)
      fs.writeFileSync(proxyOutFilePath, Buffer.from('fake mp4'))
      fs.writeFileSync(rawOutFilePath, Buffer.from('fake mp4'))

      try {
        const media = await transcodeWatermarkMediaActivity({
          assetId: asset.id,
          watermarkConfigId: config.id,
        })

        expect(media.proxyType).toBe('video')
        // Only the transcoded proxy should be watermarked, never the raw original.
        expect(transcodeService.transcodeVideo).toHaveBeenCalledTimes(1)
        expect(media.videoTranscodes).toHaveLength(1)
        expect(media.videoTranscodes?.[0].resolution).toBe('100p')
        expect(media.videoTranscodes?.[0].key).toContain('watermark-')
      } finally {
        fs.rmSync(proxyOutFilePath, { force: true })
        fs.rmSync(rawOutFilePath, { force: true })
      }
    })

    it('produces a watermarked mp4 proxy for a video asset (ffmpeg path)', async () => {
      const assetKey = 'files/e2e-wm/video.mp4'
      const asset = await seedAsset('video.mp4', 'video/mp4', assetKey, 'video')
      const config = await seedConfig()

      vi.mocked(transcodeService.getVideoInfo).mockResolvedValue({
        originalWidth: 1920,
        originalHeight: 1080,
        duration: 10,
        bitRate: 1000,
        frameRate: 30,
        totalFrames: 300,
        startTimecode: '00:00:00:00',
        hasAudio: true,
        mimeType: 'video/mp4',
      })
      vi.mocked(s3Service.putObject).mockResolvedValue(undefined as never)

      // The ffmpeg execFile call is mocked, but the activity stats the output
      // file afterwards, so pre-create it at the expected path.
      const stem = 'video'
      const configId = config.id
      const outFilePath = path.join('/tmp', `${stem}-watermark-${configId}-100p.mp4`)
      fs.writeFileSync(outFilePath, Buffer.from('fake mp4'))

      const media = await transcodeWatermarkMediaActivity({
        assetId: asset.id,
        watermarkConfigId: config.id,
      })

      expect(media.proxyType).toBe('video')
      expect(media.videoTranscodes?.length).toBeGreaterThan(0)
      expect(media.videoTranscodes?.[0].key).toContain('watermark-')
      expect(s3Service.putObject).toHaveBeenCalledWith(
        bucket,
        expect.stringContaining('watermark-'),
        expect.anything(),
        expect.any(Number),
        'video/mp4',
      )

      fs.rmSync(outFilePath, { force: true })
    })
  })

  describe('completeWatermarkFileActivity', () => {
    it('upserts a completed watermark file with media', async () => {
      const asset = await prisma.asset.create({
        data: { name: 'wm-complete.png', type: 'file', status: 'processed' },
      })
      const config = await prisma.watermarkConfig.create({
        data: {
          hash: 'complete-hash-' + Math.random(),
          config: { blocks: [] },
        },
      })
      const media: PrismaJson.MediaInfo = {
        duration: 0,
        filesize: 0,
        frames: 0,
        proxyType: 'image',
        imageTranscodes: [
          { key: 'files/x/out.webp', width: 100, height: 100, quality: 90, format: 'webp' },
        ],
        videoTranscodes: [],
        videoPreview: { width: 100, height: 100 },
        finishedAt: new Date().toISOString(),
        metadata: {
          originalWidth: 100,
          originalHeight: 100,
          duration: 0,
          bitRate: 0,
          frameRate: 0,
          totalFrames: 0,
          startTimecode: '00:00:00:00',
          hasAudio: false,
          format: {},
        },
        original: {
          key: 'files/x/original.png',
          filesizeInBytes: 0,
          codec: '',
        },
      }

      await completeWatermarkFileActivity({
        assetId: asset.id,
        watermarkConfigId: config.id,
        mediaInfo: media,
        status: WatermarkFileStatus.completed,
      })

      const row = await prisma.watermarkFile.findUnique({
        where: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          assetId_watermarkConfigId: {
            assetId: asset.id,
            watermarkConfigId: config.id,
          },
        },
      })
      expect(row?.status).toBe(WatermarkFileStatus.completed)
      expect(row?.media).toBeDefined()
    })
  })
})
