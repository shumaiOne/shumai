import { assetService } from '@shumai/core/src/asset/asset'
import { logger } from '@shumai/core/src/logger'
import { s3Service } from '@shumai/core/src/s3/s3'
import { secondToTurntableFrame, TURNTABLE_FPS } from '@shumai/core/src/utils/model3d'
import { watermarkService } from '@shumai/core/src/watermark/watermark'
import { prisma } from '@shumai/db'
import '@shumai/db/src/prisma-json-types'
import { execFile } from 'child_process'
import * as fs from 'fs'
import { HTTPException } from 'hono/http-exception'
import * as os from 'os'
import * as path from 'path'
import sharp from 'sharp'
import { ulid } from 'ulid'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const DEFAULT_CONCURRENCY = 4
const DEFAULT_FRAME_TIMEOUT_MS = 30_000
const MIN_PREFERRED_PROXY_HEIGHT = 360

export interface ExtractCommentFrameParams {
  assetId: string
  second: number
  width?: number
  watermarkConfigId?: string | null
  signal?: AbortSignal
}

export interface ExtractCommentFrameResult {
  buffer: Buffer
  mimeType: string
}

export type ExecFileFn = (
  file: string,
  args: string[],
  options?: { signal?: AbortSignal; timeout?: number },
) => Promise<{ stdout: string | Buffer; stderr: string | Buffer }>

interface QueuedTask<T> {
  run: () => Promise<T>
  resolve: (value: T) => void
  reject: (err: unknown) => void
  signal?: AbortSignal
  onAbort?: () => void
}

/**
 * Bounded FIFO concurrency queue dedicated to on-demand comment frame extraction,
 * isolated from background transcode workers so print requests stay fast without
 * overloading the main API server.
 */
export class FrameExtractionQueue {
  private running = 0
  private readonly pending: QueuedTask<unknown>[] = []

  constructor(private readonly maxConcurrency: number) {}

  get activeCount(): number {
    return this.running
  }

  get queuedCount(): number {
    return this.pending.length
  }

  enqueue<T>(run: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) {
      return Promise.reject(new DOMException('Frame extraction aborted', 'AbortError'))
    }

    return new Promise<T>((resolve, reject) => {
      const task: QueuedTask<T> = { run, resolve, reject, signal }

      if (signal) {
        const onAbort = () => {
          const idx = this.pending.indexOf(task as QueuedTask<unknown>)
          if (idx !== -1) {
            this.pending.splice(idx, 1)
            signal.removeEventListener('abort', onAbort)
            reject(new DOMException('Frame extraction aborted', 'AbortError'))
          }
        }
        task.onAbort = onAbort
        signal.addEventListener('abort', onAbort, { once: true })
      }

      this.pending.push(task as QueuedTask<unknown>)
      this.drain()
    })
  }

  private drain(): void {
    while (this.running < this.maxConcurrency && this.pending.length > 0) {
      const task = this.pending.shift()
      if (!task) break

      if (task.signal && task.onAbort) {
        task.signal.removeEventListener('abort', task.onAbort)
      }
      if (task.signal?.aborted) {
        task.reject(new DOMException('Frame extraction aborted', 'AbortError'))
        continue
      }

      this.running++
      task.run().then(
        (result) => {
          this.running--
          this.drain()
          task.resolve(result)
        },
        (err) => {
          this.running--
          this.drain()
          task.reject(err)
        },
      )
    }
  }
}

/**
 * Picks the fastest video proxy suitable for thumbnail extraction:
 * 1. Prefer SDR proxies over HDR to avoid washed-out colors.
 * 2. Among SDR proxies, pick the lowest resolution that is still >= 360p (fast seek + decode
 *    for a ~400px thumbnail). If none are >= 360p, pick the highest available SDR proxy.
 */
export function selectBestVideoProxyKey(
  videoTranscodes?: PrismaJson.VideoTranscode[] | null,
): string | null {
  if (!videoTranscodes || videoTranscodes.length === 0) return null

  const valid = videoTranscodes.filter((t) => Boolean(t.key))
  if (valid.length === 0) return null

  const sdr = valid.filter((t) => !t.hdr)
  const pool = sdr.length > 0 ? sdr : valid

  const adequate = pool
    .filter((t) => (t.height || 0) >= MIN_PREFERRED_PROXY_HEIGHT)
    .sort((a, b) => (a.height || 0) - (b.height || 0))
  if (adequate.length > 0) {
    return adequate[0].key ?? null
  }

  const fallback = [...pool].sort((a, b) => (b.height || 0) - (a.height || 0))
  return fallback[0]?.key ?? null
}

/**
 * Resolves an ffmpeg `-ss` input seek timestamp that lands squarely on the exact
 * target frame displayed by Shumai's video and 3D turntable players.
 *
 * `ffmpeg -ss T -i input -vframes 1` outputs the first frame with `PTS >= T`.
 * Passing `N / fps` directly (especially after decimal rounding) or a frame center
 * `(N + 0.5) / fps` causes ffmpeg to skip frame `N` and emit frame `N + 1` whenever
 * `T` exceeds `PTS(N)` by even 1µs.
 *
 * Instead, we recover integer frame `N` with the exact player formula
 * (`Math.floor(second * fps + 0.45)` for video, `secondToTurntableFrame` for 3D)
 * and seek to the midpoint between frame `N - 1` and frame `N`: `(N - 0.5) / fps`,
 * leaving a full ±0.5 frame tolerance margin on both sides.
 */
export function resolveFrameAccurateSeek(params: {
  second: number
  proxyType: 'video' | '3d'
  frameRate?: number | null
  totalFrames?: number | null
  duration?: number | null
}): { seekTime: number; frameIndex: number | null } {
  const safeSecond = Math.max(0, params.second)

  if (params.proxyType === '3d') {
    const frameIndex = secondToTurntableFrame(safeSecond)
    const seekTime = frameIndex <= 0 ? 0 : (frameIndex - 0.5) / TURNTABLE_FPS
    return { seekTime, frameIndex }
  }

  const fps = params.frameRate && params.frameRate > 0 ? params.frameRate : null
  if (fps) {
    let frameIndex = Math.max(0, Math.floor(safeSecond * fps + 0.45))
    if (params.totalFrames && params.totalFrames > 0) {
      frameIndex = Math.min(frameIndex, params.totalFrames - 1)
    } else if (params.duration && params.duration > 0) {
      const maxFrame = Math.max(0, Math.round(params.duration * fps) - 1)
      frameIndex = Math.min(frameIndex, maxFrame)
    }
    const seekTime = frameIndex <= 0 ? 0 : (frameIndex - 0.5) / fps
    return { seekTime, frameIndex }
  }

  const seekTime =
    params.duration && params.duration > 0 && safeSecond >= params.duration
      ? Math.max(0, params.duration - 0.05)
      : safeSecond
  return { seekTime, frameIndex: null }
}

export class CommentFrameService {
  private readonly queue: FrameExtractionQueue
  private readonly inFlight = new Map<
    string,
    {
      promise: Promise<ExtractCommentFrameResult>
      controller: AbortController
      waiters: number
    }
  >()
  private readonly execFileFn: ExecFileFn
  private readonly timeoutMs: number

  constructor(options?: { maxConcurrency?: number; timeoutMs?: number; execFileFn?: ExecFileFn }) {
    const envConcurrency = Number(process.env.PRINT_FRAME_CONCURRENCY)
    const maxConcurrency =
      options?.maxConcurrency ??
      (Number.isInteger(envConcurrency) && envConcurrency > 0
        ? envConcurrency
        : DEFAULT_CONCURRENCY)
    this.queue = new FrameExtractionQueue(maxConcurrency)
    this.timeoutMs = options?.timeoutMs ?? DEFAULT_FRAME_TIMEOUT_MS
    this.execFileFn =
      options?.execFileFn ??
      ((file, args, opts) =>
        execFileAsync(file, args, {
          signal: opts?.signal,
          timeout: opts?.timeout,
          maxBuffer: 10 * 1024 * 1024,
        }))
  }

  async extractFrame(params: ExtractCommentFrameParams): Promise<ExtractCommentFrameResult> {
    if (params.signal?.aborted) {
      throw new DOMException('Frame extraction aborted', 'AbortError')
    }

    const width = Math.max(64, Math.min(1280, Math.round(params.width ?? 400)))
    const second = Math.max(0, params.second)

    const targetAssetId = await assetService.resolveLatestVersionId(params.assetId)
    const asset = await prisma.asset.findUnique({
      where: { id: targetAssetId },
      include: { storageKey: true },
    })
    params.signal?.throwIfAborted()

    if (!asset || asset.isDeleted) {
      throw new HTTPException(404, { message: 'Asset not found' })
    }

    const media = asset.media as PrismaJson.MediaInfo | null
    const proxyType = media?.proxyType ?? this.inferProxyType(asset.mediaType)

    if (proxyType !== 'video' && proxyType !== '3d' && proxyType !== 'pdf') {
      throw new HTTPException(400, {
        message: 'Frame extraction is only supported for video, 3D model, and PDF assets',
      })
    }

    const frameTarget =
      proxyType === 'pdf'
        ? null
        : resolveFrameAccurateSeek({
            second,
            proxyType,
            frameRate: media?.metadata?.frameRate,
            totalFrames: media?.metadata?.totalFrames ?? media?.frames,
            duration: media?.duration ?? media?.metadata?.duration,
          })

    const normalizedKeyTime =
      proxyType === 'pdf'
        ? `p${Math.max(1, Math.round(second))}`
        : frameTarget!.frameIndex !== null
          ? `f${frameTarget!.frameIndex}`
          : frameTarget!.seekTime.toFixed(6)
    const dedupeKey = `${targetAssetId}:${params.watermarkConfigId ?? ''}:${normalizedKeyTime}:${width}`

    let entry = this.inFlight.get(dedupeKey)
    if (!entry) {
      const controller = new AbortController()
      const promise = this.queue
        .enqueue(async () => {
          if (proxyType === 'pdf') {
            return this.extractPdfPageFrame({
              asset,
              media,
              page: Math.max(1, Math.round(second)),
              width,
              signal: controller.signal,
            })
          }
          return this.extractVideoFrame({
            asset,
            media,
            second,
            seekTime: frameTarget!.seekTime,
            frameRate: proxyType === '3d' ? TURNTABLE_FPS : media?.metadata?.frameRate,
            width,
            watermarkConfigId: params.watermarkConfigId,
            signal: controller.signal,
          })
        }, controller.signal)
        .finally(() => {
          if (this.inFlight.get(dedupeKey)?.promise === promise) {
            this.inFlight.delete(dedupeKey)
          }
        })

      entry = { promise, controller, waiters: 0 }
      this.inFlight.set(dedupeKey, entry)
    }

    entry.waiters++
    const currentEntry = entry

    if (!params.signal) {
      return currentEntry.promise.finally(() => {
        currentEntry.waiters = Math.max(0, currentEntry.waiters - 1)
      })
    }

    return new Promise<ExtractCommentFrameResult>((resolve, reject) => {
      let settled = false
      const cleanup = () => {
        params.signal?.removeEventListener('abort', onAbort)
        currentEntry.waiters = Math.max(0, currentEntry.waiters - 1)
        if (currentEntry.waiters === 0) {
          currentEntry.controller.abort()
        }
      }
      const onAbort = () => {
        if (settled) return
        settled = true
        cleanup()
        reject(new DOMException('Frame extraction aborted', 'AbortError'))
      }

      params.signal!.addEventListener('abort', onAbort, { once: true })

      currentEntry.promise.then(
        (res) => {
          if (settled) return
          settled = true
          params.signal?.removeEventListener('abort', onAbort)
          currentEntry.waiters = Math.max(0, currentEntry.waiters - 1)
          resolve(res)
        },
        (err) => {
          if (settled) return
          settled = true
          params.signal?.removeEventListener('abort', onAbort)
          currentEntry.waiters = Math.max(0, currentEntry.waiters - 1)
          reject(err)
        },
      )
    })
  }

  private inferProxyType(mediaType: string | null): PrismaJson.MediaInfo['proxyType'] | undefined {
    const lower = (mediaType || '').toLowerCase()
    if (lower.startsWith('video/')) return 'video'
    if (lower === 'application/pdf') return 'pdf'
    if (lower.startsWith('image/')) return 'image'
    if (lower.startsWith('audio/')) return 'audio'
    return undefined
  }

  private async extractVideoFrame(params: {
    asset: {
      id: string
      status: string
      storageKey: { key: string; isArchived: boolean } | null
    }
    media: PrismaJson.MediaInfo | null
    second: number
    seekTime: number
    frameRate?: number | null
    width: number
    watermarkConfigId?: string | null
    signal?: AbortSignal
  }): Promise<ExtractCommentFrameResult> {
    const bucket = process.env.S3_BUCKET || 'shumai'
    let targetKey: string | null

    if (params.watermarkConfigId) {
      const wfMap = await watermarkService.getCompletedWatermarkMediaMap(
        [params.asset.id],
        params.watermarkConfigId,
      )
      const watermarkMedia = wfMap.get(params.asset.id) ?? null
      targetKey = selectBestVideoProxyKey(watermarkMedia?.videoTranscodes)
      if (!targetKey) {
        throw new HTTPException(422, {
          message: 'Watermarked proxy is not ready for this asset',
        })
      }
    } else {
      targetKey = selectBestVideoProxyKey(params.media?.videoTranscodes)
      if (!targetKey) {
        const originalKey = params.asset.storageKey?.key
        const isArchived =
          Boolean(params.asset.storageKey?.isArchived) || params.asset.status === 'archived'
        if (!originalKey || isArchived) {
          throw new HTTPException(422, {
            message: 'Original video file is archived and no proxy is available',
          })
        }
        targetKey = originalKey
      }
    }

    const inputSource = await s3Service.resolveInput(bucket, targetKey)
    const isRemote = inputSource.startsWith('http://') || inputSource.startsWith('https://')
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shumai-print-frame-'))

    try {
      const outPath = path.join(tmpDir, `frame-${ulid()}.webp`)
      const runFfmpeg = async (timestamp: number) => {
        const args = [
          '-y',
          '-loglevel',
          'warning',
          ...(isRemote
            ? ['-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5']
            : []),
          '-ss',
          timestamp.toFixed(6),
          '-i',
          inputSource,
          '-map',
          '0:V:0',
          '-vframes',
          '1',
          '-vf',
          `scale=${params.width}:-2:force_original_aspect_ratio=decrease`,
          '-c:v',
          'libwebp',
          '-q:v',
          '80',
          outPath,
        ]
        await this.execFileFn('ffmpeg', args, {
          signal: params.signal,
          timeout: this.timeoutMs,
        })
      }

      await runFfmpeg(params.seekTime)

      // If container metadata overestimated totalFrames at EOF, step back one frame and retry.
      if ((!fs.existsSync(outPath) || fs.statSync(outPath).size === 0) && params.seekTime > 0) {
        const stepBack = params.frameRate && params.frameRate > 0 ? 1 / params.frameRate : 0.1
        await runFfmpeg(Math.max(0, params.seekTime - stepBack))
      }

      if (!fs.existsSync(outPath) || fs.statSync(outPath).size === 0) {
        throw new HTTPException(404, { message: 'Could not extract frame at requested timestamp' })
      }

      const buffer = fs.readFileSync(outPath)
      return { buffer, mimeType: 'image/webp' }
    } catch (err) {
      if (err instanceof HTTPException) throw err
      if ((err as { name?: string })?.name === 'AbortError') throw err
      logger.error(
        { assetId: params.asset.id, second: params.second, err },
        'Failed to extract video comment frame',
      )
      throw new HTTPException(500, { message: 'Failed to extract video frame' })
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  }

  private async extractPdfPageFrame(params: {
    asset: {
      id: string
      status: string
      storageKey: { key: string; isArchived: boolean } | null
    }
    media: PrismaJson.MediaInfo | null
    page: number
    width: number
    signal?: AbortSignal
  }): Promise<ExtractCommentFrameResult> {
    const bucket = process.env.S3_BUCKET || 'shumai'
    const proxyKey = params.media?.pdfTranscode?.key
    const originalKey = params.asset.storageKey?.key
    const isArchived =
      Boolean(params.asset.storageKey?.isArchived) || params.asset.status === 'archived'

    let targetKey: string | null = proxyKey || null
    if (!targetKey) {
      if (!originalKey || isArchived) {
        throw new HTTPException(422, {
          message: 'Original PDF file is archived and no proxy is available',
        })
      }
      targetKey = originalKey
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shumai-print-pdf-'))
    try {
      const pdfPath = path.join(tmpDir, 'source.pdf')
      await s3Service.downloadToFile(bucket, targetKey, pdfPath)

      const pagePrefix = path.join(tmpDir, 'page')
      await this.execFileFn(
        'pdftoppm',
        [
          '-png',
          '-scale-to',
          String(params.width),
          '-f',
          String(params.page),
          '-l',
          String(params.page),
          pdfPath,
          pagePrefix,
        ],
        {
          signal: params.signal,
          timeout: this.timeoutMs,
        },
      )

      const pngFile = fs.readdirSync(tmpDir).find((f) => f.endsWith('.png'))
      if (!pngFile) {
        throw new HTTPException(404, { message: `PDF page ${params.page} not found` })
      }

      const buffer = await sharp(path.join(tmpDir, pngFile), {
        limitInputPixels: (params.width + 1) ** 2,
      })
        .toColorspace('srgb')
        .webp({ quality: 82 })
        .toBuffer()

      return { buffer, mimeType: 'image/webp' }
    } catch (err) {
      if (err instanceof HTTPException) throw err
      if ((err as { name?: string })?.name === 'AbortError') throw err
      logger.error(
        { assetId: params.asset.id, page: params.page, err },
        'Failed to render PDF comment page frame',
      )
      throw new HTTPException(500, { message: 'Failed to render PDF page' })
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  }
}

export const commentFrameService = new CommentFrameService()
