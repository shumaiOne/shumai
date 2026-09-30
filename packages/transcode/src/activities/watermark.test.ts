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

vi.mock('@shumai/core/src/transcode/transcode', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shumai/core/src/transcode/transcode')>()
  return {
    ...actual,
    transcodeService: {
      ...actual.transcodeService,
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
      transcodeHlsRendition: vi.fn().mockImplementation(async (params) => {
        fs.mkdirSync(params.outputDir, { recursive: true })
        fs.writeFileSync(path.join(params.outputDir, 'init.mp4'), 'fake-init')
        fs.writeFileSync(path.join(params.outputDir, 'segment_000.m4s'), 'fake-segment')
        fs.writeFileSync(path.join(params.outputDir, 'index.m3u8'), 'fake-index')
      }),
    },
  }
})

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

    async function seedAsset(
      name: string,
      mediaType: string,
      key: string,
      proxyType: string,
      projectId?: string,
    ) {
      const storageKey = await prisma.storageKey.create({ data: { key } })
      return prisma.asset.create({
        data: {
          name,
          type: 'file',
          mediaType,
          status: 'processed',
          projectId,
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
      expect(transcodeService.transcodeVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          hardwareAcceleration: 'off',
          sourceVideoBitrate: 1000,
        }),
      )

      fs.rmSync(outFilePath, { force: true })
    })

    it('passes team hardwareAcceleration and videoBitRate to transcodeVideo', async () => {
      const team = await prisma.team.create({
        data: {
          name: 'HW Accel Team',
          settings: {
            transcode: {
              videoStrategy: 'best_match',
              hardwareAcceleration: 'auto',
              threads: 6,
            },
          },
        },
      })
      const project = await prisma.project.create({
        data: {
          name: 'HW Accel Project',
          teamId: team.id,
        },
      })

      const assetKey = 'files/e2e-wm/video-hw.mp4'
      const asset = await seedAsset('video-hw.mp4', 'video/mp4', assetKey, 'video', project.id)
      const config = await seedConfig()

      vi.mocked(transcodeService.getVideoInfo).mockResolvedValue({
        originalWidth: 1280,
        originalHeight: 720,
        duration: 15,
        bitRate: 2000000,
        videoBitRate: 1800000,
        frameRate: 24,
        totalFrames: 360,
        startTimecode: '00:00:00:00',
        hasAudio: false,
        mimeType: 'video/mp4',
      })
      vi.mocked(s3Service.putObject).mockResolvedValue(undefined as never)

      const stem = 'video-hw'
      const configId = config.id
      const outFilePath = path.join('/tmp', `${stem}-watermark-${configId}-100p.mp4`)
      fs.writeFileSync(outFilePath, Buffer.from('fake mp4'))

      const media = await transcodeWatermarkMediaActivity({
        assetId: asset.id,
        watermarkConfigId: config.id,
      })

      expect(media.proxyType).toBe('video')
      expect(media.metadata?.bitRate).toBe(2000000)
      expect(transcodeService.transcodeVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          hardwareAcceleration: 'auto',
          sourceVideoBitrate: 1800000,
          disableAudio: true,
          threads: 6,
        }),
      )

      fs.rmSync(outFilePath, { force: true })
    })

    it('mirrors both SDR and HDR videoTranscodes preserving HDR flags and -hdr suffix', async () => {
      const assetKey = 'files/hdr-wm/video.mp4'
      const storageKey = await prisma.storageKey.create({ data: { key: assetKey } })
      const asset = await prisma.asset.create({
        data: {
          name: 'video.mp4',
          type: 'file',
          status: 'processed',
          storageKeyId: storageKey.id,
          mediaType: 'video/mp4',
          media: {
            duration: 10,
            filesize: 0,
            frames: 300,
            proxyType: 'video',
            imageTranscodes: [],
            videoPreview: { width: 1920, height: 1080 },
            finishedAt: new Date().toISOString(),
            original: {
              key: assetKey,
              filesizeInBytes: 0,
              codec: '',
            },
            metadata: {
              originalWidth: 1920,
              originalHeight: 1080,
              duration: 10,
              bitRate: 1000,
              frameRate: 30,
              totalFrames: 300,
              startTimecode: '00:00:00:00',
              hasAudio: true,
              format: {},
              isHdr: true,
              hdrType: 'pq',
              colorTransfer: 'smpte2084',
            },
            videoTranscodes: [
              {
                key: 'files/hdr-wm/video-1080p.mp4',
                resolution: '1080p',
                width: 1920,
                height: 1080,
                hdr: false,
              },
              {
                key: 'files/hdr-wm/video-1080p-hdr.mp4',
                resolution: '1080p',
                width: 1920,
                height: 1080,
                hdr: true,
              },
            ],
          } as PrismaJson.MediaInfo,
        },
      })
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
        isHdr: true,
        hdrType: 'pq',
        colorTransfer: 'smpte2084',
      })
      vi.mocked(s3Service.putObject).mockResolvedValue(undefined as never)

      const sdrOut = path.join('/tmp', `video-watermark-${config.id}-1080p.mp4`)
      const hdrOut = path.join('/tmp', `video-watermark-${config.id}-1080p-hdr.mp4`)
      fs.writeFileSync(sdrOut, Buffer.from('fake sdr'))
      fs.writeFileSync(hdrOut, Buffer.from('fake hdr'))

      const media = await transcodeWatermarkMediaActivity({
        assetId: asset.id,
        watermarkConfigId: config.id,
      })

      expect(media.videoTranscodes).toHaveLength(2)
      expect(media.videoTranscodes?.[0]).toEqual(
        expect.objectContaining({
          resolution: '1080p',
          hdr: false,
          key: expect.stringContaining(`video-watermark-${config.id}-1080p.mp4`),
        }),
      )
      expect(media.videoTranscodes?.[1]).toEqual(
        expect.objectContaining({
          resolution: '1080p',
          hdr: true,
          key: expect.stringContaining(`video-watermark-${config.id}-1080p-hdr.mp4`),
        }),
      )

      expect(transcodeService.transcodeVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          outputFile: sdrOut,
          hdr: false,
          sourceIsHdr: true,
        }),
      )
      expect(transcodeService.transcodeVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          outputFile: hdrOut,
          hdr: true,
          sourceIsHdr: true,
        }),
      )

      fs.rmSync(sdrOut, { force: true })
      fs.rmSync(hdrOut, { force: true })
    })

    it('produces watermarked HLS renditions and updates mediaInfo.hls when original is HLS', async () => {
      const originalMedia: PrismaJson.MediaInfo = {
        proxyType: 'video',
        duration: 10,
        filesize: 1000,
        frames: 300,
        videoTranscodes: [
          { key: 'files/asset/video-1080p.mp4', width: 1920, height: 1080, resolution: '1080p' },
        ],
        imageTranscodes: [],
        videoPreview: { width: 1920, height: 1080 },
        metadata: {
          originalWidth: 1920,
          originalHeight: 1080,
          duration: 10,
          frameRate: 30,
          totalFrames: 300,
          startTimecode: '00:00:00:00',
          hasAudio: false,
          format: {},
          bitRate: 1000,
        },
        original: { key: 'files/asset/raw.mp4', filesizeInBytes: 1000, codec: 'h264' },
        finishedAt: new Date().toISOString(),
        isHls: true,
        hls: {
          key: 'files/asset/hls/master.m3u8',
          resolutions: [{ resolution: '1080p', width: 1920, height: 1080 }],
        },
      }

      const storageKey = await prisma.storageKey.create({
        data: { key: 'files/asset/raw.mp4' },
      })
      const asset = await prisma.asset.create({
        data: {
          name: 'wm-hls.mp4',
          type: 'file',
          status: 'processed',
          storageKeyId: storageKey.id,
          mediaType: 'video/mp4',
          media: originalMedia,
        },
      })
      const config = await prisma.watermarkConfig.create({
        data: {
          hash: 'hls-hash-' + Math.random(),
          config: {
            blocks: [
              {
                id: 'b1',
                type: 'text',
                text: 'HLS Confidential',
                opacity: 0.5,
                size: 0.05,
                color: '#FFFFFF',
                x: 0.5,
                y: 0.5,
                rotation: 0,
              },
            ],
          },
        },
      })

      const media = await transcodeWatermarkMediaActivity({
        assetId: asset.id,
        watermarkConfigId: config.id,
      })

      expect(media.isHls).toBe(true)
      expect(media.hls).toBeDefined()
      expect(media.hls?.key).toContain(`hls-watermark-${config.id}/master.m3u8`)
      expect(media.hls?.resolutions).toHaveLength(1)
      expect(media.hls?.resolutions?.[0]?.resolution).toBe('1080p')
      expect(transcodeService.transcodeHlsRendition).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 1920,
          height: 1080,
        }),
      )
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
