import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  transcodeService,
  calculatePreviewDimensions,
  getPlatformEncoderCandidates,
  getDefaultBitrate,
  getDefaultBitrateBps,
  calculateMaxBitrate,
  H264_ENCODER_CONFIGS,
} from './transcode'
import { s3Service } from '@shumai/core/src/s3/s3'
import * as path from 'path'
import * as child_process from 'child_process'
import { execFile } from 'child_process'
import * as fs from 'fs'
import { WorkflowTask } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import sharp from 'sharp'

vi.mock('@shumai/core/src/s3/s3', () => ({
  s3Service: {
    downloadToFile: vi.fn(),
    putObject: vi.fn(),
  },
}))

// Mock child_process
vi.mock('child_process', () => ({
  execFile: vi.fn(),
}))

// Mock sharp
vi.mock('sharp', () => {
  const mockSharp = {
    resize: vi.fn().mockReturnThis(),
    toColorspace: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    composite: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-webp-buffer')),
    toFile: vi.fn().mockImplementation(async (filePath: string) => {
      fs.writeFileSync(filePath, 'fake-webp-data')
      return {}
    }),
    metadata: vi.fn().mockResolvedValue({ width: 800, height: 600, format: 'png' }),
  }
  const sharpFunc = vi.fn(() => mockSharp)
  return {
    default: sharpFunc,
  }
})

describe('TranscodeService', () => {
  setupTestDbHooks()
  let tempDir: string

  beforeEach(() => {
    tempDir = transcodeService.createTempDir('transcode-test-')
    vi.clearAllMocks()
  })

  afterEach(() => {
    transcodeService.removeDir(tempDir)
  })

  it('should parse video info correctly from ffprobe output', async () => {
    /* eslint-disable @typescript-eslint/naming-convention */
    const mockOutput = JSON.stringify({
      format: { duration: '10.5', bit_rate: '128000' },
      streams: [
        {
          codec_type: 'video',
          codec_name: 'h264',
          width: 1920,
          height: 1080,
          r_frame_rate: '30/1',
          tags: {
            mime_codec_string: 'avc1.4d401e',
          },
        },
        {
          codec_type: 'audio',
          codec_name: 'aac',
          channels: 2,
          sample_rate: '48000',
          bits_per_raw_sample: '16',
          tags: {
            mime_codec_string: 'mp4a.40.2',
          },
        },
      ],
    })
    /* eslint-enable @typescript-eslint/naming-convention */

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(child_process.execFile as any).mockImplementation((file: string, args: string[], cb: any) => {
      cb(null, { stdout: mockOutput, stderr: '' })
    })

    const info = await transcodeService.getVideoInfo('test.mp4')

    expect(info.originalWidth).toBe(1920)
    expect(info.originalHeight).toBe(1080)
    expect(info.duration).toBe(10.5)
    expect(info.frameRate).toBe(30)
    expect(info.hasAudio).toBe(true)
    expect(info.videoCodec).toBe('Advanced Video Coding')
    expect(info.audioCodec).toBe('MPEG-4 Audio')
    expect(info.audioChannels).toBe(2)
    expect(info.audioSampleRate).toBe(48000)
    expect(info.audioBitDepth).toBe(16)

    expect(child_process.execFile).toHaveBeenCalledWith(
      'ffprobe',
      expect.any(Array),
      expect.any(Function),
    )
  })

  it('should extract videoBitRate from stream bit_rate or tags or fallback correctly', async () => {
    /* eslint-disable @typescript-eslint/naming-convention */
    // 1. Direct video stream bit_rate
    const output1 = JSON.stringify({
      format: { duration: '10', bit_rate: '2000000' },
      streams: [
        { codec_type: 'video', width: 1920, height: 1080, bit_rate: '1800000' },
        { codec_type: 'audio', bit_rate: '128000' },
      ],
    })
    vi.mocked(execFile).mockImplementation(
      (
        _cmd: unknown,
        _args: unknown,
        callback: unknown,
      ): ReturnType<typeof child_process.execFile> => {
        const cb = callback as (
          err: Error | null,
          result: { stdout: string; stderr: string },
        ) => void
        if (typeof cb === 'function') {
          cb(null, { stdout: output1, stderr: '' })
        }
        return {} as ReturnType<typeof child_process.execFile>
      },
    )
    const info1 = await transcodeService.getVideoInfo('test1.mp4')
    expect(info1.videoBitRate).toBe(1800000)

    // 2. Stream BPS tag
    const output2 = JSON.stringify({
      format: { duration: '10', bit_rate: '2000000' },
      streams: [
        { codec_type: 'video', width: 1920, height: 1080, tags: { BPS: '1500000' } },
        { codec_type: 'audio', bit_rate: '128000' },
      ],
    })
    vi.mocked(execFile).mockImplementation(
      (
        _cmd: unknown,
        _args: unknown,
        callback: unknown,
      ): ReturnType<typeof child_process.execFile> => {
        const cb = callback as (
          err: Error | null,
          result: { stdout: string; stderr: string },
        ) => void
        if (typeof cb === 'function') {
          cb(null, { stdout: output2, stderr: '' })
        }
        return {} as ReturnType<typeof child_process.execFile>
      },
    )
    const info2 = await transcodeService.getVideoInfo('test2.mp4')
    expect(info2.videoBitRate).toBe(1500000)

    // 3. Stream NUMBER_OF_BYTES tag
    const output3 = JSON.stringify({
      format: { duration: '10', bit_rate: '2000000' },
      streams: [
        { codec_type: 'video', width: 1920, height: 1080, tags: { NUMBER_OF_BYTES: '1000000' } },
        { codec_type: 'audio', bit_rate: '128000' },
      ],
    })
    vi.mocked(execFile).mockImplementation(
      (
        _cmd: unknown,
        _args: unknown,
        callback: unknown,
      ): ReturnType<typeof child_process.execFile> => {
        const cb = callback as (
          err: Error | null,
          result: { stdout: string; stderr: string },
        ) => void
        if (typeof cb === 'function') {
          cb(null, { stdout: output3, stderr: '' })
        }
        return {} as ReturnType<typeof child_process.execFile>
      },
    )
    const info3 = await transcodeService.getVideoInfo('test3.mp4')
    expect(info3.videoBitRate).toBe(800000) // (1,000,000 * 8) / 10 = 800,000

    // 4. Fallback totalBitrate - audioBitrate
    const output4 = JSON.stringify({
      format: { duration: '10', bit_rate: '1000000' },
      streams: [
        { codec_type: 'video', width: 1920, height: 1080 },
        { codec_type: 'audio', bit_rate: '128000' },
      ],
    })
    /* eslint-enable @typescript-eslint/naming-convention */
    vi.mocked(execFile).mockImplementation(
      (
        _cmd: unknown,
        _args: unknown,
        callback: unknown,
      ): ReturnType<typeof child_process.execFile> => {
        const cb = callback as (
          err: Error | null,
          result: { stdout: string; stderr: string },
        ) => void
        if (typeof cb === 'function') {
          cb(null, { stdout: output4, stderr: '' })
        }
        return {} as ReturnType<typeof child_process.execFile>
      },
    )
    const info4 = await transcodeService.getVideoInfo('test4.mp4')
    expect(info4.videoBitRate).toBe(872000) // 1,000,000 - 128,000 = 872,000
  })

  it('should get image info using sharp', async () => {
    const mockMetadata = {
      width: 800,
      height: 600,
      format: 'png',
    }
    const mockSharp = vi.mocked(sharp())
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockSharp.metadata.mockResolvedValue(mockMetadata as any)

    const info = await transcodeService.getImageInfo('test.png')

    expect(info.originalWidth).toBe(800)
    expect(info.originalHeight).toBe(600)
    expect(info.mimeType).toBe('png')
    expect(info.duration).toBe(0)
    expect(sharp).toHaveBeenCalledWith('test.png', { limitInputPixels: false })
  })

  it('should construct correct ffmpeg arguments for video transcoding', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(child_process.execFile as any).mockImplementation((file: string, args: string[], cb: any) => {
      cb(null, { stdout: '', stderr: '' })
    })

    const outputFile = path.join(tempDir, 'output.mp4')
    await transcodeService.transcodeVideo({
      inputFile: 'input.mp4',
      outputFile,
      width: 1280,
      height: 720,
      frameRate: 24,
      disableAudio: true,
    })

    expect(child_process.execFile).toHaveBeenCalledWith(
      'ffmpeg',
      expect.arrayContaining(['-filter_complex', expect.stringContaining('scale=w=1280:h=720')]),
      expect.any(Function),
    )
    expect(child_process.execFile).toHaveBeenCalledWith(
      'ffmpeg',
      expect.arrayContaining(['-filter_complex', expect.stringContaining('fps=24')]),
      expect.any(Function),
    )
    // Should NOT have audio maps if disabled
    expect(child_process.execFile).not.toHaveBeenCalledWith(
      'ffmpeg',
      expect.arrayContaining(['-map', '0:a?']),
      expect.any(Function),
    )
  })

  it('should handle rational fraction frame rate for video transcoding', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(child_process.execFile as any).mockImplementation((file: string, args: string[], cb: any) => {
      cb(null, { stdout: '', stderr: '' })
    })

    const outputFile = path.join(tempDir, 'output_rational.mp4')
    await transcodeService.transcodeVideo({
      inputFile: 'input.mp4',
      outputFile,
      width: 1280,
      height: 720,
      frameRate: '160000/142512',
      disableAudio: true,
    })

    expect(child_process.execFile).toHaveBeenCalledWith(
      'ffmpeg',
      expect.arrayContaining(['-filter_complex', expect.stringContaining('fps=160000/142512')]),
      expect.any(Function),
    )
  })

  it('should use sharp for image transcoding with sRGB conversion (production 300p spec)', async () => {
    const outputFile = path.join(tempDir, 'output.webp')
    await transcodeService.transcodeImage('input.png', outputFile, 300, 80, { isPreview: true })

    expect(sharp).toHaveBeenCalledWith('input.png', { limitInputPixels: false })
    const mockSharp = vi.mocked(sharp).mock.results[0].value
    expect(mockSharp.toColorspace).toHaveBeenCalledWith('srgb')
    expect(mockSharp.resize).toHaveBeenCalledWith(400, 300, expect.any(Object))
    expect(mockSharp.webp).toHaveBeenCalledWith({ quality: 80 })
    expect(mockSharp.toFile).toHaveBeenCalledWith(outputFile)
  })

  it('should support legacy 480 width fallback shim', async () => {
    const outputFile = path.join(tempDir, 'output_legacy.webp')
    await transcodeService.transcodeImage('input.png', outputFile, 480, 80)

    const mockSharp = vi.mocked(sharp).mock.results[vi.mocked(sharp).mock.results.length - 1].value
    expect(mockSharp.resize).toHaveBeenCalledWith(400, 300, expect.any(Object))
  })

  it('should handle preview and full-res proxy dimension calculations correctly', async () => {
    const outputFile = path.join(tempDir, 'out.webp')

    // 16:9 source (1920x1080) in preview mode -> 533x300
    const mockSharp169 = {
      resize: vi.fn().mockReturnThis(),
      toColorspace: vi.fn().mockReturnThis(),
      webp: vi.fn().mockReturnThis(),
      toFile: vi.fn().mockResolvedValue({}),
      metadata: vi.fn().mockResolvedValue({ width: 1920, height: 1080 }),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(sharp).mockReturnValueOnce(mockSharp169 as any)
    await transcodeService.transcodeImage('169.png', outputFile, 300, 80, { isPreview: true })
    expect(mockSharp169.resize).toHaveBeenCalledWith(533, 300, expect.any(Object))

    // Small image (200x150) in preview mode -> 200x150
    const mockSharpSmall = {
      resize: vi.fn().mockReturnThis(),
      toColorspace: vi.fn().mockReturnThis(),
      webp: vi.fn().mockReturnThis(),
      toFile: vi.fn().mockResolvedValue({}),
      metadata: vi.fn().mockResolvedValue({ width: 200, height: 150 }),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(sharp).mockReturnValueOnce(mockSharpSmall as any)
    await transcodeService.transcodeImage('small.png', outputFile, 300, 80, { isPreview: true })
    expect(mockSharpSmall.resize).toHaveBeenCalledWith(200, 150, expect.any(Object))

    // 1:10 Tall screenshot (1000x10000) in preview mode -> 53x533
    const mockSharpTall = {
      resize: vi.fn().mockReturnThis(),
      toColorspace: vi.fn().mockReturnThis(),
      webp: vi.fn().mockReturnThis(),
      toFile: vi.fn().mockResolvedValue({}),
      metadata: vi.fn().mockResolvedValue({ width: 1000, height: 10000 }),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(sharp).mockReturnValueOnce(mockSharpTall as any)
    await transcodeService.transcodeImage('tall.png', outputFile, 300, 80, { isPreview: true })
    expect(mockSharpTall.resize).toHaveBeenCalledWith(53, 533, expect.any(Object))

    // Square full-resolution proxy (10000x10000, isPreview: false) -> capped at WEBP_MAX_DIMENSION (7680)
    const mockSharpSquareProxy = {
      resize: vi.fn().mockReturnThis(),
      toColorspace: vi.fn().mockReturnThis(),
      webp: vi.fn().mockReturnThis(),
      toFile: vi.fn().mockResolvedValue({}),
      metadata: vi.fn().mockResolvedValue({ width: 10000, height: 10000 }),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(sharp).mockReturnValueOnce(mockSharpSquareProxy as any)
    await transcodeService.transcodeImage('square.png', outputFile, 10000, 90, {
      height: 10000,
      isPreview: false,
    })
    expect(mockSharpSquareProxy.resize).toHaveBeenCalledWith(7680, 7680, expect.any(Object))
  })

  it('should calculate preview dimensions correctly for 300p (short side 300, max long side 533)', () => {
    // 16:9 Landscape
    expect(calculatePreviewDimensions(1920, 1080)).toEqual({ width: 533, height: 300 })
    // 9:16 Portrait
    expect(calculatePreviewDimensions(1080, 1920)).toEqual({ width: 300, height: 533 })
    // 1:1 Square
    expect(calculatePreviewDimensions(1000, 1000)).toEqual({ width: 300, height: 300 })
    // 21:9 Ultrawide
    expect(calculatePreviewDimensions(2560, 1080)).toEqual({ width: 533, height: 225 })
    // 1:10 Tall screenshot (capped at max long side = 533)
    expect(calculatePreviewDimensions(1000, 10000)).toEqual({ width: 53, height: 533 })
    // Small image (no enlargement)
    expect(calculatePreviewDimensions(200, 150)).toEqual({ width: 200, height: 150 })
  })

  it('should use ImageMagick for PSD image transcoding', async () => {
    const outputFile = path.join(tempDir, 'output_psd.webp')
    const psdBuffer = Buffer.from('8BPS-fake-psd-content')
    await transcodeService.transcodeImage(psdBuffer, outputFile, 480, 80)

    expect(execFile).toHaveBeenCalledWith(
      'magick',
      expect.arrayContaining([
        '-colorspace',
        'sRGB',
        expect.stringContaining('[0]'),
        '-quality',
        '80',
      ]),
      expect.any(Function),
    )
  })

  it('should get PSD image info using ImageMagick identify', async () => {
    const mockExecFile = vi.mocked(execFile)
    mockExecFile.mockImplementation((cmd: unknown, args: unknown, callback: unknown) => {
      const cb = callback as (
        err: Error | null,
        result: { stdout: string; stderr: string },
        extra: string,
      ) => void
      const argsArr = args as string[] | undefined
      if (cmd === 'magick' && argsArr && argsArr[0] === 'identify') {
        cb(null, { stdout: '1920 1080\n', stderr: '' }, '')
      } else if (typeof cb === 'function') {
        cb(null, { stdout: '', stderr: '' }, '')
      }
      return {} as ReturnType<typeof execFile>
    })

    const psdPath = path.join(tempDir, 'sample.psd')
    fs.writeFileSync(psdPath, '8BPS-sample')

    const info = await transcodeService.getImageInfo(psdPath)
    expect(info.originalWidth).toBe(1920)
    expect(info.originalHeight).toBe(1080)
    expect(info.mimeType).toBe('psd')
  })

  it('should fetch image if input is a URL', async () => {
    const mockBuffer = Buffer.from('fake-image-data')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(mockBuffer),
    })

    const outputFile = path.join(tempDir, 'output.webp')
    await transcodeService.transcodeImage('http://example.com/image.png', outputFile, 480, 80)

    expect(global.fetch).toHaveBeenCalledWith('http://example.com/image.png')
    expect(sharp).toHaveBeenCalledWith(expect.any(Buffer), { limitInputPixels: false })
  })

  it('should support Buffer as input for image transcoding', async () => {
    const inputBuffer = Buffer.from('fake-buffer-image')
    const outputFile = path.join(tempDir, 'output-buffer.webp')
    await transcodeService.transcodeImage(inputBuffer, outputFile, 480, 80)

    expect(sharp).toHaveBeenCalledWith(inputBuffer, { limitInputPixels: false })
    const mockSharp = vi.mocked(sharp).mock.results[vi.mocked(sharp).mock.results.length - 1].value
    expect(mockSharp.toColorspace).toHaveBeenCalledWith('srgb')
    expect(mockSharp.resize).toHaveBeenCalledWith(400, 300, expect.any(Object))
    expect(mockSharp.webp).toHaveBeenCalledWith({ quality: 80 })
    expect(mockSharp.toFile).toHaveBeenCalledWith(outputFile)
  })

  it('should use transcodeImage in extractVideoFrames for images', async () => {
    const transcodeImageSpy = vi.spyOn(transcodeService, 'transcodeImage').mockResolvedValue()
    const result = await transcodeService.extractVideoFrames({
      inputFile: 'input.png',
      outputDir: tempDir,
      numFrames: 1,
      frameHeight: 720,
      isImage: true,
    })

    expect(transcodeImageSpy).toHaveBeenCalledWith(
      'input.png',
      expect.stringContaining('1.webp'),
      -1,
      80,
      720,
    )
    expect(result).toHaveLength(1)
    expect(result[0]).toContain('1.webp')
  })

  it('should use ffmpeg with libwebp in extractVideoFrames for videos', async () => {
    vi.spyOn(transcodeService, 'getVideoInfo').mockResolvedValue({
      duration: 10,
      originalWidth: 1920,
      originalHeight: 1080,
      bitRate: 1000,
      frameRate: 30,
      totalFrames: 300,
      hasAudio: true,
      mimeType: 'video/mp4',
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(child_process.execFile as any).mockImplementation((file: string, args: string[], cb: any) => {
      cb(null, { stdout: '', stderr: '' })
    })

    await transcodeService.extractVideoFrames({
      inputFile: 'input.mp4',
      outputDir: tempDir,
      numFrames: 10,
      frameHeight: 720,
      isImage: false,
    })

    expect(child_process.execFile).toHaveBeenCalledWith(
      'ffmpeg',
      expect.arrayContaining(['-c:v', 'libwebp']),
      expect.any(Function),
    )
  })

  it('should create transcode tasks correctly', async () => {
    const task = (await transcodeService.createVideoTranscodeTask('asset-123', 'proj-123', {
      videoStrategy: 'best_match',
      thumbnail: true,
    })) as WorkflowTask

    expect(task.assetId).toBe('asset-123')
    expect(task.type).toBe('transcode_video')
    expect(task.status).toBe('pending')
    expect(task.payload?.projectId).toBe('proj-123')
    expect(task.payload?.transcode?.videoStrategy).toBe('best_match')
  })

  it('should parse audio info correctly from ffprobe output', async () => {
    /* eslint-disable @typescript-eslint/naming-convention */
    const mockOutput = JSON.stringify({
      format: { duration: '120.4', bit_rate: '256000' },
      streams: [
        {
          codec_type: 'audio',
          codec_name: 'flac',
          channels: 6,
          sample_rate: '44100',
          bits_per_sample: '24',
          tags: {
            mime_codec_string: 'fLaC',
          },
        },
      ],
    })
    /* eslint-enable @typescript-eslint/naming-convention */

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(child_process.execFile as any).mockImplementation((file: string, args: string[], cb: any) => {
      cb(null, { stdout: mockOutput, stderr: '' })
    })

    const info = await transcodeService.getAudioInfo('test.flac')

    expect(info.originalWidth).toBe(0)
    expect(info.originalHeight).toBe(0)
    expect(info.duration).toBe(120.4)
    expect(info.frameRate).toBe(0)
    expect(info.hasAudio).toBe(true)
    expect(info.videoCodec).toBeUndefined()
    expect(info.audioCodec).toBe('Fres Lossless Audio Codec')
    expect(info.audioChannels).toBe(6)
    expect(info.audioSampleRate).toBe(44100)
    expect(info.audioBitDepth).toBe(24)

    expect(child_process.execFile).toHaveBeenCalledWith(
      'ffprobe',
      expect.any(Array),
      expect.any(Function),
    )
  })

  it('should construct correct ffmpeg arguments for audio transcoding', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(child_process.execFile as any).mockImplementation((file: string, args: string[], cb: any) => {
      cb(null, { stdout: '', stderr: '' })
    })

    await transcodeService.transcodeAudio({
      inputFile: 'input.wav',
      outputFile: 'output.mp4',
      bitrate: '128k',
    })

    expect(child_process.execFile).toHaveBeenCalledWith(
      'ffmpeg',
      [
        '-y',
        '-loglevel',
        'warning',
        '-i',
        'input.wav',
        '-vn',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-ac',
        '2',
        'output.mp4',
      ],
      expect.any(Function),
    )
  })

  it('should generate PDF sprite sheet and poster using pdftoppm, ffmpeg, and sharp', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(child_process.execFile as any).mockImplementation(
      (
        cmd: string,
        args: string[],
        cb: (err: Error | null, res: { stdout: string; stderr: string }) => void,
      ) => {
        if (cmd === 'pdftoppm') {
          // Create dummy page-1.png in temp directory (target output path prefix is args[args.length - 1])
          const pagePrefix = args[args.length - 1]
          const pagePath = `${pagePrefix}-1.png`
          fs.writeFileSync(pagePath, 'fake-png-data')
          cb(null, { stdout: '', stderr: '' })
        } else if (cmd === 'pdfinfo') {
          cb(null, { stdout: 'Title: Document\nPages: 15\nPage size: 612 x 792 pts', stderr: '' })
        } else if (cmd === 'ffmpeg') {
          cb(null, { stdout: '', stderr: '' })
        } else {
          cb(null, { stdout: '', stderr: '' })
        }
      },
    )

    const outputSprite = path.join(tempDir, 'sprite.webp')
    const outputPoster = path.join(tempDir, 'poster.webp')

    const result = await transcodeService.generatePdfSprite('input.pdf', outputSprite, outputPoster)

    expect(result.pageCount).toBe(15)
    expect(result.originalWidth).toBe(800)
    expect(result.originalHeight).toBe(600)

    expect(child_process.execFile).toHaveBeenCalledWith(
      'pdftoppm',
      expect.arrayContaining(['-png', '-f', '1', '-l', '100', 'input.pdf']),
      expect.any(Function),
    )
    expect(child_process.execFile).toHaveBeenCalledWith(
      'ffmpeg',
      expect.arrayContaining(['-filter_complex', 'scale=w=300:h=-2,tile=10x10']),
      expect.any(Function),
    )
    expect(child_process.execFile).toHaveBeenCalledWith(
      'pdfinfo',
      ['input.pdf'],
      expect.any(Function),
    )
  })

  it('should extract PDF info metadata using pdftoppm and pdfinfo', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(child_process.execFile as any).mockImplementation(
      (
        cmd: string,
        args: string[],
        cb: (err: Error | null, res: { stdout: string; stderr: string }) => void,
      ) => {
        if (cmd === 'pdftoppm') {
          const pagePrefix = args[args.length - 1]
          const pagePath = `${pagePrefix}-1.png`
          fs.writeFileSync(pagePath, 'fake-png-data')
          cb(null, { stdout: '', stderr: '' })
        } else if (cmd === 'pdfinfo') {
          cb(null, { stdout: 'Pages: 42\n', stderr: '' })
        } else {
          cb(null, { stdout: '', stderr: '' })
        }
      },
    )

    const info = await transcodeService.getPdfInfo('document.pdf')

    expect(info.mimeType).toBe('application/pdf')
    expect(info.totalFrames).toBe(42)
    expect(info.originalWidth).toBe(800)
    expect(info.originalHeight).toBe(600)
    expect(info.hasAudio).toBe(false)
  })

  it('should render PDF pages and upload to S3', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(child_process.execFile as any).mockImplementation(
      (
        cmd: string,
        args: string[],
        cb: (err: Error | null, res: { stdout: string; stderr: string }) => void,
      ) => {
        if (cmd === 'pdftoppm') {
          const pagePrefix = args[args.length - 1]
          const pagePath = `${pagePrefix}-1.png`
          fs.writeFileSync(pagePath, 'fake-png-data')
          cb(null, { stdout: '', stderr: '' })
        } else {
          cb(null, { stdout: '', stderr: '' })
        }
      },
    )

    vi.mocked(s3Service.downloadToFile).mockResolvedValue(undefined)
    vi.mocked(s3Service.putObject).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof s3Service.putObject>>,
    )

    const result = await transcodeService.renderPdfPages({
      assetKey: 'projects/p1/doc.pdf',
      assetId: 'asset-1',
      start: 1,
      end: 1,
    })

    expect(result.length).toBe(1)
    expect(result[0].page).toBe(1)
    expect(result[0].key).toContain('files/asset-1/pdf_pages/doc-page-1-')
    expect(s3Service.putObject).toHaveBeenCalled()
  })

  describe('overlayAnnotationsOnBuffer Pixel Tests', () => {
    it('should draw annotation overlay on a 100x200 image and mutate pixels', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const actualSharp = (await vi.importActual('sharp')) as any
      const realSharp = (actualSharp.default || actualSharp) as typeof sharp

      const inputBuffer = await realSharp({
        create: {
          width: 100,
          height: 200,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        },
      })
        .png()
        .toBuffer()

      const annotations: PrismaJson.AnnotationList = [
        {
          type: 'box',
          color: '#ff0000',
          points: [
            [0.2, 0.2],
            [0.8, 0.8],
          ],
        },
      ]

      const sharpSpy = vi
        .mocked(sharp)
        .mockImplementation((input: unknown, options?: unknown) =>
          realSharp(input as Parameters<typeof sharp>[0], options as Parameters<typeof sharp>[1]),
        )

      const outputBuffer = await transcodeService.overlayAnnotationsOnBuffer(
        inputBuffer,
        annotations,
      )
      sharpSpy.mockRestore()

      const { data, info } = await realSharp(outputBuffer)
        .raw()
        .toBuffer({ resolveWithObject: true })

      expect(info.width).toBe(100)
      expect(info.height).toBe(200)

      const pixelX = 50
      const pixelY = 40
      const offset = (pixelY * info.width + pixelX) * info.channels

      const r = data[offset]
      const g = data[offset + 1]
      const b = data[offset + 2]

      expect(r).toBeGreaterThan(150)
      expect(g).toBeLessThan(120)
      expect(b).toBeLessThan(120)
    })

    it('should draw annotation overlay on a 200x100 image and mutate pixels', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const actualSharp = (await vi.importActual('sharp')) as any
      const realSharp = (actualSharp.default || actualSharp) as typeof sharp

      const inputBuffer = await realSharp({
        create: {
          width: 200,
          height: 100,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        },
      })
        .png()
        .toBuffer()

      const annotations: PrismaJson.AnnotationList = [
        {
          type: 'box',
          color: '#00ff00',
          points: [
            [0.1, 0.1],
            [0.9, 0.9],
          ],
        },
      ]

      const sharpSpy = vi
        .mocked(sharp)
        .mockImplementation((input: unknown, options?: unknown) =>
          realSharp(input as Parameters<typeof sharp>[0], options as Parameters<typeof sharp>[1]),
        )

      const outputBuffer = await transcodeService.overlayAnnotationsOnBuffer(
        inputBuffer,
        annotations,
      )
      sharpSpy.mockRestore()

      const { data, info } = await realSharp(outputBuffer)
        .raw()
        .toBuffer({ resolveWithObject: true })

      expect(info.width).toBe(200)
      expect(info.height).toBe(100)

      const pixelX = 100
      const pixelY = 10
      const offset = (pixelY * info.width + pixelX) * info.channels

      const r = data[offset]
      const g = data[offset + 1]
      const b = data[offset + 2]

      expect(r).toBeLessThan(100)
      expect(g).toBeGreaterThan(200)
      expect(b).toBeLessThan(100)
    })

    it('should snap commentTimestamp and overlay annotations when start/end has rounding mismatch', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(child_process.execFile as any).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (file: string, args: string[], cb: any) => {
          if (file === 'ffmpeg') {
            const outPath = args[args.length - 1]
            fs.writeFileSync(outPath, 'fake-webp-image')
          }
          cb(null, { stdout: '', stderr: '' })
        },
      )

      const overlaySpy = vi
        .spyOn(transcodeService, 'overlayAnnotationsOnBuffer')
        .mockResolvedValue(Buffer.from('composited-buffer'))

      const annotations: PrismaJson.AnnotationList = [
        {
          type: 'box',
          color: '#ff0000',
          points: [
            [0.2, 0.2],
            [0.8, 0.8],
          ],
        },
      ]

      const results = await transcodeService.takeScreenshots({
        assetKey: 'test/video.mp4',
        assetId: 'asset-123',
        start: 4.57,
        end: 4.57,
        count: 1,
        commentTimestamp: 4.566666666666667,
        annotations,
      })

      expect(results).toHaveLength(1)
      expect(results[0].timestamp).toBe(4.566666666666667)
      expect(overlaySpy).toHaveBeenCalledWith(expect.any(Buffer), annotations)

      overlaySpy.mockRestore()
    })

    it('should overlay annotation on ONLY the single snapped frame in a multi-screenshot range', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(child_process.execFile as any).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (file: string, args: string[], cb: any) => {
          if (file === 'ffmpeg') {
            const outPath = args[args.length - 1]
            fs.writeFileSync(outPath, 'fake-webp-image')
          }
          cb(null, { stdout: '', stderr: '' })
        },
      )

      const overlaySpy = vi
        .spyOn(transcodeService, 'overlayAnnotationsOnBuffer')
        .mockResolvedValue(Buffer.from('composited-buffer'))

      const annotations: PrismaJson.AnnotationList = [
        {
          type: 'box',
          color: '#ff0000',
          points: [
            [0.2, 0.2],
            [0.8, 0.8],
          ],
        },
      ]

      const results = await transcodeService.takeScreenshots({
        assetKey: 'test/video.mp4',
        assetId: 'asset-123',
        start: 0,
        end: 1,
        count: 30,
        commentTimestamp: 0.566666666666667,
        annotations,
      })

      expect(results).toHaveLength(30)
      // Exactly 1 overlay call for the snapped timestamp out of 30 frames
      expect(overlaySpy).toHaveBeenCalledTimes(1)
      expect(overlaySpy).toHaveBeenCalledWith(expect.any(Buffer), annotations)

      overlaySpy.mockRestore()
    })

    it('should generate PDF from text file including CJK characters', async () => {
      const txtFile = path.join(tempDir, 'test.txt')
      const pdfFile = path.join(tempDir, 'output.pdf')
      fs.writeFileSync(txtFile, 'Hello World\n你好世界\nこんにちは世界\n안녕하세요世界')

      await transcodeService.generatePdfFromText(txtFile, pdfFile)

      expect(fs.existsSync(pdfFile)).toBe(true)
      const stat = fs.statSync(pdfFile)
      expect(stat.size).toBeGreaterThan(0)
    })

    it('should generate PDF from CSV file including CJK characters', async () => {
      const csvFile = path.join(tempDir, 'test.csv')
      const pdfFile = path.join(tempDir, 'output.pdf')
      fs.writeFileSync(
        csvFile,
        'Name,Age,Country\nHello World,25,USA\n你好世界,30,China\nこんにちは,28,Japan\n안녕하세요,22,Korea',
      )

      await transcodeService.generatePdfFromCsv(csvFile, pdfFile)

      expect(fs.existsSync(pdfFile)).toBe(true)
      const stat = fs.statSync(pdfFile)
      expect(stat.size).toBeGreaterThan(0)
    })

    describe('watermark overlay helpers', () => {
      it('renderSvgToPng should rasterize the SVG to a PNG buffer', async () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>WM</text></svg>'
        const result = await transcodeService.renderSvgToPng(svg)
        expect(Buffer.isBuffer(result)).toBe(true)
        // sharp was invoked with the SVG bytes
        expect(sharp).toHaveBeenCalledWith(Buffer.from(svg))
      })

      it('downscaleImageToPng should resize, normalize to PNG and return dimensions', async () => {
        const result = await transcodeService.downscaleImageToPng(Buffer.from('raw-image'), 1024)
        expect(result.buffer).toBeDefined()
        expect(result.width).toBe(800)
        expect(result.height).toBe(600)
        // resize limited to the max dimension without enlargement
        const resizeCall = vi.mocked(sharp().resize).mock.calls[0] as unknown[]
        expect(resizeCall[0]).toBe(1024)
        expect(resizeCall[1]).toBe(1024)
        expect(resizeCall[2]).toEqual({
          fit: 'inside',
          withoutEnlargement: true,
        })
        expect(vi.mocked(sharp().png)).toHaveBeenCalled()
      })

      it('compositeOverlayToWebpFile should composite the overlay and write a webp file', async () => {
        const inputPath = path.join(tempDir, 'input.png')
        const outputPath = path.join(tempDir, 'output.webp')
        fs.writeFileSync(inputPath, 'fake-input')

        await transcodeService.compositeOverlayToWebpFile(
          inputPath,
          Buffer.from('overlay-png'),
          outputPath,
          1920,
          1080,
        )

        expect(fs.existsSync(outputPath)).toBe(true)
        expect(vi.mocked(sharp().resize)).toHaveBeenCalledWith(1920, 1080, {
          fit: 'inside',
        })
        expect(vi.mocked(sharp().composite)).toHaveBeenCalledWith([
          { input: Buffer.from('overlay-png') },
        ])
        expect(vi.mocked(sharp().webp)).toHaveBeenCalledWith({ quality: 90 })
        expect(vi.mocked(sharp().toFile)).toHaveBeenCalledWith(outputPath)
      })
    })
  })

  describe('Hardware Acceleration & Encoder Resolution', () => {
    beforeEach(() => {
      transcodeService.clearEncodersCache()
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should return platform candidates correctly', () => {
      expect(getPlatformEncoderCandidates('darwin')).toEqual([
        'h264_videotoolbox',
        'h264_nvenc',
        'h264_qsv',
        'h264_amf',
      ])
      expect(getPlatformEncoderCandidates('win32')).toEqual(['h264_nvenc', 'h264_qsv', 'h264_amf'])
      expect(getPlatformEncoderCandidates('linux')).toEqual(['h264_nvenc', 'h264_qsv', 'h264_amf'])
    })

    it('should calculate default bitrates by resolution height and width correctly', () => {
      expect(getDefaultBitrateBps(2160, 3840)).toBe(12_000_000)
      expect(getDefaultBitrate(2160, 3840)).toBe('12000k')
      expect(getDefaultBitrate(1080, 1920)).toBe('4500k')
      expect(getDefaultBitrate(720, 1280)).toBe('2500k')
      expect(getDefaultBitrate(540, 960)).toBe('1200k')
      expect(getDefaultBitrate(360, 640)).toBe('800k')
      expect(getDefaultBitrate(180, 320)).toBe('100k')
      expect(getDefaultBitrate(100, 100)).toBe('100k')
    })

    it('calculateMaxBitrate should cap bitrate based on sourceVideoBitrate, ceiling, and targetFps', () => {
      // Default without source bitrate
      expect(calculateMaxBitrate(720, 1280)).toEqual({
        maxrate: '2500k',
        bufsize: '5000k',
      })

      // With low source bitrate (600k * 1.2 = 720k)
      expect(calculateMaxBitrate(720, 1280, 600_000)).toEqual({
        maxrate: '720k',
        bufsize: '1440k',
      })

      // With high source bitrate (3000k * 1.2 = 3600k, capped at 2500k)
      expect(calculateMaxBitrate(720, 1280, 3_000_000)).toEqual({
        maxrate: '2500k',
        bufsize: '5000k',
      })

      // With downsampled targetFps (180p preview @ 0.78 fps: 100k * (0.78/24) = 3.25k -> capped at min 50k)
      expect(calculateMaxBitrate(180, 320, 600_000, 0.78)).toEqual({
        maxrate: '50k',
        bufsize: '100k',
      })

      // With downsampled targetFps string (180p preview @ 24 fps)
      expect(calculateMaxBitrate(180, 320, 600_000, 24)).toEqual({
        maxrate: '100k',
        bufsize: '200k',
      })

      // With extremely low source bitrate without targetFps (50k * 1.2 = 60k, minimum floor 100k)
      expect(calculateMaxBitrate(720, 1280, 50_000)).toEqual({
        maxrate: '100k',
        bufsize: '200k',
      })
    })

    it('selectH264Encoder should return libx264 when hardwareAcceleration is off', async () => {
      const encoder = await transcodeService.selectH264Encoder('off')
      expect(encoder).toEqual(H264_ENCODER_CONFIGS.libx264)
      expect(child_process.execFile).not.toHaveBeenCalledWith(
        'ffmpeg',
        ['-encoders'],
        expect.any(Function),
      )
    })

    it('selectH264Encoder should select h264_videotoolbox on darwin when available', async () => {
      const mockEncodersOutput = `
 V....D libx264              libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10
 V....D h264_videotoolbox    VideoToolbox H.264 Encoder
      `
      vi.mocked(execFile).mockImplementation(
        (
          _cmd: unknown,
          args: unknown,
          callback: unknown,
        ): ReturnType<typeof child_process.execFile> => {
          const cb = callback as (
            err: Error | null,
            result: { stdout: string; stderr: string },
          ) => void
          const argsArr = args as string[] | undefined
          if (argsArr && argsArr[0] === '-encoders') {
            cb(null, { stdout: mockEncodersOutput, stderr: '' })
          } else if (typeof cb === 'function') {
            cb(null, { stdout: '', stderr: '' })
          }
          return {} as ReturnType<typeof child_process.execFile>
        },
      )

      const encoder = await transcodeService.selectH264Encoder('auto', 'darwin')
      expect(encoder.name).toBe('h264_videotoolbox')
      expect(encoder.presetArgs).toEqual(['-q:v', '74'])
    })

    it('selectH264Encoder should select h264_nvenc on linux when available', async () => {
      const mockEncodersOutput = `
 V....D libx264              libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10
 V....D h264_nvenc           NVIDIA NVENC H.264 encoder
 V....D h264_qsv             Intel Quick Sync Video H.264
      `
      vi.mocked(execFile).mockImplementation(
        (
          _cmd: unknown,
          args: unknown,
          callback: unknown,
        ): ReturnType<typeof child_process.execFile> => {
          const cb = callback as (
            err: Error | null,
            result: { stdout: string; stderr: string },
          ) => void
          const argsArr = args as string[] | undefined
          if (argsArr && argsArr[0] === '-encoders') {
            cb(null, { stdout: mockEncodersOutput, stderr: '' })
          } else if (typeof cb === 'function') {
            cb(null, { stdout: '', stderr: '' })
          }
          return {} as ReturnType<typeof child_process.execFile>
        },
      )

      const encoder = await transcodeService.selectH264Encoder('auto', 'linux')
      expect(encoder.name).toBe('h264_nvenc')
      expect(encoder.presetArgs).toEqual([
        '-preset',
        'p4',
        '-rc:v',
        'vbr',
        '-cq:v',
        '26',
        '-b:v',
        '0',
      ])
    })

    it('selectH264Encoder should select h264_qsv on linux when nvenc is not available', async () => {
      const mockEncodersOutput = `
 V....D libx264              libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10
 V....D h264_qsv             Intel Quick Sync Video H.264
      `
      vi.mocked(execFile).mockImplementation(
        (
          _cmd: unknown,
          args: unknown,
          callback: unknown,
        ): ReturnType<typeof child_process.execFile> => {
          const cb = callback as (
            err: Error | null,
            result: { stdout: string; stderr: string },
          ) => void
          const argsArr = args as string[] | undefined
          if (argsArr && argsArr[0] === '-encoders') {
            cb(null, { stdout: mockEncodersOutput, stderr: '' })
          } else if (typeof cb === 'function') {
            cb(null, { stdout: '', stderr: '' })
          }
          return {} as ReturnType<typeof child_process.execFile>
        },
      )

      const encoder = await transcodeService.selectH264Encoder('auto', 'linux')
      expect(encoder.name).toBe('h264_qsv')
      expect(encoder.presetArgs).toEqual(['-preset', 'fast', '-global_quality', '26'])
    })

    it('selectH264Encoder should select h264_amf on win32 when available', async () => {
      const mockEncodersOutput = `
 V....D libx264              libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10
 V....D h264_amf             AMD AMF H.264 Encoder
      `
      vi.mocked(execFile).mockImplementation(
        (
          _cmd: unknown,
          args: unknown,
          callback: unknown,
        ): ReturnType<typeof child_process.execFile> => {
          const cb = callback as (
            err: Error | null,
            result: { stdout: string; stderr: string },
          ) => void
          const argsArr = args as string[] | undefined
          if (argsArr && argsArr[0] === '-encoders') {
            cb(null, { stdout: mockEncodersOutput, stderr: '' })
          } else if (typeof cb === 'function') {
            cb(null, { stdout: '', stderr: '' })
          }
          return {} as ReturnType<typeof child_process.execFile>
        },
      )

      const encoder = await transcodeService.selectH264Encoder('auto', 'win32')
      expect(encoder.name).toBe('h264_amf')
      expect(encoder.presetArgs).toEqual([
        '-quality',
        'balanced',
        '-rc',
        'qvbr',
        '-qvbr_quality_level',
        '26',
      ])
    })

    it('selectH264Encoder should fallback to libx264 when no hw encoder is in ffmpeg build', async () => {
      const mockEncodersOutput = `
 V....D libx264              libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10
      `
      vi.mocked(execFile).mockImplementation(
        (
          _cmd: unknown,
          args: unknown,
          callback: unknown,
        ): ReturnType<typeof child_process.execFile> => {
          const cb = callback as (
            err: Error | null,
            result: { stdout: string; stderr: string },
          ) => void
          const argsArr = args as string[] | undefined
          if (argsArr && argsArr[0] === '-encoders') {
            cb(null, { stdout: mockEncodersOutput, stderr: '' })
          } else if (typeof cb === 'function') {
            cb(null, { stdout: '', stderr: '' })
          }
          return {} as ReturnType<typeof child_process.execFile>
        },
      )

      const encoder = await transcodeService.selectH264Encoder('auto', 'linux')
      expect(encoder.name).toBe('libx264')
      expect(encoder.presetArgs).toEqual(['-preset', 'fast', '-crf', '26'])
    })

    it('transcodeVideo with hardwareAcceleration off should use libx264, preset fast, crf 26, maxrate, and yuv420p', async () => {
      vi.mocked(execFile).mockImplementation(
        (
          _cmd: unknown,
          _args: unknown,
          callback: unknown,
        ): ReturnType<typeof child_process.execFile> => {
          const cb = callback as (
            err: Error | null,
            result: { stdout: string; stderr: string },
          ) => void
          if (typeof cb === 'function') {
            cb(null, { stdout: '', stderr: '' })
          }
          return {} as ReturnType<typeof child_process.execFile>
        },
      )

      const outputFile = path.join(tempDir, 'out_off.mp4')
      await transcodeService.transcodeVideo({
        inputFile: 'input.mp4',
        outputFile,
        width: 1280,
        height: 720,
        hardwareAcceleration: 'off',
        sourceVideoBitrate: 600_000,
      })

      expect(child_process.execFile).toHaveBeenCalledWith(
        'ffmpeg',
        expect.arrayContaining([
          '-c:v',
          'libx264',
          '-preset',
          'fast',
          '-crf',
          '26',
          '-maxrate',
          '720k',
          '-bufsize',
          '1440k',
          '-pix_fmt',
          'yuv420p',
        ]),
        expect.any(Function),
      )
    })

    it('transcodeVideo with hardwareAcceleration auto and videotoolbox should use -q:v 74 and -maxrate', async () => {
      vi.spyOn(transcodeService, 'selectH264Encoder').mockResolvedValue(
        H264_ENCODER_CONFIGS.h264_videotoolbox,
      )

      vi.mocked(execFile).mockImplementation(
        (
          _cmd: unknown,
          _args: unknown,
          callback: unknown,
        ): ReturnType<typeof child_process.execFile> => {
          const cb = callback as (
            err: Error | null,
            result: { stdout: string; stderr: string },
          ) => void
          if (typeof cb === 'function') {
            cb(null, { stdout: '', stderr: '' })
          }
          return {} as ReturnType<typeof child_process.execFile>
        },
      )

      const outputFile = path.join(tempDir, 'out_vt.mp4')
      await transcodeService.transcodeVideo({
        inputFile: 'input.mp4',
        outputFile,
        width: 1280,
        height: 720,
        hardwareAcceleration: 'auto',
        sourceVideoBitrate: 600_000,
      })

      expect(child_process.execFile).toHaveBeenCalledWith(
        'ffmpeg',
        expect.arrayContaining([
          '-c:v',
          'h264_videotoolbox',
          '-q:v',
          '74',
          '-maxrate',
          '720k',
          '-bufsize',
          '1440k',
          '-pix_fmt',
          'yuv420p',
        ]),
        expect.any(Function),
      )
    })

    it('transcodeVideo with hardwareAcceleration auto and nvenc should use -preset p4, -rc:v vbr, -cq:v 26, -b:v 0, and -maxrate', async () => {
      vi.spyOn(transcodeService, 'selectH264Encoder').mockResolvedValue(
        H264_ENCODER_CONFIGS.h264_nvenc,
      )

      vi.mocked(execFile).mockImplementation(
        (
          _cmd: unknown,
          _args: unknown,
          callback: unknown,
        ): ReturnType<typeof child_process.execFile> => {
          const cb = callback as (
            err: Error | null,
            result: { stdout: string; stderr: string },
          ) => void
          if (typeof cb === 'function') {
            cb(null, { stdout: '', stderr: '' })
          }
          return {} as ReturnType<typeof child_process.execFile>
        },
      )

      const outputFile = path.join(tempDir, 'out_nvenc.mp4')
      await transcodeService.transcodeVideo({
        inputFile: 'input.mp4',
        outputFile,
        width: 1920,
        height: 1080,
        hardwareAcceleration: 'auto',
        sourceVideoBitrate: 1_000_000,
      })

      expect(child_process.execFile).toHaveBeenCalledWith(
        'ffmpeg',
        expect.arrayContaining([
          '-c:v',
          'h264_nvenc',
          '-preset',
          'p4',
          '-rc:v',
          'vbr',
          '-cq:v',
          '26',
          '-b:v',
          '0',
          '-maxrate',
          '1200k',
          '-bufsize',
          '2400k',
          '-pix_fmt',
          'yuv420p',
        ]),
        expect.any(Function),
      )
    })

    it('transcodeVideo with hardwareAcceleration auto and amf should use -quality balanced, -rc qvbr, -qvbr_quality_level 26, and -maxrate', async () => {
      vi.spyOn(transcodeService, 'selectH264Encoder').mockResolvedValue(
        H264_ENCODER_CONFIGS.h264_amf,
      )

      vi.mocked(execFile).mockImplementation(
        (
          _cmd: unknown,
          _args: unknown,
          callback: unknown,
        ): ReturnType<typeof child_process.execFile> => {
          const cb = callback as (
            err: Error | null,
            result: { stdout: string; stderr: string },
          ) => void
          if (typeof cb === 'function') {
            cb(null, { stdout: '', stderr: '' })
          }
          return {} as ReturnType<typeof child_process.execFile>
        },
      )

      const outputFile = path.join(tempDir, 'out_amf.mp4')
      await transcodeService.transcodeVideo({
        inputFile: 'input.mp4',
        outputFile,
        width: 1280,
        height: 720,
        hardwareAcceleration: 'auto',
        sourceVideoBitrate: 600_000,
      })

      expect(child_process.execFile).toHaveBeenCalledWith(
        'ffmpeg',
        expect.arrayContaining([
          '-c:v',
          'h264_amf',
          '-quality',
          'balanced',
          '-rc',
          'qvbr',
          '-qvbr_quality_level',
          '26',
          '-maxrate',
          '720k',
          '-bufsize',
          '1440k',
          '-pix_fmt',
          'yuv420p',
        ]),
        expect.any(Function),
      )
    })

    it('transcodeVideo with explicit videoBitrate should use -b:v directly', async () => {
      vi.mocked(execFile).mockImplementation(
        (
          _cmd: unknown,
          _args: unknown,
          callback: unknown,
        ): ReturnType<typeof child_process.execFile> => {
          const cb = callback as (
            err: Error | null,
            result: { stdout: string; stderr: string },
          ) => void
          if (typeof cb === 'function') {
            cb(null, { stdout: '', stderr: '' })
          }
          return {} as ReturnType<typeof child_process.execFile>
        },
      )

      const outputFile = path.join(tempDir, 'out_explicit.mp4')
      await transcodeService.transcodeVideo({
        inputFile: 'input.mp4',
        outputFile,
        width: 1280,
        height: 720,
        hardwareAcceleration: 'off',
        videoBitrate: '1500k',
      })

      expect(child_process.execFile).toHaveBeenCalledWith(
        'ffmpeg',
        expect.arrayContaining([
          '-c:v',
          'libx264',
          '-preset',
          'fast',
          '-crf',
          '26',
          '-b:v',
          '1500k',
          '-pix_fmt',
          'yuv420p',
        ]),
        expect.any(Function),
      )
      expect(child_process.execFile).not.toHaveBeenCalledWith(
        'ffmpeg',
        expect.arrayContaining(['-maxrate']),
        expect.any(Function),
      )
    })
  })
})
