import { prisma } from '@/db'
import { ulid } from 'ulid'
import { generateKeyBetween } from 'jittered-fractional-indexing'
import { s3Service } from '@/services/s3/s3'
import { assetService } from '@/services/asset/asset'
import {
  ConfirmFileUploadRequest,
  CreateUploadTaskRequest,
  CreateUploadTaskResponse,
  FileNode,
  PresignedUrl,
  TaskInfo,
} from '@/dtos/upload'
import {
  AssetStatus,
  AssetType,
  Prisma,
  TaskStatus,
  WorkflowTaskStatus,
  WorkflowTaskType,
} from '@/generated/prisma/client'
import { PaginationParams, paginateQuery, PaginatedData } from '@/services/pagination'
import { VideoTranscoder, ImageTranscoder } from '@/transcode/transcoder'

export class UploadService {
  constructor(private readonly prismaClient: typeof prisma = prisma) {}

  async createUploadTask(
    userId: string,
    req: CreateUploadTaskRequest,
  ): Promise<CreateUploadTaskResponse> {
    const visibleFiles = req.files.filter((f) => !f.name.startsWith('.'))
    let taskName = ''
    if (visibleFiles.length === 1) {
      taskName = visibleFiles[0].name
    } else {
      taskName = `${visibleFiles.length} Items`
    }

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

    const createdAssetIds = await this.createAssetsRecursively(
      userId,
      task.id,
      parentAsset.projectId,
      targetParentId,
      req.files,
      presignedUrls,
    )

    if (isParentFile && createdAssetIds.length > 0) {
      for (const assetId of createdAssetIds) {
        await assetService.reparentAssets({
          assetIds: [assetId],
          newParentId: parentAsset.id,
          creatorId: userId,
        })
      }
    }

    return {
      taskId: task.id,
      presignedUrls: presignedUrls,
    }
  }

  private async createAssetsRecursively(
    userId: string,
    taskId: string,
    projectId: string,
    parentId: string,
    files: FileNode[],
    presignedUrls: PresignedUrl[],
  ): Promise<string[]> {
    const firstFile = await this.prismaClient.asset.findFirst({
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
        key = `file/${ulid()}/raw`
      }

      const newAsset = await this.prismaClient.asset.create({
        data: {
          name: file.name,
          type: assetType,
          storageKey: key ? { create: { key } } : undefined,
          sortIndex: newSortIndex,
          mediaType: file.mediaType,
          status: AssetStatus.uploading,
          sizeByte: file.size,
          creator: userId ? { connect: { id: userId } } : undefined,
          parent: parentId ? { connect: { id: parentId } } : undefined,
          project: { connect: { id: projectId } },
          task: { connect: { id: taskId } },
        },
      })
      createdIds.push(newAsset.id)

      if (file.children && file.children.length > 0) {
        await this.createAssetsRecursively(
          userId,
          taskId,
          projectId,
          newAsset.id,
          file.children,
          presignedUrls,
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
      // Update asset
      const updatedAsset = await tx.asset.update({
        where: { id: asset.id },
        data: {
          status: AssetStatus.uploaded,
          sizeByte: size,
        },
      })

      // Update parent and ancestors
      if (asset.parentId) {
        await tx.asset.update({
          where: { id: asset.parentId },
          data: { fileCount: { increment: 1 } },
        })
        // The transaction context is compatible with the asset service's requirements
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await assetService.updateAncestorsSize(tx as any, asset.parentId, updatedAsset.sizeByte)
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

      // Ai Tasks
      const autofillAgent = await tx.agent.findFirst({
        where: {
          type: 'autofill',
          enabled: true,
          user: { teamMembers: { some: { teamId: team.id } } },
        },
      })

      if (autofillAgent) {
        await tx.workflowTask.create({
          data: {
            assetId: asset.id,
            type: WorkflowTaskType.ai_metadata_autofill,
            status: WorkflowTaskStatus.pending,
            teamId: team.id,
            projectId: asset.projectId,
            payload: {
              projectId: asset.projectId!,
              agent: { agentId: autofillAgent.id },
            },
          },
        })
      }

      // Ai Embedding if enabled via agent
      const embeddingAgent = await tx.agent.findFirst({
        where: {
          type: 'embedding',
          enabled: true,
          user: { teamMembers: { some: { teamId: team.id } } },
        },
      })

      if (embeddingAgent) {
        if (asset.mediaType?.startsWith('video/') || asset.mediaType?.startsWith('image/')) {
          await tx.workflowTask.create({
            data: {
              assetId: asset.id,
              type: WorkflowTaskType.ai_embedding,
              status: WorkflowTaskStatus.pending,
              teamId: team.id,
              projectId: asset.projectId,
              payload: {
                projectId: asset.projectId!,
                agent: { agentId: embeddingAgent.id },
              },
            },
          })
        }
      }

      const isVideo = asset.mediaType?.startsWith('video/')
      const isImage = asset.mediaType?.startsWith('image/')
      if (!isVideo && !isImage) {
        await tx.asset.update({
          where: { id: asset.id },
          data: { status: AssetStatus.processed },
        })
      } else {
        const settings = team.settings as PrismaJson.Settings | null
        if (isVideo) {
          const strategy = settings?.transcode?.videoStrategy || 'single'
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await new VideoTranscoder(tx as any, asset.id, team.id, asset.projectId)
            .setStrategy(strategy)
            .withSprite()
            .withPoster()
            .submit()
        } else if (isImage) {
          const strategy = settings?.transcode?.imageStrategy || 'single'
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await new ImageTranscoder(tx as any, asset.id, team.id, asset.projectId)
            .setStrategy(strategy)
            .withThumbnail()
            .submit()
        }
      }
    })
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
