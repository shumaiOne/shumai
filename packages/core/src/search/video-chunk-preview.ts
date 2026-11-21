import { logger } from '@shumai/core/src/logger'
import { s3Service } from '@shumai/core/src/s3/s3'
import {
  isPartialVideoRange,
  type renderVideoChunkPreview,
  type VideoRange,
} from '@shumai/core/src/transcode/video-chunk-preview'
import { getDerivedArtifactDirectory } from '@shumai/core/src/utils/filename'
import { prisma, triggerWorkflowTask, WorkflowTaskStatus, WorkflowTaskType } from '@shumai/db'
import type { ChunkPreview } from '@shumai/dtos'

type ChunkKey = VideoRange & { assetId: string }
type RenderedPreview = Awaited<ReturnType<typeof renderVideoChunkPreview>>
const PREVIEW_TASK = WorkflowTaskType.transcode_video_chunk_preview
const ACTIVE_STATUS = [WorkflowTaskStatus.pending, WorkflowTaskStatus.processing]

export class VideoChunkPreviewService {
  constructor(private readonly db: typeof prisma = prisma) {}

  async listReady(ranges: ChunkKey[]) {
    if (!ranges.length) return new Map<string, ChunkPreview>()
    const assets = await this.db.asset.findMany({
      where: { id: { in: [...new Set(ranges.map(({ assetId }) => assetId))] } },
      select: { id: true, media: true },
    })
    const byId = new Map(assets.map(({ id, media }) => [id, media?.chunkPreviews]))
    const previews = new Map<string, ChunkPreview>()
    await Promise.all(
      [...new Map(ranges.map((range) => [chunkKey(range), range]))].map(async ([key, range]) => {
        const media = byId.get(range.assetId)?.[previewRangeKey(range)]
        if (media) previews.set(key, await this.toPreview(media))
      }),
    )
    return previews
  }

  async requestPreviews(assetId: string, ranges: VideoRange[]): Promise<string[]> {
    if (!ranges.length) return []
    const { task, ids } = await this.db.$transaction(async (tx) => {
      // Serialize scheduling for concurrent embedding runs on the same video version.
      await tx.$queryRaw`SELECT id FROM assets WHERE id = ${assetId} FOR UPDATE`
      const asset = await tx.asset.findFirst({
        where: { id: assetId, isDeleted: false, status: { not: 'pending_purge' } },
        select: { projectId: true, media: true, storageKey: true },
      })
      if (
        !asset?.projectId ||
        !asset.storageKey ||
        !getPreviewInput(asset.media, asset.storageKey)
      ) {
        return { ids: [] }
      }
      const duration = asset.media?.duration || asset.media?.metadata?.duration
      const missing = new Map(
        ranges
          .filter(
            (range) =>
              isPartialVideoRange(range, duration) &&
              !asset.media?.chunkPreviews?.[previewRangeKey(range)],
          )
          .map((range) => [previewRangeKey(range), range]),
      )
      if (!missing.size) return { ids: [] }

      const jobs = await tx.workflowTask.findMany({
        where: { assetId, type: PREVIEW_TASK, status: { in: ACTIVE_STATUS } },
        orderBy: { id: 'desc' },
      })
      const ids = new Set<string>()
      for (const job of jobs) {
        for (const range of job.payload?.videoChunkPreviewRanges ?? []) {
          if (missing.delete(previewRangeKey(range))) ids.add(job.id)
        }
      }

      if (!missing.size) return { ids: [...ids] }
      // The create hook submits immediately. Publish this task after the transaction commits.
      const [task] = await tx.workflowTask.createManyAndReturn({
        data: [
          {
            assetId,
            projectId: asset.projectId,
            type: PREVIEW_TASK,
            status: WorkflowTaskStatus.pending,
            payload: { projectId: asset.projectId, videoChunkPreviewRanges: [...missing.values()] },
          },
        ],
      })
      return { task, ids: [...ids, task.id] }
    })
    if (task) {
      triggerWorkflowTask(task).catch((err: unknown) =>
        logger.error({ err, taskId: task.id }, 'Could not submit video chunk preview task'),
      )
    }
    return ids
  }

  async store(
    assetId: string,
    sourceKey: string,
    ranges: VideoRange[],
    render: (range: VideoRange) => Promise<RenderedPreview>,
  ) {
    const asset = await this.db.asset.findUnique({
      where: { id: assetId },
      select: { media: true },
    })
    const existing = asset?.media?.chunkPreviews ?? {}
    const bucket = process.env.S3_BUCKET || 'shumai'
    const prefix = `${getDerivedArtifactDirectory(sourceKey, assetId)}/chunk-previews/${assetId}/${crypto.randomUUID()}`
    const generated: Record<string, PrismaJson.VideoChunkPreviewMedia> = {}
    const failures: unknown[] = []
    for (const [key, range] of new Map(ranges.map((range) => [previewRangeKey(range), range]))) {
      if (existing[key]) continue
      const posterKey = `${prefix}/${range.startTime}-${range.endTime}/poster.webp`
      const spriteKey = `${prefix}/${range.startTime}-${range.endTime}/sprite.webp`
      try {
        const { poster, sprite, ...metadata } = await render(range)
        await s3Service.putObject(bucket, posterKey, poster, poster.length, 'image/webp')
        await s3Service.putObject(bucket, spriteKey, sprite, sprite.length, 'image/webp')
        generated[key] = { ...metadata, posterKey, spriteKey }
      } catch (err) {
        failures.push(err)
        await this.cleanup(bucket, [posterKey, spriteKey], assetId)
      }
    }

    const entries = Object.entries(generated)
    if (entries.length) {
      let published = new Set<string>()
      try {
        published = await this.publish(assetId, entries)
      } finally {
        const unpublished = entries
          .filter(([key]) => !published.has(key))
          .flatMap(([, { posterKey, spriteKey }]) => [posterKey, spriteKey])
        if (unpublished.length) await this.cleanup(bucket, unpublished, assetId)
      }
    }

    if (failures.length) throw failures[0]
  }

  private async publish(assetId: string, entries: [string, PrismaJson.VideoChunkPreviewMedia][]) {
    return this.db.$transaction(async (tx) => {
      const [asset] = await tx.$queryRaw<{ media: PrismaJson.MediaInfo | null }[]>`
        SELECT media FROM assets
        WHERE id = ${assetId} AND NOT is_deleted AND status <> 'pending_purge'
        FOR UPDATE
      `
      if (!asset) return new Set<string>()
      const missing = entries.filter(([key]) => !asset.media?.chunkPreviews?.[key])
      if (!missing.length) return new Set<string>()

      await tx.$executeRaw`
        UPDATE assets
        SET media = jsonb_set(
              COALESCE(media, '{}'::jsonb),
              '{chunkPreviews}',
              COALESCE(media->'chunkPreviews', '{}'::jsonb) ||
                ${JSON.stringify(Object.fromEntries(missing))}::jsonb
            ),
            updated_at = NOW()
        WHERE id = ${assetId}
      `
      return new Set(missing.map(([key]) => key))
    })
  }

  private async cleanup(bucket: string, keys: string[], assetId: string) {
    const outcomes = await Promise.allSettled(
      keys.map((key) => s3Service.deleteObject(bucket, key)),
    )
    for (const outcome of outcomes) {
      if (outcome.status === 'rejected') {
        logger.warn({ err: outcome.reason, assetId }, 'Could not clean up unpublished preview')
      }
    }
  }

  private async toPreview(media: PrismaJson.VideoChunkPreviewMedia): Promise<ChunkPreview> {
    const { posterKey, spriteKey, ...metadata } = media
    const bucket = process.env.S3_BUCKET || 'shumai'
    const [posterUrl, spriteUrl] = await Promise.all([
      s3Service.presign(bucket, posterKey, 'GET'),
      s3Service.presign(bucket, spriteKey, 'GET'),
    ])
    return { ...metadata, posterUrl, spriteUrl }
  }
}

export function chunkKey({ assetId, startTime, endTime }: ChunkKey) {
  return JSON.stringify([assetId, startTime, endTime])
}

export function previewRangeKey({ startTime, endTime }: VideoRange) {
  return JSON.stringify([startTime, endTime])
}

export function getPreviewInput(
  media: PrismaJson.MediaInfo | null,
  source: { key: string; isArchived: boolean },
) {
  const proxy = media?.videoTranscodes?.find((transcode) => transcode.key && !transcode.hdr)
  return proxy?.key || (source.isArchived ? undefined : source.key)
}

export const videoChunkPreviewService = new VideoChunkPreviewService()
