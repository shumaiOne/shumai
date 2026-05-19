import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import sharp from 'sharp'
import { prisma } from '@/db'
import { WorkflowTaskType, WorkflowTaskStatus } from '@/generated/prisma/client'
import '@/prisma-json-types'

const execAsync = promisify(exec)

export interface MediaMetadata {
  originalWidth: number
  originalHeight: number
  duration: number
  bitRate: number
  frameRate: number
  hasAudio: boolean
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

  async getVideoInfo(inputFile: string): Promise<MediaMetadata> {
    const { stdout } = await execAsync(
      `ffprobe -v quiet -print_format json -show_format -show_streams "${inputFile}"`,
    )
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

    const metadata = await sharp(input).metadata()
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

    const args = [
      '-i',
      `"${params.inputFile}"`,
      '-filter_complex',
      `"${filterComplex}"`,
      '-map',
      '[vout]',
    ]

    if (!params.disableAudio) {
      args.push('-map', '0:a?')
    }

    args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '23')

    if (!params.disableAudio) {
      args.push('-c:a', 'aac', '-b:a', '128k')
    }

    args.push('-max_muxing_queue_size', '1024', `"${params.outputFile}"`)

    await execAsync(`ffmpeg -y ${args.join(' ')}`)
  }

  async transcodeImage(
    inputFile: string,
    outputFile: string,
    width: number,
    quality: number,
    height: number | null = null,
  ): Promise<void> {
    let input: string | Buffer = inputFile
    if (inputFile.startsWith('http')) {
      const resp = await fetch(inputFile)
      if (!resp.ok) {
        throw new Error(`Failed to fetch image from ${inputFile}: ${resp.statusText}`)
      }
      input = Buffer.from(await resp.arrayBuffer())
    }

    const sharpInstance = sharp(input)

    const w = width > 0 ? width : null
    const h = height && height > 0 ? height : null

    if (w || h) {
      sharpInstance.resize(w, h, {
        withoutEnlargement: true,
        fit: 'inside',
      })
    }

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
      `"${inputFile}"`,
      '-filter_complex',
      `"${filterComplex}"`,
      '-map',
      '[sprite_out]',
      '-frames:v',
      '1',
      '-c:v',
      'libwebp',
      '-q:v',
      '75',
      `"${outputSprite}"`,
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
      `"${outputPoster}"`,
    ]
    await execAsync(`ffmpeg -y ${args.join(' ')}`)
  }

  async extractAudio(inputFile: string, outputFile: string, bitrate: string): Promise<void> {
    const args = [
      '-i',
      `"${inputFile}"`,
      '-vn',
      '-acodec',
      'libmp3lame',
      '-b:a',
      bitrate,
      `"${outputFile}"`,
    ]
    await execAsync(`ffmpeg -y ${args.join(' ')}`)
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
      `"${params.inputFile}"`,
      '-vf',
      `fps=${fps},scale=-2:${params.frameHeight}`,
      '-c:v',
      'libwebp',
      '-q:v',
      '80',
      `"${outputPattern}"`,
    ]
    await execAsync(`ffmpeg -y ${args.join(' ')}`)

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

  async createVideoTranscodeTask(assetId: string, spec: PrismaJson.TaskSpec) {
    return this.prismaClient.workflowTask.create({
      data: {
        assetId,
        type: WorkflowTaskType.transcode,
        status: WorkflowTaskStatus.pending,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payload: spec as any,
      },
    })
  }

  async createImageTranscodeTask(assetId: string, spec: PrismaJson.TaskSpec) {
    return this.prismaClient.workflowTask.create({
      data: {
        assetId,
        type: WorkflowTaskType.transcode,
        status: WorkflowTaskStatus.pending,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payload: spec as any,
      },
    })
  }
}

export const transcodeService = new TranscodeService()
