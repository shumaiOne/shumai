import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  transcodeService,
  calculatePreviewDimensions,
  getPlatformEncoderCandidates,
  getDefaultBitrate,
  getDefaultBitrateBps,
  calculateMaxBitrate,
  H264_ENCODER_CONFIGS,
  isHwDecodeEnabled,
  getHwDecodeStallTimeoutMs,
  HW_DECODE_CONFIGS,
  buildSdrToneMapFilterChain,
  getDriDevice,
  getVaapiDevice,
  parseBitrateKbps,
  buildHlsMasterPlaylist,
  rewriteM3u8WithPresignedUrls,
  compareStreams,
  selectPrimaryVideoStream,
  selectPrimaryAudioStream,
} from './transcode'
import { logger } from '@shumai/core/src/logger'
import { s3Service } from '@shumai/core/src/s3/s3'
import * as path from 'path'
import * as child_process from 'child_process'
import { execFile } from 'child_process'
import * as fs from 'fs'
import { WorkflowTask } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import sharp from 'sharp'
import * as rawExtract from './raw-extract'

vi.mock('@shumai/core/src/s3/s3', () => ({
  s3Service: {
    downloadToFile: vi.fn(),
    putObject: vi.fn(),
    resolveInput: vi.fn().mockImplementation(async (_bucket, key) => `http://mock-storage/${key}`),
    presign: vi
      .fn()
      .mockImplementation(async (_bucket, key) => `https://presigned.example.com/${key}`),
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
    rotate: vi.fn().mockReturnThis(),
    flip: vi.fn().mockReturnThis(),
    flop: vi.fn().mockReturnThis(),
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

  it('should extract embedded preview for RAW image in getImageInfo', async () => {
    const rawPath = path.join(tempDir, 'photo.cr2')
    const cleanupSpy = vi.fn()
    vi.spyOn(rawExtract, 'extractAndValidateRawPreview').mockResolvedValueOnce({
      previewPath: '/tmp/preview.jpg',
      cleanup: cleanupSpy,
      width: 6000,
      height: 4000,
      orientation: 1,
    })

    const info = await transcodeService.getImageInfo(rawPath)
    expect(info.originalWidth).toBe(6000)
    expect(info.originalHeight).toBe(4000)
    expect(info.mimeType).toBe('jpeg')
    expect(cleanupSpy).toHaveBeenCalled()
  })

  it('should swap dimensions in getImageInfo when RAW orientation is portrait (orientation 6)', async () => {
    const rawPath = path.join(tempDir, 'portrait.dng')
    const cleanupSpy = vi.fn()
    vi.spyOn(rawExtract, 'extractAndValidateRawPreview').mockResolvedValueOnce({
      previewPath: '/tmp/preview.jpg',
      cleanup: cleanupSpy,
      width: 6000,
      height: 4000,
      orientation: 6,
    })

    const info = await transcodeService.getImageInfo(rawPath)
    expect(info.originalWidth).toBe(4000)
    expect(info.originalHeight).toBe(6000)
    expect(info.mimeType).toBe('jpeg')
    expect(cleanupSpy).toHaveBeenCalled()
  })

  it('should return zero dimensions in getImageInfo when RAW has no usable preview', async () => {
    const rawPath = path.join(tempDir, 'nopreview.arw')
    vi.spyOn(rawExtract, 'extractAndValidateRawPreview').mockResolvedValueOnce(null)

    const info = await transcodeService.getImageInfo(rawPath)
    expect(info.originalWidth).toBe(0)
    expect(info.originalHeight).toBe(0)
    expect(info.mimeType).toBe('')
  })

  it('should prioritize rawWidth and rawHeight in getImageInfo when available', async () => {
    const rawPath = path.join(tempDir, 'highres.arw')
    const cleanupSpy = vi.fn()
    vi.spyOn(rawExtract, 'extractAndValidateRawPreview').mockResolvedValueOnce({
      previewPath: '/tmp/decoded-half.tiff',
      cleanup: cleanupSpy,
      width: 4752,
      height: 3168,
      rawWidth: 9504,
      rawHeight: 6336,
      orientation: undefined,
    })

    const info = await transcodeService.getImageInfo(rawPath)
    expect(info.originalWidth).toBe(9504)
    expect(info.originalHeight).toBe(6336)
    expect(info.mimeType).toBe('jpeg')
    expect(cleanupSpy).toHaveBeenCalled()
  })

  it('should transcode RAW image by extracting preview to temp file and feeding to sharp', async () => {
    const rawPath = path.join(tempDir, 'sample.nef')
    const outputFile = path.join(tempDir, 'output-raw.webp')
    const cleanupSpy = vi.fn()
    vi.spyOn(rawExtract, 'extractAndValidateRawPreview').mockResolvedValueOnce({
      previewPath: '/tmp/extracted-raw.jpg',
      cleanup: cleanupSpy,
      width: 3000,
      height: 2000,
      orientation: 1,
    })

    await transcodeService.transcodeImage(rawPath, outputFile, 1920, 85)

    expect(sharp).toHaveBeenCalledWith('/tmp/extracted-raw.jpg', { limitInputPixels: false })
    const mockSharp = vi.mocked(sharp).mock.results[vi.mocked(sharp).mock.results.length - 1].value
    expect(mockSharp.toColorspace).toHaveBeenCalledWith('srgb')
    expect(mockSharp.webp).toHaveBeenCalledWith({ quality: 85 })
    expect(mockSharp.toFile).toHaveBeenCalledWith(outputFile)
    expect(cleanupSpy).toHaveBeenCalled()
  })

  it('should transcode RAW image from dcraw_emu fallback TIFF without double-rotating', async () => {
    const rawPath = path.join(tempDir, 'fallback.dng')
    const outputFile = path.join(tempDir, 'output-fallback.webp')
    const cleanupSpy = vi.fn()
    vi.spyOn(rawExtract, 'extractAndValidateRawPreview').mockResolvedValueOnce({
      previewPath: '/tmp/decoded-dcraw.tiff',
      cleanup: cleanupSpy,
      width: 3168,
      height: 4752,
      rawWidth: 6336,
      rawHeight: 9504,
      orientation: undefined,
    })

    await transcodeService.transcodeImage(rawPath, outputFile, 1920, 85)

    expect(sharp).toHaveBeenCalledWith('/tmp/decoded-dcraw.tiff', { limitInputPixels: false })
    const mockSharp = vi.mocked(sharp).mock.results[vi.mocked(sharp).mock.results.length - 1].value
    expect(mockSharp.rotate).not.toHaveBeenCalled()
    expect(mockSharp.toColorspace).toHaveBeenCalledWith('srgb')
    expect(mockSharp.webp).toHaveBeenCalledWith({ quality: 85 })
    expect(mockSharp.toFile).toHaveBeenCalledWith(outputFile)
    expect(cleanupSpy).toHaveBeenCalled()
  })

  it('should apply orientation rotation when transcoding RAW image', async () => {
    const rawPath = path.join(tempDir, 'rotated.cr3')
    const outputFile = path.join(tempDir, 'output-rotated.webp')
    const cleanupSpy = vi.fn()
    vi.spyOn(rawExtract, 'extractAndValidateRawPreview').mockResolvedValueOnce({
      previewPath: '/tmp/extracted-rotated.jpg',
      cleanup: cleanupSpy,
      width: 4000,
      height: 3000,
      orientation: 6, // 90° CW
    })

    await transcodeService.transcodeImage(rawPath, outputFile, 1920, 85)

    const mockSharp = vi.mocked(sharp).mock.results[vi.mocked(sharp).mock.results.length - 1].value
    expect(mockSharp.rotate).toHaveBeenCalledWith(90)
    expect(cleanupSpy).toHaveBeenCalled()
  })

  it('should throw error when transcoding RAW without usable preview', async () => {
    const rawPath = path.join(tempDir, 'corrupt.raf')
    const outputFile = path.join(tempDir, 'output-fail.webp')
    vi.spyOn(rawExtract, 'extractAndValidateRawPreview').mockResolvedValueOnce(null)

    await expect(transcodeService.transcodeImage(rawPath, outputFile, 1920, 85)).rejects.toThrow(
      'Cannot generate preview for RAW file',
    )
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
        '-map',
        '0:a:0?',
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

  it('transcodeAudio should pass -threads when threads > 0', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(child_process.execFile as any).mockImplementation((file: string, args: string[], cb: any) => {
      cb(null, { stdout: '', stderr: '' })
    })

    await transcodeService.transcodeAudio({
      inputFile: 'input.wav',
      outputFile: 'output.mp4',
      bitrate: '128k',
      threads: 4,
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
        '-map',
        '0:a:0?',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-ac',
        '2',
        '-threads',
        '4',
        'output.mp4',
      ],
      expect.any(Function),
    )
  })

  it('transcodeAudio should omit -threads when threads is 0', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(child_process.execFile as any).mockImplementation((file: string, args: string[], cb: any) => {
      cb(null, { stdout: '', stderr: '' })
    })

    await transcodeService.transcodeAudio({
      inputFile: 'input.wav',
      outputFile: 'output.mp4',
      bitrate: '128k',
      threads: 0,
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
        '-map',
        '0:a:0?',
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
    expect(result[0].key).toContain('projects/p1/pdf_pages/doc-page-1-')
    expect(s3Service.putObject).toHaveBeenCalledWith(
      'shumai',
      result[0].key,
      expect.any(Buffer),
      expect.any(Number),
      'image/webp',
    )
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

    it('should use resolveInput and avoid downloadToFile when taking screenshots', async () => {
      vi.mocked(s3Service.downloadToFile).mockClear()
      vi.mocked(s3Service.resolveInput).mockClear()
      vi.mocked(s3Service.resolveInput).mockResolvedValue('https://mock-r2.com/video.mp4')

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

      const results = await transcodeService.takeScreenshots({
        assetKey: 'test/video.mp4',
        assetId: 'asset-123',
        start: 0,
        end: 10,
        count: 5,
      })

      expect(results).toHaveLength(5)
      expect(s3Service.resolveInput).toHaveBeenCalledWith('shumai', 'test/video.mp4')
      expect(s3Service.downloadToFile).not.toHaveBeenCalled()
      expect(child_process.execFile).toHaveBeenCalledWith(
        'ffmpeg',
        expect.arrayContaining(['-i', 'https://mock-r2.com/video.mp4', '-reconnect', '1']),
        expect.any(Function),
      )
    })

    it('should save screenshots in the same storage directory as assetKey', async () => {
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

      const results = await transcodeService.takeScreenshots({
        assetKey: 'files/storage-ulid-abc/video.mp4',
        assetId: 'asset-db-id-xyz',
        start: 0,
        end: 0,
        count: 1,
      })

      expect(results).toHaveLength(1)
      expect(results[0].key).toMatch(/^files\/storage-ulid-abc\/screenshots\/shot-.*\.webp$/)
      expect(s3Service.putObject).toHaveBeenCalledWith(
        'shumai',
        results[0].key,
        expect.any(Buffer),
        expect.any(Number),
        'image/webp',
      )
    })

    it('should save overlay annotations in the same storage directory as assetKey', async () => {
      vi.mocked(s3Service.downloadToFile).mockImplementation(async (_bucket, _key, filePath) => {
        // Create a dummy image file
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const actualSharp = (await vi.importActual('sharp')) as any
        const realSharp = (actualSharp.default || actualSharp) as typeof sharp
        await realSharp({
          create: {
            width: 100,
            height: 100,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 1 },
          },
        })
          .webp()
          .toFile(filePath)
      })

      const key = await transcodeService.overlayAnnotations({
        assetKey: 'files/storage-ulid-img/photo.webp',
        assetId: 'asset-db-id-xyz',
        annotations: [
          {
            type: 'box',
            color: '#ff0000',
            points: [
              [0.1, 0.1],
              [0.5, 0.5],
            ],
          },
        ],
      })

      expect(key).toMatch(/^files\/storage-ulid-img\/annotations\/annotation-.*\.webp$/)
      expect(s3Service.putObject).toHaveBeenCalledWith(
        'shumai',
        key,
        expect.any(Buffer),
        expect.any(Number),
        'image/webp',
      )
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
    let origHwDecode: string | undefined

    beforeEach(() => {
      transcodeService.clearEncodersCache()
      // These tests cover the software-decode VAAPI path; the GPU decode path
      // (on by default) is covered in 'Hardware decode' below.
      origHwDecode = process.env.SHUMAI_HW_DECODE
      process.env.SHUMAI_HW_DECODE = 'false'
    })

    afterEach(() => {
      vi.restoreAllMocks()
      if (origHwDecode === undefined) delete process.env.SHUMAI_HW_DECODE
      else process.env.SHUMAI_HW_DECODE = origHwDecode
    })

    it('should return platform candidates correctly', () => {
      expect(getPlatformEncoderCandidates('darwin')).toEqual([
        'h264_videotoolbox',
        'h264_nvenc',
        'h264_qsv',
        'h264_amf',
      ])
      expect(getPlatformEncoderCandidates('win32')).toEqual(['h264_nvenc', 'h264_qsv', 'h264_amf'])
      expect(getPlatformEncoderCandidates('linux')).toEqual([
        'h264_nvenc',
        'h264_vaapi',
        'h264_qsv',
        'h264_rkmpp',
        'h264_amf',
      ])
    })

    it('getDriDevice should return device from SHUMAI_HW_DEVICE, SHUMAI_VAAPI_DEVICE, or VAAPI_DEVICE env var', () => {
      const origHw = process.env.SHUMAI_HW_DEVICE
      const origShumai = process.env.SHUMAI_VAAPI_DEVICE
      const origVaapi = process.env.VAAPI_DEVICE
      try {
        process.env.SHUMAI_HW_DEVICE = '/dev/dri/custom0'
        expect(getDriDevice()).toBe('/dev/dri/custom0')
        delete process.env.SHUMAI_HW_DEVICE

        process.env.SHUMAI_VAAPI_DEVICE = '/dev/dri/custom1'
        expect(getDriDevice()).toBe('/dev/dri/custom1')
        expect(getVaapiDevice()).toBe('/dev/dri/custom1')
        delete process.env.SHUMAI_VAAPI_DEVICE

        process.env.VAAPI_DEVICE = '/dev/dri/custom2'
        expect(getDriDevice()).toBe('/dev/dri/custom2')
        expect(getVaapiDevice()).toBe('/dev/dri/custom2')
      } finally {
        if (origHw) process.env.SHUMAI_HW_DEVICE = origHw
        else delete process.env.SHUMAI_HW_DEVICE
        if (origShumai) process.env.SHUMAI_VAAPI_DEVICE = origShumai
        else delete process.env.SHUMAI_VAAPI_DEVICE
        if (origVaapi) process.env.VAAPI_DEVICE = origVaapi
        else delete process.env.VAAPI_DEVICE
      }
    })

    it('getVaapiDevice should pick highest index render node from driDir', () => {
      const fakeDriDir = path.join(tempDir, 'fake-dri')
      fs.mkdirSync(fakeDriDir, { recursive: true })
      fs.writeFileSync(path.join(fakeDriDir, 'card0'), '')
      fs.writeFileSync(path.join(fakeDriDir, 'renderD128'), '')
      fs.writeFileSync(path.join(fakeDriDir, 'renderD129'), '')

      expect(getVaapiDevice(fakeDriDir)).toBe(path.join(fakeDriDir, 'renderD129'))
    })

    it('getVaapiDevice should return null if driDir does not exist or has no render/card devices', () => {
      expect(getVaapiDevice(path.join(tempDir, 'non-existent'))).toBeNull()

      const emptyDir = path.join(tempDir, 'empty-dri')
      fs.mkdirSync(emptyDir, { recursive: true })
      expect(getVaapiDevice(emptyDir)).toBeNull()
    })

    it('parseBitrateKbps should parse number and various string bitrate units', () => {
      expect(parseBitrateKbps(2_500_000)).toBe(2500)
      expect(parseBitrateKbps('4500k')).toBe(4500)
      expect(parseBitrateKbps('4500kbps')).toBe(4500)
      expect(parseBitrateKbps('12M')).toBe(12000)
      expect(parseBitrateKbps('1.5Mbps')).toBe(1500)
      expect(parseBitrateKbps('invalid')).toBe(2500)
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
      expect(encoder.presetArgs).toEqual([])
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

    it('selectH264Encoder should select h264_vaapi before h264_qsv on linux when both are available', async () => {
      const mockEncodersOutput = `
 V....D libx264              libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10
 V....D h264_qsv             Intel Quick Sync Video H.264
 V....D h264_vaapi           H.264/AVC (VAAPI)
      `
      vi.spyOn(transcodeService, 'getVaapiDevice').mockReturnValue('/dev/dri/renderD128')
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
      expect(encoder.name).toBe('h264_vaapi')
      expect(encoder.presetArgs).toEqual(['-compression_level', '4'])
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
      expect(encoder.presetArgs).toEqual(['-preset', 'fast', '-crf', '23', '-bf', '0'])
    })

    it('selectH264Encoder should select h264_vaapi on linux when available and dri device exists', async () => {
      const mockEncodersOutput = `
 V....D libx264              libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10
 V....D h264_vaapi           H.264/AVC (VAAPI)
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
      vi.spyOn(transcodeService, 'getVaapiDevice').mockReturnValue('/dev/dri/renderD128')

      const encoder = await transcodeService.selectH264Encoder('auto', 'linux')
      expect(encoder.name).toBe('h264_vaapi')
      expect(encoder.presetArgs).toEqual(['-compression_level', '4'])
    })

    it('selectH264Encoder should skip h264_vaapi on linux when vaapi device is not found', async () => {
      const mockEncodersOutput = `
 V....D libx264              libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10
 V....D h264_vaapi           H.264/AVC (VAAPI)
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
      vi.spyOn(transcodeService, 'getVaapiDevice').mockReturnValue(null)

      const encoder = await transcodeService.selectH264Encoder('auto', 'linux')
      expect(encoder.name).toBe('h264_amf')
    })

    it('selectH264Encoder should skip h264_nvenc and fallback to libx264 when nvenc fails usability probe', async () => {
      const mockEncodersOutput = `
 V....D libx264              libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10
 V....D h264_nvenc           NVIDIA NVENC H.264 encoder
      `
      vi.mocked(execFile).mockImplementation(
        (
          _cmd: unknown,
          args: unknown,
          callback: unknown,
        ): ReturnType<typeof child_process.execFile> => {
          const cb = callback as (
            err: Error | null,
            result?: { stdout: string; stderr: string },
          ) => void
          const argsArr = args as string[] | undefined
          if (argsArr && argsArr[0] === '-encoders') {
            cb(null, { stdout: mockEncodersOutput, stderr: '' })
          } else if (argsArr && argsArr.includes('h264_nvenc')) {
            cb(new Error('Cannot load libcuda.so.1'))
          } else if (typeof cb === 'function') {
            cb(null, { stdout: '', stderr: '' })
          }
          return {} as ReturnType<typeof child_process.execFile>
        },
      )

      const encoder = await transcodeService.selectH264Encoder('auto', 'linux')
      expect(encoder.name).toBe('libx264')
    })

    it('isEncoderUsable should return true and cache result when probe succeeds', async () => {
      const execFileMock = vi
        .mocked(execFile)
        .mockImplementation(
          (
            _cmd: unknown,
            _args: unknown,
            callback: unknown,
          ): ReturnType<typeof child_process.execFile> => {
            const cb = callback as (
              err: Error | null,
              result?: { stdout: string; stderr: string },
            ) => void
            if (typeof cb === 'function') {
              cb(null, { stdout: '', stderr: '' })
            }
            return {} as ReturnType<typeof child_process.execFile>
          },
        )

      const result1 = await transcodeService.isEncoderUsable('h264_nvenc')
      expect(result1).toBe(true)
      expect(execFileMock).toHaveBeenCalledTimes(1)

      // Subsequent call should hit cache and not call execFile again
      const result2 = await transcodeService.isEncoderUsable('h264_nvenc')
      expect(result2).toBe(true)
      expect(execFileMock).toHaveBeenCalledTimes(1)
    })

    it('isEncoderUsable should return false and cache result when probe fails', async () => {
      const execFileMock = vi
        .mocked(execFile)
        .mockImplementation(
          (
            _cmd: unknown,
            _args: unknown,
            callback: unknown,
          ): ReturnType<typeof child_process.execFile> => {
            const cb = callback as (
              err: Error | null,
              result?: { stdout: string; stderr: string },
            ) => void
            if (typeof cb === 'function') {
              cb(new Error('Driver init failed'))
            }
            return {} as ReturnType<typeof child_process.execFile>
          },
        )

      const result1 = await transcodeService.isEncoderUsable('h264_qsv')
      expect(result1).toBe(false)
      expect(execFileMock).toHaveBeenCalledTimes(1)

      // Cached call
      const result2 = await transcodeService.isEncoderUsable('h264_qsv')
      expect(result2).toBe(false)
      expect(execFileMock).toHaveBeenCalledTimes(1)
    })

    it('isEncoderUsable should return false for h264_vaapi when getVaapiDevice returns null without running ffmpeg', async () => {
      vi.spyOn(transcodeService, 'getVaapiDevice').mockReturnValue(null)
      const execFileMock = vi.mocked(execFile)

      const result = await transcodeService.isEncoderUsable('h264_vaapi')
      expect(result).toBe(false)
      expect(execFileMock).not.toHaveBeenCalled()
    })

    it('isEncoderUsable should probe vaapi with hw device options when vaapi device exists', async () => {
      vi.spyOn(transcodeService, 'getVaapiDevice').mockReturnValue('/dev/dri/renderD128')
      let probeArgs: string[] = []
      vi.mocked(execFile).mockImplementation(
        (
          _cmd: unknown,
          args: unknown,
          callback: unknown,
        ): ReturnType<typeof child_process.execFile> => {
          probeArgs = (args as string[]) || []
          const cb = callback as (
            err: Error | null,
            result?: { stdout: string; stderr: string },
          ) => void
          if (typeof cb === 'function') {
            cb(null, { stdout: '', stderr: '' })
          }
          return {} as ReturnType<typeof child_process.execFile>
        },
      )

      const result = await transcodeService.isEncoderUsable('h264_vaapi')
      expect(result).toBe(true)
      expect(probeArgs).toContain('-init_hw_device')
      expect(probeArgs).toContain('vaapi=accel:/dev/dri/renderD128')
      expect(probeArgs).toContain('h264_vaapi')
    })

    it('transcodeVideo with hardwareAcceleration off should use libx264, preset fast, crf 23, -bf 0, maxrate, and yuv420p', async () => {
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
          '23',
          '-bf',
          '0',
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

    it('transcodeVideo with hardwareAcceleration auto and videotoolbox should use -b:v and no maxrate', async () => {
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
          '-b:v',
          '720k',
          '-pix_fmt',
          'yuv420p',
        ]),
        expect.any(Function),
      )
      const callArgs = vi.mocked(child_process.execFile).mock.calls[0][1] as string[]
      expect(callArgs).not.toContain('-maxrate')
      expect(callArgs).not.toContain('-bufsize')
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
          '23',
          '-bf',
          '0',
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

    it('transcodeVideo with hardwareAcceleration auto and vaapi should use init_hw_device, hwupload, rc_mode 3, and omit pix_fmt yuv420p', async () => {
      vi.spyOn(transcodeService, 'selectH264Encoder').mockResolvedValue(
        H264_ENCODER_CONFIGS.h264_vaapi,
      )
      vi.spyOn(transcodeService, 'getVaapiDevice').mockReturnValue('/dev/dri/renderD128')
      const loggerSpy = vi.spyOn(logger, 'info')

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

      const outputFile = path.join(tempDir, 'out_vaapi.mp4')
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
          '-init_hw_device',
          'vaapi=accel:/dev/dri/renderD128',
          '-filter_hw_device',
          'accel',
          '-c:v',
          'h264_vaapi',
          '-compression_level',
          '4',
          '-rc_mode',
          '3',
          '-b:v',
          '497k',
          '-maxrate',
          '720k',
          '-minrate',
          '249k',
        ]),
        expect.any(Function),
      )

      const callArgs = vi.mocked(child_process.execFile).mock.calls[0][1] as string[]
      expect(callArgs).not.toContain('-pix_fmt')
      expect(callArgs).not.toContain('yuv420p')

      const filterComplexIdx = callArgs.indexOf('-filter_complex')
      expect(filterComplexIdx).toBeGreaterThan(-1)
      expect(callArgs[filterComplexIdx + 1]).toContain('format=nv12,hwupload=extra_hw_frames=64')

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          encoder: 'h264_vaapi',
          hardwareAcceleration: 'auto',
          vaapiDevice: '/dev/dri/renderD128',
        }),
        'Starting video transcoding',
      )
    })

    it('transcodeVideo with explicit videoBitrate and vaapi calculates VBR distribution correctly', async () => {
      vi.spyOn(transcodeService, 'selectH264Encoder').mockResolvedValue(
        H264_ENCODER_CONFIGS.h264_vaapi,
      )
      vi.spyOn(transcodeService, 'getVaapiDevice').mockReturnValue('/dev/dri/renderD128')

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

      const outputFile = path.join(tempDir, 'out_vaapi_custom.mp4')
      await transcodeService.transcodeVideo({
        inputFile: 'input.mp4',
        outputFile,
        width: 1920,
        height: 1080,
        hardwareAcceleration: 'auto',
        videoBitrate: '4500k',
      })

      const callArgs = vi.mocked(child_process.execFile).mock.calls[0][1] as string[]
      expect(callArgs).toContain('-rc_mode')
      expect(callArgs).toContain('3')
      expect(callArgs).toContain('-b:v')
      expect(callArgs).toContain('3104k')
      expect(callArgs).toContain('-maxrate')
      expect(callArgs).toContain('4500k')
      expect(callArgs).toContain('-minrate')
      expect(callArgs).toContain('1552k')
    })

    it('transcodeVideo should fall back to libx264 software encoding when hardware transcoding fails', async () => {
      vi.spyOn(transcodeService, 'selectH264Encoder').mockResolvedValue(
        H264_ENCODER_CONFIGS.h264_vaapi,
      )
      vi.spyOn(transcodeService, 'getVaapiDevice').mockReturnValue('/dev/dri/renderD128')
      const warnSpy = vi.spyOn(logger, 'warn')

      let callCount = 0
      vi.mocked(execFile).mockImplementation(
        (
          _cmd: unknown,
          _args: unknown,
          callback: unknown,
        ): ReturnType<typeof child_process.execFile> => {
          callCount++
          const cb = callback as (
            err: Error | null,
            result: { stdout: string; stderr: string },
          ) => void
          if (typeof cb === 'function') {
            if (callCount === 1) {
              cb(
                new Error(
                  'Hardware does not support encoding at size 1088x1920 (constraints: width 128-2560 height 128-1440)',
                ),
                {
                  stdout: '',
                  stderr: 'VAAPI error',
                },
              )
            } else {
              cb(null, { stdout: '', stderr: '' })
            }
          }
          return {} as ReturnType<typeof child_process.execFile>
        },
      )

      const outputFile = path.join(tempDir, 'out_vaapi_fallback.mp4')
      await transcodeService.transcodeVideo({
        inputFile: 'input.mp4',
        outputFile,
        width: 1088,
        height: 1920,
        hardwareAcceleration: 'auto',
      })

      expect(callCount).toBe(2)
      const firstCallArgs = vi.mocked(child_process.execFile).mock.calls[0][1] as string[]
      const secondCallArgs = vi.mocked(child_process.execFile).mock.calls[1][1] as string[]

      expect(firstCallArgs).toContain('h264_vaapi')
      expect(secondCallArgs).toContain('libx264')
      expect(secondCallArgs).toContain('-pix_fmt')
      expect(secondCallArgs).toContain('yuv420p')

      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          encoder: 'h264_vaapi',
          inputFile: 'input.mp4',
          outputFile,
        }),
        'Hardware video transcoding failed; falling back to software transcode (libx264)',
      )
    })

    it('transcodeVideo should clean up partial output file before falling back to software transcode', async () => {
      vi.spyOn(transcodeService, 'selectH264Encoder').mockResolvedValue(
        H264_ENCODER_CONFIGS.h264_vaapi,
      )
      vi.spyOn(transcodeService, 'getVaapiDevice').mockReturnValue('/dev/dri/renderD128')

      const outputFile = path.join(tempDir, 'out_vaapi_partial.mp4')
      let callCount = 0
      let existedBeforeFallback = false

      vi.mocked(execFile).mockImplementation(
        (
          _cmd: unknown,
          _args: unknown,
          callback: unknown,
        ): ReturnType<typeof child_process.execFile> => {
          callCount++
          const cb = callback as (
            err: Error | null,
            result: { stdout: string; stderr: string },
          ) => void
          if (typeof cb === 'function') {
            if (callCount === 1) {
              // Simulate ffmpeg creating a partial output file before failing
              fs.writeFileSync(outputFile, 'partial video data')
              cb(new Error('VAAPI encode failed'), { stdout: '', stderr: 'encode failed' })
            } else {
              existedBeforeFallback = fs.existsSync(outputFile)
              cb(null, { stdout: '', stderr: '' })
            }
          }
          return {} as ReturnType<typeof child_process.execFile>
        },
      )

      await transcodeService.transcodeVideo({
        inputFile: 'input.mp4',
        outputFile,
        width: 1088,
        height: 1920,
        hardwareAcceleration: 'auto',
      })

      expect(callCount).toBe(2)
      expect(existedBeforeFallback).toBe(false)
    })

    it('transcodeVideo should rethrow software transcode error if fallback also fails', async () => {
      vi.spyOn(transcodeService, 'selectH264Encoder').mockResolvedValue(
        H264_ENCODER_CONFIGS.h264_vaapi,
      )
      vi.spyOn(transcodeService, 'getVaapiDevice').mockReturnValue('/dev/dri/renderD128')

      let callCount = 0
      vi.mocked(execFile).mockImplementation(
        (
          _cmd: unknown,
          _args: unknown,
          callback: unknown,
        ): ReturnType<typeof child_process.execFile> => {
          callCount++
          const cb = callback as (
            err: Error | null,
            result: { stdout: string; stderr: string },
          ) => void
          if (typeof cb === 'function') {
            if (callCount === 1) {
              cb(new Error('VAAPI driver error'), { stdout: '', stderr: 'driver error' })
            } else {
              cb(new Error('x264 failed: corrupted frame'), {
                stdout: '',
                stderr: 'x264 error',
              })
            }
          }
          return {} as ReturnType<typeof child_process.execFile>
        },
      )

      const outputFile = path.join(tempDir, 'out_vaapi_both_fail.mp4')
      await expect(
        transcodeService.transcodeVideo({
          inputFile: 'input.mp4',
          outputFile,
          width: 1280,
          height: 720,
          hardwareAcceleration: 'auto',
        }),
      ).rejects.toThrow('x264 failed: corrupted frame')
      expect(callCount).toBe(2)
    })

    it('transcodeVideo should not fall back to software encoding when transcode was aborted', async () => {
      vi.spyOn(transcodeService, 'selectH264Encoder').mockResolvedValue(
        H264_ENCODER_CONFIGS.h264_vaapi,
      )
      vi.spyOn(transcodeService, 'getVaapiDevice').mockReturnValue('/dev/dri/renderD128')

      const abortController = new AbortController()
      let callCount = 0

      vi.mocked(execFile).mockImplementation(
        (
          _cmd: unknown,
          _args: unknown,
          optionsOrCallback: unknown,
          maybeCallback?: unknown,
        ): ReturnType<typeof child_process.execFile> => {
          callCount++
          const cb = (
            typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback
          ) as (err: Error | null, result: { stdout: string; stderr: string }) => void
          if (typeof cb === 'function') {
            abortController.abort()
            const abortErr = new Error('The operation was aborted')
            abortErr.name = 'AbortError'
            cb(abortErr, { stdout: '', stderr: '' })
          }
          return {} as ReturnType<typeof child_process.execFile>
        },
      )

      const outputFile = path.join(tempDir, 'out_vaapi_abort.mp4')
      await expect(
        transcodeService.transcodeVideo({
          inputFile: 'input.mp4',
          outputFile,
          width: 1280,
          height: 720,
          hardwareAcceleration: 'auto',
          signal: abortController.signal,
        }),
      ).rejects.toThrow('The operation was aborted')

      expect(callCount).toBe(1)
    })

    it('transcodeVideo with threads > 0 should pass -threads to ffmpeg', async () => {
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

      const outputFile = path.join(tempDir, 'out_threads.mp4')
      await transcodeService.transcodeVideo({
        inputFile: 'input.mp4',
        outputFile,
        width: 1280,
        height: 720,
        threads: 6,
      })

      expect(child_process.execFile).toHaveBeenCalledWith(
        'ffmpeg',
        expect.arrayContaining(['-threads', '6']),
        expect.any(Function),
      )
    })

    it('transcodeVideo with threads 0 or undefined should omit -threads', async () => {
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

      const outputFile = path.join(tempDir, 'out_threads_0.mp4')
      await transcodeService.transcodeVideo({
        inputFile: 'input.mp4',
        outputFile,
        width: 1280,
        height: 720,
        threads: 0,
      })

      expect(child_process.execFile).not.toHaveBeenCalledWith(
        'ffmpeg',
        expect.arrayContaining(['-threads']),
        expect.any(Function),
      )
    })

    it('transcodeVideo with signal should pass signal to execFile', async () => {
      vi.mocked(execFile).mockImplementation(
        (
          _cmd: unknown,
          _args: unknown,
          optionsOrCallback: unknown,
          maybeCallback?: unknown,
        ): ReturnType<typeof child_process.execFile> => {
          const cb = (
            typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback
          ) as (err: Error | null, result: { stdout: string; stderr: string }) => void
          if (typeof cb === 'function') {
            cb(null, { stdout: '', stderr: '' })
          }
          return {} as ReturnType<typeof child_process.execFile>
        },
      )

      const controller = new AbortController()
      const outputFile = path.join(tempDir, 'out_signal.mp4')
      await transcodeService.transcodeVideo({
        inputFile: 'input.mp4',
        outputFile,
        width: 1280,
        height: 720,
        signal: controller.signal,
      })

      expect(child_process.execFile).toHaveBeenCalledWith(
        'ffmpeg',
        expect.any(Array),
        { signal: controller.signal },
        expect.any(Function),
      )
    })
  })

  describe('Hardware decode', () => {
    let origHwDecode: string | undefined
    let origStall: string | undefined

    type FfmpegCallback = (err: Error | null, result: { stdout: string; stderr: string }) => void

    // execFile is called as (cmd, args, cb) or (cmd, args, options, cb); the
    // GPU-decode attempt always passes options (signal + SIGKILL watchdog).
    const callbackOf = (optionsOrCallback: unknown, maybeCallback?: unknown) =>
      (typeof optionsOrCallback === 'function'
        ? optionsOrCallback
        : maybeCallback) as FfmpegCallback

    const mockFfmpeg = (onCall: (n: number, cb: FfmpegCallback, options: unknown) => void) =>
      vi
        .mocked(execFile)
        .mockImplementation(
          (
            _cmd: unknown,
            _args: unknown,
            optionsOrCallback: unknown,
            maybeCallback?: unknown,
          ): ReturnType<typeof child_process.execFile> => {
            const n = vi.mocked(execFile).mock.calls.length
            onCall(n, callbackOf(optionsOrCallback, maybeCallback), optionsOrCallback)
            return {} as ReturnType<typeof child_process.execFile>
          },
        )

    const failOn =
      (...failing: number[]) =>
      (n: number, cb: FfmpegCallback) =>
        failing.includes(n)
          ? cb(new Error(`ffmpeg failed on call ${n}`), { stdout: '', stderr: '' })
          : cb(null, { stdout: '', stderr: '' })

    const calls = () => vi.mocked(child_process.execFile).mock.calls.map((c) => c[1] as string[])
    const filterOf = (args: string[]) => args[args.indexOf('-filter_complex') + 1]
    const vaapiScale = (w: number, h: number) => HW_DECODE_CONFIGS.h264_vaapi!.scaleFilter(w, h)
    const nvencScale = (w: number, h: number) => HW_DECODE_CONFIGS.h264_nvenc!.scaleFilter(w, h)
    const qsvScale = (w: number, h: number) => HW_DECODE_CONFIGS.h264_qsv!.scaleFilter(w, h)
    const rkmppScale = (w: number, h: number) => HW_DECODE_CONFIGS.h264_rkmpp!.scaleFilter(w, h)

    beforeEach(() => {
      transcodeService.clearEncodersCache()
      origHwDecode = process.env.SHUMAI_HW_DECODE
      origStall = process.env.SHUMAI_HW_DECODE_STALL_TIMEOUT
      delete process.env.SHUMAI_HW_DECODE
      delete process.env.SHUMAI_HW_DECODE_STALL_TIMEOUT
      vi.spyOn(transcodeService, 'selectH264Encoder').mockResolvedValue(
        H264_ENCODER_CONFIGS.h264_vaapi,
      )
      vi.spyOn(transcodeService, 'getVaapiDevice').mockReturnValue('/dev/dri/renderD128')
      vi.spyOn(transcodeService, 'getDriDevice').mockReturnValue('/dev/dri/renderD128')
      vi.spyOn(transcodeService, 'getVideoRotation').mockResolvedValue(0)
    })

    afterEach(() => {
      vi.restoreAllMocks()
      if (origHwDecode === undefined) delete process.env.SHUMAI_HW_DECODE
      else process.env.SHUMAI_HW_DECODE = origHwDecode
      if (origStall === undefined) delete process.env.SHUMAI_HW_DECODE_STALL_TIMEOUT
      else process.env.SHUMAI_HW_DECODE_STALL_TIMEOUT = origStall
    })

    it('isHwDecodeEnabled should default to true and honor false/0/off', () => {
      expect(isHwDecodeEnabled()).toBe(true)
      for (const value of ['false', '0', 'off', ' FALSE ']) {
        process.env.SHUMAI_HW_DECODE = value
        expect(isHwDecodeEnabled()).toBe(false)
      }
      process.env.SHUMAI_HW_DECODE = 'true'
      expect(isHwDecodeEnabled()).toBe(true)
    })

    it('getHwDecodeStallTimeoutMs should default to 120s and honor SHUMAI_HW_DECODE_STALL_TIMEOUT', () => {
      expect(getHwDecodeStallTimeoutMs()).toBe(120_000)
      process.env.SHUMAI_HW_DECODE_STALL_TIMEOUT = '30'
      expect(getHwDecodeStallTimeoutMs()).toBe(30_000)
      process.env.SHUMAI_HW_DECODE_STALL_TIMEOUT = 'nope'
      expect(getHwDecodeStallTimeoutMs()).toBe(120_000)
    })

    it('should have hardware decode configs for nvenc, qsv, vaapi, and rkmpp', () => {
      expect(Object.keys(HW_DECODE_CONFIGS)).toEqual([
        'h264_nvenc',
        'h264_qsv',
        'h264_vaapi',
        'h264_rkmpp',
      ])
      expect(nvencScale(1920, 1080)).toBe(
        'scale_cuda=w=1920:h=1080:force_original_aspect_ratio=decrease:force_divisible_by=2:format=nv12',
      )
      expect(qsvScale(1920, 1080)).toBe('scale_qsv=w=1920:h=1080:async_depth=4:mode=hq:format=nv12')
      expect(vaapiScale(1920, 1080)).toBe(
        'scale_vaapi=w=1920:h=1080:force_original_aspect_ratio=decrease:force_divisible_by=2:format=nv12:mode=hq',
      )
      expect(rkmppScale(1920, 1080)).toBe(
        'scale_rkrga=w=1920:h=1080:format=nv12:afbc=1:async_depth=4',
      )
      expect(HW_DECODE_CONFIGS.h264_qsv!.getInputArgs!('/dev/dri/renderD128')).toEqual([
        '-hwaccel',
        'qsv',
        '-hwaccel_output_format',
        'qsv',
        '-async_depth',
        '4',
        '-threads',
        '1',
        '-qsv_device',
        '/dev/dri/renderD128',
      ])
      expect(HW_DECODE_CONFIGS.h264_qsv!.getInputArgs!()).toEqual([
        '-hwaccel',
        'qsv',
        '-hwaccel_output_format',
        'qsv',
        '-async_depth',
        '4',
        '-threads',
        '1',
      ])
    })

    it('transcodeVideo should decode and scale on the GPU by default with vaapi', async () => {
      mockFfmpeg(failOn())
      const loggerSpy = vi.spyOn(logger, 'info')

      await transcodeService.transcodeVideo({
        inputFile: 'input.mp4',
        outputFile: path.join(tempDir, 'out_hwdec.mp4'),
        width: 1280,
        height: 720,
        frameRate: 24,
        hardwareAcceleration: 'auto',
        sourceVideoBitrate: 600_000,
        sourceRotation: 0,
      })

      expect(calls()).toHaveLength(1)
      const args = calls()[0]
      expect(args).toEqual(
        expect.arrayContaining([
          '-init_hw_device',
          'vaapi=accel:/dev/dri/renderD128',
          '-hwaccel',
          'vaapi',
          '-hwaccel_device',
          'accel',
          '-hwaccel_output_format',
          'vaapi',
          '-noautoscale',
          '-c:v',
          'h264_vaapi',
          '-rc_mode',
          '3',
        ]),
      )
      // hwaccel options must precede the input; -noautoscale is an output option
      expect(args.indexOf('-hwaccel')).toBeLessThan(args.indexOf('-i'))
      expect(args.indexOf('-noautoscale')).toBeGreaterThan(args.indexOf('-filter_complex'))
      expect(filterOf(args)).toBe(`[0:V]${vaapiScale(1280, 720)},fps=24[vout]`)
      expect(filterOf(args)).not.toContain('hwupload')
      expect(args).not.toContain('-pix_fmt')
      // the GPU attempt runs under the stall watchdog
      expect(vi.mocked(child_process.execFile).mock.calls[0][2]).toEqual(
        expect.objectContaining({ killSignal: 'SIGKILL', signal: expect.any(AbortSignal) }),
      )
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({ encoder: 'h264_vaapi', hwDecode: true }),
        'Starting video transcoding',
      )
    })

    it('transcodeVideo should decode and scale on the GPU by default with nvenc', async () => {
      vi.mocked(transcodeService.selectH264Encoder).mockResolvedValue(
        H264_ENCODER_CONFIGS.h264_nvenc,
      )
      mockFfmpeg(failOn())
      const loggerSpy = vi.spyOn(logger, 'info')

      await transcodeService.transcodeVideo({
        inputFile: 'input.mp4',
        outputFile: path.join(tempDir, 'out_hwdec_nvenc.mp4'),
        width: 1280,
        height: 720,
        frameRate: 24,
        hardwareAcceleration: 'auto',
        sourceVideoBitrate: 600_000,
        sourceRotation: 0,
      })

      expect(calls()).toHaveLength(1)
      const args = calls()[0]
      expect(args).toEqual(
        expect.arrayContaining([
          '-hwaccel',
          'cuda',
          '-hwaccel_output_format',
          'cuda',
          '-threads',
          '1',
          '-noautoscale',
          '-c:v',
          'h264_nvenc',
        ]),
      )
      expect(args.indexOf('-hwaccel')).toBeLessThan(args.indexOf('-i'))
      expect(args.indexOf('-noautoscale')).toBeGreaterThan(args.indexOf('-filter_complex'))
      expect(filterOf(args)).toBe(`[0:V]${nvencScale(1280, 720)},fps=24[vout]`)
      expect(filterOf(args)).not.toContain('hwupload')
      expect(args).not.toContain('-pix_fmt')
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({ encoder: 'h264_nvenc', hwDecode: true }),
        'Starting video transcoding',
      )
    })

    it('transcodeVideo should decode and scale on the GPU by default with qsv', async () => {
      vi.mocked(transcodeService.selectH264Encoder).mockResolvedValue(H264_ENCODER_CONFIGS.h264_qsv)
      mockFfmpeg(failOn())
      const loggerSpy = vi.spyOn(logger, 'info')

      await transcodeService.transcodeVideo({
        inputFile: 'input.mp4',
        outputFile: path.join(tempDir, 'out_hwdec_qsv.mp4'),
        width: 1280,
        height: 720,
        frameRate: 24,
        hardwareAcceleration: 'auto',
        sourceVideoBitrate: 600_000,
        sourceRotation: 0,
      })

      expect(calls()).toHaveLength(1)
      const args = calls()[0]
      expect(args).toEqual(
        expect.arrayContaining([
          '-hwaccel',
          'qsv',
          '-hwaccel_output_format',
          'qsv',
          '-async_depth',
          '4',
          '-threads',
          '1',
          '-noautoscale',
          '-c:v',
          'h264_qsv',
        ]),
      )
      expect(args).toContain('-qsv_device')
      expect(args).toContain('/dev/dri/renderD128')
      expect(args.indexOf('-hwaccel')).toBeLessThan(args.indexOf('-i'))
      expect(args.indexOf('-noautoscale')).toBeGreaterThan(args.indexOf('-filter_complex'))
      expect(filterOf(args)).toBe(`[0:V]${qsvScale(1280, 720)},fps=24[vout]`)
      expect(filterOf(args)).not.toContain('hwupload')
      expect(args).not.toContain('-pix_fmt')
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({ encoder: 'h264_qsv', hwDecode: true }),
        'Starting video transcoding',
      )
    })

    it('transcodeVideo should decode and scale on the GPU by default with rkmpp', async () => {
      vi.mocked(transcodeService.selectH264Encoder).mockResolvedValue(
        H264_ENCODER_CONFIGS.h264_rkmpp,
      )
      mockFfmpeg(failOn())
      const loggerSpy = vi.spyOn(logger, 'info')

      await transcodeService.transcodeVideo({
        inputFile: 'input.mp4',
        outputFile: path.join(tempDir, 'out_hwdec_rkmpp.mp4'),
        width: 1280,
        height: 720,
        frameRate: 24,
        hardwareAcceleration: 'auto',
        sourceVideoBitrate: 600_000,
        sourceRotation: 0,
      })

      expect(calls()).toHaveLength(1)
      const args = calls()[0]
      expect(args).toEqual(
        expect.arrayContaining([
          '-hwaccel',
          'rkmpp',
          '-hwaccel_output_format',
          'drm_prime',
          '-afbc',
          'rga',
          '-noautoscale',
          '-c:v',
          'h264_rkmpp',
        ]),
      )
      expect(args.indexOf('-hwaccel')).toBeLessThan(args.indexOf('-i'))
      expect(args.indexOf('-noautoscale')).toBeGreaterThan(args.indexOf('-filter_complex'))
      expect(filterOf(args)).toBe(`[0:V]${rkmppScale(1280, 720)},fps=24[vout]`)
      expect(filterOf(args)).not.toContain('hwupload')
      expect(args).not.toContain('-pix_fmt')
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({ encoder: 'h264_rkmpp', hwDecode: true }),
        'Starting video transcoding',
      )
    })

    it('transcodeVideo should fall back to software decode when qsv has no DRI device on Linux', async () => {
      const origPlatform = process.platform
      try {
        Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })
        vi.mocked(transcodeService.selectH264Encoder).mockResolvedValue(
          H264_ENCODER_CONFIGS.h264_qsv,
        )
        vi.spyOn(transcodeService, 'getDriDevice').mockReturnValue(null)
        vi.spyOn(transcodeService, 'getVaapiDevice').mockReturnValue(null)
        mockFfmpeg(failOn())

        await transcodeService.transcodeVideo({
          inputFile: 'input.mp4',
          outputFile: path.join(tempDir, 'out_hwdec_qsv_no_dri.mp4'),
          width: 1280,
          height: 720,
          hardwareAcceleration: 'auto',
        })

        expect(calls()).toHaveLength(1)
        expect(calls()[0]).not.toContain('-hwaccel')
        expect(calls()[0]).toContain('h264_qsv')
      } finally {
        Object.defineProperty(process, 'platform', { value: origPlatform, configurable: true })
      }
    })

    it('transcodeVideo should use the provided sourceRotation instead of probing', async () => {
      mockFfmpeg(failOn())

      await transcodeService.transcodeVideo({
        inputFile: 'portrait.mov',
        outputFile: path.join(tempDir, 'out_hwdec_rotation_param.mp4'),
        width: 1080,
        height: 1920,
        hardwareAcceleration: 'auto',
        sourceRotation: -90,
      })

      expect(transcodeService.getVideoRotation).not.toHaveBeenCalled()
      expect(calls()[0]).not.toContain('-hwaccel')
      expect(filterOf(calls()[0])).toContain('hwupload')
    })

    it('transcodeVideo should probe rotation when sourceRotation is not provided', async () => {
      vi.mocked(transcodeService.getVideoRotation).mockResolvedValue(90)
      mockFfmpeg(failOn())

      await transcodeService.transcodeVideo({
        inputFile: 'portrait.mov',
        outputFile: path.join(tempDir, 'out_hwdec_rotated.mp4'),
        width: 1080,
        height: 1920,
        hardwareAcceleration: 'auto',
      })

      expect(transcodeService.getVideoRotation).toHaveBeenCalledWith('portrait.mov', undefined)
      expect(calls()).toHaveLength(1)
      expect(calls()[0]).not.toContain('-hwaccel')
      expect(filterOf(calls()[0])).toContain('hwupload')
    })

    it('transcodeVideo should retry with software decode + hardware encode when GPU decode fails', async () => {
      const outputFile = path.join(tempDir, 'out_hwdec_retry.mp4')
      mockFfmpeg(failOn(1))
      const warnSpy = vi.spyOn(logger, 'warn')

      await transcodeService.transcodeVideo({
        inputFile: 'input.mp4',
        outputFile,
        width: 1280,
        height: 720,
        hardwareAcceleration: 'auto',
      })

      expect(calls()).toHaveLength(2)
      expect(calls()[0]).toContain('-hwaccel')
      expect(calls()[1]).not.toContain('-hwaccel')
      expect(calls()[1]).not.toContain('-noautoscale')
      expect(calls()[1]).toContain('h264_vaapi')
      expect(filterOf(calls()[1])).toContain('format=nv12,hwupload=extra_hw_frames=64')
      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({ encoder: 'h264_vaapi', outputFile }),
        'Hardware decode failed; retrying with software decode and hardware encode',
      )
    })

    it('transcodeVideo should kill a stalled GPU decode attempt and fall back', async () => {
      process.env.SHUMAI_HW_DECODE_STALL_TIMEOUT = '0.05'
      const outputFile = path.join(tempDir, 'out_hwdec_stall.mp4')
      const warnSpy = vi.spyOn(logger, 'warn')
      let killSignal: unknown
      mockFfmpeg((n, cb, options) => {
        if (n === 1) {
          // simulate a hung ffmpeg: never exits on its own, only when killed
          const opts = options as { signal: AbortSignal; killSignal: string }
          killSignal = opts.killSignal
          opts.signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted')
            err.name = 'AbortError'
            cb(err, { stdout: '', stderr: '' })
          })
        } else {
          cb(null, { stdout: '', stderr: '' })
        }
      })

      await transcodeService.transcodeVideo({
        inputFile: 'input.mp4',
        outputFile,
        width: 1280,
        height: 720,
        hardwareAcceleration: 'auto',
      })

      expect(killSignal).toBe('SIGKILL')
      expect(calls()).toHaveLength(2)
      expect(calls()[1]).not.toContain('-hwaccel')
      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.objectContaining({ message: expect.stringContaining('made no progress') }),
        }),
        'Hardware decode failed; retrying with software decode and hardware encode',
      )
    })

    it('transcodeVideo should fall back to libx264 when GPU decode and vaapi encode both fail', async () => {
      const outputFile = path.join(tempDir, 'out_hwdec_x264.mp4')
      let existedBeforeRetry = true
      mockFfmpeg((n, cb) => {
        if (n === 1) {
          fs.writeFileSync(outputFile, 'partial video data')
          cb(new Error('hw decode failed'), { stdout: '', stderr: '' })
        } else if (n === 2) {
          existedBeforeRetry = fs.existsSync(outputFile)
          cb(new Error('vaapi encode failed'), { stdout: '', stderr: '' })
        } else {
          cb(null, { stdout: '', stderr: '' })
        }
      })

      await transcodeService.transcodeVideo({
        inputFile: 'input.mp4',
        outputFile,
        width: 1280,
        height: 720,
        hardwareAcceleration: 'auto',
      })

      expect(calls()).toHaveLength(3)
      expect(existedBeforeRetry).toBe(false)
      expect(calls()[0]).toContain('-hwaccel')
      expect(calls()[1]).toContain('h264_vaapi')
      expect(calls()[1]).not.toContain('-hwaccel')
      expect(calls()[2]).toContain('libx264')
    })

    it('transcodeVideo should not retry when the GPU decode attempt was aborted by the caller', async () => {
      const abortController = new AbortController()
      mockFfmpeg((_n, cb) => {
        abortController.abort()
        const abortErr = new Error('The operation was aborted')
        abortErr.name = 'AbortError'
        cb(abortErr, { stdout: '', stderr: '' })
      })

      await expect(
        transcodeService.transcodeVideo({
          inputFile: 'input.mp4',
          outputFile: path.join(tempDir, 'out_hwdec_abort.mp4'),
          width: 1280,
          height: 720,
          hardwareAcceleration: 'auto',
          signal: abortController.signal,
        }),
      ).rejects.toThrow('aborted')
      expect(vi.mocked(child_process.execFile)).toHaveBeenCalledTimes(1)
    })

    it('transcodeVideo should keep software decode for watermark overlays', async () => {
      mockFfmpeg(failOn())

      await transcodeService.transcodeVideo({
        inputFile: 'input.mp4',
        outputFile: path.join(tempDir, 'out_hwdec_overlay.mp4'),
        width: 1280,
        height: 720,
        overlayFile: 'overlay.png',
        hardwareAcceleration: 'auto',
      })

      expect(calls()).toHaveLength(1)
      expect(calls()[0]).not.toContain('-hwaccel')
      expect(filterOf(calls()[0])).toContain('overlay=0:0')
      expect(filterOf(calls()[0])).toContain('hwupload')
    })

    it('transcodeVideo should keep software decode for HDR sources', async () => {
      mockFfmpeg(failOn())

      await transcodeService.transcodeVideo({
        inputFile: 'input.mov',
        outputFile: path.join(tempDir, 'out_hwdec_hdr.mp4'),
        width: 1920,
        height: 1080,
        sourceHdrType: 'pq',
        hardwareAcceleration: 'auto',
      })

      expect(calls()[0]).not.toContain('-hwaccel')
      expect(filterOf(calls()[0])).toContain('hwupload')
    })

    it('transcodeVideo should keep software decode when SHUMAI_HW_DECODE=false', async () => {
      process.env.SHUMAI_HW_DECODE = 'false'
      mockFfmpeg(failOn())

      await transcodeService.transcodeVideo({
        inputFile: 'input.mp4',
        outputFile: path.join(tempDir, 'out_hwdec_disabled.mp4'),
        width: 1280,
        height: 720,
        hardwareAcceleration: 'auto',
      })

      expect(calls()[0]).not.toContain('-hwaccel')
      expect(filterOf(calls()[0])).toContain('hwupload')
    })

    it('transcodeVideo should not use GPU decode for encoders without a hardware decode config', async () => {
      for (const encoder of ['libx264', 'h264_amf', 'h264_videotoolbox'] as const) {
        vi.mocked(child_process.execFile).mockClear()
        vi.mocked(transcodeService.selectH264Encoder).mockResolvedValue(
          H264_ENCODER_CONFIGS[encoder],
        )
        mockFfmpeg(failOn())

        await transcodeService.transcodeVideo({
          inputFile: 'input.mp4',
          outputFile: path.join(tempDir, `out_hwdec_${encoder}.mp4`),
          width: 1280,
          height: 720,
          hardwareAcceleration: 'auto',
        })

        expect(calls()).toHaveLength(1)
        expect(calls()[0]).not.toContain('-hwaccel')
        expect(calls()[0]).toContain(encoder)
      }
    })

    it('transcodeHlsRendition should decode and scale on the GPU by default with vaapi', async () => {
      mockFfmpeg(failOn())
      const loggerSpy = vi.spyOn(logger, 'info')

      await transcodeService.transcodeHlsRendition({
        inputFile: 'input.mp4',
        outputDir: path.join(tempDir, 'hls_hwdec'),
        width: 1920,
        height: 1080,
        frameRate: 24,
        hardwareAcceleration: 'auto',
        sourceRotation: 0,
      })

      expect(calls()).toHaveLength(1)
      const args = calls()[0]
      expect(args).toEqual(
        expect.arrayContaining([
          '-hwaccel',
          'vaapi',
          '-hwaccel_output_format',
          'vaapi',
          '-noautoscale',
          '-f',
          'hls',
        ]),
      )
      expect(args.indexOf('-hwaccel')).toBeLessThan(args.indexOf('-i'))
      expect(filterOf(args)).toBe(`[0:V]${vaapiScale(1920, 1080)},fps=24[vout]`)
      expect(transcodeService.getVideoRotation).not.toHaveBeenCalled()
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({ encoder: 'h264_vaapi', hwDecode: true }),
        'Starting HLS rendition transcoding',
      )
    })

    it('transcodeHlsRendition should decode and scale on the GPU by default with nvenc and qsv', async () => {
      // NVENC
      vi.mocked(transcodeService.selectH264Encoder).mockResolvedValue(
        H264_ENCODER_CONFIGS.h264_nvenc,
      )
      mockFfmpeg(failOn())

      await transcodeService.transcodeHlsRendition({
        inputFile: 'input.mp4',
        outputDir: path.join(tempDir, 'hls_hwdec_nvenc'),
        width: 1920,
        height: 1080,
        frameRate: 24,
        hardwareAcceleration: 'auto',
        sourceRotation: 0,
      })

      expect(calls()).toHaveLength(1)
      expect(calls()[0]).toContain('-hwaccel')
      expect(calls()[0]).toContain('cuda')
      expect(calls()[0]).toContain('-forced-idr')
      expect(calls()[0]).toContain('1')
      expect(filterOf(calls()[0])).toBe(`[0:V]${nvencScale(1920, 1080)},fps=24[vout]`)

      // QSV
      vi.mocked(child_process.execFile).mockClear()
      vi.mocked(transcodeService.selectH264Encoder).mockResolvedValue(H264_ENCODER_CONFIGS.h264_qsv)
      mockFfmpeg(failOn())

      await transcodeService.transcodeHlsRendition({
        inputFile: 'input.mp4',
        outputDir: path.join(tempDir, 'hls_hwdec_qsv'),
        width: 1920,
        height: 1080,
        frameRate: 24,
        hardwareAcceleration: 'auto',
        sourceRotation: 0,
      })

      expect(calls()).toHaveLength(1)
      expect(calls()[0]).toContain('-hwaccel')
      expect(calls()[0]).toContain('qsv')
      expect(calls()[0]).toContain('-idr_interval')
      expect(calls()[0]).toContain('0')
      expect(filterOf(calls()[0])).toBe(`[0:V]${qsvScale(1920, 1080)},fps=24[vout]`)
    })

    it('transcodeHlsRendition should keep software decode when rotation cannot be determined', async () => {
      vi.mocked(transcodeService.getVideoRotation).mockResolvedValue(null)
      mockFfmpeg(failOn())

      await transcodeService.transcodeHlsRendition({
        inputFile: 'input.mp4',
        outputDir: path.join(tempDir, 'hls_hwdec_unknown_rotation'),
        width: 1280,
        height: 720,
        hardwareAcceleration: 'auto',
      })

      expect(calls()[0]).not.toContain('-hwaccel')
    })

    it('transcodeHlsRendition should retry with software decode, then libx264, cleaning the output dir', async () => {
      const outputDir = path.join(tempDir, 'hls_hwdec_fallback')
      let dirExistedBeforeRetry = true
      mockFfmpeg((n, cb) => {
        if (n === 1) {
          fs.writeFileSync(path.join(outputDir, 'segment_000.m4s'), 'partial')
          cb(new Error('hw decode failed'), { stdout: '', stderr: '' })
        } else if (n === 2) {
          dirExistedBeforeRetry = fs.existsSync(path.join(outputDir, 'segment_000.m4s'))
          cb(new Error('vaapi encode failed'), { stdout: '', stderr: '' })
        } else {
          cb(null, { stdout: '', stderr: '' })
        }
      })

      await transcodeService.transcodeHlsRendition({
        inputFile: 'input.mp4',
        outputDir,
        width: 1280,
        height: 720,
        hardwareAcceleration: 'auto',
      })

      expect(calls()).toHaveLength(3)
      expect(dirExistedBeforeRetry).toBe(false)
      expect(calls()[0]).toContain('-hwaccel')
      expect(calls()[1]).not.toContain('-hwaccel')
      expect(filterOf(calls()[1])).toContain('hwupload')
      expect(calls()[2]).toContain('libx264')
    })

    it('getVideoRotation should read the display matrix, the rotate tag, and normalize', async () => {
      vi.mocked(transcodeService.getVideoRotation).mockRestore()
      const probe = (json: unknown) =>
        vi
          .mocked(execFile)
          .mockImplementationOnce(
            (
              _cmd: unknown,
              _args: unknown,
              callback: unknown,
            ): ReturnType<typeof child_process.execFile> => {
              ;(callback as FfmpegCallback)(null, { stdout: JSON.stringify(json), stderr: '' })
              return {} as ReturnType<typeof child_process.execFile>
            },
          )

      /* eslint-disable @typescript-eslint/naming-convention */
      probe({
        streams: [{ side_data_list: [{ side_data_type: 'Display Matrix', rotation: -90 }] }],
      })
      /* eslint-enable @typescript-eslint/naming-convention */
      expect(await transcodeService.getVideoRotation('a.mov')).toBe(270)

      probe({ streams: [{ tags: { rotate: '180' } }] })
      expect(await transcodeService.getVideoRotation('b.mp4')).toBe(180)

      probe({ streams: [{}] })
      expect(await transcodeService.getVideoRotation('c.mp4', 2)).toBe(0)
      expect(vi.mocked(child_process.execFile).mock.calls.at(-1)?.[1]).toEqual(
        expect.arrayContaining(['-select_streams', '2']),
      )

      probe({ streams: [] })
      expect(await transcodeService.getVideoRotation('d.mp4')).toBeNull()
    })
  })

  describe('HDR detection, tone mapping, and transcoding', () => {
    it('buildSdrToneMapFilterChain constructs zscale + tonemap filter chain for PQ and HLG', () => {
      const available = new Set(['zscale', 'tonemap'])
      const pqChain = buildSdrToneMapFilterChain({
        hdrType: 'pq',
        availableFilters: available,
      })
      expect(pqChain).toContain(
        'setparams=color_primaries=bt2020:color_trc=smpte2084:colorspace=bt2020nc',
      )
      expect(pqChain).toContain('zscale=tin=smpte2084:pin=bt2020:min=bt2020nc')
      expect(pqChain).toContain('tonemap=tonemap=hable:desat=0:peak=100')
      expect(pqChain).toContain('format=yuv420p')

      const hlgChain = buildSdrToneMapFilterChain({
        hdrType: 'hlg',
        availableFilters: available,
      })
      expect(hlgChain).toContain(
        'setparams=color_primaries=bt2020:color_trc=arib-std-b67:colorspace=bt2020nc',
      )
      expect(hlgChain).toContain('zscale=tin=arib-std-b67:pin=bt2020:min=bt2020nc')
      expect(hlgChain).toContain('tonemap=tonemap=hable')
    })

    it('buildSdrToneMapFilterChain throws error if zscale or tonemap is missing for PQ/HLG', () => {
      expect(() =>
        buildSdrToneMapFilterChain({
          hdrType: 'pq',
          availableFilters: new Set(['zscale']),
        }),
      ).toThrow(/zscale and tonemap filters are required for HDR tone mapping/)

      expect(() =>
        buildSdrToneMapFilterChain({
          hdrType: 'hlg',
          availableFilters: new Set(['tonemap']),
        }),
      ).toThrow(/zscale and tonemap filters are required for HDR tone mapping/)
    })

    it('buildSdrToneMapFilterChain constructs zscale + tonemap filter chain for Dolby Vision Profile 5', () => {
      const chain = buildSdrToneMapFilterChain({
        hdrType: 'dovi_p5',
        availableFilters: new Set(['zscale', 'tonemap']),
      })
      expect(chain).toContain(
        'setparams=color_primaries=bt2020:color_trc=smpte2084:colorspace=bt2020nc',
      )
      expect(chain).toContain('tin=smpte2084')
      expect(chain).toContain('tonemap=tonemap=hable')
      expect(chain).toContain('m=bt709')
    })

    it('buildSdrToneMapFilterChain throws error if zscale or tonemap is missing for Dolby Vision Profile 5', () => {
      expect(() =>
        buildSdrToneMapFilterChain({
          hdrType: 'dovi_p5',
          availableFilters: new Set(['tonemap']),
        }),
      ).toThrow(/zscale and tonemap filters are required for HDR tone mapping/)
    })

    const mockExecFileStdout = (mockOutput: string) => {
      ;(
        child_process.execFile as unknown as {
          mockImplementation: (
            fn: (
              file: string,
              args: string[],
              cb: (err: Error | null, res: { stdout: string; stderr: string }) => void,
            ) => unknown,
          ) => void
        }
      ).mockImplementation((_file, _args, cb) => {
        cb(null, { stdout: mockOutput, stderr: '' })
      })
    }

    it('getVideoInfo detects PQ HDR from smpte2084 color_transfer', async () => {
      /* eslint-disable @typescript-eslint/naming-convention */
      const mockOutput = JSON.stringify({
        format: { duration: '10.0', bit_rate: '20000000' },
        streams: [
          {
            codec_type: 'video',
            codec_name: 'hevc',
            width: 3840,
            height: 2160,
            r_frame_rate: '24/1',
            color_transfer: 'smpte2084',
            color_primaries: 'bt2020',
            color_space: 'bt2020nc',
            bits_per_raw_sample: '10',
          },
        ],
      })
      /* eslint-enable @typescript-eslint/naming-convention */

      mockExecFileStdout(mockOutput)

      const info = await transcodeService.getVideoInfo('hdr-pq.mp4')
      expect(info.isHdr).toBe(true)
      expect(info.hdrType).toBe('pq')
      expect(info.colorTransfer).toBe('smpte2084')
    })

    it('getVideoInfo detects HLG HDR from arib-std-b67 color_transfer', async () => {
      /* eslint-disable @typescript-eslint/naming-convention */
      const mockOutput = JSON.stringify({
        format: { duration: '10.0', bit_rate: '20000000' },
        streams: [
          {
            codec_type: 'video',
            codec_name: 'hevc',
            width: 1920,
            height: 1080,
            r_frame_rate: '30/1',
            color_transfer: 'arib-std-b67',
            color_primaries: 'bt2020',
            color_space: 'bt2020nc',
          },
        ],
      })
      /* eslint-enable @typescript-eslint/naming-convention */

      mockExecFileStdout(mockOutput)

      const info = await transcodeService.getVideoInfo('hdr-hlg.mp4')
      expect(info.isHdr).toBe(true)
      expect(info.hdrType).toBe('hlg')
      expect(info.colorTransfer).toBe('arib-std-b67')
    })

    it('getVideoInfo treats 10-bit Rec.709 with BT.709 transfer as SDR', async () => {
      /* eslint-disable @typescript-eslint/naming-convention */
      const mockOutput = JSON.stringify({
        format: { duration: '10.0', bit_rate: '20000000' },
        streams: [
          {
            codec_type: 'video',
            codec_name: 'h264',
            width: 1920,
            height: 1080,
            r_frame_rate: '24/1',
            color_transfer: 'bt709',
            color_primaries: 'bt709',
            color_space: 'bt709',
            bits_per_raw_sample: '10',
          },
        ],
      })
      /* eslint-enable @typescript-eslint/naming-convention */

      mockExecFileStdout(mockOutput)

      const info = await transcodeService.getVideoInfo('10bit-sdr.mp4')
      expect(info.isHdr).toBe(false)
      expect(info.hdrType).toBe('sdr')
    })

    it('getVideoInfo detects Dolby Vision Profile 5 via side data', async () => {
      /* eslint-disable @typescript-eslint/naming-convention */
      const mockOutput = JSON.stringify({
        format: { duration: '10.0', bit_rate: '25000000' },
        streams: [
          {
            codec_type: 'video',
            codec_name: 'hevc',
            width: 3840,
            height: 2160,
            r_frame_rate: '24/1',
            side_data_list: [
              {
                side_data_type: 'DOVI configuration record',
                dv_profile: 5,
                dv_level: 6,
              },
            ],
          },
        ],
      })
      /* eslint-enable @typescript-eslint/naming-convention */

      mockExecFileStdout(mockOutput)

      const info = await transcodeService.getVideoInfo('dovi-p5.mp4')
      expect(info.isHdr).toBe(true)
      expect(info.hdrType).toBe('dovi_p5')
      expect(info.dvProfile).toBe(5)
    })

    it('getVideoInfo treats Dolby Vision Profile 8 with BT.709 transfer as SDR', async () => {
      /* eslint-disable @typescript-eslint/naming-convention */
      const mockOutput = JSON.stringify({
        format: { duration: '10.0', bit_rate: '25000000' },
        streams: [
          {
            codec_type: 'video',
            codec_name: 'hevc',
            width: 1920,
            height: 1080,
            r_frame_rate: '24/1',
            color_transfer: 'bt709',
            color_primaries: 'bt709',
            color_space: 'bt709',
            side_data_list: [
              {
                side_data_type: 'DOVI configuration record',
                dv_profile: 8,
              },
            ],
          },
        ],
      })
      /* eslint-enable @typescript-eslint/naming-convention */

      mockExecFileStdout(mockOutput)

      const info = await transcodeService.getVideoInfo('dovi-p8-sdr.mp4')
      expect(info.isHdr).toBe(false)
      expect(info.hdrType).toBe('sdr')
      expect(info.dvProfile).toBe(8)
    })

    it('getVideoInfo swaps width and height when Display Matrix side data has rotation -90', async () => {
      /* eslint-disable @typescript-eslint/naming-convention */
      const mockOutput = JSON.stringify({
        format: { duration: '10.0', bit_rate: '20000000' },
        streams: [
          {
            codec_type: 'video',
            codec_name: 'hevc',
            width: 1920,
            height: 1080,
            r_frame_rate: '30/1',
            side_data_list: [
              {
                side_data_type: 'Display Matrix',
                rotation: -90,
              },
            ],
          },
        ],
      })
      /* eslint-enable @typescript-eslint/naming-convention */

      mockExecFileStdout(mockOutput)

      const info = await transcodeService.getVideoInfo('vertical-display-matrix.mp4')
      expect(info.originalWidth).toBe(1080)
      expect(info.originalHeight).toBe(1920)
      expect(info.rotation).toBe(-90)
    })

    it('getVideoInfo swaps width and height when tags.rotate is 90 or 270', async () => {
      /* eslint-disable @typescript-eslint/naming-convention */
      const mockOutput = JSON.stringify({
        format: { duration: '10.0', bit_rate: '20000000' },
        streams: [
          {
            codec_type: 'video',
            codec_name: 'h264',
            width: 1920,
            height: 1080,
            r_frame_rate: '30/1',
            tags: {
              rotate: '90',
            },
          },
        ],
      })
      /* eslint-enable @typescript-eslint/naming-convention */

      mockExecFileStdout(mockOutput)

      const info = await transcodeService.getVideoInfo('vertical-tag.mp4')
      expect(info.originalWidth).toBe(1080)
      expect(info.originalHeight).toBe(1920)
      expect(info.rotation).toBe(90)
    })

    it('getVideoInfo preserves width and height when rotation is 180 degrees', async () => {
      /* eslint-disable @typescript-eslint/naming-convention */
      const mockOutput = JSON.stringify({
        format: { duration: '10.0', bit_rate: '20000000' },
        streams: [
          {
            codec_type: 'video',
            codec_name: 'h264',
            width: 1920,
            height: 1080,
            r_frame_rate: '30/1',
            tags: {
              rotate: '180',
            },
          },
        ],
      })
      /* eslint-enable @typescript-eslint/naming-convention */

      mockExecFileStdout(mockOutput)

      const info = await transcodeService.getVideoInfo('upside-down.mp4')
      expect(info.originalWidth).toBe(1920)
      expect(info.originalHeight).toBe(1080)
      expect(info.rotation).toBe(180)
    })

    it('getVideoInfo ignores attached picture streams and selects the main video stream', async () => {
      /* eslint-disable @typescript-eslint/naming-convention */
      const mockOutput = JSON.stringify({
        format: { duration: '10.0', bit_rate: '20000000' },
        streams: [
          {
            index: 0,
            codec_type: 'video',
            codec_name: 'mjpeg',
            width: 320,
            height: 240,
            avg_frame_rate: '0/0',
            r_frame_rate: '90000/1',
            disposition: {
              attached_pic: 1,
            },
          },
          {
            index: 1,
            codec_type: 'video',
            codec_name: 'h264',
            width: 1920,
            height: 1080,
            avg_frame_rate: '24/1',
            r_frame_rate: '24/1',
            nb_frames: '240',
            disposition: {
              default: 1,
              attached_pic: 0,
            },
          },
        ],
      })
      /* eslint-enable @typescript-eslint/naming-convention */

      mockExecFileStdout(mockOutput)

      const info = await transcodeService.getVideoInfo('cover-art-first.mp4')
      expect(info.originalWidth).toBe(1920)
      expect(info.originalHeight).toBe(1080)
      expect(info.videoStreamIndex).toBe(1)
    })

    it('getVideoInfo throws error when file only contains audio and attached picture', async () => {
      /* eslint-disable @typescript-eslint/naming-convention */
      const mockOutput = JSON.stringify({
        format: { duration: '10.0', bit_rate: '320000' },
        streams: [
          {
            index: 0,
            codec_type: 'audio',
            codec_name: 'aac',
            channels: 2,
            sample_rate: '44100',
          },
          {
            index: 1,
            codec_type: 'video',
            codec_name: 'mjpeg',
            width: 320,
            height: 240,
            disposition: {
              attached_pic: 1,
            },
          },
        ],
      })
      /* eslint-enable @typescript-eslint/naming-convention */

      mockExecFileStdout(mockOutput)

      await expect(transcodeService.getVideoInfo('audio-with-cover.mp4')).rejects.toThrow(
        'No video stream found',
      )
    })

    it('compareStreams prioritizes default stream then highest bitrate', () => {
      /* eslint-disable @typescript-eslint/naming-convention */
      const s1 = { index: 0, bit_rate: '5000000', disposition: { default: 0 } }
      const s2 = { index: 1, bit_rate: '2000000', disposition: { default: 1 } }
      const s3 = { index: 2, bit_rate: '8000000', disposition: { default: 0 } }
      const s4 = { index: 3, disposition: {} }
      /* eslint-enable @typescript-eslint/naming-convention */

      const sorted = [s1, s2, s3, s4].sort(compareStreams)
      expect(sorted[0].index).toBe(1) // default: 1
      expect(sorted[1].index).toBe(2) // 8000000 bps
      expect(sorted[2].index).toBe(0) // 5000000 bps
      expect(sorted[3].index).toBe(3) // 0 bps
    })

    it('selectPrimaryVideoStream filters out attached picture streams', () => {
      /* eslint-disable @typescript-eslint/naming-convention */
      const streams = [
        { index: 0, codec_type: 'video', disposition: { attached_pic: 1 }, bit_rate: '9999999' },
        { index: 1, codec_type: 'audio', disposition: { default: 1 } },
        { index: 2, codec_type: 'video', disposition: { default: 0 }, bit_rate: '1500000' },
        { index: 3, codec_type: 'video', disposition: { default: 1 }, bit_rate: '1000000' },
      ]
      /* eslint-enable @typescript-eslint/naming-convention */

      const selected = selectPrimaryVideoStream(streams)
      expect(selected).toBeDefined()
      expect(selected?.index).toBe(3) // default: 1 non-attached
    })

    it('selectPrimaryAudioStream picks default then highest bitrate audio stream', () => {
      /* eslint-disable @typescript-eslint/naming-convention */
      const streams = [
        { index: 0, codec_type: 'video', bit_rate: '2000000' },
        { index: 1, codec_type: 'audio', disposition: { default: 0 }, bit_rate: '320000' },
        { index: 2, codec_type: 'audio', disposition: { default: 1 }, bit_rate: '128000' },
      ]
      /* eslint-enable @typescript-eslint/naming-convention */

      const selected = selectPrimaryAudioStream(streams)
      expect(selected).toBeDefined()
      expect(selected?.index).toBe(2) // default: 1 audio
    })

    it('transcodeVideo uses explicit streamIndex and audioStreamIndex in mapping', async () => {
      let executedArgs: string[] = []
      ;(
        child_process.execFile as unknown as {
          mockImplementation: (
            fn: (
              file: string,
              args: string[],
              callback: (error: Error | null, result: { stdout: string; stderr: string }) => void,
            ) => void,
          ) => void
        }
      ).mockImplementation((_file, args, callback) => {
        executedArgs = args
        callback(null, { stdout: '', stderr: '' })
      })

      await transcodeService.transcodeVideo({
        inputFile: 'input.mp4',
        outputFile: 'output.mp4',
        width: 1280,
        height: 720,
        hardwareAcceleration: 'off',
        streamIndex: 2,
        audioStreamIndex: 1,
      })

      const filterIdx = executedArgs.indexOf('-filter_complex')
      expect(filterIdx).toBeGreaterThan(-1)
      expect(executedArgs[filterIdx + 1]).toContain('[0:2]scale=')

      const mapIndices = executedArgs
        .map((arg, idx) => (arg === '-map' ? executedArgs[idx + 1] : null))
        .filter(Boolean)
      expect(mapIndices).toContain('0:1')
    })

    it('generatePoster uses explicit streamIndex in mapping', async () => {
      let executedArgs: string[] = []
      ;(
        child_process.execFile as unknown as {
          mockImplementation: (
            fn: (
              file: string,
              args: string[],
              callback: (error: Error | null, result: { stdout: string; stderr: string }) => void,
            ) => void,
          ) => void
        }
      ).mockImplementation((_file, args, callback) => {
        executedArgs = args
        callback(null, { stdout: '', stderr: '' })
      })

      await transcodeService.generatePoster('input.mp4', 'poster.webp', { streamIndex: 3 })

      const mapIdx = executedArgs.indexOf('-map')
      expect(mapIdx).toBeGreaterThan(-1)
      expect(executedArgs[mapIdx + 1]).toBe('0:3')
    })

    it('transcodeVideo preserves HDR parameters and tags when hdr is true', async () => {
      let executedArgs: string[] = []
      ;(
        child_process.execFile as unknown as {
          mockImplementation: (
            fn: (
              file: string,
              args: string[],
              cb: (err: Error | null, res: { stdout: string; stderr: string }) => void,
            ) => unknown,
          ) => void
        }
      ).mockImplementation((_file, args, cb) => {
        if (args.includes('-filters')) {
          cb(null, { stdout: ' ... zscale ... \n ... tonemap ... ', stderr: '' })
          return {}
        }
        if (args.includes('-encoders')) {
          cb(null, { stdout: ' V..... libx264 ', stderr: '' })
          return {}
        }
        executedArgs = args
        cb(null, { stdout: '', stderr: '' })
        return {}
      })

      const outputFile = path.join(tempDir, 'hdr_output.mp4')
      await transcodeService.transcodeVideo({
        inputFile: 'hdr_input.mp4',
        outputFile,
        width: 1920,
        height: 1080,
        hdr: true,
        sourceIsHdr: true,
        sourceHdrType: 'pq',
        sourceColorTransfer: 'smpte2084',
      })

      expect(executedArgs).toContain('-color_primaries')
      expect(executedArgs).toContain('bt2020')
      expect(executedArgs).toContain('-color_trc')
      expect(executedArgs).toContain('smpte2084')
      expect(executedArgs).toContain('-colorspace')
      expect(executedArgs).toContain('bt2020nc')
      expect(executedArgs).toContain('-x264-params')
      expect(executedArgs).toContain('colorprim=bt2020:transfer=smpte2084:colormatrix=bt2020nc')
    })

    it('transcodeVideo transcodes Dolby Vision Profile 5 to HDR proxy without libplacebo', async () => {
      let executedArgs: string[] = []
      ;(
        child_process.execFile as unknown as {
          mockImplementation: (
            fn: (
              file: string,
              args: string[],
              cb: (err: Error | null, res: { stdout: string; stderr: string }) => void,
            ) => unknown,
          ) => void
        }
      ).mockImplementation((_file, args, cb) => {
        if (args.includes('-filters')) {
          cb(null, { stdout: ' ... zscale ... \n ... tonemap ... ', stderr: '' })
          return {}
        }
        if (args.includes('-encoders')) {
          cb(null, { stdout: ' V..... libx264 ', stderr: '' })
          return {}
        }
        executedArgs = args
        cb(null, { stdout: '', stderr: '' })
        return {}
      })

      const outputFile = path.join(tempDir, 'dovi_p5_hdr.mp4')
      await transcodeService.transcodeVideo({
        inputFile: 'dovi_p5_input.mp4',
        outputFile,
        width: 1920,
        height: 1080,
        hdr: true,
        sourceIsHdr: true,
        sourceHdrType: 'dovi_p5',
      })

      const filterIdx = executedArgs.indexOf('-filter_complex')
      expect(filterIdx).toBeGreaterThan(-1)
      const filterComplex = executedArgs[filterIdx + 1]
      expect(filterComplex).not.toContain('libplacebo')
      expect(executedArgs).toContain('-color_primaries')
      expect(executedArgs).toContain('bt2020')
      expect(executedArgs).toContain('-color_trc')
      expect(executedArgs).toContain('smpte2084')
    })

    it('generateSprite extracts smart poster and generates sprite grid for small and short HDR inputs (single-pass)', async () => {
      const executedCommands: string[][] = []
      ;(
        child_process.execFile as unknown as {
          mockImplementation: (
            fn: (
              file: string,
              args: string[],
              cb: (err: Error | null, res: { stdout: string; stderr: string }) => void,
            ) => unknown,
          ) => void
        }
      ).mockImplementation((_file, args, cb) => {
        if (args.includes('-filters')) {
          cb(null, { stdout: ' ... zscale ... \n ... tonemap ... ', stderr: '' })
          return {}
        }
        executedCommands.push(args)
        cb(null, { stdout: '', stderr: '' })
        return {}
      })

      const inputPath = path.join(tempDir, 'short.mp4')
      fs.writeFileSync(inputPath, 'dummy short video content')
      const spritePath = path.join(tempDir, 'sprite.webp')
      const posterPath = path.join(tempDir, 'poster.webp')
      await transcodeService.generateSprite(inputPath, spritePath, posterPath, 20, undefined, {
        isHdr: true,
        hdrType: 'pq',
        colorTransfer: 'smpte2084',
      })

      // Poster command
      const posterCmd = executedCommands.find((cmd) => cmd[cmd.length - 1] === posterPath)
      expect(posterCmd).toBeDefined()
      expect(posterCmd).toContain('-skip_frame')
      expect(posterCmd).toContain('nointra')
      const posterVf = posterCmd![posterCmd!.indexOf('-vf') + 1]
      expect(posterVf).toContain('thumbnail=12')
      expect(posterVf).toContain('reverse')
      expect(posterVf).toContain('scale=-2:300')

      // Sprite command
      const spriteCmd = executedCommands.find((cmd) => cmd[cmd.length - 1] === spritePath)
      expect(spriteCmd).toBeDefined()
      const filterIdx = spriteCmd!.indexOf('-filter_complex')
      expect(filterIdx).toBeGreaterThan(-1)
      const filterStr = spriteCmd![filterIdx + 1]
      expect(filterStr).toContain('fps=')
      expect(filterStr).toContain('scale=w=300:h=-2')
      expect(filterStr).toContain('tile=10x10[sprite_out]')
    })

    it('generateSprite extracts smart poster and generates sprite grid for small and short SDR inputs (single-pass)', async () => {
      const executedCommands: string[][] = []
      ;(
        child_process.execFile as unknown as {
          mockImplementation: (
            fn: (
              file: string,
              args: string[],
              cb: (err: Error | null, res: { stdout: string; stderr: string }) => void,
            ) => unknown,
          ) => void
        }
      ).mockImplementation((_file, args, cb) => {
        executedCommands.push(args)
        cb(null, { stdout: '', stderr: '' })
        return {}
      })

      const inputPath = path.join(tempDir, 'short.mp4')
      fs.writeFileSync(inputPath, 'dummy short video content')
      const spritePath = path.join(tempDir, 'sprite.webp')
      const posterPath = path.join(tempDir, 'poster.webp')
      await transcodeService.generateSprite(inputPath, spritePath, posterPath, 20)

      // Poster command
      const posterCmd = executedCommands.find((cmd) => cmd[cmd.length - 1] === posterPath)
      expect(posterCmd).toBeDefined()
      expect(posterCmd).toContain('-skip_frame')
      expect(posterCmd).toContain('nointra')
      const posterVf = posterCmd![posterCmd!.indexOf('-vf') + 1]
      expect(posterVf).toContain('thumbnail=12')
      expect(posterVf).toContain('reverse')

      // Sprite command
      const spriteCmd = executedCommands.find((cmd) => cmd[cmd.length - 1] === spritePath)
      expect(spriteCmd).toBeDefined()
      const filterIdx = spriteCmd!.indexOf('-filter_complex')
      expect(filterIdx).toBeGreaterThan(-1)
      const filterStr = spriteCmd![filterIdx + 1]
      expect(filterStr).toContain('[0:V]fps=')
      expect(filterStr).toContain('scale=w=300:h=-2,tile=10x10[sprite_out]')
    })

    it('generateSprite uses seek-pool for long inputs (>30s) and generates sprite and poster', async () => {
      const dummyWebp = await sharp({
        create: { width: 300, height: 168, channels: 3, background: { r: 50, g: 50, b: 50 } },
      })
        .webp()
        .toBuffer()

      const executedCommands: string[][] = []
      ;(
        child_process.execFile as unknown as {
          mockImplementation: (
            fn: (
              file: string,
              args: string[],
              cb: (err: Error | null, res: { stdout: string; stderr: string }) => void,
            ) => unknown,
          ) => void
        }
      ).mockImplementation((_file, args, cb) => {
        if (args.includes('-filters')) {
          cb(null, { stdout: ' ... zscale ... \n ... tonemap ... ', stderr: '' })
          return {}
        }
        executedCommands.push(args)
        const outPath = args[args.length - 1]
        if (outPath && outPath.endsWith('.webp')) {
          fs.writeFileSync(outPath, dummyWebp)
        }
        cb(null, { stdout: '', stderr: '' })
        return {}
      })

      const inputPath = path.join(tempDir, 'long.mp4')
      fs.writeFileSync(inputPath, 'dummy long video content')
      const spritePath = path.join(tempDir, 'sprite_pool.webp')
      const posterPath = path.join(tempDir, 'poster_pool.webp')

      await transcodeService.generateSprite(inputPath, spritePath, posterPath, 120, undefined, {
        isHdr: true,
        hdrType: 'pq',
        colorTransfer: 'smpte2084',
      })

      // Poster was extracted with smart poster filter
      const posterCmd = executedCommands.find((cmd) => cmd[cmd.length - 1] === posterPath)
      expect(posterCmd).toBeDefined()
      expect(posterCmd).toContain('-skip_frame')
      expect(posterCmd).toContain('nointra')
      const posterVf = posterCmd![posterCmd!.indexOf('-vf') + 1]
      expect(posterVf).toContain('thumbnail=12')
      expect(posterVf).toContain('reverse')
      expect(posterVf).toContain('scale=-2:300')
      expect(fs.existsSync(posterPath)).toBe(true)

      // 100 seek calls were performed for frames
      const frameCmds = executedCommands.filter((cmd) => cmd[cmd.length - 1].includes('frame_'))
      expect(frameCmds.length).toBe(100)
      // Check pre-scaling before tonemap filter
      expect(frameCmds[0].some((arg) => arg.includes('scale=300:-2'))).toBe(true)

      // Sprite file was generated by Sharp
      expect(fs.existsSync(spritePath)).toBe(true)
      expect(
        vi.mocked(sharp).mock.calls.some((call) => {
          const create = (call[0] as { create?: { width: number; height: number } })?.create
          return create?.width === 8000 && create?.height === 6000
        }),
      ).toBe(true)
    })

    it('generateSprite seek-pool resiliently handles frame failure and abort signal', async () => {
      const dummyWebp = await sharp({
        create: { width: 300, height: 168, channels: 3, background: { r: 10, g: 20, b: 30 } },
      })
        .webp()
        .toBuffer()

      ;(
        child_process.execFile as unknown as {
          mockImplementation: (
            fn: (
              file: string,
              args: string[],
              cb: (err: Error | null, res: { stdout: string; stderr: string }) => void,
            ) => unknown,
          ) => void
        }
      ).mockImplementation((_file, args, cb) => {
        const outPath = args[args.length - 1]
        // Simulate failure on frame 50
        if (outPath && outPath.includes('frame_050')) {
          cb(new Error('Simulated frame decode error'), { stdout: '', stderr: 'error' })
          return {}
        }
        if (outPath && outPath.endsWith('.webp')) {
          fs.writeFileSync(outPath, dummyWebp)
        }
        cb(null, { stdout: '', stderr: '' })
        return {}
      })

      const inputPath = path.join(tempDir, 'long_fail.mp4')
      fs.writeFileSync(inputPath, 'dummy video')
      const spritePath = path.join(tempDir, 'sprite_resilient.webp')
      const posterPath = path.join(tempDir, 'poster_resilient.webp')

      // Should not throw even with frame_050 failure
      await transcodeService.generateSprite(inputPath, spritePath, posterPath, 60)
      expect(fs.existsSync(spritePath)).toBe(true)

      // Test abort signal
      const controller = new AbortController()
      controller.abort()
      await expect(
        transcodeService.generateSprite(inputPath, spritePath, posterPath, 60, controller.signal),
      ).rejects.toThrow('Sprite generation cancelled')
    })

    it('generateSprite rejects with cancellation error if aborted while Sharp toFile is pending', async () => {
      const dummyWebp = await sharp({
        create: { width: 300, height: 168, channels: 3, background: { r: 10, g: 20, b: 30 } },
      })
        .webp()
        .toBuffer()

      const controller = new AbortController()

      ;(
        child_process.execFile as unknown as {
          mockImplementation: (
            fn: (
              file: string,
              args: string[],
              optOrCb: unknown,
              maybeCb?: (err: Error | null, res: { stdout: string; stderr: string }) => void,
            ) => unknown,
          ) => void
        }
      ).mockImplementation((_file, args, optOrCb, maybeCb) => {
        const cb = (typeof optOrCb === 'function' ? optOrCb : maybeCb) as (
          err: Error | null,
          res: { stdout: string; stderr: string },
        ) => void
        const outPath = args[args.length - 1]
        if (outPath && outPath.endsWith('.webp')) {
          fs.writeFileSync(outPath, dummyWebp)
        }
        cb(null, { stdout: '', stderr: '' })
        return {}
      })

      // Hook into Sharp toFile: trigger abort while toFile is pending
      const mockSharpInstance = vi.mocked(sharp())
      mockSharpInstance.toFile.mockImplementationOnce(async (filePath: string) => {
        controller.abort()
        fs.writeFileSync(filePath, 'fake-webp-data')
        return {
          format: 'webp',
          size: 14,
          width: 3000,
          height: 1680,
          channels: 4,
          premultiplied: false,
          hasAlpha: false,
        }
      })

      const inputPath = path.join(tempDir, 'cancel_during_sharp.mp4')
      fs.writeFileSync(inputPath, 'dummy video')
      const spritePath = path.join(tempDir, 'sprite_cancel.webp')
      const posterPath = path.join(tempDir, 'poster_cancel.webp')

      await expect(
        transcodeService.generateSprite(inputPath, spritePath, posterPath, 60, controller.signal),
      ).rejects.toThrow('Sprite generation cancelled')
    })
  })

  describe('generatePoster', () => {
    it('generates poster with fast intra skipping and intelligent filter graph', async () => {
      let executedArgs: string[] = []
      ;(
        child_process.execFile as unknown as {
          mockImplementation: (
            fn: (
              file: string,
              args: string[],
              cb: (err: Error | null, res: { stdout: string; stderr: string }) => void,
            ) => unknown,
          ) => void
        }
      ).mockImplementation((_file, args, cb) => {
        executedArgs = args
        cb(null, { stdout: '', stderr: '' })
        return {}
      })

      const inputPath = path.join(tempDir, 'sample.mp4')
      const outputPath = path.join(tempDir, 'poster.webp')
      await transcodeService.generatePoster(inputPath, outputPath)

      expect(executedArgs).toContain('-skip_frame')
      expect(executedArgs).toContain('nointra')
      expect(executedArgs).toContain('-frames:v')
      expect(executedArgs).toContain('1')
      expect(executedArgs).toContain('-update')
      expect(executedArgs).toContain('1')
      expect(executedArgs).toContain('-c:v')
      expect(executedArgs).toContain('libwebp')

      const vfIndex = executedArgs.indexOf('-vf')
      expect(vfIndex).toBeGreaterThan(-1)
      const vf = executedArgs[vfIndex + 1]
      expect(vf).toContain('fps=12:start_time=0:eof_action=pass:round=down')
      expect(vf).toContain('thumbnail=12')
      expect(vf).toContain(
        'select=gt(scene\\,0.1)-eq(prev_selected_n\\,n)+isnan(prev_selected_n)+gt(n\\,20)',
      )
      expect(vf).toContain('trim=end_frame=2')
      expect(vf).toContain('reverse')
      expect(vf).toContain('scale=-2:300:force_original_aspect_ratio=decrease')
    })

    it('omits -skip_frame nointra for MPEG-TS files (.ts / .m2ts / .mts)', async () => {
      let executedArgs: string[] = []
      ;(
        child_process.execFile as unknown as {
          mockImplementation: (
            fn: (
              file: string,
              args: string[],
              cb: (err: Error | null, res: { stdout: string; stderr: string }) => void,
            ) => unknown,
          ) => void
        }
      ).mockImplementation((_file, args, cb) => {
        executedArgs = args
        cb(null, { stdout: '', stderr: '' })
        return {}
      })

      const inputPath = path.join(tempDir, 'stream.m2ts')
      const outputPath = path.join(tempDir, 'poster.webp')
      await transcodeService.generatePoster(inputPath, outputPath)

      expect(executedArgs).not.toContain('-skip_frame')
      expect(executedArgs).not.toContain('nointra')
      expect(executedArgs).toContain('-i')
      expect(executedArgs).toContain(inputPath)
    })

    it('omits -skip_frame nointra for signed remote MPEG-TS URLs with query parameters', async () => {
      let executedArgs: string[] = []
      ;(
        child_process.execFile as unknown as {
          mockImplementation: (
            fn: (
              file: string,
              args: string[],
              cb: (err: Error | null, res: { stdout: string; stderr: string }) => void,
            ) => unknown,
          ) => void
        }
      ).mockImplementation((_file, args, cb) => {
        executedArgs = args
        cb(null, { stdout: '', stderr: '' })
        return {}
      })

      const signedUrl =
        'https://storage.example.com/videos/stream.ts?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abcdef123'
      const outputPath = path.join(tempDir, 'poster.webp')
      await transcodeService.generatePoster(signedUrl, outputPath)

      expect(executedArgs).not.toContain('-skip_frame')
      expect(executedArgs).not.toContain('nointra')
      expect(executedArgs).toContain('-reconnect')
      expect(executedArgs).toContain('-i')
      expect(executedArgs).toContain(signedUrl)
    })

    it('adds reconnect options for remote input sources', async () => {
      let executedArgs: string[] = []
      ;(
        child_process.execFile as unknown as {
          mockImplementation: (
            fn: (
              file: string,
              args: string[],
              cb: (err: Error | null, res: { stdout: string; stderr: string }) => void,
            ) => unknown,
          ) => void
        }
      ).mockImplementation((_file, args, cb) => {
        executedArgs = args
        cb(null, { stdout: '', stderr: '' })
        return {}
      })

      const inputUrl = 'https://example.com/video.mp4'
      const outputPath = path.join(tempDir, 'poster.webp')
      await transcodeService.generatePoster(inputUrl, outputPath)

      expect(executedArgs).toContain('-reconnect')
      expect(executedArgs).toContain('1')
      expect(executedArgs).toContain('-reconnect_streamed')
      expect(executedArgs).toContain('-reconnect_delay_max')
    })

    it('applies HDR tone mapping filter when isHdr is true', async () => {
      let executedArgs: string[] = []
      ;(
        child_process.execFile as unknown as {
          mockImplementation: (
            fn: (
              file: string,
              args: string[],
              cb: (err: Error | null, res: { stdout: string; stderr: string }) => void,
            ) => unknown,
          ) => void
        }
      ).mockImplementation((_file, args, cb) => {
        if (args.includes('-filters')) {
          cb(null, { stdout: ' ... zscale ... \n ... tonemap ... ', stderr: '' })
          return {}
        }
        executedArgs = args
        cb(null, { stdout: '', stderr: '' })
        return {}
      })

      const inputPath = path.join(tempDir, 'hdr.mp4')
      const outputPath = path.join(tempDir, 'poster.webp')
      await transcodeService.generatePoster(inputPath, outputPath, {
        isHdr: true,
        hdrType: 'pq',
        colorTransfer: 'smpte2084',
      })

      const vfIndex = executedArgs.indexOf('-vf')
      expect(vfIndex).toBeGreaterThan(-1)
      const vf = executedArgs[vfIndex + 1]
      expect(vf).toContain('zscale=tin=smpte2084')
      expect(vf).toContain('tonemap=tonemap=hable')
      expect(vf).toContain('scale=-2:300')
    })

    it('rejects with cancellation error if aborted before or during execution', async () => {
      const controller = new AbortController()
      controller.abort()

      const inputPath = path.join(tempDir, 'aborted.mp4')
      const outputPath = path.join(tempDir, 'poster.webp')

      await expect(
        transcodeService.generatePoster(inputPath, outputPath, { signal: controller.signal }),
      ).rejects.toThrow('Poster generation cancelled')
    })
  })

  describe('HLS utilities', () => {
    it('builds master playlist correctly with bandwidth and codecs', () => {
      const playlist = buildHlsMasterPlaylist([
        { resolution: '1080p', width: 1920, height: 1080, bitrateBps: 4_500_000, isHdr: false },
        { resolution: '720p', width: 1280, height: 720, bitrateBps: 2_500_000, isHdr: false },
        { resolution: '480p', width: 854, height: 480, bitrateBps: 1_200_000, isHdr: false },
      ])

      expect(playlist).toContain('#EXTM3U')
      expect(playlist).toContain('#EXT-X-VERSION:7')
      expect(playlist).toContain('#EXT-X-INDEPENDENT-SEGMENTS')
      expect(playlist).toContain('RESOLUTION=1920x1080')
      expect(playlist).toContain('BANDWIDTH=4628000')
      expect(playlist).toContain('1080p/index.m3u8')
      expect(playlist).toContain('RESOLUTION=1280x720')
      expect(playlist).toContain('720p/index.m3u8')
      expect(playlist).toContain('RESOLUTION=854x480')
      expect(playlist).toContain('480p/index.m3u8')
    })

    it('builds master playlist with HDR codec when isHdr is true', () => {
      const playlist = buildHlsMasterPlaylist([
        { resolution: '1080p', width: 1920, height: 1080, bitrateBps: 4_500_000, isHdr: true },
      ])
      expect(playlist).toContain('CODECS="avc1.640028,mp4a.40.2"')
    })

    it('rewrites variant m3u8 playlist with presigned S3 URLs', async () => {
      const sampleM3u8 = [
        '#EXTM3U',
        '#EXT-X-VERSION:7',
        '#EXT-X-TARGETDURATION:4',
        '#EXT-X-MEDIA-SEQUENCE:0',
        '#EXT-X-PLAYLIST-TYPE:VOD',
        '#EXT-X-MAP:URI="init.mp4"',
        '#EXTINF:4.000000,',
        'segment_000.m4s',
        '#EXTINF:4.000000,',
        'segment_001.m4s',
        '#EXT-X-ENDLIST',
      ].join('\n')

      const rewritten = await rewriteM3u8WithPresignedUrls(
        sampleM3u8,
        'files/asset1/hls/1080p',
        'shumai',
      )

      expect(rewritten).toContain(
        '#EXT-X-MAP:URI="https://presigned.example.com/files/asset1/hls/1080p/init.mp4"',
      )
      expect(rewritten).toContain(
        'https://presigned.example.com/files/asset1/hls/1080p/segment_000.m4s',
      )
      expect(rewritten).toContain(
        'https://presigned.example.com/files/asset1/hls/1080p/segment_001.m4s',
      )
      expect(rewritten).toContain('#EXTINF:4.000000,')
      expect(rewritten).toContain('#EXT-X-ENDLIST')
    })

    it('executes transcodeHlsRendition with correct fMP4 CMAF parameters', async () => {
      let executedArgs: string[] = []
      // child_process.execFile mock signature
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(child_process.execFile as any).mockImplementation(
        (
          _file: string,
          args: string[],
          cb: (err: unknown, result: { stdout: string; stderr: string }) => void,
        ) => {
          executedArgs = args
          cb(null, { stdout: '', stderr: '' })
        },
      )

      const outputDir = path.join(tempDir, 'hls_output')
      fs.mkdirSync(outputDir, { recursive: true })

      await transcodeService.transcodeHlsRendition({
        inputFile: 'input.mp4',
        outputDir,
        width: 1920,
        height: 1080,
        frameRate: 30,
        hardwareAcceleration: 'off',
        threads: 4,
      })

      expect(executedArgs).toContain('-f')
      expect(executedArgs).toContain('hls')
      expect(executedArgs).toContain('-hls_segment_type')
      expect(executedArgs).toContain('fmp4')
      expect(executedArgs).toContain('-hls_fmp4_init_filename')
      expect(executedArgs).toContain('init.mp4')
      expect(executedArgs).toContain('-flags')
      expect(executedArgs).toContain('+cgop')
      expect(executedArgs).toContain('-threads')
      expect(executedArgs).toContain('4')
    })
  })
})
