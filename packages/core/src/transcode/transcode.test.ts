import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { transcodeService } from './transcode'
import { s3Service } from '@shumai/core/src/s3/s3'
import * as path from 'path'
import * as child_process from 'child_process'
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
    webp: vi.fn().mockReturnThis(),
    composite: vi.fn().mockReturnThis(),
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

  it('should use sharp for image transcoding', async () => {
    const outputFile = path.join(tempDir, 'output.webp')
    await transcodeService.transcodeImage('input.png', outputFile, 480, 80)

    expect(sharp).toHaveBeenCalledWith('input.png', { limitInputPixels: false })
    const mockSharp = vi.mocked(sharp).mock.results[0].value
    expect(mockSharp.resize).toHaveBeenCalledWith(480, 7680, expect.any(Object))
    expect(mockSharp.webp).toHaveBeenCalledWith({ quality: 80 })
    expect(mockSharp.toFile).toHaveBeenCalledWith(outputFile)
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
    expect(mockSharp.resize).toHaveBeenCalledWith(480, 7680, expect.any(Object))
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
    expect(task.type).toBe('transcode')
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
      expect.arrayContaining(['-filter_complex', 'scale=w=480:h=-2,tile=10x10']),
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
})
