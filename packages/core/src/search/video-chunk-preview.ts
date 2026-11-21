import { logger } from '@shumai/core/src/logger'
import { s3Service } from '@shumai/core/src/s3/s3'
import {
  isPartialVideoRange,
  type renderVideoChunkPreview,
  type VideoRange,
} from '@shumai/core/src/transcode/video-chunk-preview'
import { getDerivedArtifactDirectory } from '@shumai/core/src/utils/filename'
import {
  Prisma,
  prisma,
  triggerWorkflowTask,
  WorkflowTaskStatus,
  WorkflowTaskType,
} from '@shumai/db'
import type { ChunkPreview, ChunkPreviewState } from '@shumai/dtos'
import { HTTPException } from 'hono/http-exception'

type ChunkKey = VideoRange & { assetId: string }
type RenderedPreview = Awaited<ReturnType<typeof renderVideoChunkPreview>>
const RETRY_DELAY_MS = 60_000

export class VideoChunkPreviewService {
  constructor(private readonly db: typeof prisma = prisma) {}

  async listReady(ranges: ChunkKey[]) {
    if (!ranges.length) return new Map<string, ChunkPreview>()
    const records = await this.db.videoChunkPreview.findMany({
      where: { OR: ranges, media: { not: Prisma.DbNull } },
    })
    const previews = new Map<string, ChunkPreview>()
    await Promise.all(
      records.map(async (record) => {
        if (record.media) previews.set(chunkKey(record), await this.toPreview(record.media))
      }),
    )
    return previews
  }

  async getForMatch(
    assetId: string,
    matchId: string,
    request: boolean,
  ): Promise<ChunkPreviewState> {
    const match = await this.db.assetEmbedding.findFirst({
      where: {
        id: matchId,
        assetId,
        asset: { isDeleted: false, mediaType: { startsWith: 'video/' } },
      },
      select: {
        startTime: true,
        endTime: true,
        asset: { select: { projectId: true, media: true, storageKey: true } },
      },
    })
    if (!match) throw new HTTPException(404, { message: 'Video match not found' })

    const { startTime, endTime, asset } = match
    const duration = asset.media?.duration || asset.media?.metadata?.duration
    if (
      startTime === null ||
      endTime === null ||
      !isPartialVideoRange({ startTime, endTime }, duration)
    ) {
      return { status: 'unavailable' }
    }

    const range = { assetId, startTime, endTime }
    const existing = await this.db.videoChunkPreview.findUnique({
      where: { assetRange: range },
    })
    if (existing?.media) return { status: 'ready', preview: await this.toPreview(existing.media) }
    if (!request) {
      const task =
        existing?.taskId &&
        (await this.db.workflowTask.findUnique({ where: { id: existing.taskId } }))
      return { status: task && isActive(task.status) ? 'pending' : 'unavailable' }
    }

    if (!asset.projectId || !asset.storageKey || !getPreviewInput(asset.media, asset.storageKey)) {
      return { status: 'unavailable' }
    }
    return this.requestPreview(range, asset.projectId)
  }

  private async requestPreview(range: ChunkKey, projectId: string): Promise<ChunkPreviewState> {
    const { preview, task, pending } = await this.db.$transaction(async (tx) => {
      await tx.videoChunkPreview.createMany({ data: [range], skipDuplicates: true })
      const [record] = await tx.$queryRaw<{ id: string; taskId: string | null }[]>`
        SELECT id, task_id AS "taskId" FROM video_chunk_previews
        WHERE asset_id = ${range.assetId} AND start_time = ${range.startTime} AND end_time = ${range.endTime}
        FOR UPDATE
      `
      const current = await tx.videoChunkPreview.findUniqueOrThrow({ where: { id: record.id } })
      if (current.media) return { preview: current.media }
      if (record.taskId) {
        const existing = await tx.workflowTask.findUnique({ where: { id: record.taskId } })
        if (existing && isActive(existing.status)) return { pending: true }
        if (existing && Date.now() - existing.updatedAt.getTime() < RETRY_DELAY_MS) {
          return { pending: false }
        }
      }

      // The normal create hook submits immediately. Publish this task after its transaction commits.
      const [task] = await tx.workflowTask.createManyAndReturn({
        data: [
          {
            assetId: range.assetId,
            projectId,
            type: WorkflowTaskType.transcode_video_chunk_preview,
            status: WorkflowTaskStatus.pending,
            payload: { projectId, videoChunkPreviewId: record.id },
          },
        ],
      })
      await tx.videoChunkPreview.update({ where: { id: record.id }, data: { taskId: task.id } })
      return { task, pending: true }
    })
    if (task) {
      triggerWorkflowTask(task).catch((err: unknown) =>
        logger.error({ err, taskId: task.id }, 'Could not submit video chunk preview task'),
      )
    }
    if (preview) return { status: 'ready', preview: await this.toPreview(preview) }
    return { status: pending ? 'pending' : 'unavailable' }
  }

  async store(range: ChunkKey, sourceKey: string, render: () => Promise<RenderedPreview>) {
    await this.db.videoChunkPreview.createMany({ data: [range], skipDuplicates: true })
    const record = await this.db.videoChunkPreview.findUniqueOrThrow({
      where: { assetRange: range },
    })
    if (record.media) return

    const { poster, sprite, ...metadata } = await render()
    const bucket = process.env.S3_BUCKET || 'shumai'
    const prefix = `${getDerivedArtifactDirectory(sourceKey, range.assetId)}/chunk-previews/${record.id}/${crypto.randomUUID()}`
    const posterKey = `${prefix}/poster.webp`
    const spriteKey = `${prefix}/sprite.webp`
    let published = false
    try {
      await s3Service.putObject(bucket, posterKey, poster, poster.length, 'image/webp')
      await s3Service.putObject(bucket, spriteKey, sprite, sprite.length, 'image/webp')
      const result = await this.db.videoChunkPreview.updateMany({
        where: { id: record.id, media: { equals: Prisma.DbNull } },
        data: { media: { ...metadata, posterKey, spriteKey } },
      })
      published = result.count === 1
    } finally {
      if (!published) {
        const outcomes = await Promise.allSettled([
          s3Service.deleteObject(bucket, posterKey),
          s3Service.deleteObject(bucket, spriteKey),
        ])
        for (const outcome of outcomes) {
          if (outcome.status === 'rejected') {
            logger.warn(
              { err: outcome.reason, previewId: record.id },
              'Could not clean up unpublished preview',
            )
          }
        }
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

function isActive(status: WorkflowTaskStatus | null): boolean {
  return status === WorkflowTaskStatus.pending || status === WorkflowTaskStatus.processing
}

export function chunkKey({ assetId, startTime, endTime }: ChunkKey) {
  return JSON.stringify([assetId, startTime, endTime])
}

export function getPreviewInput(
  media: PrismaJson.MediaInfo | null,
  source: { key: string; isArchived: boolean },
) {
  const proxy = media?.videoTranscodes?.find((transcode) => transcode.key && !transcode.hdr)
  return proxy?.key || (source.isArchived ? undefined : source.key)
}

export const videoChunkPreviewService = new VideoChunkPreviewService()
