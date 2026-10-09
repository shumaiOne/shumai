import { assetService } from '@shumai/core/src/asset/asset'
import { PaginatedData, PaginationParams, paginateQuery } from '@shumai/core/src/pagination'
import { getStorageBackend, s3Service } from '@shumai/core/src/s3/s3'
import { AssetStatus, AssetType, Prisma, TaskStatus, prisma } from '@shumai/db'
import {
  AbortUploadRequest,
  AbortUploadResponse,
  ConfirmFileUploadRequest,
  CreateUploadTaskRequest,
  CreateUploadTaskResponse,
  FileNode,
  PresignedUrl,
  S3SignRequest,
  S3SignResponse,
  TaskInfo,
} from '@shumai/dtos'
import { ImageTranscoder, PdfTranscoder, VideoTranscoder } from '@shumai/transcode'
import { generateKeyBetween } from 'jittered-fractional-indexing'
import { ulid } from 'ulid'
import { gotenbergService } from '@shumai/core/src/gotenberg/gotenberg'
import { sanitizeFilename } from '@shumai/core/src/utils/filename'
import { getProxyType, isHtmlDocument, isOfficeDocument } from '@shumai/core/src/utils/mime'
import { logger } from '@shumai/core/src/logger'
import { HTTPException } from 'hono/http-exception'
import { staleSweepIntervalMs, staleUploadHours } from './upload-env'

export { staleSweepIntervalMs, staleUploadHours } from './upload-env'

export class UploadService {
  constructor(private readonly prismaClient: typeof prisma = prisma) {}

  async createUploadTask(
    userId: string,
    req: CreateUploadTaskRequest,
  ): Promise<CreateUploadTaskResponse> {
    const visibleFiles = req.files.filter((f) => !f.name.startsWith('.'))
    const taskName =
      visibleFiles.length === 1 ? visibleFiles[0].name : `${visibleFiles.length} Items`

    let total = 0
    const countTotalFiles = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.name.startsWith('.')) continue
        if (node.type === 'file') {
          total++
        } else {
          countTotalFiles(node.children)
        }
      }
    }
    countTotalFiles(req.files)
    this.rejectFilesOverBodyLimit(req.files)

    const task = await this.prismaClient.task.create({
      data: {
        creatorId: userId,
        type: 'upload',
        name: taskName,
        total,
        // Nothing to upload (only folders or dot-files): there is no file to confirm, so the task is
        // already done rather than pending forever.
        status: total === 0 ? TaskStatus.completed : TaskStatus.pending,
      },
    })

    const parentAsset = await this.prismaClient.asset.findUnique({
      where: { id: req.parentId },
      include: { project: true },
    })
    if (!parentAsset) throw new Error('Parent asset not found')
    if (!parentAsset.projectId) throw new Error('Parent asset has no project')

    const presignedUrls: PresignedUrl[] = []
    const isParentFile = parentAsset.type === AssetType.file
    const targetParentId = isParentFile ? parentAsset.parentId! : parentAsset.id

    const createdAssets: { tempId: string; assetId: string; key?: string }[] = []

    await this.prismaClient.$transaction(async (tx) => {
      const ids = await this.createAssetsRecursively(
        tx,
        userId,
        task.id,
        parentAsset.projectId!,
        targetParentId,
        req.files,
        presignedUrls,
        createdAssets,
      )

      if (isParentFile && ids.length > 0) {
        for (const assetId of ids) {
          await assetService.reparentAssets(
            {
              assetIds: [assetId],
              newParentId: parentAsset.id,
              creatorId: userId,
            },
            tx,
          )
        }
      }

      return ids
    })

    return {
      taskId: task.id,
      presignedUrls: presignedUrls,
      storageBackend: getStorageBackend(),
      createdAssets: createdAssets,
    }
  }

  private async createAssetsRecursively(
    tx: Prisma.TransactionClient,
    userId: string,
    taskId: string,
    projectId: string,
    parentId: string,
    files: FileNode[],
    presignedUrls: PresignedUrl[],
    createdAssets: { tempId: string; assetId: string; key?: string }[],
  ): Promise<string[]> {
    const firstFile = await tx.asset.findFirst({
      where: { parentId },
      orderBy: { sortIndex: 'asc' },
    })
    let currentSortIndex = firstFile?.sortIndex || undefined
    const createdIds: string[] = []

    for (const file of files) {
      if (file.name.startsWith('.')) continue

      const newSortIndex = generateKeyBetween(null, currentSortIndex || null)
      currentSortIndex = newSortIndex

      const assetType = file.type === 'folder' ? AssetType.folder : AssetType.file
      let key: string | null = null
      if (assetType === AssetType.file) {
        key = `files/${ulid()}/${sanitizeFilename(file.name)}`
      }

      let mediaType = file.mediaType
      if (mediaType && file.name.toLowerCase().endsWith('.wma') && mediaType.startsWith('video/')) {
        mediaType = mediaType.replace(/^video\//, 'audio/')
      }

      const newAsset = await tx.asset.create({
        data: {
          name: file.name,
          type: assetType,
          storageKey: key ? { create: { key } } : undefined,
          sortIndex: newSortIndex,
          mediaType: mediaType,
          status: assetType === AssetType.folder ? AssetStatus.uploaded : AssetStatus.uploading,
          sizeByte: file.size,
          creator: userId ? { connect: { id: userId } } : undefined,
          parent: parentId ? { connect: { id: parentId } } : undefined,
          project: { connect: { id: projectId } },
          task: { connect: { id: taskId } },
        },
      })
      createdIds.push(newAsset.id)
      createdAssets.push({
        tempId: file.id,
        assetId: newAsset.id,
        key: key || undefined,
      })

      if (assetType === AssetType.folder && parentId) {
        await tx.asset.update({
          where: { id: parentId },
          data: { fileCount: { increment: 1 } },
        })
      }

      if (file.children && file.children.length > 0) {
        await this.createAssetsRecursively(
          tx,
          userId,
          taskId,
          projectId,
          newAsset.id,
          file.children,
          presignedUrls,
          createdAssets,
        )
      } else if (assetType === AssetType.file && key) {
        const url = await s3Service.presign(process.env.S3_BUCKET || 'shumai', key, 'PUT')
        presignedUrls.push({
          id: file.id,
          fileId: newAsset.id,
          url,
        })
      }
    }
    return createdIds
  }

  async confirmFileUpload(
    userId: string,
    taskId: string,
    req: ConfirmFileUploadRequest,
  ): Promise<void> {
    const asset = await this.prismaClient.asset.findUnique({
      where: { id: req.fileId },
      include: {
        storageKey: true,
        project: { include: { team: true } },
      },
    })
    if (!asset) throw new Error('Asset not found')
    if (!asset.project) throw new Error('Project not found for asset')
    const key = asset.storageKey?.key
    if (!key) throw new Error('Asset has no key')

    if (req.errorMessage) {
      const bucket = process.env.S3_BUCKET || 'shumai'
      if (asset.uploadId && key) {
        try {
          await s3Service.abortMultipartUpload(bucket, key, asset.uploadId)
        } catch (err) {
          logger.warn(
            { err, key, uploadId: asset.uploadId },
            'Failed to abort multipart upload on confirm error',
          )
        }
      } else if (key) {
        try {
          await s3Service.deleteObject(bucket, key)
        } catch (err) {
          logger.warn({ err, key }, 'Failed to delete storage object on confirm error')
        }
      }

      await this.prismaClient.asset.delete({ where: { id: asset.id } }).catch(() => {})
      if (asset.storageKeyId) {
        await this.prismaClient.storageKey
          .delete({ where: { id: asset.storageKeyId } })
          .catch(() => {})
      }
      const t = await this.prismaClient.task.findUnique({ where: { id: taskId } })
      if (t) {
        const updatedTask = await this.prismaClient.task.update({
          where: { id: taskId },
          data: { uploaded: { increment: 1 } },
        })
        if (updatedTask.uploaded === updatedTask.total) {
          await this.prismaClient.task.update({
            where: { id: taskId },
            data: { status: TaskStatus.completed },
          })
        }
      }
      return
    }

    const size = await s3Service.getObjectSize(process.env.S3_BUCKET || 'shumai', key)

    const project = asset.project

    await this.prismaClient.$transaction(async (tx) => {
      let resolvedMediaType = asset.mediaType
      if (!resolvedMediaType || resolvedMediaType === 'application/octet-stream') {
        resolvedMediaType = Bun.file(asset.name).type || 'application/octet-stream'
      }

      // Update asset
      const updatedAsset = await tx.asset.update({
        where: { id: asset.id },
        data: {
          status: AssetStatus.uploaded,
          sizeByte: size,
          mediaType: resolvedMediaType,
        },
      })

      // Update parent and ancestors
      if (asset.parentId) {
        await tx.asset.update({
          where: { id: asset.parentId },
          data: { fileCount: { increment: 1 } },
        })

        await assetService.updateAncestorsSize(tx, asset.parentId, updatedAsset.sizeByte)
      }

      // Update task
      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: { uploaded: { increment: 1 } },
      })
      if (updatedTask.uploaded === (updatedTask.total || 0)) {
        await tx.task.update({
          where: { id: taskId },
          data: { status: TaskStatus.completed },
        })
      }

      const team = project.team
      if (!team) return
      if (!asset.projectId) throw new Error('Asset project ID is missing')

      await this.triggerPostUploadWorkflows(tx, asset.id, team.id, asset.projectId)
    })
  }

  async triggerPostUploadWorkflows(
    tx: Prisma.TransactionClient,
    assetId: string,
    teamId: string,
    projectId: string,
  ): Promise<void> {
    const asset = await tx.asset.findUnique({
      where: { id: assetId },
    })
    if (!asset) throw new Error('Asset not found')

    const team = await tx.team.findUnique({
      where: { id: teamId },
    })
    if (!team) throw new Error('Team not found')

    const proxyType =
      (asset.media as PrismaJson.MediaInfo | null)?.proxyType ||
      getProxyType(asset.mediaType, asset.name)

    const isVideo = proxyType === 'video'
    const isImage = proxyType === 'image'
    const isAudio = proxyType === 'audio'
    const isPdf = proxyType === 'pdf'

    if (!proxyType) {
      await tx.asset.update({
        where: { id: asset.id },
        data: { status: AssetStatus.processed },
      })
    } else {
      const settings = team.settings as PrismaJson.Settings | null
      const threads = settings?.transcode?.threads ?? 0
      if (isVideo) {
        const strategy = settings?.transcode?.videoStrategy || 'best_match'
        const videoResolutions = settings?.transcode?.videoResolutions
        const hardwareAcceleration = settings?.transcode?.hardwareAcceleration || 'off'
        const hlsEnabled = settings?.transcode?.hlsEnabled ?? false
        const hlsResolutions = settings?.transcode?.hlsResolutions
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await new VideoTranscoder(tx as any, asset.id, team.id, projectId)
          .setStrategy(strategy)
          .setVideoResolutions(videoResolutions)
          .setHardwareAcceleration(hardwareAcceleration)
          .setThreads(threads)
          .setHls(hlsEnabled, hlsResolutions)
          .withSprite()
          .withPoster()
          .submit()
      } else if (isAudio) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await new VideoTranscoder(tx as any, asset.id, team.id, projectId)
          .setThreads(threads)
          .submit()
      } else if (isImage) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await new ImageTranscoder(tx as any, asset.id, team.id, projectId).withThumbnail().submit()
      } else if (isPdf) {
        const isOffice = isOfficeDocument(asset.mediaType, asset.name)
        const isHtml = isHtmlDocument(asset.mediaType, asset.name)

        if (isOffice || isHtml) {
          const gotenbergAvailable = await gotenbergService.isAvailable()
          if (!gotenbergAvailable) {
            await tx.asset.update({
              where: { id: asset.id },
              data: { status: AssetStatus.processed },
            })
            return
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await new PdfTranscoder(tx as any, asset.id, team.id, projectId)
          .withSprite()
          .withPoster()
          .submit()
      }
    }
  }

  async listUploadTasks(
    userId: string,
    params: PaginationParams,
  ): Promise<PaginatedData<TaskInfo[]>> {
    const where: Prisma.TaskWhereInput = {
      creatorId: userId,
      type: 'upload',
    }

    const { data: tasks, pageInfo } = await paginateQuery(
      async (skip, take) => {
        return this.prismaClient.task.findMany({
          where,
          orderBy: { id: 'desc' },
          skip,
          take,
        })
      },
      async () => this.prismaClient.task.count({ where }),
      params,
    )

    const infos: TaskInfo[] = tasks.map((t) => ({
      id: t.id,
      name: t.name || '',
      total: t.total || 0,
      uploaded: t.uploaded,
      createdAt: t.createdAt.toISOString(),
      status: t.status,
    }))

    return { data: infos, pageInfo }
  }

  async signS3Upload(teamId: string, userId: string, req: S3SignRequest): Promise<S3SignResponse> {
    const bucket = process.env.S3_BUCKET || 'shumai'

    const asset = await this.prismaClient.asset.findUnique({
      where: { id: req.fileId },
      include: {
        storageKey: true,
        project: true,
      },
    })

    if (!asset) {
      throw new Error('Asset not found')
    }

    if (asset.status !== AssetStatus.uploading) {
      throw new Error('Asset is not currently uploading')
    }

    if (asset.project?.teamId !== teamId) {
      throw new Error('Asset does not belong to team')
    }

    const key = asset.storageKey?.key
    if (!key) {
      throw new Error('Asset has no storage key')
    }

    if (req.key && req.key !== key) {
      throw new Error('Requested key does not match asset storage key')
    }

    if (req.method === 'GET' || req.method === 'DELETE') {
      if (!req.uploadId) {
        throw new Error('Operation requires uploadId')
      }
    }

    if (req.uploadId) {
      if (asset.uploadId && asset.uploadId !== req.uploadId) {
        throw new Error('Upload ID does not match asset upload ID')
      }
    }

    // Every signing request is a sign of life from a multipart upload: each part and the final
    // complete need a fresh URL. Bumping updatedAt keeps the stale sweep away from an upload that
    // is still moving parts, however long it takes.
    await this.prismaClient.asset.update({
      where: { id: asset.id },
      data: {
        updatedAt: new Date(),
        ...(req.uploadId && !asset.uploadId ? { uploadId: req.uploadId } : {}),
      },
    })

    const result = await s3Service.presignMultipart(bucket, key, req)
    return { url: result.url }
  }

  async abortUpload(
    teamId: string,
    userId: string,
    taskId: string,
    req: AbortUploadRequest,
  ): Promise<AbortUploadResponse> {
    const asset = await this.prismaClient.asset.findUnique({
      where: { id: req.fileId },
      include: {
        storageKey: true,
        project: true,
      },
    })

    if (!asset) {
      return { success: true }
    }

    if (asset.status !== AssetStatus.uploading) {
      throw new Error('Asset is not currently uploading')
    }

    if (asset.taskId !== taskId) {
      throw new Error('Asset does not belong to specified task')
    }

    if (asset.project?.teamId !== teamId) {
      throw new Error('Asset does not belong to specified team')
    }

    const key = asset.storageKey?.key
    if (req.key && key && req.key !== key) {
      throw new Error('Provided key does not match asset storage key')
    }

    if (asset.uploadId && req.uploadId && asset.uploadId !== req.uploadId) {
      throw new Error('Provided uploadId does not match asset uploadId')
    }

    await this.discardUpload(asset, req.uploadId)

    if (taskId) {
      const remaining = await this.prismaClient.asset.count({
        where: { taskId, status: AssetStatus.uploading },
      })
      if (remaining === 0) {
        await this.prismaClient.task
          .update({
            where: { id: taskId },
            data: { status: TaskStatus.failed },
          })
          .catch(() => {})
      }
    }

    return { success: true }
  }

  /**
   * With local storage every file arrives as one request, so a file over MAX_REQUEST_BODY_SIZE can
   * never get through: the server answers 413 and closes the connection while the client is still
   * sending, which the client only sees as a reset. Refuse it here, before any placeholder is made.
   */
  private rejectFilesOverBodyLimit(files: FileNode[]) {
    if (getStorageBackend() !== 'local') return
    const limit = maxRequestBodySize()
    const tooBig: FileNode[] = []
    const walk = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.type === 'file' && node.size > limit) tooBig.push(node)
        else if (node.children) walk(node.children)
      }
    }
    walk(files)
    if (tooBig.length === 0) return
    const gib = (bytes: number) => `${(bytes / 1024 ** 3).toFixed(1)} GiB`
    throw new HTTPException(413, {
      message: `Too large to upload (limit ${gib(limit)}, set by MAX_REQUEST_BODY_SIZE): ${tooBig
        .map((f) => `${f.name} (${gib(f.size)})`)
        .join(', ')}`,
    })
  }

  /** Removes an unfinished upload: its partial data in storage, its placeholder asset and its key. */
  private async discardUpload(
    asset: {
      id: string
      uploadId: string | null
      storageKeyId: string | null
      storageKey: { key: string } | null
    },
    requestUploadId?: string,
  ): Promise<void> {
    const bucket = process.env.S3_BUCKET || 'shumai'
    const key = asset.storageKey?.key
    const uploadId = asset.uploadId || requestUploadId

    if (uploadId && key) {
      try {
        await s3Service.abortMultipartUpload(bucket, key, uploadId)
      } catch (err) {
        logger.warn({ err, key, uploadId }, 'Failed to abort multipart upload in S3')
      }
    } else if (key) {
      try {
        await s3Service.deleteObject(bucket, key)
      } catch (err) {
        logger.warn({ err, key }, 'Failed to delete object from storage')
      }
    }

    await this.prismaClient.asset.delete({ where: { id: asset.id } }).catch((err) => {
      logger.warn({ err, assetId: asset.id }, 'Failed to delete asset on upload abort')
    })
    if (asset.storageKeyId) {
      await this.prismaClient.storageKey
        .delete({ where: { id: asset.storageKeyId } })
        .catch(() => {})
    }
  }

  /**
   * Gives up on uploads nobody is finishing. A client that crashes, goes offline or is turned away by
   * the server (for example a body over MAX_REQUEST_BODY_SIZE) never confirms or aborts its files, so
   * their placeholders and the task would otherwise show "Uploading" forever. A file counts as
   * abandoned once neither it nor its task has changed for `olderThanHours`; it is discarded the same
   * way an abort would, and a task left with nothing uploading is marked failed.
   */
  async abandonStaleUploads(
    olderThanHours = staleUploadHours(),
    now = new Date(),
  ): Promise<{ files: number; tasks: number }> {
    const cutoff = new Date(now.getTime() - olderThanHours * 60 * 60 * 1000)

    const stale = await this.prismaClient.asset.findMany({
      where: {
        status: AssetStatus.uploading,
        updatedAt: { lt: cutoff },
        OR: [{ taskId: null }, { task: { updatedAt: { lt: cutoff } } }],
      },
      select: {
        id: true,
        uploadId: true,
        storageKeyId: true,
        storageKey: { select: { key: true } },
      },
      take: STALE_UPLOAD_BATCH,
    })
    for (const asset of stale) {
      await this.discardUpload(asset)
    }

    const failed = await this.prismaClient.task.updateMany({
      where: {
        type: 'upload',
        status: { in: [TaskStatus.pending, TaskStatus.uploading] },
        // A task with no files (total 0) has nothing to abandon.
        total: { gt: 0 },
        updatedAt: { lt: cutoff },
        assets: { none: { status: AssetStatus.uploading } },
      },
      data: { status: TaskStatus.failed },
    })

    if (stale.length > 0 || failed.count > 0) {
      logger.info(
        { files: stale.length, tasks: failed.count, olderThanHours },
        'Abandoned stale uploads',
      )
    }
    return { files: stale.length, tasks: failed.count }
  }

  private staleUploadTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Start the periodic sweep. The interval (UPLOAD_STALE_SWEEP_INTERVAL_MINUTES) and the stale age
   * (UPLOAD_STALE_AFTER_HOURS) are read once here, so a bad value warns once at startup.
   */
  startStaleUploadSweep(intervalMs = staleSweepIntervalMs(), olderThanHours = staleUploadHours()) {
    if (this.staleUploadTimer) return
    logger.info({ intervalMs, olderThanHours }, 'Stale upload sweep enabled')
    const run = async () => {
      try {
        await this.abandonStaleUploads(olderThanHours)
      } catch (err) {
        logger.error({ err }, 'Stale upload sweep failed')
      }
      if (this.staleUploadTimer) this.staleUploadTimer = setTimeout(run, intervalMs)
    }
    this.staleUploadTimer = setTimeout(run, 0)
  }

  stopStaleUploadSweep() {
    if (this.staleUploadTimer) clearTimeout(this.staleUploadTimer)
    this.staleUploadTimer = null
  }
}

const DEFAULT_MAX_REQUEST_BODY_SIZE = 20 * 1024 * 1024 * 1024

/** Largest request body the server accepts, in bytes (MAX_REQUEST_BODY_SIZE, default 20 GiB). */
export function maxRequestBodySize(): number {
  const bytes = parseInt(process.env.MAX_REQUEST_BODY_SIZE || '', 10)
  return Number.isFinite(bytes) && bytes > 0 ? bytes : DEFAULT_MAX_REQUEST_BODY_SIZE
}

const STALE_UPLOAD_BATCH = 500

export const uploadService = new UploadService()
