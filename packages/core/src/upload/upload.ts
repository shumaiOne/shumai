import { assetService } from '@shumai/core/src/asset/asset'
import { PaginatedData, PaginationParams, paginateQuery } from '@shumai/core/src/pagination'
import { s3Service } from '@shumai/core/src/s3/s3'
import {
  AssetStatus,
  AssetType,
  Prisma,
  TaskStatus,
  WorkflowTaskStatus,
  WorkflowTaskType,
  prisma,
} from '@shumai/db'
import {
  ConfirmFileUploadRequest,
  CreateUploadTaskRequest,
  CreateUploadTaskResponse,
  FileNode,
  PresignedUrl,
  TaskInfo,
} from '@shumai/dtos'
import { ImageTranscoder, PdfTranscoder, VideoTranscoder } from '@shumai/transcode'
import { generateKeyBetween } from 'jittered-fractional-indexing'
import { ulid } from 'ulid'
import { sanitizeFilename } from '@shumai/core/src/utils/filename'
import { getProxyType } from '@shumai/core/src/utils/mime'

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

    const task = await this.prismaClient.task.create({
      data: {
        creatorId: userId,
        type: 'upload',
        name: taskName,
        total,
        status: TaskStatus.pending,
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

    const createdAssets: { tempId: string; assetId: string }[] = []

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
    createdAssets: { tempId: string; assetId: string }[],
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
      await this.prismaClient.asset.delete({ where: { id: asset.id } })
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

    // Ai Tasks
    const autofillAgent = await tx.agent.findFirst({
      where: {
        type: 'autofill',
        enabled: true,
        user: { teamMembers: { some: { teamId: team.id } } },
      },
    })

    const proxyType =
      (asset.media as PrismaJson.MediaInfo | null)?.proxyType ||
      getProxyType(asset.mediaType, asset.name)

    const isVideo = proxyType === 'video'
    const isImage = proxyType === 'image'
    const isAudio = proxyType === 'audio'
    const isPdf = proxyType === 'pdf'

    if (autofillAgent && (isVideo || isImage)) {
      await tx.workflowTask.create({
        data: {
          assetId: asset.id,
          type: WorkflowTaskType.ai_metadata_autofill,
          status: WorkflowTaskStatus.pending,
          teamId: team.id,
          projectId,
          payload: {
            projectId,
            agent: { agentId: autofillAgent.id },
          },
        },
      })
    }

    if (!proxyType) {
      await tx.asset.update({
        where: { id: asset.id },
        data: { status: AssetStatus.processed },
      })
    } else {
      const settings = team.settings as PrismaJson.Settings | null
      if (isVideo) {
        const strategy = settings?.transcode?.videoStrategy || 'best_match'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await new VideoTranscoder(tx as any, asset.id, team.id, projectId)
          .setStrategy(strategy)
          .withSprite()
          .withPoster()
          .submit()
      } else if (isAudio) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await new VideoTranscoder(tx as any, asset.id, team.id, projectId).submit()
      } else if (isImage) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await new ImageTranscoder(tx as any, asset.id, team.id, projectId).withThumbnail().submit()
      } else if (isPdf) {
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
    }))

    return { data: infos, pageInfo }
  }
}

export const uploadService = new UploadService()
