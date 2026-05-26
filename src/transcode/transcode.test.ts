import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { transcodeService } from './transcode'
import * as path from 'path'
import * as child_process from 'child_process'
import { WorkflowTask } from '@/generated/prisma/client'
import sharp from 'sharp'

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn(),
}))

// Mock sharp
vi.mock('sharp', () => {
  const mockSharp = {
    resize: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    toFile: vi.fn().mockResolvedValue({}),
    metadata: vi.fn().mockResolvedValue({ width: 800, height: 600, format: 'png' }),
  }
  const sharpFunc = vi.fn(() => mockSharp)
  return {
    default: sharpFunc,
  }
})

describe('TranscodeService', () => {
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
    ;(child_process.exec as any).mockImplementation((cmd: string, cb: any) => {
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

    expect(child_process.exec).toHaveBeenCalledWith(
      expect.stringContaining('ffprobe'),
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
    expect(sharp).toHaveBeenCalledWith('test.png')
  })

  it('should construct correct ffmpeg arguments for video transcoding', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(child_process.exec as any).mockImplementation((cmd: string, cb: any) => {
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

    expect(child_process.exec).toHaveBeenCalledWith(
      expect.stringContaining('scale=w=1280:h=720'),
      expect.any(Function),
    )
    expect(child_process.exec).toHaveBeenCalledWith(
      expect.stringContaining('fps=24'),
      expect.any(Function),
    )
    // Should NOT have audio maps if disabled
    expect(child_process.exec).not.toHaveBeenCalledWith(
      expect.stringContaining('-map 0:a?'),
      expect.any(Function),
    )
  })

  it('should use sharp for image transcoding', async () => {
    const outputFile = path.join(tempDir, 'output.webp')
    await transcodeService.transcodeImage('input.png', outputFile, 480, 80)

    expect(sharp).toHaveBeenCalledWith('input.png')
    const mockSharp = vi.mocked(sharp).mock.results[0].value
    expect(mockSharp.resize).toHaveBeenCalledWith(480, null, expect.any(Object))
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
    expect(sharp).toHaveBeenCalledWith(expect.any(Buffer))
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
      hasAudio: true,
      mimeType: 'video/mp4',
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(child_process.exec as any).mockImplementation((cmd: string, cb: any) => {
      cb(null, { stdout: '', stderr: '' })
    })

    await transcodeService.extractVideoFrames({
      inputFile: 'input.mp4',
      outputDir: tempDir,
      numFrames: 10,
      frameHeight: 720,
      isImage: false,
    })

    expect(child_process.exec).toHaveBeenCalledWith(
      expect.stringContaining('-c:v libwebp'),
      expect.any(Function),
    )
  })

  it('should create transcode tasks correctly', async () => {
    const task = (await transcodeService.createVideoTranscodeTask('asset-123', {
      videoStrategy: 'single',
      thumbnail: true,
    })) as WorkflowTask

    expect(task.assetId).toBe('asset-123')
    expect(task.type).toBe('transcode')
    expect(task.status).toBe('pending')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((task.payload as any).videoStrategy).toBe('single')
  })
})
