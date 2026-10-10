import { s3Service } from '@shumai/core/src/s3/s3'
import { getDerivedArtifactDirectory, stemFromKey } from '@shumai/core/src/utils/filename'
import { prisma, WorkflowTaskStatus, WorkflowTaskType } from '@shumai/db'
import '@shumai/db/src/prisma-json-types'
import { execFile } from 'child_process'
import { parse } from 'csv-parse/sync'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import PDFDocument from 'pdfkit'
import sharp, { type Metadata as SharpMetadata } from 'sharp'
import { ulid } from 'ulid'
import { promisify } from 'util'
import { mapConcurrent } from '../utils/async'
import { isRawImage } from '../utils/raw'
import { dataFormatNames } from './dataFormatNames'
import { extractAndValidateRawPreview, EXIF_ORIENTATION_TO_ROTATION } from './raw-extract'
import { logger } from '@shumai/core/src/logger'

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

export type HdrType = 'pq' | 'hlg' | 'dovi_p5' | 'dovi_p8' | 'sdr'

export interface GeneratePosterOptions {
  isHdr?: boolean
  hdrType?: HdrType
  colorTransfer?: string
  signal?: AbortSignal
  streamIndex?: number
}

export interface FfprobeStreamLike {
  index: number
  codec_type?: string
  codec_name?: string
  bit_rate?: string
  avg_frame_rate?: string
  r_frame_rate?: string
  nb_frames?: string
  width?: number
  height?: number
  channels?: number
  sample_rate?: string | number
  bits_per_raw_sample?: string | number
  bits_per_sample?: string | number
  color_transfer?: string
  color_primaries?: string
  color_space?: string
  disposition?: Record<string, number | undefined>
  tags?: Record<string, string | undefined>
  side_data_list?: Array<Record<string, unknown>>
  mime_codec_string?: string
  [key: string]: unknown
}

/**
 * Immich-compatible stream comparator:
 * 1. Streams with disposition.default: 1 come first.
 * 2. Ties are broken by higher bit_rate.
 */
export function compareStreams<T extends FfprobeStreamLike>(a: T, b: T): number {
  const defDiff = (b.disposition?.default ?? 0) - (a.disposition?.default ?? 0)
  if (defDiff !== 0) return defDiff
  const aBitrate = parseInt(a.bit_rate || '0', 10) || 0
  const bBitrate = parseInt(b.bit_rate || '0', 10) || 0
  return bBitrate - aBitrate
}

export function selectPrimaryVideoStream<T extends FfprobeStreamLike>(streams: T[]): T | undefined {
  return streams
    .filter((s) => s.codec_type === 'video' && !s.disposition?.attached_pic)
    .sort(compareStreams)[0]
}

export function selectPrimaryAudioStream<T extends FfprobeStreamLike>(streams: T[]): T | undefined {
  return streams.filter((s) => s.codec_type === 'audio').sort(compareStreams)[0]
}

export interface MediaMetadata {
  originalWidth: number
  originalHeight: number
  duration: number
  bitRate: number
  videoBitRate?: number
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
  colorTransfer?: string
  colorPrimaries?: string
  colorSpace?: string
  isHdr?: boolean
  hdrType?: HdrType
  dvProfile?: number
  dvCompatibilityId?: number
  rotation?: number
  videoStreamIndex?: number
  audioStreamIndex?: number
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
  sourceVideoBitrate?: number
  threads?: number
  signal?: AbortSignal
  hdr?: boolean
  sourceIsHdr?: boolean
  sourceHdrType?: HdrType
  sourceColorTransfer?: string
  sourceColorPrimaries?: string
  sourceColorSpace?: string
  /** Source rotation in degrees from MediaMetadata; probed when omitted. */
  sourceRotation?: number
  streamIndex?: number
  audioStreamIndex?: number
}

export interface TranscodeHlsRenditionParams {
  inputFile: string
  outputDir: string
  width: number
  height: number
  frameRate?: number | string
  disableAudio?: boolean
  overlayFile?: string
  hardwareAcceleration?: 'off' | 'auto'
  videoBitrate?: string
  sourceVideoBitrate?: number
  threads?: number
  signal?: AbortSignal
  hdr?: boolean
  sourceIsHdr?: boolean
  sourceHdrType?: HdrType
  sourceColorTransfer?: string
  sourceColorPrimaries?: string
  sourceColorSpace?: string
  segmentDuration?: number
  /** Source rotation in degrees from MediaMetadata; probed when omitted. */
  sourceRotation?: number
  streamIndex?: number
  audioStreamIndex?: number
}

export interface EncoderConfig {
  name: string
  presetArgs: string[]
}

export const H264_ENCODER_CONFIGS: Record<string, EncoderConfig> = {
  h264_nvenc: {
    name: 'h264_nvenc',
    presetArgs: ['-preset', 'p4', '-rc:v', 'vbr', '-cq:v', '26', '-b:v', '0'],
  },
  h264_qsv: {
    name: 'h264_qsv',
    presetArgs: ['-preset', 'fast', '-global_quality', '26'],
  },
  h264_vaapi: {
    name: 'h264_vaapi',
    presetArgs: ['-compression_level', '4'],
  },
  h264_rkmpp: {
    name: 'h264_rkmpp',
    presetArgs: ['-level', '51', '-rc_mode', 'AVBR'],
  },
  h264_amf: {
    name: 'h264_amf',
    presetArgs: ['-quality', 'balanced', '-rc', 'qvbr', '-qvbr_quality_level', '26'],
  },
  h264_videotoolbox: {
    name: 'h264_videotoolbox',
    presetArgs: [],
  },
  libx264: {
    name: 'libx264',
    presetArgs: ['-preset', 'fast', '-crf', '23', '-bf', '0'],
  },
}

/**
 * How an encoder can also decode and scale on its own device, so frames stay in
 * GPU memory instead of being decoded and scaled on the CPU and uploaded.
 * Matches Immich's hardware acceleration pipelines for NVENC (CUDA), QSV, VAAPI,
 * and RKMPP.
 */
export interface HardwareDecodeConfig {
  /** Input options placed before `-i` (after any `-init_hw_device`). */
  inputArgs: string[]
  /** Dynamic input options generator taking device info if applicable. */
  getInputArgs?: (driDevice?: string) => string[]
  /** Output options placed after the filter graph. */
  outputArgs: string[]
  /** GPU filter fitting the frame within width x height with even dimensions. */
  scaleFilter: (width: number, height: number) => string
}

export function resolveHwDecodeInputArgs(
  config: HardwareDecodeConfig,
  driDevice?: string,
): string[] {
  return config.getInputArgs ? config.getInputArgs(driDevice) : config.inputArgs
}

export const HW_DECODE_CONFIGS: Partial<Record<string, HardwareDecodeConfig>> = {
  h264_nvenc: {
    inputArgs: ['-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda', '-threads', '1'],
    outputArgs: ['-noautoscale'],
    scaleFilter: (width, height) =>
      `scale_cuda=w=${width}:h=${height}:force_original_aspect_ratio=decrease:force_divisible_by=2:format=nv12`,
  },
  h264_qsv: {
    inputArgs: [
      '-hwaccel',
      'qsv',
      '-hwaccel_output_format',
      'qsv',
      '-async_depth',
      '4',
      '-threads',
      '1',
    ],
    getInputArgs: (driDevice?: string) => [
      '-hwaccel',
      'qsv',
      '-hwaccel_output_format',
      'qsv',
      '-async_depth',
      '4',
      '-threads',
      '1',
      ...(driDevice ? ['-qsv_device', driDevice] : []),
    ],
    outputArgs: ['-noautoscale'],
    scaleFilter: (width, height) =>
      `scale_qsv=w=${width}:h=${height}:async_depth=4:mode=hq:format=nv12`,
  },
  h264_vaapi: {
    inputArgs: ['-hwaccel', 'vaapi', '-hwaccel_device', 'accel', '-hwaccel_output_format', 'vaapi'],
    // If the decoder reinitializes mid-stream with a different coded size
    // (e.g. 1080 -> 1088), ffmpeg would otherwise auto-insert a software
    // scaler, which cannot take GPU frames, and fail.
    outputArgs: ['-noautoscale'],
    // Output range is left as-is (matching the software path): on i965,
    // out_range only retags the stream without converting levels.
    scaleFilter: (width, height) =>
      `scale_vaapi=w=${width}:h=${height}:force_original_aspect_ratio=decrease:force_divisible_by=2:format=nv12:mode=hq`,
  },
  h264_rkmpp: {
    inputArgs: ['-hwaccel', 'rkmpp', '-hwaccel_output_format', 'drm_prime', '-afbc', 'rga'],
    outputArgs: ['-noautoscale'],
    scaleFilter: (width, height) =>
      `scale_rkrga=w=${width}:h=${height}:format=nv12:afbc=1:async_depth=4`,
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
      return ['h264_nvenc', 'h264_vaapi', 'h264_qsv', 'h264_rkmpp', 'h264_amf']
  }
}

export function getDriDevice(driDir = '/dev/dri'): string | null {
  const envDevice =
    process.env.SHUMAI_HW_DEVICE || process.env.SHUMAI_VAAPI_DEVICE || process.env.VAAPI_DEVICE
  if (envDevice) {
    return envDevice
  }

  try {
    if (!fs.existsSync(driDir)) {
      return null
    }
    const entries = fs.readdirSync(driDir)
    const renderNodes = entries
      .filter((entry) => entry.startsWith('renderD') || entry.startsWith('card'))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))

    if (renderNodes.length > 0) {
      return path.join(driDir, renderNodes[0])
    }
  } catch {
    return null
  }

  return null
}

export function getVaapiDevice(driDir = '/dev/dri'): string | null {
  return getDriDevice(driDir)
}

/**
 * Whether hardware encoders with a {@link HW_DECODE_CONFIGS} entry also decode
 * and scale on the GPU. Enabled by default; set SHUMAI_HW_DECODE=false to disable.
 */
export function isHwDecodeEnabled(): boolean {
  const value = process.env.SHUMAI_HW_DECODE?.trim().toLowerCase()
  return value !== 'false' && value !== '0' && value !== 'off'
}

/**
 * A GPU-decode attempt whose output stops growing for this long is killed and
 * retried with software decode, since some driver failures hang ffmpeg instead
 * of exiting. Override with SHUMAI_HW_DECODE_STALL_TIMEOUT (seconds).
 */
export function getHwDecodeStallTimeoutMs(): number {
  const seconds = parseFloat(process.env.SHUMAI_HW_DECODE_STALL_TIMEOUT ?? '')
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 120_000
}

function getPathSize(target: string): number {
  try {
    const stat = fs.statSync(target)
    if (!stat.isDirectory()) {
      return stat.size
    }
    return fs
      .readdirSync(target)
      .reduce((total, entry) => total + getPathSize(path.join(target, entry)), 0)
  } catch {
    return 0
  }
}

function normalizeRotation(rotation: number): number {
  return ((Math.round(rotation) % 360) + 360) % 360
}

interface OrientationOptions {
  /** True when a RAW container orientation is applied by hand, so sharp must not also auto-orient. */
  rawOrientationApplied?: boolean
}

/**
 * Sharp input options. The webp output drops the EXIF orientation tag, so camera portraits would
 * come out sideways unless sharp applies it; skip that when the RAW orientation is already applied,
 * otherwise the image would rotate twice.
 */
function orientedSharpOptions({ rawOrientationApplied = false }: OrientationOptions = {}) {
  return { limitInputPixels: false, autoOrient: !rawOrientationApplied } as const
}

/** Width and height as displayed: sharp reports the EXIF-oriented size under `autoOrient`. */
function displayedDimensions(
  metadata: SharpMetadata,
  { rawOrientationApplied = false }: OrientationOptions = {},
): Pick<SharpMetadata, 'width' | 'height'> {
  return rawOrientationApplied ? metadata : (metadata.autoOrient ?? metadata)
}

export function parseBitrateKbps(bitrate: string | number): number {
  if (typeof bitrate === 'number') {
    return Math.round(bitrate / 1000)
  }
  const clean = bitrate.trim().toLowerCase()
  if (clean.endsWith('m') || clean.endsWith('mbps')) {
    return Math.round(parseFloat(clean) * 1000)
  }
  if (clean.endsWith('k') || clean.endsWith('kbps')) {
    return Math.round(parseFloat(clean))
  }
  const num = parseFloat(clean)
  if (Number.isFinite(num)) {
    return num > 100_000 ? Math.round(num / 1000) : Math.round(num)
  }
  return 2500
}

export function getDefaultBitrateBps(height: number, width?: number): number {
  const longSide = Math.max(width || 0, height)
  const shortSide = Math.min(width || height, height)
  const effectiveHeight = shortSide > 0 ? shortSide : height

  if (effectiveHeight >= 2160 || longSide >= 3840) return 12_000_000
  if (effectiveHeight >= 1440 || longSide >= 2560) return 8_000_000
  if (effectiveHeight >= 1080 || longSide >= 1920) return 4_500_000
  if (effectiveHeight >= 720 || longSide >= 1280) return 2_500_000
  if (effectiveHeight >= 540 || longSide >= 960) return 1_200_000
  if (effectiveHeight >= 480 || longSide >= 854) return 1_400_000
  if (effectiveHeight >= 360 || longSide >= 640) return 800_000
  return 100_000
}

export function getDefaultBitrate(height: number, width?: number): string {
  const bps = getDefaultBitrateBps(height, width)
  return `${Math.round(bps / 1000)}k`
}

export function calculateEffectiveBitrateBps(
  targetHeight: number,
  targetWidth?: number,
  sourceVideoBitrate?: number,
  targetFps?: number | string,
): number {
  let configuredMaxBps = getDefaultBitrateBps(targetHeight, targetWidth)

  // If frame rate is downsampled (e.g. 180p preview with < 24 fps), scale the bitrate ceiling proportionally
  if (targetFps) {
    let parsedFps: number | undefined
    if (typeof targetFps === 'number') {
      parsedFps = targetFps
    } else {
      const parts = targetFps.split('/')
      if (parts.length === 2) {
        parsedFps = parseFloat(parts[0]) / parseFloat(parts[1])
      } else {
        parsedFps = parseFloat(targetFps)
      }
    }
    if (Number.isFinite(parsedFps) && parsedFps > 0 && parsedFps < 24) {
      const fpsRatio = Math.max(0.1, parsedFps / 24)
      configuredMaxBps = Math.max(50_000, Math.round(configuredMaxBps * fpsRatio))
    }
  }

  const effectiveMaxBps =
    sourceVideoBitrate && sourceVideoBitrate > 0
      ? Math.min(configuredMaxBps, Math.round(sourceVideoBitrate * 1.2))
      : configuredMaxBps

  const minFloor = targetFps ? 50_000 : 100_000
  return Math.max(minFloor, effectiveMaxBps)
}

export function calculateMaxBitrate(
  targetHeight: number,
  targetWidth?: number,
  sourceVideoBitrate?: number,
  targetFps?: number | string,
): { maxrate: string; bufsize: string } {
  const effectiveMaxBps = calculateEffectiveBitrateBps(
    targetHeight,
    targetWidth,
    sourceVideoBitrate,
    targetFps,
  )

  const maxrateKbps = Math.max(50, Math.round(effectiveMaxBps / 1000))
  const bufsizeKbps = maxrateKbps * 2

  return {
    maxrate: `${maxrateKbps}k`,
    bufsize: `${bufsizeKbps}k`,
  }
}

export function buildSdrToneMapFilterChain(options: {
  hdrType?: HdrType
  availableFilters?: Set<string>
  colorTransfer?: string
}): string {
  if (options.availableFilters) {
    if (!options.availableFilters.has('zscale') || !options.availableFilters.has('tonemap')) {
      throw new Error('zscale and tonemap filters are required for HDR tone mapping')
    }
  }

  const tin =
    options.hdrType === 'hlg' || options.colorTransfer === 'arib-std-b67'
      ? 'arib-std-b67'
      : 'smpte2084'
  return `setparams=color_primaries=bt2020:color_trc=${tin}:colorspace=bt2020nc,zscale=tin=${tin}:pin=bt2020:min=bt2020nc:t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0:peak=100,zscale=t=bt709:m=bt709:out_range=full,format=yuv420p`
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

  private safeParseInt(value: unknown): number | undefined {
    if (value === undefined || value === null) return undefined
    const parsed =
      typeof value === 'string'
        ? parseInt(value, 10)
        : typeof value === 'number'
          ? value
          : undefined
    return parsed !== undefined && Number.isFinite(parsed) ? parsed : undefined
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
    const videoStream = selectPrimaryVideoStream(info.streams || [])
    const audioStream = selectPrimaryAudioStream(info.streams || [])

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

    let videoBitRate: number | undefined
    if (videoStream.bit_rate && parseInt(videoStream.bit_rate, 10) > 0) {
      videoBitRate = parseInt(videoStream.bit_rate, 10)
    } else {
      const bpsTag = videoStream.tags?.BPS || videoStream.tags?.['BPS-eng']
      if (bpsTag && parseInt(bpsTag, 10) > 0) {
        videoBitRate = parseInt(bpsTag, 10)
      } else {
        const bytesTag =
          videoStream.tags?.NUMBER_OF_BYTES || videoStream.tags?.['NUMBER_OF_BYTES-eng']
        if (bytesTag && duration > 0) {
          videoBitRate = Math.round((parseInt(bytesTag, 10) * 8) / duration)
        } else {
          const totalBitrate = parseFloat(info.format.bit_rate)
          if (Number.isFinite(totalBitrate) && totalBitrate > 0) {
            const audioBitrate = audioStream?.bit_rate
              ? parseFloat(audioStream.bit_rate)
              : audioStream
                ? 128_000
                : 0
            videoBitRate = Math.max(100_000, Math.round(totalBitrate - audioBitrate))
          }
        }
      }
    }

    const colorTransfer =
      typeof videoStream.color_transfer === 'string'
        ? videoStream.color_transfer.toLowerCase()
        : undefined
    const colorPrimaries =
      typeof videoStream.color_primaries === 'string'
        ? videoStream.color_primaries.toLowerCase()
        : undefined
    const colorSpace =
      typeof videoStream.color_space === 'string'
        ? videoStream.color_space.toLowerCase()
        : undefined

    let dvProfile: number | undefined
    let dvCompatibilityId: number | undefined

    if (Array.isArray(videoStream.side_data_list)) {
      const dovi = videoStream.side_data_list.find(
        (sd: unknown): sd is Record<string, unknown> =>
          typeof (sd as Record<string, unknown>)?.side_data_type === 'string' &&
          String((sd as Record<string, unknown>).side_data_type)
            .toLowerCase()
            .includes('dovi'),
      )
      if (dovi) {
        dvProfile = this.safeParseInt(dovi.dv_profile)
        dvCompatibilityId = this.safeParseInt(dovi.dv_bl_signal_compatibility_id)
      }
    }

    let isHdr: boolean
    let hdrType: HdrType

    if (dvProfile === 5) {
      isHdr = true
      hdrType = 'dovi_p5'
    } else if (dvProfile !== undefined) {
      if (colorTransfer === 'smpte2084') {
        isHdr = true
        hdrType = 'pq'
      } else if (colorTransfer === 'arib-std-b67') {
        isHdr = true
        hdrType = 'hlg'
      } else {
        isHdr = false
        hdrType = 'sdr'
      }
    } else {
      if (colorTransfer === 'smpte2084') {
        isHdr = true
        hdrType = 'pq'
      } else if (colorTransfer === 'arib-std-b67') {
        isHdr = true
        hdrType = 'hlg'
      } else {
        isHdr = false
        hdrType = 'sdr'
      }
    }

    let rotation = 0

    if (Array.isArray(videoStream.side_data_list)) {
      const displayMatrix = videoStream.side_data_list.find(
        (sd: unknown): sd is Record<string, unknown> =>
          typeof (sd as Record<string, unknown>)?.side_data_type === 'string' &&
          String((sd as Record<string, unknown>).side_data_type).toLowerCase() === 'display matrix',
      )
      if (displayMatrix && typeof displayMatrix.rotation === 'number') {
        rotation = displayMatrix.rotation
      }
    }

    if (!rotation) {
      const rotateTag = videoStream.tags?.rotate || info.format?.tags?.rotate
      if (rotateTag) {
        const parsed = parseFloat(rotateTag)
        if (Number.isFinite(parsed)) {
          rotation = parsed
        }
      }
    }

    const normalizedRotation = ((Math.round(rotation) % 360) + 360) % 360
    const isRotatedVertical = normalizedRotation === 90 || normalizedRotation === 270

    const rawWidth = typeof videoStream.width === 'number' ? videoStream.width : 0
    const rawHeight = typeof videoStream.height === 'number' ? videoStream.height : 0
    const originalWidth = isRotatedVertical ? rawHeight : rawWidth
    const originalHeight = isRotatedVertical ? rawWidth : rawHeight

    return {
      originalWidth,
      originalHeight,
      rotation: rotation || undefined,
      duration,
      bitRate: parseFloat(info.format.bit_rate),
      videoBitRate,
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
      colorTransfer,
      colorPrimaries,
      colorSpace,
      isHdr,
      hdrType,
      dvProfile,
      dvCompatibilityId,
      videoStreamIndex: videoStream.index,
      audioStreamIndex: audioStream ? audioStream.index : undefined,
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

    // RAW branch — extract embedded JPEG or decode RAW for metadata
    if (typeof input === 'string' && isRawImage(input)) {
      const extracted = await extractAndValidateRawPreview(input)
      if (extracted) {
        try {
          const isSwapped =
            extracted.orientation !== undefined &&
            extracted.orientation >= 5 &&
            extracted.orientation <= 8
          const sourceWidth = extracted.rawWidth ?? extracted.width
          const sourceHeight = extracted.rawHeight ?? extracted.height
          const originalWidth = isSwapped ? sourceHeight : sourceWidth
          const originalHeight = isSwapped ? sourceWidth : sourceHeight

          return {
            originalWidth,
            originalHeight,
            duration: 0,
            bitRate: 0,
            frameRate: 0,
            totalFrames: 0,
            startTimecode: undefined,
            hasAudio: false,
            mimeType: 'jpeg',
          }
        } finally {
          extracted.cleanup()
        }
      }
      // No extractable preview — return zero dimensions
      // The workflow will still mark the asset as processed
      return {
        originalWidth: 0,
        originalHeight: 0,
        duration: 0,
        bitRate: 0,
        frameRate: 0,
        totalFrames: 0,
        startTimecode: undefined,
        hasAudio: false,
        mimeType: '',
      }
    }

    const metadata = await sharp(input, { limitInputPixels: false }).metadata()
    // Cameras store portraits sideways plus an EXIF orientation; report the size as displayed.
    const shown = displayedDimensions(metadata)
    return {
      originalWidth: shown.width || 0,
      originalHeight: shown.height || 0,
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
  private usableEncodersCache: Map<string, boolean> = new Map()

  clearEncodersCache(): void {
    this.availableEncodersCache = null
    this.usableEncodersCache.clear()
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

  private availableFiltersCache: Set<string> | null = null

  clearFiltersCache(): void {
    this.availableFiltersCache = null
  }

  async getAvailableFilters(): Promise<Set<string>> {
    if (this.availableFiltersCache) {
      return this.availableFiltersCache
    }
    try {
      const { stdout } = await execFileAsync('ffmpeg', ['-filters'])
      const filters = new Set<string>()
      const lines = stdout.split('\n')
      for (const line of lines) {
        const match = line.match(/^\s*[A-Z.]{2,4}\s+([a-zA-Z0-9_-]+)/)
        if (match) {
          filters.add(match[1])
        }
      }
      this.availableFiltersCache = filters
      return filters
    } catch (err) {
      console.warn('Failed to probe ffmpeg filters:', err)
      return new Set<string>()
    }
  }

  getDriDevice(driDir = '/dev/dri'): string | null {
    return this.getVaapiDevice(driDir)
  }

  getVaapiDevice(driDir = '/dev/dri'): string | null {
    return getDriDevice(driDir)
  }

  async isEncoderUsable(encoder: string): Promise<boolean> {
    const cached = this.usableEncodersCache.get(encoder)
    if (cached !== undefined) {
      return cached
    }

    if (encoder === 'h264_vaapi') {
      const vaapiDevice = this.getVaapiDevice()
      if (!vaapiDevice) {
        this.usableEncodersCache.set(encoder, false)
        return false
      }
      try {
        await execFileAsync('ffmpeg', [
          '-loglevel',
          'error',
          '-init_hw_device',
          `vaapi=accel:${vaapiDevice}`,
          '-filter_hw_device',
          'accel',
          '-f',
          'lavfi',
          '-i',
          'color=c=black:s=256x256:d=0.04',
          '-vf',
          'format=nv12,hwupload',
          '-frames:v',
          '1',
          '-c:v',
          'h264_vaapi',
          '-f',
          'null',
          '-',
        ])
        this.usableEncodersCache.set(encoder, true)
        return true
      } catch (err) {
        logger.debug({ encoder, err }, 'Encoder failed usability probe')
        this.usableEncodersCache.set(encoder, false)
        return false
      }
    }

    try {
      await execFileAsync('ffmpeg', [
        '-loglevel',
        'error',
        '-f',
        'lavfi',
        '-i',
        'color=c=black:s=256x256:d=0.04',
        '-frames:v',
        '1',
        '-c:v',
        encoder,
        '-f',
        'null',
        '-',
      ])
      this.usableEncodersCache.set(encoder, true)
      return true
    } catch (err) {
      logger.debug({ encoder, err }, 'Encoder failed usability probe')
      this.usableEncodersCache.set(encoder, false)
      return false
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
        const usable = await this.isEncoderUsable(enc)
        if (!usable) {
          continue
        }
        return H264_ENCODER_CONFIGS[enc]
      }
    }

    return H264_ENCODER_CONFIGS.libx264
  }

  private isAbortError(err: unknown, signal?: AbortSignal): boolean {
    if (signal?.aborted) return true
    if (err && typeof err === 'object') {
      const r = err as Record<string, unknown>
      if (r.name === 'AbortError' || r.code === 'ABORT_ERR') return true
      const msg = typeof r.message === 'string' ? r.message.toLowerCase() : ''
      if (msg.includes('abort')) return true
    }
    return false
  }

  async transcodeVideo(params: TranscodeVideoParams): Promise<void> {
    const encoder = await this.selectH264Encoder(params.hardwareAcceleration)

    if (await this.canUseHwDecode(params, encoder)) {
      try {
        await this.executeFfmpegVideoTranscode(params, encoder, { hwDecode: true })
        return
      } catch (err) {
        if (this.isAbortError(err, params.signal)) {
          throw err
        }

        logger.warn(
          {
            err,
            encoder: encoder.name,
            inputFile: params.inputFile,
            outputFile: params.outputFile,
            width: params.width,
            height: params.height,
          },
          'Hardware decode failed; retrying with software decode and hardware encode',
        )

        this.removeFileIfExists(params.outputFile)
      }
    }

    if (encoder.name !== 'libx264') {
      try {
        await this.executeFfmpegVideoTranscode(params, encoder)
        return
      } catch (err) {
        if (this.isAbortError(err, params.signal)) {
          throw err
        }

        logger.warn(
          {
            err,
            encoder: encoder.name,
            inputFile: params.inputFile,
            outputFile: params.outputFile,
            width: params.width,
            height: params.height,
          },
          'Hardware video transcoding failed; falling back to software transcode (libx264)',
        )

        this.removeFileIfExists(params.outputFile)

        await this.executeFfmpegVideoTranscode(params, H264_ENCODER_CONFIGS.libx264)
        return
      }
    }

    await this.executeFfmpegVideoTranscode(params, encoder)
  }

  /**
   * GPU decode + scale is attempted only for plain proxies: watermark overlays,
   * HDR sources and rotated sources keep the software decode path. (ffmpeg
   * cannot auto-insert its rotation filter on GPU frames, so a rotated phone
   * clip would otherwise come out sideways rather than fail.) Sources the GPU
   * cannot decode (e.g. HEVC/10-bit on older Intel iGPUs) fail fast and are
   * retried with software decode by the caller.
   */
  private async canUseHwDecode(
    params: Pick<
      TranscodeVideoParams,
      | 'inputFile'
      | 'streamIndex'
      | 'overlayFile'
      | 'sourceIsHdr'
      | 'sourceHdrType'
      | 'sourceRotation'
    >,
    encoder: EncoderConfig,
  ): Promise<boolean> {
    if (!HW_DECODE_CONFIGS[encoder.name] || !isHwDecodeEnabled()) {
      return false
    }
    if (params.overlayFile) {
      return false
    }
    const isSourceHdr =
      params.sourceIsHdr ||
      params.sourceHdrType === 'pq' ||
      params.sourceHdrType === 'hlg' ||
      params.sourceHdrType === 'dovi_p5'
    if (isSourceHdr) {
      return false
    }
    if (encoder.name === 'h264_vaapi' && !this.getDriDevice()) {
      return false
    }
    if (encoder.name === 'h264_qsv' && process.platform === 'linux' && !this.getDriDevice()) {
      return false
    }
    const rotation =
      params.sourceRotation !== undefined
        ? normalizeRotation(params.sourceRotation)
        : await this.getVideoRotation(params.inputFile, params.streamIndex)
    return rotation === 0
  }

  /**
   * Rotation of the source video stream in degrees (0, 90, 180 or 270), from
   * the display matrix or the legacy `rotate` tag. Returns null if it cannot be
   * determined.
   */
  async getVideoRotation(inputFile: string, streamIndex?: number): Promise<number | null> {
    try {
      const { stdout } = await execFileAsync('ffprobe', [
        '-v',
        'error',
        '-select_streams',
        streamIndex !== undefined ? String(streamIndex) : 'V:0',
        '-show_entries',
        'stream_side_data=rotation:stream_tags=rotate',
        '-of',
        'json',
        inputFile,
      ])
      const stream = JSON.parse(stdout)?.streams?.[0]
      if (!stream) {
        return null
      }
      let rotation = 0
      const sideData = Array.isArray(stream.side_data_list) ? stream.side_data_list : []
      const matrix = sideData.find((d: { rotation?: unknown }) => typeof d.rotation === 'number')
      if (matrix) {
        rotation = matrix.rotation
      } else if (stream.tags?.rotate !== undefined) {
        rotation = parseFloat(stream.tags.rotate) || 0
      }
      return normalizeRotation(rotation)
    } catch (err) {
      logger.debug({ err, inputFile }, 'Failed to probe video rotation')
      return null
    }
  }

  private removeFileIfExists(filePath: string): void {
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath)
      } catch {
        // ignore unlink errors
      }
    }
  }

  /**
   * Inputs, video filter graph and `-map [vout]`, shared by the MP4 and HLS
   * paths: GPU decode + GPU scale when `hwDecodeConfig` is set, otherwise
   * software decode + scale (+ upload for VAAPI encode).
   */
  private buildVideoInputArgs(
    params: Pick<
      TranscodeVideoParams,
      'inputFile' | 'overlayFile' | 'streamIndex' | 'width' | 'height'
    >,
    options: {
      isVaapi: boolean
      driDevice?: string
      hwDecodeConfig?: HardwareDecodeConfig
      frameRate?: number | string
    },
  ): string[] {
    const { isVaapi, driDevice, hwDecodeConfig, frameRate } = options
    const args: string[] = []

    if (isVaapi && driDevice) {
      args.push('-init_hw_device', `vaapi=accel:${driDevice}`, '-filter_hw_device', 'accel')
    }
    if (hwDecodeConfig) {
      args.push(...resolveHwDecodeInputArgs(hwDecodeConfig, driDevice))
    }

    args.push('-i', params.inputFile)
    const baseScale = hwDecodeConfig
      ? hwDecodeConfig.scaleFilter(params.width, params.height)
      : `scale=w=${params.width}:h=${params.height}:force_original_aspect_ratio=decrease,scale=w='trunc(iw/2)*2':h='trunc(ih/2)*2'`

    const vPad = params.streamIndex !== undefined ? `0:${params.streamIndex}` : '0:V'

    let filterComplex: string
    if (params.overlayFile) {
      args.push('-i', params.overlayFile)
      filterComplex = `[${vPad}]scale=${params.width}:${params.height}[vscaled];[vscaled][1:v]overlay=0:0`
    } else {
      filterComplex = `[${vPad}]${baseScale}`
    }

    if (frameRate) {
      filterComplex += `,fps=${frameRate}`
    }
    if (isVaapi && !hwDecodeConfig) {
      filterComplex += ',format=nv12,hwupload=extra_hw_frames=64'
    }
    filterComplex += '[vout]'

    args.push('-filter_complex', filterComplex, '-map', '[vout]')
    if (hwDecodeConfig) {
      args.push(...hwDecodeConfig.outputArgs)
    }
    return args
  }

  /**
   * Runs ffmpeg. With `stallWatchPath`, ffmpeg is killed (SIGKILL; hung VAAPI
   * processes have been seen to ignore SIGTERM) if that output file/directory
   * stops growing for {@link getHwDecodeStallTimeoutMs}, and the call rejects
   * with a regular error so the caller can fall back.
   */
  private async runFfmpeg(
    args: string[],
    options: { signal?: AbortSignal; stallWatchPath?: string } = {},
  ): Promise<void> {
    const ffmpegArgs = ['-y', '-loglevel', 'warning', ...args]

    if (!options.stallWatchPath) {
      if (options.signal) {
        await execFileAsync('ffmpeg', ffmpegArgs, { signal: options.signal })
      } else {
        await execFileAsync('ffmpeg', ffmpegArgs)
      }
      return
    }

    const stallTimeoutMs = getHwDecodeStallTimeoutMs()
    const stall = new AbortController()
    const signal = options.signal ? AbortSignal.any([options.signal, stall.signal]) : stall.signal
    const watchPath = options.stallWatchPath
    let lastSize = -1
    let lastProgressAt = Date.now()
    const timer = setInterval(
      () => {
        const size = getPathSize(watchPath)
        if (size !== lastSize) {
          lastSize = size
          lastProgressAt = Date.now()
        } else if (Date.now() - lastProgressAt >= stallTimeoutMs) {
          stall.abort()
        }
      },
      Math.min(5000, stallTimeoutMs),
    )
    timer.unref?.()

    try {
      await execFileAsync('ffmpeg', ffmpegArgs, { signal, killSignal: 'SIGKILL' })
    } catch (err) {
      if (stall.signal.aborted && !options.signal?.aborted) {
        throw new Error(
          `ffmpeg made no progress for ${Math.round(stallTimeoutMs / 1000)}s and was killed`,
          { cause: err },
        )
      }
      throw err
    } finally {
      clearInterval(timer)
    }
  }

  private async executeFfmpegVideoTranscode(
    params: TranscodeVideoParams,
    encoder: EncoderConfig,
    options: { hwDecode?: boolean } = {},
  ): Promise<void> {
    const isSourceHdr =
      params.sourceIsHdr ||
      params.sourceHdrType === 'pq' ||
      params.sourceHdrType === 'hlg' ||
      params.sourceHdrType === 'dovi_p5'
    const isHdrOutput = Boolean(params.hdr)

    const isVaapi = encoder.name === 'h264_vaapi'
    const driDevice = this.getDriDevice() ?? (isVaapi ? '/dev/dri/renderD128' : undefined)
    const hwDecodeConfig = options.hwDecode ? HW_DECODE_CONFIGS[encoder.name] : undefined
    const hwDecode = Boolean(hwDecodeConfig)

    logger.info(
      {
        encoder: encoder.name,
        hardwareAcceleration: params.hardwareAcceleration ?? 'off',
        inputFile: params.inputFile,
        outputFile: params.outputFile,
        vaapiDevice: isVaapi ? driDevice : undefined,
        driDevice,
        hwDecode,
      },
      'Starting video transcoding',
    )

    const args = this.buildVideoInputArgs(params, {
      isVaapi,
      driDevice,
      hwDecodeConfig,
      frameRate: params.frameRate,
    })

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
      const aMap = params.audioStreamIndex !== undefined ? `0:${params.audioStreamIndex}` : '0:a:0?'
      args.push('-map', aMap)
    }

    args.push('-c:v', encoder.name)
    if (encoder.presetArgs.length > 0) {
      args.push(...encoder.presetArgs)
    }

    if (encoder.name === 'h264_videotoolbox') {
      if (params.videoBitrate) {
        args.push('-b:v', params.videoBitrate)
      } else {
        const targetBps = calculateEffectiveBitrateBps(
          params.height,
          params.width,
          params.sourceVideoBitrate,
          params.frameRate,
        )
        const targetKbps = Math.max(50, Math.round(targetBps / 1000))
        args.push('-b:v', `${targetKbps}k`)
      }
    } else if (isVaapi) {
      let maxKbps: number
      if (params.videoBitrate) {
        maxKbps = parseBitrateKbps(params.videoBitrate)
      } else {
        const { maxrate } = calculateMaxBitrate(
          params.height,
          params.width,
          params.sourceVideoBitrate,
          params.frameRate,
        )
        maxKbps = parseInt(maxrate, 10)
      }
      const targetKbps = Math.max(25, Math.ceil(maxKbps / 1.45))
      const minKbps = Math.max(10, Math.round(targetKbps / 2))
      args.push(
        '-rc_mode',
        '3',
        '-b:v',
        `${targetKbps}k`,
        '-maxrate',
        `${maxKbps}k`,
        '-minrate',
        `${minKbps}k`,
      )
    } else if (encoder.name === 'h264_rkmpp') {
      if (params.videoBitrate) {
        args.push('-b:v', params.videoBitrate)
      } else {
        const { maxrate } = calculateMaxBitrate(
          params.height,
          params.width,
          params.sourceVideoBitrate,
          params.frameRate,
        )
        args.push('-b:v', maxrate)
      }
    } else {
      if (params.videoBitrate) {
        args.push('-b:v', params.videoBitrate)
      } else {
        const { maxrate, bufsize } = calculateMaxBitrate(
          params.height,
          params.width,
          params.sourceVideoBitrate,
          params.frameRate,
        )
        args.push('-maxrate', maxrate, '-bufsize', bufsize)
      }
    }

    if (!hwDecode && !isVaapi) {
      args.push('-pix_fmt', 'yuv420p')
    }

    if (isSourceHdr && isHdrOutput) {
      const isHlg = params.sourceHdrType === 'hlg' || params.sourceColorTransfer === 'arib-std-b67'
      const trc = isHlg ? 'arib-std-b67' : 'smpte2084'
      args.push('-color_primaries', 'bt2020', '-color_trc', trc, '-colorspace', 'bt2020nc')
      if (encoder.name === 'libx264') {
        args.push('-x264-params', `colorprim=bt2020:transfer=${trc}:colormatrix=bt2020nc`)
      }
    }

    if (!params.disableAudio) {
      args.push('-c:a', 'aac', '-b:a', '128k')
    }

    if (params.threads && params.threads > 0) {
      args.push('-threads', params.threads.toString())
    }

    args.push('-movflags', '+faststart', '-max_muxing_queue_size', '1024', params.outputFile)

    await this.runFfmpeg(args, {
      signal: params.signal,
      stallWatchPath: hwDecode ? params.outputFile : undefined,
    })
  }

  async transcodeHlsRendition(params: TranscodeHlsRenditionParams): Promise<void> {
    const encoder = await this.selectH264Encoder(params.hardwareAcceleration)

    if (await this.canUseHwDecode(params, encoder)) {
      try {
        await this.executeFfmpegHlsTranscode(params, encoder, { hwDecode: true })
        return
      } catch (err) {
        if (this.isAbortError(err, params.signal)) {
          throw err
        }

        logger.warn(
          {
            err,
            encoder: encoder.name,
            inputFile: params.inputFile,
            outputDir: params.outputDir,
            width: params.width,
            height: params.height,
          },
          'Hardware decode failed for HLS; retrying with software decode and hardware encode',
        )

        this.removeDirIfExists(params.outputDir)
      }
    }

    if (encoder.name !== 'libx264') {
      try {
        await this.executeFfmpegHlsTranscode(params, encoder)
        return
      } catch (err) {
        if (this.isAbortError(err, params.signal)) {
          throw err
        }

        logger.warn(
          {
            err,
            encoder: encoder.name,
            inputFile: params.inputFile,
            outputDir: params.outputDir,
            width: params.width,
            height: params.height,
          },
          'Hardware HLS transcoding failed; falling back to software transcode (libx264)',
        )

        this.removeDirIfExists(params.outputDir)

        await this.executeFfmpegHlsTranscode(params, H264_ENCODER_CONFIGS.libx264)
        return
      }
    }

    await this.executeFfmpegHlsTranscode(params, encoder)
  }

  private removeDirIfExists(dirPath: string): void {
    if (fs.existsSync(dirPath)) {
      try {
        fs.rmSync(dirPath, { recursive: true, force: true })
      } catch {
        // ignore unlink errors
      }
    }
  }

  private async executeFfmpegHlsTranscode(
    params: TranscodeHlsRenditionParams,
    encoder: EncoderConfig,
    options: { hwDecode?: boolean } = {},
  ): Promise<void> {
    fs.mkdirSync(params.outputDir, { recursive: true })

    const isSourceHdr =
      params.sourceIsHdr ||
      params.sourceHdrType === 'pq' ||
      params.sourceHdrType === 'hlg' ||
      params.sourceHdrType === 'dovi_p5'
    const isHdrOutput = Boolean(params.hdr)

    const isVaapi = encoder.name === 'h264_vaapi'
    const driDevice = this.getDriDevice() ?? (isVaapi ? '/dev/dri/renderD128' : undefined)
    const hwDecodeConfig = options.hwDecode ? HW_DECODE_CONFIGS[encoder.name] : undefined
    const hwDecode = Boolean(hwDecodeConfig)

    const segmentDuration = params.segmentDuration || 4
    let calculatedFps = 30
    if (params.frameRate) {
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
    }
    if (!Number.isFinite(calculatedFps) || calculatedFps <= 0) {
      calculatedFps = 30
    }
    const gopSize = Math.max(1, Math.round(calculatedFps * segmentDuration))

    logger.info(
      {
        encoder: encoder.name,
        hardwareAcceleration: params.hardwareAcceleration ?? 'off',
        inputFile: params.inputFile,
        outputDir: params.outputDir,
        width: params.width,
        height: params.height,
        segmentDuration,
        gopSize,
        hwDecode,
      },
      'Starting HLS rendition transcoding',
    )

    const args = this.buildVideoInputArgs(params, {
      isVaapi,
      driDevice,
      hwDecodeConfig,
      frameRate: calculatedFps,
    })

    if (!params.disableAudio) {
      const aMap = params.audioStreamIndex !== undefined ? `0:${params.audioStreamIndex}` : '0:a:0?'
      args.push('-map', aMap)
    }

    args.push('-c:v', encoder.name)
    if (encoder.presetArgs.length > 0) {
      args.push(...encoder.presetArgs)
    }

    if (encoder.name === 'h264_videotoolbox') {
      if (params.videoBitrate) {
        args.push('-b:v', params.videoBitrate)
      } else {
        const targetBps = calculateEffectiveBitrateBps(
          params.height,
          params.width,
          params.sourceVideoBitrate,
          calculatedFps,
        )
        const targetKbps = Math.max(50, Math.round(targetBps / 1000))
        args.push('-b:v', `${targetKbps}k`)
      }
    } else if (isVaapi) {
      let maxKbps: number
      if (params.videoBitrate) {
        maxKbps = parseBitrateKbps(params.videoBitrate)
      } else {
        const { maxrate } = calculateMaxBitrate(
          params.height,
          params.width,
          params.sourceVideoBitrate,
          calculatedFps,
        )
        maxKbps = parseInt(maxrate, 10)
      }
      const targetKbps = Math.max(25, Math.ceil(maxKbps / 1.45))
      const minKbps = Math.max(10, Math.round(targetKbps / 2))
      args.push(
        '-rc_mode',
        '3',
        '-b:v',
        `${targetKbps}k`,
        '-minrate',
        `${minKbps}k`,
        '-maxrate',
        `${maxKbps}k`,
      )
    } else if (encoder.name === 'h264_qsv') {
      let maxKbps: number
      if (params.videoBitrate) {
        maxKbps = parseBitrateKbps(params.videoBitrate)
      } else {
        const { maxrate } = calculateMaxBitrate(
          params.height,
          params.width,
          params.sourceVideoBitrate,
          calculatedFps,
        )
        maxKbps = parseInt(maxrate, 10)
      }
      const targetKbps = Math.max(25, Math.ceil(maxKbps / 1.45))
      args.push('-b:v', `${targetKbps}k`, '-maxrate', `${maxKbps}k`, '-idr_interval', '0')
    } else if (encoder.name === 'h264_nvenc') {
      let maxrateStr: string
      let bufsizeStr: string
      if (params.videoBitrate) {
        const kbps = parseBitrateKbps(params.videoBitrate)
        maxrateStr = `${kbps}k`
        bufsizeStr = `${kbps * 2}k`
      } else {
        const res = calculateMaxBitrate(
          params.height,
          params.width,
          params.sourceVideoBitrate,
          calculatedFps,
        )
        maxrateStr = res.maxrate
        bufsizeStr = res.bufsize
      }
      args.push(
        '-rc',
        'vbr',
        '-cq',
        '23',
        '-maxrate',
        maxrateStr,
        '-bufsize',
        bufsizeStr,
        '-spatial-aq',
        '1',
        '-temporal-aq',
        '1',
        '-forced-idr',
        '1',
      )
    } else if (encoder.name === 'h264_rkmpp') {
      let maxKbps: number
      if (params.videoBitrate) {
        maxKbps = parseBitrateKbps(params.videoBitrate)
      } else {
        const { maxrate } = calculateMaxBitrate(
          params.height,
          params.width,
          params.sourceVideoBitrate,
          calculatedFps,
        )
        maxKbps = parseInt(maxrate, 10)
      }
      args.push('-b:v', `${maxKbps}k`)
    } else {
      let maxrateStr: string
      let bufsizeStr: string
      if (params.videoBitrate) {
        const kbps = parseBitrateKbps(params.videoBitrate)
        maxrateStr = `${kbps}k`
        bufsizeStr = `${kbps * 2}k`
      } else {
        const res = calculateMaxBitrate(
          params.height,
          params.width,
          params.sourceVideoBitrate,
          calculatedFps,
        )
        maxrateStr = res.maxrate
        bufsizeStr = res.bufsize
      }
      args.push('-crf', '23', '-maxrate', maxrateStr, '-bufsize', bufsizeStr)
    }

    if (!hwDecode && !isVaapi) {
      args.push('-pix_fmt', 'yuv420p')
    }

    if (isSourceHdr && isHdrOutput) {
      const isHlg = params.sourceHdrType === 'hlg' || params.sourceColorTransfer === 'arib-std-b67'
      const trc = isHlg ? 'arib-std-b67' : 'smpte2084'
      args.push('-color_primaries', 'bt2020', '-color_trc', trc, '-colorspace', 'bt2020nc')
      if (encoder.name === 'libx264') {
        args.push('-x264-params', `colorprim=bt2020:transfer=${trc}:colormatrix=bt2020nc`)
      }
    }

    args.push(
      '-r',
      calculatedFps.toString(),
      '-g',
      gopSize.toString(),
      '-keyint_min',
      gopSize.toString(),
      '-sc_threshold',
      '0',
      '-flags',
      '+cgop',
      '-force_key_frames',
      `expr:gte(t,n_forced*${segmentDuration})`,
    )

    if (!params.disableAudio) {
      args.push('-c:a', 'aac', '-b:a', '128k')
    }

    if (params.threads && params.threads > 0) {
      args.push('-threads', params.threads.toString())
    }

    const initFilename = 'init.mp4'
    const segmentPattern = path.join(params.outputDir, 'segment_%03d.m4s')
    const playlistFile = path.join(params.outputDir, 'index.m3u8')

    args.push(
      '-f',
      'hls',
      '-hls_time',
      segmentDuration.toString(),
      '-hls_playlist_type',
      'vod',
      '-hls_segment_type',
      'fmp4',
      '-hls_fmp4_init_filename',
      initFilename,
      '-hls_segment_filename',
      segmentPattern,
      '-max_muxing_queue_size',
      '1024',
      playlistFile,
    )

    await this.runFfmpeg(args, {
      signal: params.signal,
      stallWatchPath: hwDecode ? params.outputDir : undefined,
    })
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

    // RAW branch — extract embedded preview or decode RAW to temporary file + orientation, then treat as normal image
    let rawOrientation: number | undefined
    let rawOutputUpright = false
    let rawCleanup: (() => void) | null = null
    if (typeof input === 'string' && isRawImage(input)) {
      const extracted = await extractAndValidateRawPreview(input)
      if (!extracted) {
        throw new Error(
          `Cannot generate preview for RAW file: no usable embedded preview or decoded image in ${input}`,
        )
      }
      input = extracted.previewPath
      rawOrientation = extracted.orientation
      rawOutputUpright = extracted.orientationApplied === true
      rawCleanup = extracted.cleanup
    }

    try {
      const WEBP_MAX_DIMENSION = 7680
      let targetW = width > 0 ? Math.min(width, WEBP_MAX_DIMENSION) : WEBP_MAX_DIMENSION
      let targetH = height && height > 0 ? Math.min(height, WEBP_MAX_DIMENSION) : WEBP_MAX_DIMENSION

      // RAW previews are oriented from the container EXIF below, so only auto-orient other
      // inputs: the webp output drops the tag, which would leave camera portraits sideways.
      // dcraw_emu output is already upright, so it is never auto-oriented (no double rotation).
      const rawOrientationApplied = rawOrientation !== undefined || rawOutputUpright
      const sharpInstance = sharp(input, orientedSharpOptions({ rawOrientationApplied }))

      if (isPreview) {
        try {
          const meta = displayedDimensions(await sharpInstance.metadata(), {
            rawOrientationApplied,
          })
          if (meta.width && meta.height) {
            const isSwapped =
              rawOrientation !== undefined && rawOrientation >= 5 && rawOrientation <= 8
            const srcW = isSwapped ? meta.height : meta.width
            const srcH = isSwapped ? meta.width : meta.height
            // Fallback shim: If legacy 480 caller passed width=480, map targetShort to 300
            const targetShort = width === 480 ? 300 : width
            const maxLong = Math.round((targetShort * 16) / 9)
            const dims = calculatePreviewDimensions(srcW, srcH, targetShort, maxLong)
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

      // Apply EXIF orientation from the RAW container to the extracted buffer.
      // The buffer itself often lacks orientation EXIF, so Sharp won't auto-rotate.
      // For non-RAW images, autoOrient above applies the image's own EXIF.
      if (rawOrientation && EXIF_ORIENTATION_TO_ROTATION[rawOrientation]) {
        const { angle, flip, flop } = EXIF_ORIENTATION_TO_ROTATION[rawOrientation]
        if (angle) sharpInstance.rotate(angle)
        if (flip) sharpInstance.flip()
        if (flop) sharpInstance.flop()
      }

      sharpInstance.toColorspace('srgb').resize(targetW, targetH, {
        withoutEnlargement: true,
        fit: 'inside',
      })

      await sharpInstance.webp({ quality }).toFile(outputFile)
    } finally {
      if (rawCleanup) {
        rawCleanup()
      }
    }
  }

  async generatePoster(
    inputFile: string,
    outputPoster: string,
    options: GeneratePosterOptions = {},
  ): Promise<void> {
    const { isHdr, hdrType, colorTransfer, signal } = options
    if (signal?.aborted) {
      throw new Error('Poster generation cancelled')
    }

    const isRemote = inputFile.startsWith('http://') || inputFile.startsWith('https://')
    let pathname = inputFile
    if (isRemote) {
      try {
        pathname = new URL(inputFile).pathname
      } catch {
        pathname = inputFile.split('?')[0].split('#')[0]
      }
    }
    const ext = path.extname(pathname).toLowerCase()
    const isMpegTs = ext === '.ts' || ext === '.m2ts' || ext === '.mts'

    const filters: string[] = [
      'fps=12:start_time=0:eof_action=pass:round=down',
      'thumbnail=12',
      String.raw`select=gt(scene\,0.1)-eq(prev_selected_n\,n)+isnan(prev_selected_n)+gt(n\,20)`,
      'trim=end_frame=2',
      'reverse',
    ]

    if (isHdr) {
      const availableFilters = await this.getAvailableFilters()
      const tonemap = buildSdrToneMapFilterChain({
        hdrType,
        colorTransfer,
        availableFilters,
      })
      filters.push(tonemap)
    }

    filters.push('scale=-2:300:force_original_aspect_ratio=decrease')

    const vMap = options.streamIndex !== undefined ? `0:${options.streamIndex}` : '0:V:0'

    const args = [
      ...(isRemote
        ? ['-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5']
        : []),
      ...(isMpegTs ? [] : ['-skip_frame', 'nointra']),
      '-i',
      inputFile,
      '-map',
      vMap,
      '-vf',
      filters.join(','),
      '-fps_mode',
      'vfr',
      '-frames:v',
      '1',
      '-update',
      '1',
      '-c:v',
      'libwebp',
      '-q:v',
      '75',
      outputPoster,
    ]

    if (signal) {
      await execFileAsync('ffmpeg', ['-y', '-loglevel', 'warning', ...args], { signal })
    } else {
      await execFileAsync('ffmpeg', ['-y', '-loglevel', 'warning', ...args])
    }
  }

  async generateSprite(
    inputFile: string,
    outputSprite: string,
    outputPoster: string,
    duration: number,
    signal?: AbortSignal,
    hdrOptions?: { isHdr?: boolean; hdrType?: HdrType; colorTransfer?: string },
    streamIndex?: number,
  ): Promise<void> {
    if (signal?.aborted) {
      throw new Error('Sprite generation cancelled')
    }

    // 1. Generate poster first (fast, smart frame selection)
    await this.generatePoster(inputFile, outputPoster, { ...hdrOptions, signal, streamIndex })

    // 2. Generate sprite
    let fileSize = Infinity
    try {
      const stats = await fs.promises.stat(inputFile)
      fileSize = stats.size
    } catch {
      // If stat fails (e.g. mocked in unit tests), fileSize remains Infinity
    }

    const isSmallAndShort = fileSize <= 50 * 1024 * 1024 && duration <= 30
    if (isSmallAndShort) {
      await this.generateSpriteSinglePass(
        inputFile,
        outputSprite,
        duration,
        signal,
        hdrOptions,
        streamIndex,
      )
    } else {
      await this.generateSpriteSeekPool(
        inputFile,
        outputSprite,
        duration,
        signal,
        hdrOptions,
        streamIndex,
      )
    }
  }

  private async generateSpriteSinglePass(
    inputFile: string,
    outputSprite: string,
    duration: number,
    signal?: AbortSignal,
    hdrOptions?: { isHdr?: boolean; hdrType?: HdrType; colorTransfer?: string },
    streamIndex?: number,
  ): Promise<void> {
    const spriteFps = 100 / duration
    let filterComplex: string
    const vPad = streamIndex !== undefined ? `0:${streamIndex}` : '0:V'

    if (hdrOptions?.isHdr) {
      const availableFilters = await this.getAvailableFilters()
      const tonemap = buildSdrToneMapFilterChain({
        hdrType: hdrOptions.hdrType,
        colorTransfer: hdrOptions.colorTransfer,
        availableFilters,
      })
      filterComplex = `[${vPad}]${tonemap},fps=${spriteFps},scale=w=300:h=-2,tile=10x10[sprite_out]`
    } else {
      filterComplex = `[${vPad}]fps=${spriteFps},scale=w=300:h=-2,tile=10x10[sprite_out]`
    }

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
    ]
    if (signal) {
      await execFileAsync('ffmpeg', ['-y', '-loglevel', 'warning', ...args], { signal })
    } else {
      await execFileAsync('ffmpeg', ['-y', '-loglevel', 'warning', ...args])
    }
  }

  private async generateSpriteSeekPool(
    inputFile: string,
    outputSprite: string,
    duration: number,
    signal?: AbortSignal,
    hdrOptions?: { isHdr?: boolean; hdrType?: HdrType; colorTransfer?: string },
    streamIndex?: number,
  ): Promise<void> {
    if (signal?.aborted) {
      throw new Error('Sprite generation cancelled')
    }

    let tonemapFilterChain = ''
    if (hdrOptions?.isHdr) {
      const availableFilters = await this.getAvailableFilters()
      tonemapFilterChain = buildSdrToneMapFilterChain({
        hdrType: hdrOptions.hdrType,
        colorTransfer: hdrOptions.colorTransfer,
        availableFilters,
      })
    }

    // Extract 100 frames across duration using 4-worker concurrency pool
    const tmpDir = this.createTempDir('sprite-pool-')
    try {
      const numFrames = 100
      const tileX = 10
      const tileY = 10
      const timestamps = Array.from({ length: numFrames }, (_, i) => {
        const rawTs = (i / (numFrames - 1)) * duration
        return Math.min(rawTs, Math.max(0, duration - 0.1))
      })

      // For sprite tiles: scale to width 300 first, then apply HDR tonemapping if needed
      const vfSprite = tonemapFilterChain ? `scale=300:-2,${tonemapFilterChain}` : 'scale=300:-2'

      const concurrency = 4
      const frameFiles: string[] = new Array(numFrames).fill('')
      let nextIdx = 0

      const worker = async () => {
        while (true) {
          if (signal?.aborted) {
            throw new Error('Sprite generation cancelled')
          }
          const idx = nextIdx++
          if (idx >= timestamps.length) break

          const ts = timestamps[idx]
          const framePath = path.join(tmpDir, `frame_${idx.toString().padStart(3, '0')}.webp`)
          const vMap = streamIndex !== undefined ? `0:${streamIndex}` : '0:V:0'
          const args = [
            '-ss',
            ts.toFixed(3),
            '-i',
            inputFile,
            '-map',
            vMap,
            '-vframes',
            '1',
            '-vf',
            vfSprite,
            '-c:v',
            'libwebp',
            '-q:v',
            '75',
            framePath,
          ]

          try {
            if (signal) {
              await execFileAsync('ffmpeg', ['-y', '-loglevel', 'warning', ...args], { signal })
            } else {
              await execFileAsync('ffmpeg', ['-y', '-loglevel', 'warning', ...args])
            }
            if (fs.existsSync(framePath) && fs.statSync(framePath).size > 0) {
              frameFiles[idx] = framePath
            }
          } catch (err) {
            if (signal?.aborted) throw err
            // If frame extraction fails, keep empty for resilient fallback
          }
        }
      }

      await Promise.all(Array.from({ length: concurrency }, () => worker()))

      // Resilient fallback: ensure all 100 frames exist by filling any failed frame with adjacent frame
      let lastValid = frameFiles.find((f) => f && fs.existsSync(f))
      if (!lastValid) {
        throw new Error(`Failed to extract any frames from ${inputFile}`)
      }
      for (let i = 0; i < numFrames; i++) {
        if (!frameFiles[i] || !fs.existsSync(frameFiles[i])) {
          const fallbackFile = path.join(tmpDir, `frame_${i.toString().padStart(3, '0')}.webp`)
          fs.copyFileSync(lastValid, fallbackFile)
          frameFiles[i] = fallbackFile
        } else {
          lastValid = frameFiles[i]
        }
      }

      // 3. Composite 100 tiles into 10x10 sprite sheet with Sharp
      if (signal?.aborted) {
        throw new Error('Sprite generation cancelled')
      }

      const firstMeta = await sharp(frameFiles[0]).metadata()
      const frameW = firstMeta.width || 300
      const frameH = firstMeta.height || 168

      const composites = frameFiles.map((file, i) => ({
        input: file,
        left: (i % tileX) * frameW,
        top: Math.floor(i / tileX) * frameH,
      }))

      const toFilePromise = sharp({
        create: {
          width: frameW * tileX,
          height: frameH * tileY,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 1 },
        },
      })
        .composite(composites)
        .webp({ quality: 75 })
        .toFile(outputSprite)

      if (signal) {
        await Promise.race([
          toFilePromise,
          new Promise<never>((_, reject) => {
            if (signal.aborted) {
              reject(new Error('Sprite generation cancelled'))
              return
            }
            signal.addEventListener(
              'abort',
              () => reject(new Error('Sprite generation cancelled')),
              { once: true },
            )
          }),
        ])
      } else {
        await toFilePromise
      }

      if (signal?.aborted) {
        throw new Error('Sprite generation cancelled')
      }
    } finally {
      this.removeDir(tmpDir)
    }
  }

  async generatePdfSprite(
    inputFile: string,
    outputSprite: string,
    outputPoster: string,
    signal?: AbortSignal,
  ): Promise<{ pageCount: number; originalWidth: number; originalHeight: number }> {
    const tmpDir = this.createTempDir('pdf-sprite-')
    try {
      const pagePrefix = path.join(tmpDir, 'page')
      try {
        if (signal) {
          await execFileAsync('pdftoppm', ['-png', '-f', '1', '-l', '100', inputFile, pagePrefix], {
            signal,
          })
        } else {
          await execFileAsync('pdftoppm', ['-png', '-f', '1', '-l', '100', inputFile, pagePrefix])
        }
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
      if (signal) {
        await execFileAsync('ffmpeg', ['-y', '-loglevel', 'warning', ...spriteArgs], { signal })
      } else {
        await execFileAsync('ffmpeg', ['-y', '-loglevel', 'warning', ...spriteArgs])
      }

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
    const audioStream = selectPrimaryAudioStream(info.streams || [])

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
      audioStreamIndex: audioStream.index,
      mimeType: '',
    }
  }

  async transcodeAudio(params: {
    inputFile: string
    outputFile: string
    bitrate?: string
    threads?: number
    signal?: AbortSignal
    audioStreamIndex?: number
  }): Promise<void> {
    const bitrate = params.bitrate || '128k'
    const aMap = params.audioStreamIndex !== undefined ? `0:${params.audioStreamIndex}` : '0:a:0?'
    const args = [
      '-i',
      params.inputFile,
      '-vn',
      '-map',
      aMap,
      '-c:a',
      'aac',
      '-b:a',
      bitrate,
      '-ac',
      '2',
    ]
    if (params.threads && params.threads > 0) {
      args.push('-threads', params.threads.toString())
    }
    args.push(params.outputFile)
    if (params.signal) {
      await execFileAsync('ffmpeg', ['-y', '-loglevel', 'warning', ...args], {
        signal: params.signal,
      })
    } else {
      await execFileAsync('ffmpeg', ['-y', '-loglevel', 'warning', ...args])
    }
  }

  async extractVideoFrames(params: ExtractVideoFramesParams): Promise<string[]> {
    if (params.isImage) {
      const outputFile = path.join(params.outputDir, '1.webp')
      await this.transcodeImage(params.inputFile, outputFile, -1, 80, params.frameHeight)
      return [outputFile]
    }

    const meta = await this.getVideoInfo(params.inputFile)
    const isRemote =
      params.inputFile.startsWith('http://') || params.inputFile.startsWith('https://')

    const duration = meta.duration > 0 ? meta.duration : 1
    const numFrames = Math.max(1, params.numFrames)
    const step = duration / numFrames
    const timestamps = Array.from({ length: numFrames }, (_, i) => i * step)
    const vMap = meta.videoStreamIndex !== undefined ? `0:${meta.videoStreamIndex}` : '0:V:0'

    await mapConcurrent(timestamps, 10, async (t, idx) => {
      const outputFile = path.join(params.outputDir, `${idx + 1}.webp`)
      const args = [
        ...(isRemote
          ? ['-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5']
          : []),
        '-ss',
        t.toFixed(4),
        '-i',
        params.inputFile,
        '-map',
        vMap,
        '-vframes',
        '1',
        '-vf',
        `scale=-2:${params.frameHeight}`,
        '-c:v',
        'libwebp',
        '-q:v',
        '80',
        outputFile,
      ]
      await execFileAsync('ffmpeg', ['-y', '-loglevel', 'warning', ...args])
    })

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
    signal?: AbortSignal
  }): Promise<Array<{ key: string; timestamp: number }>> {
    const bucket = process.env.S3_BUCKET || 'shumai'
    const tmpDir = this.createTempDir('screenshot-')

    try {
      // 1. Resolve input source (presigned GET URL for S3/R2, local file path for local storage)
      const inputSource = await s3Service.resolveInput(bucket, params.assetKey)
      const isRemote = inputSource.startsWith('http://') || inputSource.startsWith('https://')

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

      // 4. Extract screenshots concurrently with a limit of 10 parallel processes
      const results = await mapConcurrent(timestamps, 10, async (t) => {
        const outName = `shot-${t.toFixed(4)}-${ulid()}.webp`
        const localShotPath = path.join(tmpDir, outName)

        const args = [
          ...(isRemote
            ? ['-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5']
            : []),
          '-ss',
          t.toFixed(4),
          '-i',
          inputSource,
          '-map',
          '0:V:0',
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
        if (params.signal) {
          await execFileAsync('ffmpeg', ['-y', '-loglevel', 'warning', ...args], {
            signal: params.signal,
          })
        } else {
          await execFileAsync('ffmpeg', ['-y', '-loglevel', 'warning', ...args])
        }

        const isMatch =
          commentTimestamp !== undefined &&
          commentTimestamp !== null &&
          Math.abs(t - commentTimestamp) <= 1e-3

        // 5. Overlay annotations if timestamp matches commentTimestamp (within float tolerance)
        if (isMatch && params.annotations && params.annotations.length > 0) {
          const shotBuffer = fs.readFileSync(localShotPath)
          const composited = await this.overlayAnnotationsOnBuffer(shotBuffer, params.annotations)
          fs.writeFileSync(localShotPath, composited)
        }

        // 6. Upload to S3
        const assetDir = getDerivedArtifactDirectory(params.assetKey, params.assetId)
        const s3Key = `${assetDir}/screenshots/${outName}`
        const fileBuffer = fs.readFileSync(localShotPath)
        await s3Service.putObject(bucket, s3Key, fileBuffer, fileBuffer.length, 'image/webp')

        return { key: s3Key, timestamp: t }
      })

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
    signal?: AbortSignal
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
        const pdftoppmArgs = [
          '-png',
          '-f',
          params.start.toString(),
          '-l',
          params.end.toString(),
          pdfPath,
          pagePrefix,
        ]
        if (params.signal) {
          await execFileAsync('pdftoppm', pdftoppmArgs, { signal: params.signal })
        } else {
          await execFileAsync('pdftoppm', pdftoppmArgs)
        }
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

        let webpBuffer: Buffer = await sharp(localPngPath, { limitInputPixels: false })
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
        const assetDir = getDerivedArtifactDirectory(params.assetKey, params.assetId)
        const s3Key = `${assetDir}/pdf_pages/${webpName}`
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

    // Annotations are drawn in the displayed (EXIF-oriented) coordinate space.
    const meta = displayedDimensions(
      await sharp(imageBuffer, { limitInputPixels: false }).metadata(),
    )
    const width = meta.width || 1920
    const height = meta.height || 1080

    const svgStr = renderAnnotationsToSvg(width, height, annotations)
    return await sharp(imageBuffer, orientedSharpOptions())
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
      const assetDir = getDerivedArtifactDirectory(params.assetKey, params.assetId)
      const s3Key = `${assetDir}/annotations/${outName}`
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
    await sharp(inputPath, orientedSharpOptions())
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

export function buildHlsMasterPlaylist(
  renditions: Array<{
    resolution: string
    width: number
    height: number
    bitrateBps: number
    isHdr?: boolean
  }>,
): string {
  let content = '#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-INDEPENDENT-SEGMENTS\n'
  for (const r of renditions) {
    const bandwidth = r.bitrateBps + 128_000
    const codecs = r.isHdr ? 'avc1.640028,mp4a.40.2' : 'avc1.64001f,mp4a.40.2'
    content += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},AVERAGE-BANDWIDTH=${bandwidth},RESOLUTION=${r.width}x${r.height},CODECS="${codecs}"\n`
    content += `${r.resolution}/index.m3u8\n`
  }
  return content
}

export async function rewriteM3u8WithPresignedUrls(
  m3u8Content: string,
  s3Prefix: string,
  bucket: string,
): Promise<string> {
  const lines = m3u8Content.split(/\r?\n/)
  const rewrittenLines: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      rewrittenLines.push(line)
      continue
    }

    const mapMatch = trimmed.match(/^#EXT-X-MAP:URI="([^"]+)"(.*)$/)
    if (mapMatch) {
      const initRelPath = mapMatch[1]
      const extra = mapMatch[2] || ''
      const initKey = path.posix.join(s3Prefix, initRelPath)
      const presignedUrl = await s3Service.presign(bucket, initKey, 'GET')
      rewrittenLines.push(`#EXT-X-MAP:URI="${presignedUrl}"${extra}`)
      continue
    }

    if (trimmed.endsWith('.m4s') || trimmed.endsWith('.mp4') || trimmed.endsWith('.ts')) {
      const segmentKey = path.posix.join(s3Prefix, trimmed)
      const presignedUrl = await s3Service.presign(bucket, segmentKey, 'GET')
      rewrittenLines.push(presignedUrl)
      continue
    }

    rewrittenLines.push(line)
  }

  return rewrittenLines.join('\n')
}
