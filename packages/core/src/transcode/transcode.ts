import { s3Service } from '@shumai/core/src/s3/s3'
import { stemFromKey } from '@shumai/core/src/utils/filename'
import { prisma, WorkflowTaskStatus, WorkflowTaskType } from '@shumai/db'
import '@shumai/db/src/prisma-json-types'
import { execFile } from 'child_process'
import { parse } from 'csv-parse/sync'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import PDFDocument from 'pdfkit'
import sharp from 'sharp'
import { ulid } from 'ulid'
import { promisify } from 'util'
import { dataFormatNames } from './dataFormatNames'

const execFileAsync = promisify(execFile)

export interface CjkFontConfig {
  fontPath: string
  fontName?: string
}

export function findCjkFontPath(): CjkFontConfig | undefined {
  const candidates: { fontPath: string; fontName?: string }[] = [
    // Custom env override
    ...(process.env.PDF_CJK_FONT_PATH
      ? [
          {
            fontPath: process.env.PDF_CJK_FONT_PATH,
            fontName: process.env.PDF_CJK_FONT_NAME,
          },
        ]
      : []),
    // macOS
    { fontPath: '/System/Library/Fonts/Supplemental/Arial Unicode.ttf' },
    { fontPath: '/Library/Fonts/Arial Unicode.ttf' },
    { fontPath: '/System/Library/Fonts/PingFang.ttc', fontName: 'PingFangSC-Regular' },
    { fontPath: '/System/Library/Fonts/STHeiti Light.ttc', fontName: 'STHeitiSC-Light' },
    // Linux / Ubuntu / Debian Noto & WenQuanYi CJK
    {
      fontPath: '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
      fontName: 'NotoSansCJKsc-Regular',
    },
    {
      fontPath: '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
      fontName: 'NotoSansCJKsc-Regular',
    },
    { fontPath: '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', fontName: 'WenQuanYiZenHei' },
    { fontPath: '/usr/share/fonts/truetype/arphic/ukai.ttc', fontName: 'AR-PL-UKai-CN' },
    {
      fontPath: '/usr/share/fonts/noto/NotoSansCJK-Regular.ttc',
      fontName: 'Noto Sans CJK SC',
    },
    // Lightweight Linux / Docker Droid Fallbacks
    { fontPath: '/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf' },
    { fontPath: '/usr/share/fonts/truetype/droid/DroidSansFallback.ttf' },
    { fontPath: '/usr/share/fonts/google-droid/DroidSansFallback.ttf' },
    // Windows CJK Fonts
    { fontPath: 'C:\\Windows\\Fonts\\msyh.ttc', fontName: 'MicrosoftYaHei' },
    { fontPath: 'C:\\Windows\\Fonts\\simsun.ttc', fontName: 'SimSun' },
    { fontPath: 'C:\\Windows\\Fonts\\simhei.ttf' },
  ]
  for (const item of candidates) {
    if (fs.existsSync(item.fontPath)) {
      return item
    }
  }
  return undefined
}

export function parseCsvContent(content: string): string[][] {
  try {
    /* eslint-disable @typescript-eslint/naming-convention */
    return parse(content, {
      skip_empty_lines: true,
      relax_column_count: true,
      relax_quotes: true,
      trim: true,
      delimiter_auto: true,
    })
  } catch {
    return content
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => line.split(',').map((cell) => cell.trim()))
  }
}

export interface MediaMetadata {
  originalWidth: number
  originalHeight: number
  duration: number
  bitRate: number
  frameRate: number
  totalFrames: number
  startTimecode?: string
  hasAudio: boolean
  videoCodec?: string
  audioCodec?: string
  audioChannels?: number
  audioSampleRate?: number
  audioBitDepth?: number
  mimeType: string
}

export interface TranscodeVideoParams {
  inputFile: string
  outputFile: string
  width: number
  height: number
  frameRate?: number | string
  disableAudio?: boolean
  overlayFile?: string
  hardwareAcceleration?: 'off' | 'auto'
  videoBitrate?: string
}

export interface EncoderConfig {
  name: string
  presetArgs: string[]
  supportsCrf: boolean
}

export const H264_ENCODER_CONFIGS: Record<string, EncoderConfig> = {
  h264_nvenc: {
    name: 'h264_nvenc',
    presetArgs: ['-preset', 'p4'],
    supportsCrf: false,
  },
  h264_qsv: {
    name: 'h264_qsv',
    presetArgs: ['-preset', 'fast'],
    supportsCrf: false,
  },
  h264_amf: {
    name: 'h264_amf',
    presetArgs: ['-quality', 'balanced'],
    supportsCrf: false,
  },
  h264_videotoolbox: {
    name: 'h264_videotoolbox',
    presetArgs: [],
    supportsCrf: false,
  },
  libx264: {
    name: 'libx264',
    presetArgs: ['-preset', 'fast'],
    supportsCrf: true,
  },
}

export function getPlatformEncoderCandidates(
  platform: NodeJS.Platform = process.platform,
): string[] {
  switch (platform) {
    case 'darwin':
      return ['h264_videotoolbox', 'h264_nvenc', 'h264_qsv', 'h264_amf']
    case 'win32':
      return ['h264_nvenc', 'h264_qsv', 'h264_amf']
    case 'linux':
    default:
      return ['h264_nvenc', 'h264_qsv', 'h264_amf']
  }
}

export function getDefaultBitrate(height: number, width?: number): string {
  const longSide = Math.max(width || 0, height)
  const shortSide = Math.min(width || height, height)
  const effectiveHeight = shortSide > 0 ? shortSide : height

  if (effectiveHeight >= 2160 || longSide >= 3840) return '12000k'
  if (effectiveHeight >= 1080 || longSide >= 1920) return '4500k'
  if (effectiveHeight >= 720 || longSide >= 1280) return '2500k'
  if (effectiveHeight >= 540 || longSide >= 960) return '1200k'
  if (effectiveHeight >= 360 || longSide >= 640) return '800k'
  return '300k'
}

export interface ExtractVideoFramesParams {
  inputFile: string
  outputDir: string
  numFrames: number
  frameHeight: number
  isImage: boolean
}

export function isPsdInput(input: string | Buffer): boolean {
  if (typeof input === 'string') {
    if (input.toLowerCase().endsWith('.psd')) return true
    if (fs.existsSync(input)) {
      try {
        const fd = fs.openSync(input, 'r')
        const buf = Buffer.alloc(4)
        fs.readSync(fd, buf, 0, 4, 0)
        fs.closeSync(fd)
        return buf.toString('ascii') === '8BPS'
      } catch {
        return false
      }
    }
    return false
  }
  return (
    input.length >= 4 &&
    input[0] === 0x38 &&
    input[1] === 0x42 &&
    input[2] === 0x50 &&
    input[3] === 0x53
  )
}
export function calculatePreviewDimensions(
  origW: number,
  origH: number,
  targetShort = 300,
  maxLong = 533,
): { width: number; height: number } {
  if (origW <= 0 || origH <= 0) {
    return { width: targetShort, height: targetShort }
  }

  const origShort = Math.min(origW, origH)
  const origLong = Math.max(origW, origH)

  if (origShort <= targetShort && origLong <= maxLong) {
    return { width: origW, height: origH }
  }

  let scale = targetShort / origShort
  const scaledLong = Math.round(origLong * scale)

  if (scaledLong > maxLong) {
    scale = maxLong / origLong
  }

  const newW = Math.max(1, Math.round(origW * scale))
  const newH = Math.max(1, Math.round(origH * scale))

  return { width: newW, height: newH }
}

export interface TranscodeImageOptions {
  height?: number | null
  isPreview?: boolean
}

export class TranscodeService {
  constructor(private readonly prismaClient: typeof prisma = prisma) {}

  private async execImageMagick(args: string[]): Promise<{ stdout: string; stderr: string }> {
    try {
      return await execFileAsync('magick', args)
    } catch (err: unknown) {
      const code = (err as Record<string, unknown>)?.code
      if (code === 'ENOENT') {
        return await execFileAsync('convert', args)
      }
      throw err
    }
  }

  private async execImageMagickIdentify(
    filePath: string,
  ): Promise<{ width: number; height: number }> {
    const fileArg = `${filePath}[0]`
    let stdout: string
    try {
      const res = await execFileAsync('magick', ['identify', '-format', '%w %h', fileArg])
      stdout = res.stdout
    } catch (err: unknown) {
      const code = (err as Record<string, unknown>)?.code
      if (code === 'ENOENT') {
        const res = await execFileAsync('identify', ['-format', '%w %h', fileArg])
        stdout = res.stdout
      } else {
        throw err
      }
    }
    const parts = stdout.trim().split(/\s+/)
    const width = parseInt(parts[0], 10) || 0
    const height = parseInt(parts[1], 10) || 0
    return { width, height }
  }

  private resolveCodecName(stream: {
    /* eslint-disable @typescript-eslint/naming-convention */
    codec_name?: string
    mime_codec_string?: string
    tags?: { mime_codec_string?: string }
    /* eslint-enable @typescript-eslint/naming-convention */
  }): string | undefined {
    const mimeCodec = stream.mime_codec_string || stream.tags?.mime_codec_string
    if (mimeCodec && typeof mimeCodec === 'string') {
      const shortCodec = mimeCodec.split('.')[0]
      if (dataFormatNames[shortCodec]) {
        return dataFormatNames[shortCodec]
      }
    }
    return stream.codec_name
  }

  private safeParseInt(value: string | number | undefined): number | undefined {
    if (value === undefined || value === null) return undefined
    const parsed = typeof value === 'string' ? parseInt(value, 10) : value
    return Number.isFinite(parsed) ? (parsed as number) : undefined
  }

  async getVideoInfo(inputFile: string): Promise<MediaMetadata> {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      inputFile,
    ])
    const info = JSON.parse(stdout)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const videoStream = info.streams.find((s: any) => s.codec_type === 'video')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const audioStream = info.streams.find((s: any) => s.codec_type === 'audio')

    if (!videoStream) {
      throw new Error('No video stream found')
    }

    let fps = 0
    if (videoStream.avg_frame_rate) {
      const parts = videoStream.avg_frame_rate.split('/')
      if (parts.length === 2) {
        const num = parseFloat(parts[0])
        const den = parseFloat(parts[1])
        if (den > 0) {
          fps = num / den
        }
      }
    }

    if (fps === 0 && videoStream.r_frame_rate) {
      const parts = videoStream.r_frame_rate.split('/')
      if (parts.length === 2) {
        const num = parseFloat(parts[0])
        const den = parseFloat(parts[1])
        if (den > 0) {
          fps = num / den
        }
      }
    }

    const duration = parseFloat(info.format.duration)
    let totalFrames = 0
    if (videoStream.nb_frames) {
      totalFrames = parseInt(videoStream.nb_frames, 10)
    }

    if (!totalFrames && fps > 0 && !isNaN(duration)) {
      totalFrames = Math.round(duration * fps)
    }
    const startTimecode = videoStream.tags?.timecode || info.format?.tags?.timecode

    return {
      originalWidth: videoStream.width,
      originalHeight: videoStream.height,
      duration,
      bitRate: parseFloat(info.format.bit_rate),
      frameRate: fps || 30,
      totalFrames: totalFrames || 0,
      startTimecode,
      hasAudio: !!audioStream,
      videoCodec: this.resolveCodecName(videoStream),
      audioCodec: audioStream ? this.resolveCodecName(audioStream) : undefined,
      audioChannels: audioStream?.channels,
      audioSampleRate: this.safeParseInt(audioStream?.sample_rate),
      audioBitDepth:
        this.safeParseInt(audioStream?.bits_per_raw_sample) ??
        this.safeParseInt(audioStream?.bits_per_sample),
      mimeType: '',
    }
  }

  async getImageInfo(inputFile: string): Promise<MediaMetadata> {
    let input: string | Buffer = inputFile
    let tempDirToCleanup: string | null = null

    if (inputFile.startsWith('http')) {
      const resp = await fetch(inputFile)
      if (!resp.ok) {
        throw new Error(`Failed to fetch image from ${inputFile}: ${resp.statusText}`)
      }
      input = Buffer.from(await resp.arrayBuffer())
    }

    if (isPsdInput(input)) {
      let psdPath: string
      if (typeof input === 'string') {
        psdPath = input
      } else {
        tempDirToCleanup = this.createTempDir('psd-info-')
        psdPath = path.join(tempDirToCleanup, 'input.psd')
        fs.writeFileSync(psdPath, input)
      }

      try {
        const { width, height } = await this.execImageMagickIdentify(psdPath)
        return {
          originalWidth: width,
          originalHeight: height,
          duration: 0,
          bitRate: 0,
          frameRate: 0,
          totalFrames: 0,
          startTimecode: undefined,
          hasAudio: false,
          mimeType: 'psd',
        }
      } catch (err) {
        console.warn('ImageMagick identify failed for PSD, falling back to sharp:', err)
      } finally {
        if (tempDirToCleanup) {
          this.removeDir(tempDirToCleanup)
        }
      }
    }

    const metadata = await sharp(input, { limitInputPixels: false }).metadata()
    return {
      originalWidth: metadata.width || 0,
      originalHeight: metadata.height || 0,
      duration: 0,
      bitRate: 0,
      frameRate: 0,
      totalFrames: 0,
      startTimecode: undefined,
      hasAudio: false,
      mimeType: metadata.format || '',
    }
  }

  private availableEncodersCache: Set<string> | null = null

  clearEncodersCache(): void {
    this.availableEncodersCache = null
  }

  async getAvailableEncoders(): Promise<Set<string>> {
    if (this.availableEncodersCache) {
      return this.availableEncodersCache
    }
    try {
      const { stdout } = await execFileAsync('ffmpeg', ['-encoders'])
      const encoders = new Set<string>()
      const lines = stdout.split('\n')
      for (const line of lines) {
        const match = line.match(/^\s*[A-Z.]{6}\s+([a-zA-Z0-9_-]+)/)
        if (match) {
          encoders.add(match[1])
        }
      }
      this.availableEncodersCache = encoders
      return encoders
    } catch (err) {
      console.warn('Failed to probe ffmpeg encoders:', err)
      return new Set<string>()
    }
  }

  async selectH264Encoder(
    hardwareAcceleration?: 'off' | 'auto',
    platform: NodeJS.Platform = process.platform,
  ): Promise<EncoderConfig> {
    if (hardwareAcceleration !== 'auto') {
      return H264_ENCODER_CONFIGS.libx264
    }

    const available = await this.getAvailableEncoders()
    const candidates = getPlatformEncoderCandidates(platform)
    for (const enc of candidates) {
      if (available.has(enc) && H264_ENCODER_CONFIGS[enc]) {
        return H264_ENCODER_CONFIGS[enc]
      }
    }

    return H264_ENCODER_CONFIGS.libx264
  }

  async transcodeVideo(params: TranscodeVideoParams): Promise<void> {
    let filterComplex: string
    const args: string[] = ['-i', params.inputFile]

    if (params.overlayFile) {
      args.push('-i', params.overlayFile)
      filterComplex = `[0:v]scale=${params.width}:${params.height}[vscaled];[vscaled][1:v]overlay=0:0`
    } else {
      filterComplex = `[0:v]scale=w=${params.width}:h=${params.height}:force_original_aspect_ratio=decrease,scale=w='trunc(iw/2)*2':h='trunc(ih/2)*2'`
    }

    if (params.frameRate) {
      filterComplex += `,fps=${params.frameRate}`
    }
    filterComplex += '[vout]'

    args.push('-filter_complex', filterComplex, '-map', '[vout]')

    if (params.frameRate) {
      let calculatedFps: number
      if (typeof params.frameRate === 'number') {
        calculatedFps = params.frameRate
      } else {
        const parts = params.frameRate.split('/')
        if (parts.length === 2) {
          calculatedFps = parseFloat(parts[0]) / parseFloat(parts[1])
        } else {
          calculatedFps = parseFloat(params.frameRate)
        }
      }
      if (Number.isFinite(calculatedFps) && calculatedFps > 0) {
        const roundedFps = Math.max(1, Math.round(calculatedFps))
        args.push(
          '-r',
          calculatedFps.toString(),
          '-g',
          roundedFps.toString(),
          '-force_key_frames',
          'expr:gte(t,n_forced*1)',
        )
      }
    }

    if (!params.disableAudio) {
      args.push('-map', '0:a?')
    }

    const encoder = await this.selectH264Encoder(params.hardwareAcceleration)
    args.push('-c:v', encoder.name)
    if (encoder.presetArgs.length > 0) {
      args.push(...encoder.presetArgs)
    }

    if (encoder.supportsCrf) {
      if (params.videoBitrate) {
        args.push('-b:v', params.videoBitrate)
      } else {
        args.push('-crf', '26')
      }
    } else {
      const bitrate = params.videoBitrate || getDefaultBitrate(params.height, params.width)
      args.push('-b:v', bitrate)
    }

    args.push('-pix_fmt', 'yuv420p')

    if (!params.disableAudio) {
      args.push('-c:a', 'aac', '-b:a', '128k')
    }

    args.push('-movflags', '+faststart', '-max_muxing_queue_size', '1024', params.outputFile)

    await execFileAsync('ffmpeg', ['-y', '-loglevel', 'warning', ...args])
  }

  async transcodeImage(
    inputFile: string | Buffer,
    outputFile: string,
    width: number,
    quality: number,
    heightOrOptions: number | null | TranscodeImageOptions = null,
  ): Promise<void> {
    const height =
      typeof heightOrOptions === 'object' && heightOrOptions !== null
        ? (heightOrOptions.height ?? null)
        : heightOrOptions
    let isPreview =
      typeof heightOrOptions === 'object' && heightOrOptions !== null
        ? (heightOrOptions.isPreview ?? false)
        : false

    // Backward compatibility shim for legacy queued tasks or old call signatures passing width 480 or height 0
    if (width === 480 || height === 0) {
      isPreview = true
    }

    let input: string | Buffer = inputFile
    if (typeof inputFile === 'string' && inputFile.startsWith('http')) {
      const resp = await fetch(inputFile)
      if (!resp.ok) {
        throw new Error(`Failed to fetch image from ${inputFile}: ${resp.statusText}`)
      }
      input = Buffer.from(await resp.arrayBuffer())
    }

    const WEBP_MAX_DIMENSION = 7680
    let targetW = width > 0 ? Math.min(width, WEBP_MAX_DIMENSION) : WEBP_MAX_DIMENSION
    let targetH = height && height > 0 ? Math.min(height, WEBP_MAX_DIMENSION) : WEBP_MAX_DIMENSION

    const sharpInstance = sharp(input, { limitInputPixels: false })

    if (isPreview) {
      try {
        const meta = await sharpInstance.metadata()
        if (meta.width && meta.height) {
          // Fallback shim: If legacy 480 caller passed width=480, map targetShort to 300
          const targetShort = width === 480 ? 300 : width
          const maxLong = Math.round((targetShort * 16) / 9)
          const dims = calculatePreviewDimensions(meta.width, meta.height, targetShort, maxLong)
          targetW = dims.width
          targetH = dims.height
        }
      } catch {
        // Fallback to targetW/targetH as calculated above
      }
    }

    // WEBP_MAX_DIMENSION (7680) safety cap is ALWAYS enforced
    targetW = Math.min(targetW, WEBP_MAX_DIMENSION)
    targetH = Math.min(targetH, WEBP_MAX_DIMENSION)

    if (isPsdInput(input)) {
      let psdPath: string
      let tempDirToCleanup: string | null = null
      if (typeof input === 'string') {
        psdPath = input
      } else {
        tempDirToCleanup = this.createTempDir('psd-transcode-')
        psdPath = path.join(tempDirToCleanup, 'input.psd')
        fs.writeFileSync(psdPath, input)
      }

      try {
        const resizeGeometry =
          targetH < WEBP_MAX_DIMENSION
            ? `${targetW}x${targetH}>`
            : `${targetW}x${WEBP_MAX_DIMENSION}>`

        await this.execImageMagick([
          `${psdPath}[0]`,
          '-colorspace',
          'sRGB',
          '-resize',
          resizeGeometry,
          '-quality',
          quality.toString(),
          outputFile,
        ])
        return
      } finally {
        if (tempDirToCleanup) {
          this.removeDir(tempDirToCleanup)
        }
      }
    }

    sharpInstance.toColorspace('srgb').resize(targetW, targetH, {
      withoutEnlargement: true,
      fit: 'inside',
    })

    await sharpInstance.webp({ quality }).toFile(outputFile)
  }

  async generateSprite(
    inputFile: string,
    outputSprite: string,
    outputPoster: string,
    duration: number,
  ): Promise<void> {
    const spriteFps = 100 / duration
    const filterComplex = `[0:v]fps=${spriteFps},scale=w=300:h=-2,tile=10x10[sprite_out];[0:v]scale=-2:300:force_original_aspect_ratio=decrease,select='eq(n\\,0)'[thumb_out]`

    const args = [
      '-i',
      inputFile,
      '-filter_complex',
      filterComplex,
      '-map',
      '[sprite_out]',
      '-frames:v',
      '1',
      '-c:v',
      'libwebp',
      '-q:v',
      '75',
      outputSprite,
      '-map',
      '[thumb_out]',
      '-c:v',
      'libwebp',
      '-q:v',
      '75',
      '-frames:v',
      '1',
      '-max_muxing_queue_size',
      '1024',
      outputPoster,
    ]
    await execFileAsync('ffmpeg', ['-y', '-loglevel', 'warning', ...args])
  }

  async generatePdfSprite(
    inputFile: string,
    outputSprite: string,
    outputPoster: string,
  ): Promise<{ pageCount: number; originalWidth: number; originalHeight: number }> {
    const tmpDir = this.createTempDir('pdf-sprite-')
    try {
      const pagePrefix = path.join(tmpDir, 'page')
      try {
        await execFileAsync('pdftoppm', ['-png', '-f', '1', '-l', '100', inputFile, pagePrefix])
      } catch (err) {
        const errCode = (err as Record<string, unknown>)?.code
        const msg = err instanceof Error ? err.message : String(err)
        const lower = msg.toLowerCase()
        if (
          errCode === 'ENOENT' ||
          lower.includes('enoent') ||
          (lower.includes('not found') && lower.includes('pdftoppm'))
        ) {
          throw new Error(
            `pdftoppm executable not found in $PATH. Please install poppler-utils / poppler. (${msg})`,
            { cause: err },
          )
        }
        throw err
      }

      const files = fs.readdirSync(tmpDir).filter((f) => f.endsWith('.png'))
      if (files.length === 0) {
        throw new Error('pdftoppm produced no image outputs')
      }

      files.sort((a, b) => {
        const numA = parseInt(a.replace(/[^0-9]/g, ''), 10)
        const numB = parseInt(b.replace(/[^0-9]/g, ''), 10)
        return numA - numB
      })

      const extractedCount = files.length
      const firstPagePath = path.join(tmpDir, files[0])
      const firstMeta = await sharp(firstPagePath, { limitInputPixels: false }).metadata()
      const originalWidth = firstMeta.width || 800
      const originalHeight = firstMeta.height || 1000

      for (let f = 1; f <= 100; f++) {
        const pageIdx = Math.min(extractedCount - 1, Math.floor(((f - 1) * extractedCount) / 100))
        const srcPath = path.join(tmpDir, files[pageIdx])
        const destPath = path.join(tmpDir, `frame_${f}.png`)
        if (srcPath !== destPath) {
          fs.copyFileSync(srcPath, destPath)
        }
      }

      const spriteArgs = [
        '-i',
        path.join(tmpDir, 'frame_%d.png'),
        '-filter_complex',
        'scale=w=300:h=-2,tile=10x10',
        '-frames:v',
        '1',
        '-c:v',
        'libwebp',
        '-q:v',
        '75',
        outputSprite,
      ]
      await execFileAsync('ffmpeg', ['-y', '-loglevel', 'warning', ...spriteArgs])

      await sharp(firstPagePath, { limitInputPixels: false })
        .toColorspace('srgb')
        .resize(300, 533, { withoutEnlargement: true, fit: 'inside' })
        .webp({ quality: 75 })
        .toFile(outputPoster)

      let totalPages = extractedCount
      try {
        const { stdout } = await execFileAsync('pdfinfo', [inputFile])
        const match = stdout.match(/Pages:\s+(\d+)/)
        if (match) {
          totalPages = parseInt(match[1], 10)
        }
      } catch {
        // Fallback to extracted count if pdfinfo is unavailable
      }

      return {
        pageCount: totalPages,
        originalWidth,
        originalHeight,
      }
    } finally {
      this.removeDir(tmpDir)
    }
  }

  async getPdfInfo(inputFile: string): Promise<MediaMetadata> {
    const tmpDir = this.createTempDir('pdf-info-')
    let originalWidth = 800
    let originalHeight = 1000
    let pageCount = 1

    try {
      const pagePrefix = path.join(tmpDir, 'page')
      await execFileAsync('pdftoppm', ['-png', '-f', '1', '-l', '1', inputFile, pagePrefix])
      const files = fs.readdirSync(tmpDir).filter((f) => f.endsWith('.png'))
      if (files.length > 0) {
        const meta = await sharp(path.join(tmpDir, files[0]), {
          limitInputPixels: false,
        }).metadata()
        originalWidth = meta.width || 800
        originalHeight = meta.height || 1000
      }
    } catch (err) {
      console.warn('pdftoppm not available for PDF dimensions extraction:', err)
    }

    try {
      const { stdout } = await execFileAsync('pdfinfo', [inputFile])
      const match = stdout.match(/Pages:\s+(\d+)/)
      if (match) {
        pageCount = parseInt(match[1], 10)
      }
    } catch {
      // Fallback
    } finally {
      this.removeDir(tmpDir)
    }

    return {
      originalWidth,
      originalHeight,
      duration: 0,
      bitRate: 0,
      frameRate: 0,
      totalFrames: pageCount,
      hasAudio: false,
      mimeType: 'application/pdf',
    }
  }

  async generatePdfFromText(inputFile: string, outputFile: string): Promise<void> {
    const content = fs.readFileSync(inputFile, 'utf-8')
    const containsCjk = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff\uac00-\ud7af]/.test(
      content,
    )
    const cjkFont = containsCjk ? findCjkFontPath() : undefined

    return new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true,
      })
      const writeStream = fs.createWriteStream(outputFile)
      doc.pipe(writeStream)

      if (cjkFont) {
        if (cjkFont.fontName !== undefined) {
          doc.font(cjkFont.fontPath, cjkFont.fontName)
        } else {
          doc.font(cjkFont.fontPath)
        }
      } else {
        doc.font('Helvetica')
      }
      doc.fontSize(10)

      doc.text(content, {
        lineGap: 3,
        paragraphGap: 4,
      })

      doc.end()

      writeStream.on('finish', () => resolve())
      writeStream.on('error', (err) => reject(err))
    })
  }

  async generatePdfFromCsv(inputFile: string, outputFile: string): Promise<void> {
    const content = fs.readFileSync(inputFile, 'utf-8')
    const rows = parseCsvContent(content)
    const containsCjk = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff\uac00-\ud7af]/.test(
      content,
    )
    const cjkFont = containsCjk ? findCjkFontPath() : undefined

    if (rows.length === 0) {
      rows.push(['(Empty CSV)'])
    }

    const maxCols = Math.max(...rows.map((r) => r.length))
    const isLandscape = maxCols > 5

    return new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        layout: isLandscape ? 'landscape' : 'portrait',
        margin: 30,
        bufferPages: true,
      })
      const writeStream = fs.createWriteStream(outputFile)
      doc.pipe(writeStream)

      const setFont = () => {
        if (cjkFont) {
          if (cjkFont.fontName !== undefined) {
            doc.font(cjkFont.fontPath, cjkFont.fontName)
          } else {
            doc.font(cjkFont.fontPath)
          }
        } else {
          doc.font('Helvetica')
        }
        doc.fontSize(9)
      }

      setFont()

      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
      const colWidth = Math.max(40, pageWidth / maxCols)

      const startX = doc.page.margins.left
      let startY = doc.page.margins.top
      const rowHeight = 20

      const drawRow = (row: string[], isHeader: boolean, y: number) => {
        if (isHeader) {
          doc.rect(startX, y, colWidth * maxCols, rowHeight).fill('#e0e0e0')
          doc.fillColor('#000000')
        }
        for (let col = 0; col < maxCols; col++) {
          const text = row[col] || ''
          const x = startX + col * colWidth
          doc.rect(x, y, colWidth, rowHeight).stroke('#cccccc')
          doc.fillColor('#000000').text(text, x + 4, y + 5, {
            width: colWidth - 8,
            height: rowHeight - 6,
            ellipsis: true,
          })
        }
      }

      const headerRow = rows[0]
      drawRow(headerRow, true, startY)
      startY += rowHeight

      for (let r = 1; r < rows.length; r++) {
        if (startY + rowHeight > doc.page.height - doc.page.margins.bottom) {
          doc.addPage()
          setFont()
          startY = doc.page.margins.top
          drawRow(headerRow, true, startY)
          startY += rowHeight
        }
        drawRow(rows[r], false, startY)
        startY += rowHeight
      }

      doc.end()

      writeStream.on('finish', () => resolve())
      writeStream.on('error', (err) => reject(err))
    })
  }

  async extractAudio(inputFile: string, outputFile: string, bitrate: string): Promise<void> {
    const args = ['-i', inputFile, '-vn', '-acodec', 'libmp3lame', '-b:a', bitrate, outputFile]
    await execFileAsync('ffmpeg', ['-y', '-loglevel', 'warning', ...args])
  }

  async getAudioInfo(inputFile: string): Promise<MediaMetadata> {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      inputFile,
    ])
    const info = JSON.parse(stdout)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const audioStream = info.streams.find((s: any) => s.codec_type === 'audio')

    if (!audioStream) {
      throw new Error('No audio stream found')
    }

    const duration = parseFloat(info.format.duration)

    return {
      originalWidth: 0,
      originalHeight: 0,
      duration: isNaN(duration) ? 0 : duration,
      bitRate: parseFloat(info.format.bit_rate) || 0,
      frameRate: 0,
      totalFrames: 0,
      startTimecode: undefined,
      hasAudio: true,
      videoCodec: undefined,
      audioCodec: this.resolveCodecName(audioStream),
      audioChannels: audioStream?.channels,
      audioSampleRate: this.safeParseInt(audioStream?.sample_rate),
      audioBitDepth:
        this.safeParseInt(audioStream?.bits_per_raw_sample) ??
        this.safeParseInt(audioStream?.bits_per_sample),
      mimeType: '',
    }
  }

  async transcodeAudio(params: {
    inputFile: string
    outputFile: string
    bitrate?: string
  }): Promise<void> {
    const bitrate = params.bitrate || '128k'
    const args = [
      '-i',
      params.inputFile,
      '-vn',
      '-c:a',
      'aac',
      '-b:a',
      bitrate,
      '-ac',
      '2',
      params.outputFile,
    ]
    await execFileAsync('ffmpeg', ['-y', '-loglevel', 'warning', ...args])
  }

  async extractVideoFrames(params: ExtractVideoFramesParams): Promise<string[]> {
    if (params.isImage) {
      const outputFile = path.join(params.outputDir, '1.webp')
      await this.transcodeImage(params.inputFile, outputFile, -1, 80, params.frameHeight)
      return [outputFile]
    }

    const meta = await this.getVideoInfo(params.inputFile)
    const fps = params.numFrames / meta.duration
    const outputPattern = path.join(params.outputDir, '%d.webp')

    const args = [
      '-i',
      params.inputFile,
      '-vf',
      `fps=${fps},scale=-2:${params.frameHeight}`,
      '-c:v',
      'libwebp',
      '-q:v',
      '80',
      outputPattern,
    ]
    await execFileAsync('ffmpeg', ['-y', '-loglevel', 'warning', ...args])

    const files = fs.readdirSync(params.outputDir)
    return files
      .filter((f) => f.endsWith('.webp'))
      .sort((a, b) => {
        const na = parseInt(path.basename(a, '.webp'))
        const nb = parseInt(path.basename(b, '.webp'))
        return na - nb
      })
      .map((f) => path.join(params.outputDir, f))
  }

  createTempDir(prefix: string): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  }

  removeDir(dir: string): void {
    fs.rmSync(dir, { recursive: true, force: true })
  }

  // --- Task Creation Helpers ---

  async createVideoTranscodeTask(assetId: string, projectId: string, spec: PrismaJson.TaskSpec) {
    return this.prismaClient.workflowTask.create({
      data: {
        assetId,
        projectId,
        type: WorkflowTaskType.transcode_video,
        status: WorkflowTaskStatus.pending,
        payload: {
          projectId,
          transcode: spec,
        },
      },
    })
  }

  async createImageTranscodeTask(assetId: string, projectId: string, spec: PrismaJson.TaskSpec) {
    return this.prismaClient.workflowTask.create({
      data: {
        assetId,
        projectId,
        type: WorkflowTaskType.transcode_image,
        status: WorkflowTaskStatus.pending,
        payload: {
          projectId,
          transcode: spec,
        },
      },
    })
  }

  async takeScreenshots(params: {
    assetKey: string
    assetId: string
    start: number
    end: number
    count: number
    commentTimestamp?: number | null
    annotations?: PrismaJson.AnnotationList | null
  }): Promise<Array<{ key: string; timestamp: number }>> {
    const bucket = process.env.S3_BUCKET || 'shumai'
    const tmpDir = this.createTempDir('screenshot-')
    const videoPath = path.join(tmpDir, path.basename(params.assetKey))

    try {
      // 1. Download video
      await s3Service.downloadToFile(bucket, params.assetKey, videoPath)

      // 2. Generate timestamps
      let timestamps: number[] = []
      if (params.count <= 1) {
        timestamps = [params.start]
      } else {
        const step = (params.end - params.start) / params.count
        timestamps = Array.from({ length: params.count }, (_, i) => params.start + i * step)
      }

      // 3. Snap closest timestamp to commentTimestamp if within range (with 100ms tolerance)
      const commentTimestamp = params.commentTimestamp
      const EPSILON = 0.1
      if (commentTimestamp !== undefined && commentTimestamp !== null) {
        const inRange =
          commentTimestamp >= params.start - EPSILON && commentTimestamp <= params.end + EPSILON
        if (inRange) {
          let closestIdx = 0
          let minDiff = Math.abs(timestamps[0] - commentTimestamp)
          for (let i = 1; i < timestamps.length; i++) {
            const diff = Math.abs(timestamps[i] - commentTimestamp)
            if (diff < minDiff) {
              minDiff = diff
              closestIdx = i
            }
          }
          timestamps[closestIdx] = commentTimestamp
        }
      }

      const results: Array<{ key: string; timestamp: number }> = []

      // 4. Extract each screenshot
      for (const t of timestamps) {
        const outName = `shot-${t.toFixed(3)}-${ulid()}.webp`
        const localShotPath = path.join(tmpDir, outName)

        const args = [
          '-ss',
          t.toFixed(3),
          '-i',
          videoPath,
          '-vframes',
          '1',
          '-vf',
          'scale=-2:720',
          '-c:v',
          'libwebp',
          '-q:v',
          '80',
          localShotPath,
        ]
        await execFileAsync('ffmpeg', ['-y', '-loglevel', 'warning', ...args])

        const isMatch =
          commentTimestamp !== undefined &&
          commentTimestamp !== null &&
          Math.abs(t - commentTimestamp) < 1e-4

        // 5. Overlay annotations if timestamp matches commentTimestamp (within float tolerance)
        if (isMatch && params.annotations && params.annotations.length > 0) {
          const shotBuffer = fs.readFileSync(localShotPath)
          const composited = await this.overlayAnnotationsOnBuffer(shotBuffer, params.annotations)
          fs.writeFileSync(localShotPath, composited)
        }

        // 6. Upload to S3
        const s3Key = `files/${params.assetId}/screenshots/${outName}`
        const fileBuffer = fs.readFileSync(localShotPath)
        await s3Service.putObject(bucket, s3Key, fileBuffer, fileBuffer.length, 'image/webp')

        results.push({ key: s3Key, timestamp: t })
      }

      return results
    } finally {
      this.removeDir(tmpDir)
    }
  }

  async renderPdfPages(params: {
    assetKey: string
    assetId: string
    start: number
    end: number
    commentTimestamp?: number | null
    annotations?: PrismaJson.AnnotationList | null
  }): Promise<Array<{ key: string; page: number }>> {
    const bucket = process.env.S3_BUCKET || 'shumai'
    const tmpDir = this.createTempDir('pdf-pages-')
    const pdfPath = path.join(tmpDir, path.basename(params.assetKey))

    try {
      // 1. Download PDF file
      await s3Service.downloadToFile(bucket, params.assetKey, pdfPath)

      // 2. Render pages via pdftoppm (-png -f start -l end)
      const pagePrefix = path.join(tmpDir, 'page')
      try {
        await execFileAsync('pdftoppm', [
          '-png',
          '-f',
          params.start.toString(),
          '-l',
          params.end.toString(),
          pdfPath,
          pagePrefix,
        ])
      } catch (err) {
        const errCode = (err as Record<string, unknown>)?.code
        const msg = err instanceof Error ? err.message : String(err)
        const lower = msg.toLowerCase()
        if (
          errCode === 'ENOENT' ||
          lower.includes('enoent') ||
          (lower.includes('not found') && lower.includes('pdftoppm'))
        ) {
          throw new Error(
            `pdftoppm executable not found in $PATH. Please install poppler-utils / poppler. (${msg})`,
            { cause: err },
          )
        }
        throw err
      }

      const files = fs.readdirSync(tmpDir).filter((f) => f.endsWith('.png'))
      if (files.length === 0) {
        throw new Error('pdftoppm produced no image outputs')
      }

      files.sort((a, b) => {
        const numA = parseInt(a.replace(/[^0-9]/g, ''), 10)
        const numB = parseInt(b.replace(/[^0-9]/g, ''), 10)
        return numA - numB
      })

      const results: Array<{ key: string; page: number }> = []
      const stem = stemFromKey(params.assetKey)

      for (let i = 0; i < files.length; i++) {
        const pageNum = params.start + i
        const localPngPath = path.join(tmpDir, files[i])
        const webpName = `${stem}-page-${pageNum}-${ulid()}.webp`

        let webpBuffer = await sharp(localPngPath, { limitInputPixels: false })
          .toColorspace('srgb')
          .resize(1920, 1080, { fit: 'inside', withoutEnlargement: false })
          .webp({ quality: 85 })
          .toBuffer()

        // Overlay annotations if comment page matches pageNum
        const commentPage =
          params.commentTimestamp !== undefined && params.commentTimestamp !== null
            ? Math.round(params.commentTimestamp)
            : null

        if (
          commentPage !== null &&
          pageNum === commentPage &&
          params.annotations &&
          params.annotations.length > 0
        ) {
          webpBuffer = await this.overlayAnnotationsOnBuffer(webpBuffer, params.annotations)
        }

        // Upload to S3 directly from buffer
        const s3Key = `files/${params.assetId}/pdf_pages/${webpName}`
        await s3Service.putObject(bucket, s3Key, webpBuffer, webpBuffer.length, 'image/webp')

        results.push({ key: s3Key, page: pageNum })
      }

      return results
    } finally {
      this.removeDir(tmpDir)
    }
  }

  async overlayAnnotationsOnBuffer(
    imageBuffer: Buffer,
    annotations: PrismaJson.AnnotationList,
  ): Promise<Buffer> {
    if (!annotations || annotations.length === 0) {
      return imageBuffer
    }

    const meta = await sharp(imageBuffer, { limitInputPixels: false }).metadata()
    const width = meta.width || 1920
    const height = meta.height || 1080

    const svgStr = renderAnnotationsToSvg(width, height, annotations)
    return await sharp(imageBuffer, { limitInputPixels: false })
      .composite([{ input: Buffer.from(svgStr), top: 0, left: 0 }])
      .toColorspace('srgb')
      .resize(16383, 16383, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer()
  }

  async overlayAnnotations(params: {
    assetKey: string
    assetId: string
    annotations: PrismaJson.AnnotationList
  }): Promise<string> {
    const bucket = process.env.S3_BUCKET || 'shumai'
    const outName = `annotation-${ulid()}.webp`
    const tmpDir = this.createTempDir('annotation-')
    const imgPath = path.join(tmpDir, path.basename(params.assetKey))

    try {
      // 1. Download image
      await s3Service.downloadToFile(bucket, params.assetKey, imgPath)
      const inputBuffer = fs.readFileSync(imgPath)

      // 2. Overlay annotations in memory using helper method
      const compositedBuffer = await this.overlayAnnotationsOnBuffer(
        inputBuffer,
        params.annotations,
      )

      // 3. Upload to S3
      const s3Key = `files/${params.assetId}/annotations/${outName}`
      await s3Service.putObject(
        bucket,
        s3Key,
        compositedBuffer,
        compositedBuffer.length,
        'image/webp',
      )

      return s3Key
    } finally {
      this.removeDir(tmpDir)
    }
  }

  /**
   * Renders an SVG string to a PNG buffer. Used by the watermark workflow to
   * rasterize the overlay before compositing it onto images or feeding it to
   * ffmpeg for video overlays.
   */
  async renderSvgToPng(svgString: string): Promise<Buffer> {
    return sharp(Buffer.from(svgString)).png().toBuffer()
  }

  /**
   * Downscales an image buffer to a bounded size and normalizes it to PNG.
   * Used for watermark block images embedded into the SVG overlay, so large
   * logo assets don't balloon the SVG/base64 payload.
   */
  async downscaleImageToPng(
    buffer: Buffer,
    maxDimension: number,
  ): Promise<{ buffer: Buffer; width: number; height: number }> {
    const processed = await sharp(buffer, { limitInputPixels: false })
      .resize(maxDimension, maxDimension, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer()
    const meta = await sharp(processed).metadata()
    return {
      buffer: processed,
      width: meta.width || 100,
      height: meta.height || 100,
    }
  }

  /**
   * Composites an overlay PNG onto an image file and writes a WebP file.
   * Used by the watermark workflow to produce watermarked image proxies.
   */
  async compositeOverlayToWebpFile(
    inputPath: string,
    overlayPngBuffer: Buffer,
    outputPath: string,
    width: number,
    height: number,
  ): Promise<void> {
    await sharp(inputPath, { limitInputPixels: false })
      .toColorspace('srgb')
      .resize(width, height, { fit: 'inside' })
      .composite([{ input: overlayPngBuffer }])
      .webp({ quality: 90 })
      .toFile(outputPath)
  }
}

function renderAnnotationsToSvg(
  width: number,
  height: number,
  annotations: PrismaJson.AnnotationList,
): string {
  const strokeWidth = Math.max(2, Math.round(Math.max(width, height) * 0.004))
  const svgElements: string[] = []

  for (const ann of annotations) {
    const color = ann.color || '#ff0000'
    const type = ann.type

    switch (type) {
      case 'box': {
        if (ann.points.length < 2) continue
        const [start, end] = ann.points
        const x = Math.min(start[0], end[0]) * width
        const y = Math.min(start[1], end[1]) * height
        const boxWidth = Math.abs(end[0] - start[0]) * width
        const boxHeight = Math.abs(end[1] - start[1]) * height

        svgElements.push(
          `<rect x="${x}" y="${y}" width="${boxWidth}" height="${boxHeight}" stroke="${color}" stroke-width="${strokeWidth}" fill="none" />`,
        )
        break
      }
      case 'line':
      case 'freehand': {
        if (ann.points.length < 2) continue
        const pointsStr = ann.points.map(([px, py]) => `${px * width},${py * height}`).join(' ')
        svgElements.push(
          `<polyline points="${pointsStr}" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" fill="none" />`,
        )
        break
      }
      case 'arrow': {
        if (ann.points.length < 2) continue
        const pts = ann.points.map(([px, py]) => [px * width, py * height])
        const pointsStr = pts.map(([x, y]) => `${x},${y}`).join(' ')

        svgElements.push(
          `<polyline points="${pointsStr}" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" fill="none" />`,
        )

        const endPt = pts[pts.length - 1]
        const prevPt = pts[pts.length - 2]
        const dx = endPt[0] - prevPt[0]
        const dy = endPt[1] - prevPt[1]
        const angle = Math.atan2(dy, dx)

        const pointerLength = Math.max(12, Math.max(width, height) * 0.015)
        const x1 = endPt[0] - pointerLength * Math.cos(angle - Math.PI / 6)
        const y1 = endPt[1] - pointerLength * Math.sin(angle - Math.PI / 6)
        const x2 = endPt[0] - pointerLength * Math.cos(angle + Math.PI / 6)
        const y2 = endPt[1] - pointerLength * Math.sin(angle + Math.PI / 6)

        svgElements.push(
          `<polygon points="${endPt[0]},${endPt[1]} ${x1},${y1} ${x2},${y2}" fill="${color}" />`,
        )
        break
      }
    }
  }

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${svgElements.join(
    '\n',
  )}</svg>`
}

export const transcodeService = new TranscodeService()
