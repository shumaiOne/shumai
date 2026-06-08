import { prisma } from '@shumai/db'
import { WorkflowTaskStatus, WorkflowTaskType } from '@shumai/db'
import '@shumai/db/src/prisma-json-types'
import { execFile } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import sharp from 'sharp'
import { promisify } from 'util'
import { s3Service } from '@shumai/core/src/s3/s3'
import { ulid } from 'ulid'

const execFileAsync = promisify(execFile)

const dataFormatNames: Record<string, string> = {
  // additional codecs
  apch: 'Apple ProRes 422 High Quality',
  apcn: 'Apple ProRes 422 Standard Definition',
  apcs: 'Apple ProRes 422 LT',
  apco: 'Apple ProRes 422 Proxy',
  ap4h: 'Apple ProRes 4444',
  jpeg: 'JPEG Image',

  // codecs from https://mp4ra.org/
  '3gvo': '3GPP Video Orientation',
  a3d1: 'Multiview Video Coding',
  a3d2: 'Multiview Video Coding',
  a3d3: 'Multiview Video Coding',
  a3d4: 'Multiview Video Coding',
  a3ds: 'Auro-Cx 3D audio',
  'ac-3': 'AC-3 audio',
  'ac-4': 'AC-4 audio',
  alac: 'Apple lossless audio codec',
  alaw: 'a-Law',
  av01: 'AV1 video',
  avc1: 'Advanced Video Coding',
  avc2: 'Advanced Video Coding',
  avc3: 'Advanced Video Coding',
  avc4: 'Advanced Video Coding',
  avcp: 'Advanced Video Coding Parameters',
  dra1: 'DRA Audio',
  drac: 'Dirac Video Coder',
  'dts-': 'Dependent base layer for DTS layered audio',
  'dts+': 'Enhancement layer for DTS layered audio',
  dtsc: 'DTS Coherent Acoustics audio',
  dtse: 'DTS Express low bit rate audio, also known as DTS LBR',
  dtsh: 'DTS-HD High Resolution Audio',
  dtsl: 'DTS-HD Master Audio',
  dtsx: 'DTS:X',
  dvav: 'AVC-based “Dolby Vision”',
  dvhe: 'HEVC-based “Dolby Vision”',
  'ec-3': 'Enhanced AC-3 audio',
  enca: 'Encrypted/Protected audio',
  encf: 'Encrypted/Protected font',
  encm: 'Encrypted/Protected metadata stream',
  encs: 'Encrypted Systems stream',
  enct: 'Encrypted Text',
  encv: 'Encrypted/protected video',
  fdp: 'File delivery hints',
  fLaC: 'Fres Lossless Audio Codec',
  g719: 'ITU-T Recommendation G.719 (2008)',
  g726: 'ITU-T Recommendation G.726 (1990)',
  hev1: 'High Efficiency Video Coding',
  hvc1: 'High Efficiency Video Coding',
  hvt1: 'High Efficiency Video Coding',
  ixse: 'DVB Track Level Index Track',
  lhe1: 'Layered High Efficiency Video Coding',
  lht1: 'Layered High Efficiency Video Coding',
  lhv1: 'Layered High Efficiency Video Coding',
  m2ts: 'MPEG-2 transport stream for DMB',
  m4ae: 'MPEG-4 Audio Enhancement MP4v1/2',
  mett: 'Text timed metadata that is not XML',
  metx: 'XML timed metadata',
  mha1: 'MPEG-H Audio (single stream, uncapsulated)',
  mha2: 'MPEG-H Audio (multi-stream, unencapsulated)',
  mhm1: 'MPEG-H Audio (single stream, MHAS encapsulated)',
  mhm2: 'MPEG-H Audio (multi-stream, MHAS encapsulated)',
  mjp2: 'Motion JPEG 2000',
  mlix: 'DVB Movie level index track',
  mlpa: 'MLP Audio',
  mp4a: 'MPEG-4 Audio',
  mp4s: 'MPEG-4 Systems',
  mp4v: 'MPEG-4 Visual',
  mvc1: 'Multiview coding',
  mvc2: 'Multiview coding',
  mvc3: 'Multiview coding',
  mvc4: 'Multiview coding',
  mvd1: 'Multiview coding',
  mvd2: 'Multiview coding',
  mvd3: 'Multiview coding',
  mvd4: 'Multiview coding',
  oksd: 'OMA Keys',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Opus: 'Opus audio coding',
  pm2t: 'Protected MPEG-2 Transport',
  prtp: 'Protected RTP Reception',
  raw: 'Uncompressed audio',
  resv: 'Restricted Video',
  rm2t: 'MPEG-2 Transport Reception',
  rrtp: 'RTP reception',
  rsrp: 'SRTP Reception',
  rtmd: 'Real Time Metadata Sample Entry(XAVC Format)',
  rtp: 'RTP Hints',
  s263: 'ITU H.263 video (3GPP format)',
  samr: 'Narrowband AMR voice',
  sawb: 'Wideband AMR voice',
  sawp: 'Extended AMR-WB (AMR-WB+)',
  sevc: 'EVRC Voice',
  sm2t: 'MPEG-2 Transport Server',
  sqcp: '13K Voice',
  srtp: 'SRTP Hints',
  ssmv: 'SMV Voice',
  STGS: 'Subtitle Sample Entry (HMMP)',
  stpp: 'Subtitles (Timed Text)',
  svc1: 'Scalable Video Coding',
  svc2: 'Scalable Video Coding',
  svcM: 'SVC Metadata',
  tc64: '64 bit timecode samples',
  tmcd: '32 bit timecode samples',
  twos: 'Uncompressed 16-bit audio',
  tx3g: 'Timed Text stream',
  ulaw: 'Samples have been compressed using uLaw 2:1.',
  unid: 'Dynamic Range Control (DRC) data',
  urim: 'Binary timed metadata identified by URI',
  'vc-1': 'SMPTE VC-1',
  vp08: 'VP8 video',
  vp09: 'VP9 video',
  wvtt: 'WebVTT',
}

export interface MediaMetadata {
  originalWidth: number
  originalHeight: number
  duration: number
  bitRate: number
  frameRate: number
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
  frameRate?: number
  disableAudio?: boolean
}

export interface ExtractVideoFramesParams {
  inputFile: string
  outputDir: string
  numFrames: number
  frameHeight: number
  isImage: boolean
}

export class TranscodeService {
  constructor(private readonly prismaClient: typeof prisma = prisma) {}

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

    const frameRateParts = videoStream.r_frame_rate.split('/')
    const frameRate = parseFloat(frameRateParts[0]) / parseFloat(frameRateParts[1])

    return {
      originalWidth: videoStream.width,
      originalHeight: videoStream.height,
      duration: parseFloat(info.format.duration),
      bitRate: parseFloat(info.format.bit_rate),
      frameRate,
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
    if (inputFile.startsWith('http')) {
      const resp = await fetch(inputFile)
      if (!resp.ok) {
        throw new Error(`Failed to fetch image from ${inputFile}: ${resp.statusText}`)
      }
      input = Buffer.from(await resp.arrayBuffer())
    }

    const metadata = await sharp(input, { limitInputPixels: false }).metadata()
    return {
      originalWidth: metadata.width || 0,
      originalHeight: metadata.height || 0,
      duration: 0,
      bitRate: 0,
      frameRate: 0,
      hasAudio: false,
      mimeType: metadata.format || '',
    }
  }

  async transcodeVideo(params: TranscodeVideoParams): Promise<void> {
    let filterComplex = `[0:v]scale=w=${params.width}:h=${params.height}:force_original_aspect_ratio=decrease,scale=w='trunc(iw/2)*2':h='trunc(ih/2)*2'`
    if (params.frameRate) {
      filterComplex += `,fps=${params.frameRate}`
    }
    filterComplex += '[vout]'

    const args = ['-i', params.inputFile, '-filter_complex', filterComplex, '-map', '[vout]']

    if (!params.disableAudio) {
      args.push('-map', '0:a?')
    }

    args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '23')

    if (!params.disableAudio) {
      args.push('-c:a', 'aac', '-b:a', '128k')
    }

    args.push('-movflags', '+faststart', '-max_muxing_queue_size', '1024', params.outputFile)

    await execFileAsync('ffmpeg', ['-y', ...args])
  }

  async transcodeImage(
    inputFile: string | Buffer,
    outputFile: string,
    width: number,
    quality: number,
    height: number | null = null,
  ): Promise<void> {
    let input: string | Buffer = inputFile
    if (typeof inputFile === 'string' && inputFile.startsWith('http')) {
      const resp = await fetch(inputFile)
      if (!resp.ok) {
        throw new Error(`Failed to fetch image from ${inputFile}: ${resp.statusText}`)
      }
      input = Buffer.from(await resp.arrayBuffer())
    }

    const sharpInstance = sharp(input, { limitInputPixels: false })

    const WEBP_MAX_DIMENSION = 16383
    const targetW = width > 0 ? Math.min(width, WEBP_MAX_DIMENSION) : WEBP_MAX_DIMENSION
    const targetH = height && height > 0 ? Math.min(height, WEBP_MAX_DIMENSION) : WEBP_MAX_DIMENSION

    sharpInstance.resize(targetW, targetH, {
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
    const filterComplex = `[0:v]fps=${spriteFps},scale=w=480:h=-2,tile=10x10[sprite_out];[0:v]scale=-2:720:force_original_aspect_ratio=decrease,select='eq(n\\,0)'[thumb_out]`

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
    await execFileAsync('ffmpeg', ['-y', ...args])
  }

  async extractAudio(inputFile: string, outputFile: string, bitrate: string): Promise<void> {
    const args = ['-i', inputFile, '-vn', '-acodec', 'libmp3lame', '-b:a', bitrate, outputFile]
    await execFileAsync('ffmpeg', ['-y', ...args])
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
    await execFileAsync('ffmpeg', ['-y', ...args])

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
        type: WorkflowTaskType.transcode,
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
        type: WorkflowTaskType.transcode,
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

      // 3. Snap closest timestamp to commentTimestamp if within range
      const commentTimestamp = params.commentTimestamp
      if (commentTimestamp !== undefined && commentTimestamp !== null) {
        if (commentTimestamp >= params.start && commentTimestamp <= params.end) {
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
        await execFileAsync('ffmpeg', ['-y', ...args])

        // 5. Overlay annotations if timestamp matches commentTimestamp exactly
        if (
          commentTimestamp !== undefined &&
          commentTimestamp !== null &&
          t === commentTimestamp &&
          params.annotations &&
          params.annotations.length > 0
        ) {
          const meta = await sharp(localShotPath, { limitInputPixels: false }).metadata()
          const width = meta.width || 1280
          const height = meta.height || 720

          const svgStr = renderAnnotationsToSvg(width, height, params.annotations)
          const tempCompositedPath = path.join(tmpDir, `composite-${outName}`)

          await sharp(localShotPath, { limitInputPixels: false })
            .composite([{ input: Buffer.from(svgStr), top: 0, left: 0 }])
            .toFile(tempCompositedPath)

          fs.renameSync(tempCompositedPath, localShotPath)
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

  async overlayAnnotations(params: {
    assetKey: string
    assetId: string
    annotations: PrismaJson.AnnotationList
  }): Promise<string> {
    const bucket = process.env.S3_BUCKET || 'shumai'
    const tmpDir = this.createTempDir('annotation-')
    const imgPath = path.join(tmpDir, path.basename(params.assetKey))

    try {
      // 1. Download image
      await s3Service.downloadToFile(bucket, params.assetKey, imgPath)

      // 2. Read dimensions
      const meta = await sharp(imgPath, { limitInputPixels: false }).metadata()
      const width = meta.width || 1920
      const height = meta.height || 1080

      // 3. Render SVG
      const svgStr = renderAnnotationsToSvg(width, height, params.annotations)

      // 4. Composite
      const outName = `annotation-${ulid()}.webp`
      const localOutPath = path.join(tmpDir, outName)

      await sharp(imgPath, { limitInputPixels: false })
        .composite([{ input: Buffer.from(svgStr), top: 0, left: 0 }])
        .resize(16383, 16383, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 90 })
        .toFile(localOutPath)

      // 5. Upload to S3
      const s3Key = `files/${params.assetId}/annotations/${outName}`
      const fileBuffer = fs.readFileSync(localOutPath)
      await s3Service.putObject(bucket, s3Key, fileBuffer, fileBuffer.length, 'image/webp')

      return s3Key
    } finally {
      this.removeDir(tmpDir)
    }
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
