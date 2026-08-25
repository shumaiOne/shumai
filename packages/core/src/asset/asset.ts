import { prisma } from '@shumai/db'
import {
  AncestorFolder,
  AssetInfo,
  AttachmentInfo,
  ChildPreview,
  CommentInfo,
  CopyAssetsRequest,
  CreateAssetRequest,
  CreateCommentRequest,
  FieldValueInfo,
  GetAssetRequest,
  ListChildrenRequest,
  PreviewInfo,
  ReparentAssetsRequest,
  UpdateAssetNameRequest,
  UpdateAssetOrderRequest,
  AssetUserInfo,
  ListRecentsRequest,
} from '@shumai/dtos'
import { type Asset, AssetStatus, AssetType, Prisma, type StorageKey } from '@shumai/db'
import { HTTPException } from 'hono/http-exception'
import { logger } from '@shumai/core/src/logger'
import { PaginatedData, paginateQuery, PaginationParams } from '@shumai/core/src/pagination'
import { s3Service } from '@shumai/core/src/s3/s3'
import { dedupeSymlinksToTarget } from './symlink'
import { watermarkService } from '@shumai/core/src/watermark/watermark'
import { generateKeyBetween } from 'jittered-fractional-indexing'
import { getAvatarUrl } from '@shumai/core/src/user/avatar'
import { getAgentRequiredLevel, getRoleLevel } from '@shumai/core/src/agent/permissions'
import { resolveEffectiveRole } from '@shumai/core/src/authz/authz'

export const assetInclude = {
  creator: true,
  metadataValues: true,
  storageKey: true,
  target: {
    include: {
      creator: true,
      metadataValues: true,
      storageKey: true,
      children: {
        include: { creator: true, metadataValues: true, storageKey: true },
      },
    },
  },
  children: {
    include: { creator: true, metadataValues: true, storageKey: true },
  },
} as const

export type AssetWithIncludes = Prisma.AssetGetPayload<{
  include: typeof assetInclude
}>

type CommentWithIncludes = Prisma.AssetCommentGetPayload<{
  include: {
    creator: true
    completionLastChangedBy: true
    attachments: { include: { asset: { include: { storageKey: true } } } }
    replies: {
      include: {
        creator: true
        completionLastChangedBy: true
        attachments: { include: { asset: { include: { storageKey: true } } } }
      }
    }
  }
}>

type AssetWithProjectTeam = Prisma.AssetGetPayload<{
  include: { project: { include: { team: true } } }
}>

function generateSortIndex(previous?: string | null): string {
  if (!previous) return generateKeyBetween(null, null)
  return generateKeyBetween(null, previous)
}

export class AssetService {
  constructor(private readonly prismaClient: typeof prisma = prisma) {}

  async getDescendantFolderIds(folderId: string): Promise<string[]> {
    const rows = await this.prismaClient.$queryRaw<{ id: string }[]>`
      WITH RECURSIVE descendant AS (
        SELECT id, parent_id FROM assets WHERE parent_id = ${folderId}
        UNION ALL
        SELECT a.id, a.parent_id FROM assets a
        INNER JOIN descendant d ON a.parent_id = d.id
      )
      SELECT id FROM descendant;
    `
    const ids = rows.map((r) => r.id)
    return [folderId, ...ids]
  }

  async listAssetsByIds(ids: string[]): Promise<AssetInfo[]> {
    if (ids.length === 0) return []

    const assets = await this.prismaClient.asset.findMany({
      where: { id: { in: ids } },
      include: {
        creator: true,
        metadataValues: true,
        storageKey: true,
        target: {
          include: {
            creator: true,
            metadataValues: true,
            storageKey: true,
            children: {
              where: { isDeleted: false },
              include: { creator: true, metadataValues: true, storageKey: true },
              take: 3,
              orderBy: { sortIndex: 'asc' },
            },
          },
        },
        children: {
          where: { isDeleted: false },
          include: { creator: true, metadataValues: true, storageKey: true },
          take: 3,
          orderBy: { sortIndex: 'asc' },
        },
      },
    })

    const assetMap = new Map(assets.map((a) => [a.id, a]))
    const orderedAssets = ids
      .map((id) => assetMap.get(id))
      .filter((a): a is AssetWithIncludes => !!a)
    const orderedInfos = await this.toAssetInfos(orderedAssets)

    return orderedInfos
  }

  async updateAncestorsSize(
    tx: Prisma.TransactionClient,
    startNodeId: string,
    sizeDelta: number | bigint,
  ) {
    if (sizeDelta === 0 || sizeDelta === 0n) return

    const rows = await tx.$queryRaw<{ id: string }[]>`
      WITH RECURSIVE ancestor AS (
        SELECT id, parent_id FROM assets WHERE id = ${startNodeId}
        UNION ALL
        SELECT a.id, a.parent_id FROM assets a
        INNER JOIN ancestor d ON a.id = d.parent_id
      )
      SELECT id FROM ancestor;
    `
    const ancestorIds = rows.map((r) => r.id)

    if (ancestorIds.length > 0) {
      await tx.asset.updateMany({
        where: { id: { in: ancestorIds } },
        data: { sizeByte: { increment: sizeDelta } },
      })
    }
  }

  async dissolveStackIfEmpty(tx: Prisma.TransactionClient, stack: Asset) {
    if (stack.type !== AssetType.version_stack) return

    const count = await tx.asset.count({ where: { parentId: stack.id } })

    if (count === 0) {
      await tx.asset.deleteMany({
        where: { targetId: stack.id, type: AssetType.symlink },
      })
      if (stack.parentId) {
        await tx.asset.update({
          where: { id: stack.parentId },
          data: { fileCount: { decrement: 1 } },
        })
      }
      await tx.asset.delete({ where: { id: stack.id } })
    } else if (count === 1) {
      const lastChild = await tx.asset.findFirst({
        where: { parentId: stack.id },
      })
      if (!lastChild) return
      if (!stack.parentId) throw new Error('Stack has no parent')

      await tx.asset.updateMany({
        where: { targetId: stack.id, type: AssetType.symlink },
        data: { targetId: lastChild.id, name: lastChild.name },
      })

      await tx.asset.update({
        where: { id: lastChild.id },
        data: { parentId: stack.parentId, sortIndex: stack.sortIndex },
      })
      await tx.asset.delete({ where: { id: stack.id } })
    }
  }

  async reparentAssets(req: ReparentAssetsRequest, tx?: Prisma.TransactionClient): Promise<void> {
    const runInTx = async (tx: Prisma.TransactionClient) => {
      const newParent = await tx.asset.findUnique({
        where: { id: req.newParentId },
        include: { project: { include: { team: true } } },
      })
      if (!newParent) throw new Error('New parent not found')
      if (!newParent.project) throw new Error('New parent folder is not associated with a project')

      if (newParent.type === AssetType.file) {
        return this.reparentFileToFile(tx, newParent, req.assetIds, req.creatorId)
      }

      const assetsToMove = await tx.asset.findMany({
        where: { id: { in: req.assetIds } },
        include: { project: { include: { team: true } } },
      })

      if (assetsToMove.length !== req.assetIds.length) {
        throw new Error('Not all assets to be moved were found')
      }

      if (assetsToMove.length === 0) return

      let totalSize = 0
      const oldParentId = assetsToMove[0].parentId
      if (!oldParentId) {
        throw new Error(`Asset ${assetsToMove[0].id} has no parent`)
      }

      for (const a of assetsToMove) {
        if (!a.project || !a.project.team) {
          throw new Error(`Asset ${a.id} is not associated with a team`)
        }
        if (!newParent.project.team) {
          throw new Error('New parent folder is not associated with a team')
        }
        if (a.project.team.id !== newParent.project.team.id) {
          throw new Error(`Cannot move asset ${a.id} to a different team`)
        }
        if (a.parentId !== oldParentId) {
          throw new Error('All assets must be moved from the same parent folder')
        }
        totalSize += Number(a.sizeByte)
      }

      const totalCount = assetsToMove.length

      // Sibling folder move
      if (newParent.parentId && oldParentId === newParent.parentId) {
        await tx.asset.update({
          where: { id: oldParentId },
          data: { fileCount: { decrement: totalCount } },
        })
        await tx.asset.update({
          where: { id: newParent.id },
          data: {
            fileCount: { increment: totalCount },
            sizeByte: { increment: totalSize },
          },
        })
      } else {
        await tx.asset.update({
          where: { id: oldParentId },
          data: { fileCount: { decrement: totalCount } },
        })
        await this.updateAncestorsSize(tx, oldParentId, -totalSize)

        await tx.asset.update({
          where: { id: newParent.id },
          data: { fileCount: { increment: totalCount } },
        })
        await this.updateAncestorsSize(tx, newParent.id, totalSize)
      }

      const firstFile = await tx.asset.findFirst({
        where: { parentId: newParent.id },
        orderBy: { sortIndex: 'asc' },
      })
      let firstSortIndex = firstFile?.sortIndex || null

      for (let i = req.assetIds.length - 1; i >= 0; i--) {
        const assetId = req.assetIds[i]
        const newSortIndex = generateSortIndex(firstSortIndex)
        await tx.asset.update({
          where: { id: assetId },
          data: { parentId: newParent.id, sortIndex: newSortIndex },
        })
        firstSortIndex = newSortIndex
      }

      if (newParent.type === AssetType.version_stack) {
        await dedupeSymlinksToTarget(tx, {
          targetIds: req.assetIds,
          newTargetId: newParent.id,
          name: '',
        })
      }

      const oldParent = await tx.asset.findUnique({
        where: { id: oldParentId },
      })
      if (oldParent) {
        await this.dissolveStackIfEmpty(tx, oldParent)
      }
    }

    if (tx) {
      await runInTx(tx)
    } else {
      await this.prismaClient.$transaction(runInTx)
    }
  }

  async copyAssets(req: CopyAssetsRequest): Promise<void> {
    await this.prismaClient.$transaction(async (tx) => {
      const newParent = await tx.asset.findUnique({
        where: { id: req.newParentId },
        include: { project: { include: { team: true } } },
      })
      if (!newParent) throw new Error('New parent not found')
      if (!newParent.project) throw new Error('New parent folder is not associated with a project')

      const assetsToCopy = await tx.asset.findMany({
        where: { id: { in: req.assetIds } },
        include: { project: { include: { team: true } } },
      })

      if (assetsToCopy.length !== req.assetIds.length) {
        throw new Error('Not all assets to be copied were found')
      }

      // Check if newParentId is a descendant of any asset being copied
      const ancestors = await tx.$queryRaw<{ id: string }[]>`
        WITH RECURSIVE ancestor AS (
          SELECT id, parent_id FROM assets WHERE id = ${newParent.id}
          UNION ALL
          SELECT a.id, a.parent_id FROM assets a
          INNER JOIN ancestor d ON a.id = d.parent_id
        )
        SELECT id FROM ancestor WHERE id IN (${Prisma.join(req.assetIds)}) LIMIT 1;
      `
      if (ancestors.length > 0) {
        throw new Error('Cannot copy a folder into its own descendant')
      }

      for (const a of assetsToCopy) {
        if (!a.project || !a.project.team) {
          throw new Error(`Asset ${a.id} is not associated with a team`)
        }
        if (!newParent.project.team) {
          throw new Error('New parent folder is not associated with a team')
        }
        if (a.project.team.id !== newParent.project.team.id) {
          throw new Error(`Cannot copy asset ${a.id} to a different team`)
        }
      }

      const firstFile = await tx.asset.findFirst({
        where: { parentId: newParent.id },
        orderBy: { sortIndex: 'asc' },
      })
      let firstSortIndex = firstFile?.sortIndex || null

      let totalSize = 0
      for (let i = req.assetIds.length - 1; i >= 0; i--) {
        const assetId = req.assetIds[i]
        const asset = assetsToCopy.find((a) => a.id === assetId)!
        const newSortIndex = generateSortIndex(firstSortIndex)
        const copiedAsset = await this.copyAssetRecursive(
          tx,
          asset,
          newParent.id,
          newParent.projectId!,
          newSortIndex,
          req.creatorId,
          req.withComments,
        )
        totalSize += Number(copiedAsset.sizeByte)
        firstSortIndex = newSortIndex
      }

      await tx.asset.update({
        where: { id: newParent.id },
        data: {
          fileCount: { increment: assetsToCopy.length },
        },
      })
      await this.updateAncestorsSize(tx, newParent.id, totalSize)
    })
  }

  private async copyAssetRecursive(
    tx: Prisma.TransactionClient,
    asset: Asset & { storageKey?: StorageKey | null },
    newParentId: string | null,
    projectId: string | null,
    sortIndex: string | null,
    creatorId?: string,
    withComments: boolean = false,
  ): Promise<Asset> {
    const newAsset = await tx.asset.create({
      data: {
        name: asset.name,
        nameNgram: asset.nameNgram,
        type: asset.type,
        mediaType: asset.mediaType,
        fileCount: asset.fileCount,
        sizeByte: asset.sizeByte,
        status: asset.status,
        transcodeTaskId: asset.transcodeTaskId,
        media: asset.media || undefined,
        isDeleted: asset.isDeleted,
        deletedAt: asset.deletedAt,
        sortIndex: sortIndex,
        parentId: newParentId,
        projectId: projectId,
        creatorId: creatorId || asset.creatorId,
        taskId: asset.taskId,
        targetId: asset.targetId,
        storageKeyId: asset.storageKeyId,
      },
    })

    if (withComments) {
      await this.copyComments(tx, asset.id, newAsset.id, projectId, creatorId)
    }

    if (asset.type === AssetType.folder) {
      const children = await tx.asset.findMany({
        where: { parentId: asset.id },
        orderBy: { sortIndex: 'asc' },
      })
      for (const child of children) {
        await this.copyAssetRecursive(
          tx,
          child,
          newAsset.id,
          projectId,
          child.sortIndex,
          creatorId,
          withComments,
        )
      }
    }

    return newAsset
  }

  private async copyComments(
    tx: Prisma.TransactionClient,
    oldAssetId: string,
    newAssetId: string,
    projectId: string | null,
    creatorId?: string,
  ) {
    const comments = await tx.assetComment.findMany({
      where: { assetId: oldAssetId, replyToId: null },
      include: {
        attachments: { include: { asset: true } },
        replies: {
          include: {
            attachments: { include: { asset: true } },
          },
        },
      },
    })

    for (const comment of comments) {
      await this.copyCommentRecursive(tx, comment, newAssetId, null, projectId, creatorId)
    }
  }

  private async copyCommentRecursive(
    tx: Prisma.TransactionClient,
    comment: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    newAssetId: string,
    newReplyToId: string | null,
    projectId: string | null,
    creatorId?: string,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, createdAt, updatedAt, assetId, replyToId, attachments, replies, ...data } = comment
    const newComment = await tx.assetComment.create({
      data: {
        ...data,
        assetId: newAssetId,
        replyToId: newReplyToId,
        creatorId: creatorId || comment.creatorId,
      },
    })

    if (attachments) {
      for (const attachment of attachments) {
        // Deep copy attachment asset
        const copiedAttachmentAsset = await this.copyAssetRecursive(
          tx,
          attachment.asset,
          null, // attachment usually has no parent
          projectId,
          attachment.asset.sortIndex,
          creatorId,
          false,
        )
        await tx.assetCommentAttachment.create({
          data: {
            commentId: newComment.id,
            assetId: copiedAttachmentAsset.id,
          },
        })
      }
    }

    if (replies) {
      for (const reply of replies) {
        await this.copyCommentRecursive(tx, reply, newAssetId, newComment.id, projectId, creatorId)
      }
    }
  }

  private async reparentFileToFile(
    tx: Prisma.TransactionClient,
    destFile: AssetWithProjectTeam,
    assetIds: string[],
    creatorId?: string,
  ) {
    if (assetIds.length !== 1) {
      throw new Error('Can only reparent one file to another file')
    }
    const sourceId = assetIds[0]
    if (sourceId === destFile.id) {
      throw new Error('Cannot reparent a file to itself')
    }

    const sourceAsset = await tx.asset.findUnique({
      where: { id: sourceId },
      include: { project: { include: { team: true } } },
    })

    if (!sourceAsset) throw new Error('Source asset not found')

    if (!sourceAsset.project || !sourceAsset.project.team) {
      throw new Error(`Asset ${sourceAsset.id} is not associated with a team`)
    }
    if (!destFile.project || !destFile.project.team) {
      throw new Error('Destination file is not associated with a team')
    }
    if (sourceAsset.project.team.id !== destFile.project.team.id) {
      throw new Error(`Cannot move asset ${sourceAsset.id} to a different team`)
    }

    const oldParentId = sourceAsset.parentId
    if (!oldParentId) {
      throw new Error(`Asset ${sourceAsset.id} has no parent`)
    }

    const stackParentId = destFile.parentId
    if (!stackParentId) {
      throw new Error(`Destination file ${destFile.id} has no parent`)
    }

    const stack = await tx.asset.create({
      data: {
        type: AssetType.version_stack,
        status: 'uploaded',
        projectId: destFile.project.id,
        parentId: stackParentId,
        creatorId: creatorId,
        name: '',
        sortIndex: destFile.sortIndex,
      },
    })

    const isUploading = sourceAsset.status === 'uploading'

    if (!isUploading) {
      await tx.asset.update({
        where: { id: oldParentId },
        data: { fileCount: { decrement: 1 } },
      })
      await this.updateAncestorsSize(tx, oldParentId, -Number(sourceAsset.sizeByte))
      await this.updateAncestorsSize(tx, stackParentId, Number(sourceAsset.sizeByte))
    }

    const firstIndex = generateKeyBetween(null, null)
    const secondIndex = generateKeyBetween(firstIndex, null)

    await tx.asset.update({
      where: { id: destFile.id },
      data: { parentId: stack.id, sortIndex: secondIndex },
    })

    await tx.asset.update({
      where: { id: sourceAsset.id },
      data: { parentId: stack.id, sortIndex: firstIndex },
    })

    await tx.asset.update({
      where: { id: stack.id },
      data: {
        fileCount: isUploading ? 1 : 2,
        sizeByte: isUploading ? destFile.sizeByte : destFile.sizeByte + sourceAsset.sizeByte,
      },
    })

    // Update existing symlinks pointing to destFile or sourceAsset
    await dedupeSymlinksToTarget(tx, {
      targetIds: [destFile.id, sourceAsset.id],
      newTargetId: stack.id,
    })

    const oldParent = await tx.asset.findUnique({ where: { id: oldParentId } })
    if (oldParent) {
      await this.dissolveStackIfEmpty(tx, oldParent)
    }
  }

  async listChildren(req: ListChildrenRequest): Promise<PaginatedData<AssetInfo[]>> {
    const typesToQuery: AssetType[] = [req.assetType as AssetType]
    if (req.assetType === AssetType.file) {
      typesToQuery.push(AssetType.version_stack)
    }

    let where: Prisma.AssetWhereInput = {}

    if (req.showDeleted) {
      if (!req.projectId) {
        throw new Error('ProjectID is required when ShowDeleted is true')
      }
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      where = {
        projectId: req.projectId,
        isDeleted: true,
        deletedAt: { gte: thirtyDaysAgo },
        OR: [
          { type: { in: typesToQuery } },
          { type: AssetType.symlink, target: { type: { in: typesToQuery } } },
        ],
      }
    } else {
      if (!req.assetId) {
        throw new Error('AssetId is required when ShowDeleted is false')
      }
      let parentId = req.assetId
      const asset = await this.prismaClient.asset.findUnique({
        where: { id: parentId },
      })
      if (asset?.type === AssetType.symlink && asset.targetId) {
        parentId = asset.targetId
      }

      where = {
        parentId,
        isDeleted: false,
        OR: [
          { type: { in: typesToQuery } },
          { type: AssetType.symlink, target: { type: { in: typesToQuery } } },
        ],
      }
    }

    if (req.prefix) {
      where.name = { startsWith: req.prefix }
    }

    let orderBy: Prisma.AssetOrderByWithRelationInput = {}
    const dir = req.order === 'desc' ? 'desc' : 'asc'

    switch (req.sort) {
      case 'createdAt':
        orderBy = { id: dir }
        break
      case 'name':
        orderBy = { name: dir }
        break
      case 'size':
        orderBy = { sizeByte: dir }
        break
      case 'index':
      default:
        orderBy = { sortIndex: 'asc' }
        break
    }

    const { data: assets, pageInfo } = await paginateQuery(
      async (skip, take) => {
        return this.prismaClient.asset.findMany({
          where,
          include: {
            creator: true,
            metadataValues: true,
            storageKey: true,
            target: {
              include: {
                creator: true,
                metadataValues: true,
                storageKey: true,
                children: {
                  where: { isDeleted: false },
                  include: { creator: true, metadataValues: true, storageKey: true },
                  take: 3,
                  orderBy: { sortIndex: 'asc' },
                },
              },
            },
            children: {
              where: { isDeleted: false },
              include: { creator: true, metadataValues: true, storageKey: true },
              take: 3,
              orderBy: { sortIndex: 'asc' },
            },
          },
          orderBy,
          skip,
          take,
        })
      },
      async () => this.prismaClient.asset.count({ where }),
      req,
    )

    const infos = await this.toAssetInfos(assets)

    return { data: infos, pageInfo }
  }

  async createAsset(req: CreateAssetRequest): Promise<AssetInfo> {
    let projectId = req.projectId
    let parent: Prisma.AssetGetPayload<{ include: { project: true } }> | null = null

    if (req.parentId) {
      parent = await this.prismaClient.asset.findUnique({
        where: { id: req.parentId },
        include: { project: true },
      })
      if (!parent) throw new Error('Parent not found')
      projectId = parent.projectId ?? undefined
    }

    if (!projectId) throw new Error('projectId is empty')

    let sortIndex: string | null = null
    if (parent) {
      const firstFile = await this.prismaClient.asset.findFirst({
        where: { parentId: parent.id },
        orderBy: { sortIndex: 'asc' },
      })
      sortIndex = generateSortIndex(firstFile?.sortIndex)
    }

    const data: Prisma.AssetCreateInput = {
      name: req.name,
      type: req.type as AssetType,
      status: 'uploaded',
      project: { connect: { id: projectId } },
    }

    if (parent) data.parent = { connect: { id: parent.id } }
    if (sortIndex) data.sortIndex = sortIndex
    if (req.key) {
      data.storageKey = {
        connectOrCreate: {
          where: { key: req.key },
          create: { key: req.key },
        },
      }
    }
    if (req.sizeByte) data.sizeByte = req.sizeByte
    if (req.contentType) data.mediaType = req.contentType
    if (req.creatorId) data.creator = { connect: { id: req.creatorId } }

    const asset = await this.prismaClient.$transaction(async (tx) => {
      const createdAsset = await tx.asset.create({
        data,
        include: {
          creator: true,
          metadataValues: true,
          storageKey: true,
          target: {
            include: {
              creator: true,
              metadataValues: true,
              storageKey: true,
              children: {
                where: { isDeleted: false },
                include: { creator: true, metadataValues: true, storageKey: true },
                take: 3,
                orderBy: { sortIndex: 'asc' },
              },
            },
          },
          children: {
            where: { isDeleted: false },
            include: { creator: true, metadataValues: true, storageKey: true },
            take: 3,
            orderBy: { sortIndex: 'asc' },
          },
        },
      })

      if (parent) {
        await tx.asset.update({
          where: { id: parent.id },
          data: { fileCount: { increment: 1 } },
        })
      }

      return createdAsset
    })

    const infos = await this.toAssetInfos([asset])
    return infos[0]
  }

  async findAsset(parentId: string, name: string): Promise<AssetInfo | null> {
    const asset = await this.prismaClient.asset.findFirst({
      where: { parentId, name },
    })
    if (!asset) return null
    return this.getAsset({ assetId: asset.id })
  }

  async getAsset(req: GetAssetRequest): Promise<AssetInfo> {
    const a = await this.prismaClient.asset.findUnique({
      where: { id: req.assetId },
      include: {
        creator: true,
        metadataValues: true,
        storageKey: true,
        target: {
          include: {
            creator: true,
            metadataValues: true,
            storageKey: true,
            children: {
              where: { isDeleted: false },
              include: { creator: true, metadataValues: true, storageKey: true },
              take: 3,
              orderBy: { sortIndex: 'asc' },
            },
          },
        },
        children: {
          where: { isDeleted: false },
          include: { creator: true, metadataValues: true, storageKey: true },
          take: 3,
          orderBy: { sortIndex: 'asc' },
        },
      },
    })
    if (!a) throw new Error('Asset not found')

    const rows = await this.prismaClient.$queryRaw<{ id: string; name: string; type: string }[]>`
      WITH RECURSIVE ancestor AS (
        SELECT id, parent_id, name, type::text FROM assets WHERE id = ${a.id}
        UNION ALL
        SELECT a.id, a.parent_id, a.name, a.type::text FROM assets a
        INNER JOIN ancestor d ON d.parent_id = a.id
      )
      SELECT id, name, type FROM ancestor;
    `

    const afs: AncestorFolder[] = []
    for (const row of rows) {
      if (row.id === a.id || row.type === 'root' || row.type === 'version_stack') continue
      afs.push({ id: row.id, name: row.name })
    }

    const infos = await this.toAssetInfos([a])
    const info = infos[0]
    info.ancestorFolders = afs

    if (info.media) {
      if (info.media.imageTranscodes) {
        for (const t of info.media.imageTranscodes) {
          t.url = await s3Service.presign(process.env.S3_BUCKET || 'shumai', t.key, 'GET')
        }
      }
      if (info.media.videoTranscodes) {
        for (const t of info.media.videoTranscodes) {
          t.url = await s3Service.presign(process.env.S3_BUCKET || 'shumai', t.key, 'GET')
        }
      }
    }

    return info
  }

  async getAssetContext(assetId: string): Promise<{ teamId: string; projectId?: string }> {
    const asset = await this.prismaClient.asset.findUnique({
      where: { id: assetId },
      select: {
        projectId: true,
        project: { select: { teamId: true } },
        teamRootFolder: { select: { id: true } },
      },
    })

    if (!asset) {
      throw new Error(`Asset not found: ${assetId}`)
    }

    if (asset.project) {
      return { teamId: asset.project.teamId, projectId: asset.projectId ?? undefined }
    }

    if (asset.teamRootFolder) {
      return { teamId: asset.teamRootFolder.id }
    }

    throw new Error(`Asset has no team context: ${assetId}`)
  }

  async resolveTargetAssetId(assetId: string): Promise<string> {
    const asset = await this.prismaClient.asset.findUnique({
      where: { id: assetId },
      select: { type: true, targetId: true },
    })

    if (asset?.type === AssetType.symlink && asset.targetId) {
      return asset.targetId
    }

    return assetId
  }

  async resolveLatestVersionId(assetId: string): Promise<string> {
    const asset = await this.prismaClient.asset.findUnique({
      where: { id: assetId },
      select: { id: true, type: true, targetId: true },
    })
    if (!asset) return assetId

    let currentId = asset.id
    let currentType = asset.type

    if (asset.type === AssetType.symlink && asset.targetId) {
      const target = await this.prismaClient.asset.findUnique({
        where: { id: asset.targetId },
        select: { id: true, type: true },
      })
      if (target) {
        currentId = target.id
        currentType = target.type
      }
    }

    if (currentType === AssetType.version_stack) {
      const latestChild = await this.prismaClient.asset.findFirst({
        where: { parentId: currentId, isDeleted: false },
        orderBy: { sortIndex: 'asc' },
        select: { id: true },
      })
      if (latestChild) {
        return latestChild.id
      }
    }

    return currentId
  }

  async updateAssetName(req: UpdateAssetNameRequest): Promise<AssetInfo> {
    const existing = await this.prismaClient.asset.findUnique({
      where: { id: req.id },
      include: { target: true },
    })
    if (!existing) throw new Error('Asset not found')

    let targetType = existing.type
    let targetId = existing.id

    if (existing.type === AssetType.symlink && existing.target) {
      targetType = existing.target.type
      targetId = existing.target.id
    }

    if (targetType === AssetType.version_stack) {
      const latestChild = await this.prismaClient.asset.findFirst({
        where: { parentId: targetId, isDeleted: false },
        orderBy: { sortIndex: 'asc' },
        select: { id: true },
      })
      if (!latestChild) {
        throw new Error('No active version found in stack to rename')
      }
      await this.prismaClient.asset.update({
        where: { id: latestChild.id },
        data: { name: req.name },
      })
    } else {
      await this.prismaClient.asset.update({
        where: { id: req.id },
        data: { name: req.name },
      })
    }

    const asset = await this.prismaClient.asset.findUnique({
      where: { id: req.id },
      include: {
        creator: true,
        metadataValues: true,
        target: {
          include: {
            creator: true,
            metadataValues: true,
            storageKey: true,
            children: {
              where: { isDeleted: false },
              include: { creator: true, metadataValues: true, storageKey: true },
              take: 3,
              orderBy: { sortIndex: 'asc' },
            },
          },
        },
        children: {
          where: { isDeleted: false },
          include: { creator: true, metadataValues: true, storageKey: true },
          take: 3,
          orderBy: { sortIndex: 'asc' },
        },
        storageKey: true,
      },
    })
    if (!asset) throw new Error('Asset not found')

    const infos = await this.toAssetInfos([asset as unknown as AssetWithIncludes])
    return infos[0]
  }

  async updateAssetOrder(id: string, req: UpdateAssetOrderRequest): Promise<AssetInfo> {
    const asset = await this.prismaClient.asset.findUnique({
      where: { id },
    })
    if (!asset) throw new Error('Asset not found')

    let afterSortIndex: string | null = null
    let beforeSortIndex: string | null = null

    if (req.beforeIndex) {
      beforeSortIndex = req.beforeIndex
      const prevAsset = await this.prismaClient.asset.findFirst({
        where: {
          parentId: asset.parentId,
          sortIndex: { lt: req.beforeIndex },
          id: { not: id },
        },
        orderBy: { sortIndex: 'desc' },
      })
      afterSortIndex = prevAsset?.sortIndex || null
    } else if (req.afterIndex) {
      afterSortIndex = req.afterIndex
      const nextAsset = await this.prismaClient.asset.findFirst({
        where: {
          parentId: asset.parentId,
          sortIndex: { gt: req.afterIndex },
          id: { not: id },
        },
        orderBy: { sortIndex: 'asc' },
      })
      beforeSortIndex = nextAsset?.sortIndex || null
    }

    const newSortIndex = generateKeyBetween(afterSortIndex, beforeSortIndex)

    await this.prismaClient.asset.update({
      where: { id },
      data: { sortIndex: newSortIndex },
    })

    return this.getAsset({ assetId: id })
  }

  async deleteAssets(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.prismaClient.$transaction(async (tx) => {
        const a = await tx.asset.findUnique({
          where: { id },
          include: { project: { include: { team: true } } },
        })
        if (!a) throw new Error('Asset not found')
        if (!a.parentId) throw new Error('Asset has no parent')

        await tx.asset.update({
          where: { id: a.parentId },
          data: { fileCount: { decrement: 1 } },
        })

        const rows = await tx.$queryRaw<{ id: string }[]>`
          WITH RECURSIVE descendant AS (
            SELECT id, parent_id FROM assets WHERE parent_id = ${a.id}
            UNION ALL
            SELECT a.id, a.parent_id FROM assets a
            INNER JOIN descendant d ON a.parent_id = d.id
          )
          SELECT id FROM descendant;
        `
        const descendantIds = rows.map((r) => r.id)

        if (descendantIds.length > 0) {
          await tx.asset.updateMany({
            where: { id: { in: descendantIds } },
            data: { isDeleted: true },
          })
        }

        await tx.asset.update({
          where: { id: a.id },
          data: {
            isDeleted: true,
            status: 'trashed',
            deletedAt: new Date(),
          },
        })

        await this.updateAncestorsSize(tx, a.parentId, -Number(a.sizeByte))
      })
    }
  }

  private async cascadeStatusToPendingPurge(rootIds: string[]): Promise<void> {
    if (rootIds.length === 0) return

    await this.prismaClient.$executeRaw`
      WITH RECURSIVE descendant AS (
        SELECT id FROM assets WHERE id = ANY(${rootIds})
        UNION ALL
        SELECT a.id FROM assets a
        INNER JOIN descendant d ON a.parent_id = d.id
      )
      UPDATE assets SET status = 'pending_purge', updated_at = NOW()
      WHERE id IN (SELECT id FROM descendant);
    `
  }

  async emptyTrash(projectId: string): Promise<void> {
    const trashedRoots = await this.prismaClient.asset.findMany({
      where: {
        projectId,
        status: 'trashed',
        isDeleted: true,
      },
      select: { id: true },
    })

    const rootIds = trashedRoots.map((r) => r.id)
    await this.cascadeStatusToPendingPurge(rootIds)

    await this.purgePendingAssets()
    await this.purgeUnreferencedStorageKeys()
  }

  private cleanupJobsRunning = false

  async startCleanupJob() {
    this.cleanupJobsRunning = true

    const runCleanup = async () => {
      if (!this.cleanupJobsRunning) return

      try {
        await this.expireTrashedAssets()
        await this.purgePendingAssets()
        await this.purgeUnreferencedStorageKeys()
        await watermarkService.purgeOrphanWatermarkConfigs()
      } catch (e: unknown) {
        console.error('Error in asset cleanup job:', e)
      }

      if (this.cleanupJobsRunning) {
        setTimeout(runCleanup, 5000) // Run every 5 seconds after previous run completion
      }
    }

    runCleanup()
  }

  stopCleanupJob() {
    this.cleanupJobsRunning = false
  }

  /**
   * Stage 1: Find root assets that have been in the trash for > 30 days.
   * Cascade the 'pending_purge' status to all their descendants.
   */
  private async expireTrashedAssets() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // Find up to 100 expired roots, ordered by oldest first to avoid starvation
    const expiredRoots = await this.prismaClient.asset.findMany({
      where: {
        status: 'trashed',
        deletedAt: { lt: thirtyDaysAgo },
        isDeleted: true,
      },
      orderBy: { deletedAt: 'asc' },
      select: { id: true },
      take: 100,
    })

    const rootIds = expiredRoots.map((r) => r.id)
    await this.cascadeStatusToPendingPurge(rootIds)
  }

  /**
   * Stage 2: Delete DB records for assets marked as 'pending_purge'.
   */
  private async purgePendingAssets() {
    const { count } = await this.prismaClient.asset.deleteMany({
      where: { status: AssetStatus.pending_purge },
    })

    if (count > 0) {
      logger.info(
        {
          purgedCount: count,
        },
        `${count} assets purged from database`,
      )
    }
  }

  /**
   * Stage 3: Garbage Collection - Physically delete files and StorageKey records
   * that have no associated logical assets.
   */
  private async purgeUnreferencedStorageKeys() {
    const bucket = process.env.S3_BUCKET || 'shumai'

    // 1. Find storage keys with no associated assets and older than 24 hours
    // using FOR UPDATE SKIP LOCKED to ensure multiple servers don't pick up the same keys.
    const lockedKeys = await this.prismaClient.$queryRaw<{ id: string; key: string }[]>`
      WITH to_purge AS (
        SELECT id FROM storage_keys sk
        WHERE NOT EXISTS (SELECT 1 FROM assets a WHERE a.storage_key_id = sk.id)
          AND sk.created_at < NOW() - INTERVAL '20 seconds'
          AND (sk.status = 'active' OR (sk.status = 'purging' AND sk.updated_at < NOW() - INTERVAL '1 hour'))
        LIMIT 100
        FOR UPDATE SKIP LOCKED
      )
      UPDATE storage_keys SET status = 'purging', updated_at = NOW()
      WHERE id IN (SELECT id FROM to_purge)
      RETURNING id, key;
    `

    if (lockedKeys.length === 0) return

    let physicalFilesDeleted = 0
    let purgedCount = 0

    for (const sk of lockedKeys) {
      try {
        // Physically delete from S3
        const parts = sk.key.split('/')
        if (parts.length > 2) {
          const prefix = parts.slice(0, parts.length - 1).join('/') + '/'
          const count = await s3Service.deletePrefix(bucket, prefix)
          physicalFilesDeleted += count
        } else {
          const count = await s3Service.deleteObject(bucket, sk.key)
          physicalFilesDeleted += count
        }

        // Delete from database
        await this.prismaClient.storageKey.delete({
          where: { id: sk.id },
        })
        purgedCount++
      } catch (e: unknown) {
        logger.error(
          { key: sk.key, error: e instanceof Error ? e.message : String(e) },
          'Failed to purge unreferenced storage key',
        )
      }
    }

    if (purgedCount > 0) {
      logger.info(
        { purgedCount, physicalFilesDeleted },
        `Garbage collection: purged ${purgedCount} storage keys and ${physicalFilesDeleted} physical files`,
      )
    }
  }

  async restoreAssets(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.prismaClient.$transaction(async (tx) => {
        const a = await tx.asset.findUnique({
          where: { id },
          include: { project: { include: { team: true } } },
        })
        if (!a) throw new Error('Asset not found')
        if (!a.parentId) throw new Error('Asset has no parent')

        await tx.asset.update({
          where: { id: a.parentId },
          data: { fileCount: { increment: 1 } },
        })

        const rows = await tx.$queryRaw<{ id: string }[]>`
          WITH RECURSIVE descendant AS (
            SELECT id, parent_id FROM assets WHERE parent_id = ${a.id}
            UNION ALL
            SELECT a.id, a.parent_id FROM assets a
            INNER JOIN descendant d ON a.parent_id = d.id
          )
          SELECT id FROM descendant;
        `
        const descendantIds = rows.map((r) => r.id)

        if (descendantIds.length > 0) {
          await tx.asset.updateMany({
            where: { id: { in: descendantIds } },
            data: { isDeleted: false },
          })
        }

        await tx.asset.update({
          where: { id: a.id },
          data: {
            isDeleted: false,
            status: 'processed',
            deletedAt: null,
          },
        })

        await this.updateAncestorsSize(tx, a.parentId, Number(a.sizeByte))
      })
    }
  }

  async createComment(req: CreateCommentRequest): Promise<CommentInfo> {
    let commentId = ''
    const resolvedAssetId = await this.resolveLatestVersionId(req.assetId)

    await this.prismaClient.$transaction(async (tx) => {
      const a = await tx.asset.findUnique({
        where: { id: resolvedAssetId },
        include: { project: { include: { team: true } } },
      })
      if (!a) throw new Error('Asset not found')

      let actualReplyToId = req.replyToId
      let parentComment = null
      if (req.replyToId) {
        parentComment = await tx.assetComment.findUnique({
          where: { id: req.replyToId },
          include: { creator: true },
        })
        if (parentComment?.replyToId) {
          actualReplyToId = parentComment.replyToId
        }
      }

      const comment = await tx.assetComment.create({
        data: {
          assetId: a.id,
          creatorId: req.userId,
          message: req.message,
          annotation: req.annotations,
          second: req.second,
          replyToId: actualReplyToId,
        },
      })
      commentId = comment.id

      for (const attachmentId of req.attachmentIds) {
        const attachmentAsset = await tx.asset.findUnique({
          where: { id: attachmentId },
        })
        if (attachmentAsset) {
          await tx.assetCommentAttachment.create({
            data: {
              assetId: attachmentAsset.id,
              commentId: comment.id,
            },
          })
        }
      }

      // Parse bot mentions
      const botMentionMatches = [...req.message.matchAll(/<@([^>]+)>/g)]
      const mentionedAgentIds = new Set(botMentionMatches.map((match) => match[1]))
      const handledAgentIds = new Set<string>()

      // Effective role for the project context (project override wins; project-
      // scoped members without project access resolve to null and are denied).
      const effectiveRole = a.project?.team
        ? await resolveEffectiveRole(a.project.team.id, a.project.id, req.userId, tx)
        : null

      const userLevel = getRoleLevel(effectiveRole)

      if (parentComment && a.project) {
        const rootSessionId = parentComment.sessionId
        const isRootAgent = !!rootSessionId || parentComment.creator?.type === 'agent'
        const rootAgentId = parentComment.creatorId

        if (isRootAgent && rootAgentId && mentionedAgentIds.has(rootAgentId)) {
          const rootAgent = await tx.agent.findUnique({ where: { id: rootAgentId } })
          const requiredLevel = getAgentRequiredLevel(rootAgent?.permission)

          if (userLevel >= requiredLevel) {
            await tx.workflowTask.create({
              data: {
                assetId: a.id,
                type: 'chat',
                status: 'pending',
                teamId: a.project.team.id,
                projectId: a.project.id,
                payload: {
                  projectId: a.project.id,
                  agent: {
                    userCommentId: comment.id,
                    agentId: rootAgentId,
                    sessionId: rootSessionId || undefined,
                    userId: req.userId,
                  },
                },
              },
            })
          }
          handledAgentIds.add(rootAgentId)
        }
      }

      // Handle any other explicitly mentioned agents
      for (const agentId of mentionedAgentIds) {
        if (handledAgentIds.has(agentId)) continue

        let foundAgent = false
        if (agentId === 'default') {
          foundAgent = true
        } else {
          const agent = await tx.agent.findUnique({ where: { id: agentId } })
          if (agent) {
            const requiredLevel = getAgentRequiredLevel(agent.permission)
            if (userLevel >= requiredLevel) {
              foundAgent = true
            }
          }
        }

        if (foundAgent && a.project) {
          await tx.workflowTask.create({
            data: {
              assetId: a.id,
              type: 'chat',
              status: 'pending',
              teamId: a.project.team.id,
              projectId: a.project.id,
              payload: {
                projectId: a.project.id,
                agent: {
                  userCommentId: comment.id,
                  agentId: agentId,
                  userId: req.userId,
                },
              },
            },
          })
          handledAgentIds.add(agentId)
        }
      }
    })

    return this.getComment(commentId)
  }

  async getComment(commentId: string): Promise<CommentInfo> {
    const c = await this.prismaClient.assetComment.findUnique({
      where: { id: commentId },
      include: {
        creator: true,
        completionLastChangedBy: true,
        asset: { include: { storageKey: true } },
        attachments: { include: { asset: { include: { storageKey: true } } } },
        replies: {
          include: {
            creator: true,
            completionLastChangedBy: true,
            attachments: { include: { asset: { include: { storageKey: true } } } },
          },
          orderBy: { id: 'asc' },
        },
      },
    })
    if (!c) throw new Error('Comment not found')
    return this.toCommentInfo(c)
  }

  async completeComment(
    commentId: string,
    isCompleted: boolean,
    userId: string,
  ): Promise<CommentInfo> {
    await this.prismaClient.assetComment.update({
      where: { id: commentId },
      data: {
        isCompleted,
        completionLastChangedById: userId,
      },
    })
    return this.getComment(commentId)
  }

  async deleteComment({ commentId, userId }: { commentId: string; userId: string }): Promise<void> {
    const comment = await this.prismaClient.assetComment.findUnique({
      where: { id: commentId },
      include: {
        attachments: {
          include: {
            asset: {
              include: {
                storageKey: true,
              },
            },
          },
        },
        asset: {
          select: {
            project: { select: { id: true, teamId: true } },
          },
        },
      },
    })

    if (!comment) {
      throw new HTTPException(404, { message: 'Comment not found' })
    }

    const teamId = comment.asset.project?.teamId

    if (!teamId) {
      throw new HTTPException(400, {
        message: 'Data corruption: Comment asset is not associated with a project',
      })
    }

    const member = await this.prismaClient.teamMember.findUnique({
      where: {
        teamIdUserId: {
          teamId,
          userId,
        },
      },
    })

    if (!member) {
      throw new HTTPException(403, { message: 'User is not a member of the team' })
    }

    const isOwner = member.role === 'owner'
    const isCreator = comment.creatorId === userId

    if (!isOwner && !isCreator) {
      throw new HTTPException(403, { message: 'You do not have permission to delete this comment' })
    }

    // Clean up attachment files from S3/storage and delete their DB records
    const bucket = process.env.S3_BUCKET || 'shumai'
    for (const att of comment.attachments) {
      const asset = att.asset
      if (asset.storageKey) {
        try {
          await s3Service.deleteObject(bucket, asset.storageKey.key)
        } catch (err) {
          logger.error({ err, assetId: asset.id }, 'Failed to delete attachment file from S3')
        }
      }

      await this.prismaClient.asset.delete({
        where: { id: asset.id },
      })

      if (asset.storageKey) {
        await this.prismaClient.storageKey
          .delete({
            where: { id: asset.storageKey.id },
          })
          .catch(() => {
            // Silently ignore if already deleted
          })
      }
    }

    await this.prismaClient.assetComment.delete({
      where: { id: commentId },
    })
  }

  async listComments(
    assetId: string,
    params: PaginationParams,
  ): Promise<PaginatedData<CommentInfo[]>> {
    const resolvedAssetId = await this.resolveLatestVersionId(assetId)

    const { data: comments, pageInfo } = await paginateQuery(
      async (skip, take) => {
        return this.prismaClient.assetComment.findMany({
          where: { assetId: resolvedAssetId, replyToId: null },
          include: {
            creator: true,
            completionLastChangedBy: true,
            asset: { include: { storageKey: true } },
            attachments: { include: { asset: { include: { storageKey: true } } } },
            replies: {
              include: {
                creator: true,
                completionLastChangedBy: true,
                attachments: { include: { asset: { include: { storageKey: true } } } },
              },
              orderBy: { id: 'asc' },
            },
          },
          skip,
          take,
          orderBy: { id: 'asc' },
        })
      },
      async () => this.prismaClient.assetComment.count({ where: { assetId, replyToId: null } }),
      params,
    )

    const infos = await Promise.all(comments.map((c) => this.toCommentInfo(c)))

    return { data: infos, pageInfo }
  }

  async toAssetInfos(assets: AssetWithIncludes[]): Promise<AssetInfo[]> {
    const stackIds = new Set<string>()

    for (const a of assets) {
      if (
        a.type === AssetType.version_stack ||
        (a.type === AssetType.symlink && a.target?.type === AssetType.version_stack)
      ) {
        stackIds.add(a.type === AssetType.symlink ? a.targetId! : a.id)
      }

      const folderForPreview =
        a.type === AssetType.symlink && a.target?.type === AssetType.folder ? a.target : a
      if (
        (folderForPreview.type === AssetType.folder ||
          folderForPreview.type === AssetType.share_root ||
          folderForPreview.type === AssetType.share) &&
        'children' in folderForPreview &&
        folderForPreview.children
      ) {
        for (const child of folderForPreview.children) {
          if (child.type === AssetType.version_stack) {
            stackIds.add(child.id)
          }
        }
      }
    }

    const versionsMap = new Map<string, AssetWithIncludes['children'][0][]>()
    if (stackIds.size > 0) {
      const allVersions = await this.prismaClient.asset.findMany({
        where: { parentId: { in: Array.from(stackIds) }, isDeleted: false },
        include: { creator: true, metadataValues: true, storageKey: true },
      })
      for (const v of allVersions) {
        const list = versionsMap.get(v.parentId!) || []
        list.push(v)
        versionsMap.set(v.parentId!, list)
      }
      for (const list of versionsMap.values()) {
        list.sort((x, y) => {
          if (!x.sortIndex || !y.sortIndex) return 0
          return x.sortIndex < y.sortIndex ? -1 : x.sortIndex > y.sortIndex ? 1 : 0
        })
      }
    }

    const agentMdRecords =
      assets.length > 0
        ? await this.prismaClient.assetAgentMd.findMany({
            where: { assetId: { in: assets.map((a) => a.id) } },
            select: { assetId: true },
          })
        : []
    const hasAgentMdSet = new Set(agentMdRecords.map((r) => r.assetId))

    const result: AssetInfo[] = []
    for (const a of assets) {
      let latestVersion:
        | AssetWithIncludes
        | AssetWithIncludes['children'][0]
        | NonNullable<AssetWithIncludes['target']> = a

      let versionStack: AssetInfo['versionStack'] = null

      if (
        a.type === AssetType.version_stack ||
        (a.type === AssetType.symlink && a.target?.type === AssetType.version_stack)
      ) {
        const stackId = a.type === AssetType.symlink ? a.targetId! : a.id
        const versions = versionsMap.get(stackId) || []
        if (versions.length > 0) {
          latestVersion = versions[0]
          versionStack = {
            id: stackId,
            versions: await Promise.all(
              versions.map(async (v, i) => {
                const preview = await this.toPreviewInfo(v as Asset)
                return {
                  version: versions.length - i,
                  current: i === 0,
                  id: v.id,
                  name: v.name,
                  previewUrl: preview?.thumbnailUrl || null,
                  createdAt: v.createdAt.toISOString(),
                  creator: v.creator
                    ? {
                        id: v.creator.id,
                        name: v.creator.name,
                        image: await getAvatarUrl(v.creator.image),
                      }
                    : null,
                }
              }),
            ),
          }
        }
      } else if (a.type === AssetType.symlink) {
        if (a.target) {
          latestVersion = a.target
        }
      }

      const latestChildren: ChildPreview[] = []
      const folderForPreview =
        a.type === AssetType.symlink && a.target?.type === AssetType.folder ? a.target : a
      if (
        (folderForPreview.type === AssetType.folder ||
          folderForPreview.type === AssetType.share_root ||
          folderForPreview.type === AssetType.share) &&
        'children' in folderForPreview &&
        folderForPreview.children
      ) {
        for (const child of folderForPreview.children) {
          if (child.isDeleted) continue
          let previewAsset = child as Asset
          let mediaType = child.mediaType

          if (child.type === AssetType.version_stack) {
            const versions = versionsMap.get(child.id) || []
            if (versions.length > 0) {
              const latestChild = versions[0]
              previewAsset = latestChild as Asset
              mediaType = latestChild.mediaType
            }
          }

          latestChildren.push({
            type: mediaType,
            preview: await this.toPreviewInfo(previewAsset),
          })
        }
      }

      const preview = await this.toPreviewInfo(latestVersion as Asset)

      const creator = latestVersion.creator
        ? {
            id: latestVersion.creator.id,
            name: latestVersion.creator.name,
            image: await getAvatarUrl(latestVersion.creator.image),
          }
        : null

      const fieldValues: FieldValueInfo[] = []
      if ('metadataValues' in latestVersion && latestVersion.metadataValues) {
        for (const mv of latestVersion.metadataValues) {
          let value: unknown = null
          if (mv.jsonValue !== null) {
            value = mv.jsonValue
          } else if (mv.dateValue !== null) {
            value = mv.dateValue.toISOString()
          } else if (mv.stringValue !== null) {
            value = mv.stringValue
          } else if (mv.numberValue !== null) {
            value = mv.numberValue
          } else if (mv.booleanValue !== null) {
            value = mv.booleanValue
          }
          fieldValues.push({ fieldId: mv.fieldKey, value })
        }
      }

      let media = latestVersion.media as PrismaJson.MediaInfo | null
      if (media && media.videoPreview?.key) {
        media.videoPreview.url = await s3Service.presign(
          process.env.S3_BUCKET || 'shumai',
          media.videoPreview.key,
          'GET',
        )
      }
      if (media && media.pdfTranscode?.key) {
        media.pdfTranscode.url = await s3Service.presign(
          process.env.S3_BUCKET || 'shumai',
          media.pdfTranscode.key,
          'GET',
        )
      }

      const key = latestVersion.storageKey?.key
      if (key) {
        if (!media) {
          media = {
            original: null,
            videoTranscodes: [],
            imageTranscodes: [],
          } as unknown as PrismaJson.MediaInfo
        }
        media.original = {
          key,
          filesizeInBytes: Number(latestVersion.sizeByte),
          codec: '',
        }
      }

      const proxyType = (media?.proxyType || null) as 'image' | 'video' | 'audio' | 'pdf' | null

      result.push({
        id: a.id,
        name:
          a.type === AssetType.version_stack ||
          (a.type === AssetType.symlink && a.target?.type === AssetType.version_stack)
            ? latestVersion.name
            : a.type === AssetType.symlink
              ? a.name || latestVersion.name || a.target?.name || ''
              : a.name,
        sizeByte: Number(latestVersion.sizeByte),
        fileCount: latestVersion.fileCount,
        type: a.type,
        targetType: a.type === AssetType.symlink ? a.target?.type : null,
        status: latestVersion.status,
        proxyType,
        latestChildren,
        preview,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
        deletedAt: a.deletedAt ? a.deletedAt.toISOString() : null,
        projectId: a.projectId,
        creator,
        fieldValues,
        sortIndex: a.sortIndex,
        hasAgentsMd: hasAgentMdSet.has(a.id),
        media: media as unknown as AssetInfo['media'],
        versionStack,
      })
    }
    return result
  }

  async getStackVersions(stackId: string): Promise<
    Array<{
      id: string
      version: number
      name: string
      previewUrl: string | null
      createdAt: string
      creator: { id: string; name: string | null; image?: string | null } | null
    }>
  > {
    const versions = await this.prismaClient.asset.findMany({
      where: { parentId: stackId, isDeleted: false },
      include: { creator: true },
    })

    versions.sort((x, y) => {
      if (!x.sortIndex || !y.sortIndex) return 0
      return x.sortIndex < y.sortIndex ? -1 : x.sortIndex > y.sortIndex ? 1 : 0
    })

    return await Promise.all(
      versions.map(async (v, i) => {
        const preview = await this.toPreviewInfo(v)
        return {
          id: v.id,
          version: versions.length - i,
          name: v.name,
          previewUrl: preview?.thumbnailUrl || null,
          createdAt: v.createdAt.toISOString(),
          creator: v.creator
            ? {
                id: v.creator.id,
                name: v.creator.name,
                image: await getAvatarUrl(v.creator.image),
              }
            : null,
        }
      }),
    )
  }

  async getProjectIds(assetIds: string[]): Promise<string[]> {
    if (assetIds.length === 0) {
      return []
    }

    const assets = await this.prismaClient.asset.findMany({
      where: { id: { in: assetIds }, isDeleted: false },
      select: {
        projectId: true,
        type: true,
        target: { select: { projectId: true } },
      },
    })

    const projectIds = new Set<string>()
    for (const asset of assets) {
      let projId = asset.projectId
      if (asset.type === 'symlink' && asset.target?.projectId) {
        projId = asset.target.projectId
      }
      if (projId) {
        projectIds.add(projId)
      }
    }

    return Array.from(projectIds)
  }

  async getDownloadLinks(ids: string[]): Promise<Array<{ id: string; name: string; url: string }>> {
    if (ids.length === 0) return []

    // Resolve starting IDs (dereference top-level symlinks)
    const assets = await this.prismaClient.asset.findMany({
      where: { id: { in: ids }, isDeleted: false },
      select: {
        id: true,
        type: true,
        targetId: true,
      },
    })

    const startingIds = assets.map((asset) => {
      if (asset.type === 'symlink' && asset.targetId) {
        return asset.targetId
      }
      return asset.id
    })

    if (startingIds.length === 0) return []

    const descendants = await this.prismaClient.$queryRaw<
      Array<{
        id: string
        name: string
        type: string
        parentId: string | null
        storageKeyId: string | null
        sortIndex: string | null
        targetId: string | null
      }>
    >`
      WITH RECURSIVE descendant AS (
        SELECT id, name, type, parent_id, storage_key_id, sort_index, target_id, is_deleted
        FROM assets
        WHERE id IN (${Prisma.join(startingIds)}) AND is_deleted = false
        UNION ALL
        SELECT a.id, a.name, a.type, a.parent_id, a.storage_key_id, a.sort_index, a.target_id, a.is_deleted
        FROM assets a
        INNER JOIN descendant d ON a.parent_id = d.id
        WHERE a.is_deleted = false
      )
      SELECT id, name, type, parent_id AS "parentId", storage_key_id AS "storageKeyId", sort_index AS "sortIndex", target_id AS "targetId" FROM descendant;
    `

    // Find any symlink in the descendants and resolve its target.
    const symlinks = descendants.filter((d) => d.type === 'symlink')
    let resolvedTargets: Array<{
      id: string
      name: string
      type: string
      parentId: string | null
      storageKeyId: string | null
      sortIndex: string | null
      targetId: string | null
    }> = []

    if (symlinks.length > 0) {
      const targetIds = symlinks.map((s) => s.targetId).filter((id): id is string => !!id)
      if (targetIds.length > 0) {
        const dbTargets = await this.prismaClient.asset.findMany({
          where: { id: { in: targetIds }, isDeleted: false },
        })
        resolvedTargets = dbTargets.map((t) => ({
          id: t.id,
          name: t.name,
          type: t.type,
          parentId: t.parentId,
          storageKeyId: t.storageKeyId,
          sortIndex: t.sortIndex,
          targetId: t.targetId,
        }))
      }
    }

    const allAssets = [...descendants.filter((d) => d.type !== 'symlink'), ...resolvedTargets]

    const nonFolderAssets = allAssets.filter(
      (a) =>
        a.type !== 'folder' && a.type !== 'root' && a.type !== 'share_root' && a.type !== 'share',
    )

    // Separate version stacks and other files
    const versionStackIds = new Set(
      nonFolderAssets.filter((a) => a.type === 'version_stack').map((a) => a.id),
    )

    const versionAssetsByStack = new Map<string, typeof nonFolderAssets>()
    const otherAssets: typeof nonFolderAssets = []

    for (const asset of nonFolderAssets) {
      if (asset.type === 'version_stack') {
        continue
      }
      if (asset.parentId && versionStackIds.has(asset.parentId)) {
        const list = versionAssetsByStack.get(asset.parentId) || []
        list.push(asset)
        versionAssetsByStack.set(asset.parentId, list)
      } else {
        otherAssets.push(asset)
      }
    }

    // Pick the latest version for each version stack (ascending sortIndex: 'asc' means first version is latest)
    const latestVersions: typeof nonFolderAssets = []
    for (const versions of versionAssetsByStack.values()) {
      versions.sort((x, y) => {
        if (!x.sortIndex || !y.sortIndex) return 0
        return x.sortIndex < y.sortIndex ? -1 : x.sortIndex > y.sortIndex ? 1 : 0
      })
      if (versions.length > 0) {
        latestVersions.push(versions[0])
      }
    }

    const finalFiles = [...otherAssets, ...latestVersions]

    // Deduplicate files by id
    const uniqueFilesMap = new Map<string, (typeof finalFiles)[0]>()
    for (const file of finalFiles) {
      uniqueFilesMap.set(file.id, file)
    }
    const deduplicatedFiles = Array.from(uniqueFilesMap.values())

    // Fetch storage keys
    const storageKeyIds = deduplicatedFiles
      .map((f) => f.storageKeyId)
      .filter((id): id is string => !!id)
    const storageKeys = await this.prismaClient.storageKey.findMany({
      where: { id: { in: storageKeyIds } },
    })
    const storageKeyMap = new Map(storageKeys.map((k) => [k.id, k.key]))

    const downloadLinks = await Promise.all(
      deduplicatedFiles.map(async (file) => {
        const key = file.storageKeyId ? storageKeyMap.get(file.storageKeyId) : null
        if (!key) return null

        const url = await s3Service.presign(
          process.env.S3_BUCKET || 'shumai',
          key,
          'GET',
          true,
          file.name,
        )

        return {
          id: file.id,
          name: file.name,
          url,
        }
      }),
    )

    return downloadLinks.filter((link): link is { id: string; name: string; url: string } => !!link)
  }

  /**
   * Generate a presigned download URL for a given key, verifying it belongs to the asset's
   * storage directory. This ensures users can only download files (original, transcodes, etc.)
   * that belong to an asset they have access to.
   */
  async getDownloadUrl(assetId: string, key: string): Promise<string> {
    const targetAssetId = await this.resolveLatestVersionId(assetId)
    const asset = await this.prismaClient.asset.findUnique({
      where: { id: targetAssetId },
      select: { id: true, name: true, parentId: true, storageKey: { select: { key: true } } },
    })

    if (!asset?.storageKey?.key) {
      throw new Error('Asset not found or has no storage key')
    }

    if (key.includes('..')) {
      throw new Error('Key does not belong to this asset')
    }

    let storageKey = asset.storageKey.key
    let assetDir = storageKey.substring(0, storageKey.lastIndexOf('/') + 1)

    if (!key.startsWith(assetDir) && asset.parentId) {
      // Check if requested key belongs to another version in the same version stack
      const sibling = await this.prismaClient.asset.findFirst({
        where: {
          parentId: asset.parentId,
          isDeleted: false,
          storageKey: { key: { startsWith: key.substring(0, key.lastIndexOf('/') + 1) } },
        },
        select: { storageKey: { select: { key: true } } },
      })
      if (sibling?.storageKey?.key) {
        storageKey = sibling.storageKey.key
        assetDir = storageKey.substring(0, storageKey.lastIndexOf('/') + 1)
      }
    }

    if (!key.startsWith(assetDir)) {
      throw new Error('Key does not belong to this asset')
    }

    return s3Service.presign(
      process.env.S3_BUCKET || 'shumai',
      key,
      'GET',
      true,
      asset.name ?? undefined,
    )
  }

  async toPreviewInfo(asset: Asset | AssetWithIncludes): Promise<PreviewInfo | null> {
    if (!asset.media) return null

    const proxyType = (asset.media?.proxyType || null) as 'image' | 'video' | 'audio' | 'pdf' | null

    let thumbnailUrl = undefined
    if (proxyType === 'image' && asset.media.thumbnail?.key) {
      thumbnailUrl = await s3Service.presign(
        process.env.S3_BUCKET || 'shumai',
        asset.media.thumbnail.key,
        'GET',
      )
    } else if (asset.media.poster?.key) {
      thumbnailUrl = await s3Service.presign(
        process.env.S3_BUCKET || 'shumai',
        asset.media.poster.key,
        'GET',
      )
    }

    let spriteUrl = undefined
    if (asset.media.sprite?.key) {
      spriteUrl = await s3Service.presign(
        process.env.S3_BUCKET || 'shumai',
        asset.media.sprite.key,
        'GET',
      )
    }

    return {
      proxyType,
      thumbnailUrl,
      originalHeight: asset.media.metadata?.originalHeight,
      originalWidth: asset.media.metadata?.originalWidth,
      spriteUrl,
      duration: asset.media.metadata?.duration,
      pageCount: asset.media.metadata?.totalFrames,
    }
  }

  private async toCommentInfo(
    c: CommentWithIncludes | CommentWithIncludes['replies'][0],
  ): Promise<CommentInfo> {
    const replies: CommentInfo[] = []
    if ('replies' in c && c.replies) {
      for (const r of c.replies) {
        replies.push(await this.toCommentInfo(r))
      }
    }

    const attachments: AttachmentInfo[] = []
    if (c.attachments) {
      for (const a of c.attachments) {
        if (a.asset?.storageKey?.key) {
          const url = await s3Service.presign(
            process.env.S3_BUCKET || 'shumai',
            a.asset.storageKey.key,
            'GET',
          )
          const attachmentProxyType = (a.asset.media?.proxyType || null) as
            | 'image'
            | 'video'
            | 'audio'
            | 'pdf'
            | null
          attachments.push({
            id: a.id,
            assetId: a.asset.id,
            url,
            proxyType: attachmentProxyType,
          })
        }
      }
    }

    const mentions: AssetUserInfo[] = []
    const botMentionMatch = (c.message || '').match(/<@([^>]+)>/g)
    if (botMentionMatch) {
      const userIds = botMentionMatch.map((m: string) => m.replace('<@', '').replace('>', ''))
      const users = await this.prismaClient.user.findMany({
        where: { id: { in: userIds } },
      })
      for (const u of users) {
        mentions.push({
          id: u.id,
          name: u.name,
          image: await getAvatarUrl(u.image),
        })
      }
    }

    const creator: AssetUserInfo = { id: '', name: '' }
    if (c.sessionId) {
      creator.id = c.creatorId || ''
      creator.name = c.creator?.name || 'Ai Bot'
      creator.image = await getAvatarUrl(c.creator?.image)
    } else if (c.creator) {
      creator.id = c.creator.id
      creator.name = c.creator.name
      creator.image = await getAvatarUrl(c.creator.image)
    }

    const completionLastChangedBy: AssetUserInfo | null = c.completionLastChangedBy
      ? {
          id: c.completionLastChangedBy.id,
          name: c.completionLastChangedBy.name,
          image: await getAvatarUrl(c.completionLastChangedBy.image),
        }
      : null

    return {
      id: c.id,
      assetId: c.assetId,
      message: c.message,
      annotations: c.annotation,
      second: c.second,
      creator,
      replies,
      attachments,
      mentions,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      sessionId: c.sessionId,
      isCompleted: c.isCompleted,
      completionLastChangedBy,
    }
  }

  async getAgentsMd(assetId: string): Promise<string | null> {
    const asset = await this.prismaClient.asset.findUnique({
      where: { id: assetId },
      select: { type: true },
    })
    if (!asset) throw new Error('Asset not found')
    if (asset.type !== AssetType.folder && asset.type !== AssetType.root) {
      throw new Error('AGENTS.md can only be stored on folders')
    }
    const record = await this.prismaClient.assetAgentMd.findUnique({
      where: { assetId },
      select: { content: true },
    })
    return record?.content ?? null
  }

  async updateAgentsMd(assetId: string, content: string): Promise<{ content: string }> {
    const asset = await this.prismaClient.asset.findUnique({
      where: { id: assetId },
      select: { id: true, type: true },
    })
    if (!asset) throw new Error('Asset not found')
    if (asset.type !== AssetType.folder && asset.type !== AssetType.root) {
      throw new Error('AGENTS.md can only be stored on folders')
    }
    const trimmed = content.trim()
    if (trimmed.length === 0) {
      await this.prismaClient.assetAgentMd.deleteMany({
        where: { assetId },
      })
      return { content: '' }
    }
    const record = await this.prismaClient.assetAgentMd.upsert({
      where: { assetId },
      create: { assetId, content },
      update: { content },
      select: { content: true },
    })
    return { content: record.content }
  }

  async getNestedAgentsMd(assetId: string): Promise<Array<{ path: string; content: string }>> {
    let currentId: string | null = assetId
    const nodes: Array<{
      id: string
      name: string
      type: AssetType
      parentId: string | null
    }> = []

    while (currentId) {
      const node: {
        id: string
        name: string
        type: AssetType
        parentId: string | null
      } | null = await this.prismaClient.asset.findUnique({
        where: { id: currentId },
        select: { id: true, name: true, type: true, parentId: true },
      })
      if (!node) break
      nodes.unshift(node)
      currentId = node.parentId
    }

    if (nodes.length === 0) return []

    const agentMds = await this.prismaClient.assetAgentMd.findMany({
      where: { assetId: { in: nodes.map((n) => n.id) } },
      select: { assetId: true, content: true },
    })
    const agentMdMap = new Map(agentMds.map((m) => [m.assetId, m.content]))

    const results: Array<{ path: string; content: string }> = []
    let currentFolderPath = ''

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      let virtualPath: string

      if (node.type === AssetType.root || i === 0) {
        currentFolderPath = ''
        virtualPath = '/AGENTS.md'
      } else {
        currentFolderPath = currentFolderPath
          ? `${currentFolderPath}/${node.name}`
          : `/${node.name}`
        virtualPath = `${currentFolderPath}/AGENTS.md`
      }

      const content = agentMdMap.get(node.id)
      if (content && content.trim().length > 0) {
        results.push({
          path: virtualPath,
          content: content.trim(),
        })
      }
    }

    return results
  }

  /**
   * Record a file view by user in project.
   * If the asset is a child file in a version stack, resolves to the version stack.
   * Enforces a maximum cap of 100 recent file items per (userId, projectId).
   */
  async recordRecentView(userId: string, projectId: string, assetId: string): Promise<void> {
    const asset = await this.prismaClient.asset.findUnique({
      where: { id: assetId },
      select: { id: true, type: true, parentId: true, projectId: true, isDeleted: true },
    })

    if (!asset || asset.isDeleted) return

    let targetAssetId = asset.id

    // If it's a file inside a version stack, record the version stack instead
    if (asset.type === AssetType.file && asset.parentId) {
      const parent = await this.prismaClient.asset.findUnique({
        where: { id: asset.parentId },
        select: { id: true, type: true },
      })
      if (parent && parent.type === AssetType.version_stack) {
        targetAssetId = parent.id
      }
    }

    const now = new Date()

    // Upsert into recent_file_items
    await this.prismaClient.recentFileItem.upsert({
      where: {
        userIdProjectIdAssetId: {
          userId,
          projectId,
          assetId: targetAssetId,
        },
      },
      update: {
        viewedAt: now,
      },
      create: {
        userId,
        projectId,
        assetId: targetAssetId,
        viewedAt: now,
      },
    })

    // Prune if more than 100 items for this (userId, projectId)
    const count = await this.prismaClient.recentFileItem.count({
      where: { userId, projectId },
    })

    if (count > 100) {
      const itemsToKeep = await this.prismaClient.recentFileItem.findMany({
        where: { userId, projectId },
        orderBy: { viewedAt: 'desc' },
        take: 100,
        select: { id: true },
      })
      const keepIds = itemsToKeep.map((item) => item.id)

      await this.prismaClient.recentFileItem.deleteMany({
        where: {
          userId,
          projectId,
          id: { notIn: keepIds },
        },
      })
    }
  }

  /**
   * List recent files for user in project, paginated up to 100 total items.
   */
  async listRecents(
    userId: string,
    projectId: string,
    req: ListRecentsRequest,
  ): Promise<PaginatedData<AssetInfo[]>> {
    const where = {
      userId,
      projectId,
      asset: {
        isDeleted: false,
      },
    }

    return paginateQuery(
      async (skip, take) => {
        if (skip >= 100) return []
        const effectiveTake = Math.min(take, 100 - skip)
        if (effectiveTake <= 0) return []

        const recents = await this.prismaClient.recentFileItem.findMany({
          where,
          orderBy: { viewedAt: 'desc' },
          skip,
          take: effectiveTake,
          include: {
            asset: {
              include: assetInclude,
            },
          },
        })

        const assets = recents.map((r) => r.asset).filter((a): a is AssetWithIncludes => !!a)

        return await this.toAssetInfos(assets)
      },
      async () => {
        const total = await this.prismaClient.recentFileItem.count({ where })
        return Math.min(total, 100)
      },
      req,
    )
  }
}

export const assetService = new AssetService()
