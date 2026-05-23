import { prisma } from '@/db'
import {
  AncestorFolder,
  AssetInfo,
  AttachmentInfo,
  ChildPreview,
  CommentInfo,
  CreateAssetRequest,
  CreateCommentRequest,
  FieldValueInfo,
  GetAssetRequest,
  ListChildrenRequest,
  PreviewInfo,
  ReparentAssetsRequest,
  UpdateAssetNameRequest,
  UpdateAssetOrderRequest,
  UserInfo,
} from '@/dtos/asset'
import { Asset, AssetType, Prisma } from '@/generated/prisma/client.ts'
import { PaginatedData, paginateQuery, PaginationParams } from '@/services/pagination'
import { s3Service } from '@/services/s3/s3'
import { generateKeyBetween } from 'jittered-fractional-indexing'

type AssetWithIncludes = Prisma.AssetGetPayload<{
  include: {
    creator: true
    metadataValues: true
    target: {
      include: {
        creator: true
        metadataValues: true
        children: {
          include: { creator: true; metadataValues: true }
        }
      }
    }
    children: {
      include: { creator: true; metadataValues: true }
    }
  }
}>

type CommentWithIncludes = Prisma.AssetCommentGetPayload<{
  include: {
    creator: true
    attachments: { include: { asset: true } }
    replies: {
      include: {
        creator: true
        attachments: { include: { asset: true } }
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
        target: {
          include: {
            creator: true,
            metadataValues: true,
            children: {
              include: { creator: true, metadataValues: true },
              take: 3,
              orderBy: { sortIndex: 'asc' },
            },
          },
        },
        children: {
          include: { creator: true, metadataValues: true },
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

  async updateAncestorsSize(tx: Prisma.TransactionClient, startNodeId: string, sizeDelta: number) {
    if (sizeDelta === 0) return

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

      await tx.asset.update({
        where: { id: lastChild.id },
        data: { parentId: stack.parentId, sortIndex: null },
      })
      await tx.asset.delete({ where: { id: stack.id } })
    }
  }

  async reparentAssets(req: ReparentAssetsRequest): Promise<void> {
    await this.prismaClient.$transaction(async (tx) => {
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
        totalSize += a.sizeByte
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

      const oldParent = await tx.asset.findUnique({
        where: { id: oldParentId },
      })
      if (oldParent) {
        await this.dissolveStackIfEmpty(tx, oldParent)
      }
    })
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
      },
    })

    await tx.asset.update({
      where: { id: oldParentId },
      data: { fileCount: { decrement: 1 } },
    })
    await this.updateAncestorsSize(tx, oldParentId, -sourceAsset.sizeByte)
    await this.updateAncestorsSize(tx, stackParentId, sourceAsset.sizeByte)

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
        fileCount: 2,
        sizeByte: destFile.sizeByte + sourceAsset.sizeByte,
      },
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

    if (req.showRemoved) {
      if (!req.projectId) {
        throw new Error('ProjectID is required when ShowRemoved is true')
      }
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      where = {
        projectId: req.projectId,
        removed: true,
        deletedAt: { gte: thirtyDaysAgo },
        OR: [
          { type: { in: typesToQuery } },
          { type: AssetType.symlink, target: { type: { in: typesToQuery } } },
        ],
      }
    } else {
      if (!req.assetId) {
        throw new Error('AssetId is required when ShowRemoved is false')
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
        removed: false,
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
            target: {
              include: {
                creator: true,
                metadataValues: true,
                children: {
                  include: { creator: true, metadataValues: true },
                  take: 3,
                  orderBy: { sortIndex: 'asc' },
                },
              },
            },
            children: {
              include: { creator: true, metadataValues: true },
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
    if (req.key) data.key = req.key
    if (req.sizeByte) data.sizeByte = req.sizeByte
    if (req.contentType) data.mediaType = req.contentType
    if (req.creatorId) data.creator = { connect: { id: req.creatorId } }

    const asset = await this.prismaClient.asset.create({
      data,
      include: {
        creator: true,
        metadataValues: true,
        target: {
          include: {
            creator: true,
            metadataValues: true,
            children: {
              include: { creator: true, metadataValues: true },
              take: 3,
              orderBy: { sortIndex: 'asc' },
            },
          },
        },
        children: {
          include: { creator: true, metadataValues: true },
          take: 3,
          orderBy: { sortIndex: 'asc' },
        },
      },
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
        target: {
          include: {
            creator: true,
            metadataValues: true,
            children: {
              include: { creator: true, metadataValues: true },
              take: 3,
              orderBy: { sortIndex: 'asc' },
            },
          },
        },
        children: {
          include: { creator: true, metadataValues: true },
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
      if (info.media.original?.key) {
        info.media.original.downloadUrl = await s3Service.presign(
          process.env.S3_BUCKET || 'shumai',
          info.media.original.key,
          'GET',
        )
      }
    }

    return info
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
        where: { parentId: currentId, removed: false },
        orderBy: { sortIndex: 'desc' },
        select: { id: true },
      })
      if (latestChild) {
        return latestChild.id
      }
    }

    return currentId
  }

  async updateAssetName(req: UpdateAssetNameRequest): Promise<AssetInfo> {
    const asset = await this.prismaClient.asset.update({
      where: { id: req.id },
      data: { name: req.name },
      include: {
        creator: true,
        metadataValues: true,
        target: {
          include: {
            creator: true,
            metadataValues: true,
            children: {
              include: { creator: true, metadataValues: true },
              take: 3,
              orderBy: { sortIndex: 'asc' },
            },
          },
        },
        children: {
          include: { creator: true, metadataValues: true },
          take: 3,
          orderBy: { sortIndex: 'asc' },
        },
      },
    })
    const infos = await this.toAssetInfos([asset])
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
      beforeSortIndex = null
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
            data: { removed: true },
          })
        }

        await tx.asset.update({
          where: { id: a.id },
          data: { removed: true, deletedAt: new Date() },
        })

        await this.updateAncestorsSize(tx, a.parentId, -a.sizeByte)
      })
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
            data: { removed: false },
          })
        }

        await tx.asset.update({
          where: { id: a.id },
          data: { removed: false, deletedAt: null },
        })

        await this.updateAncestorsSize(tx, a.parentId, a.sizeByte)
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

      if (parentComment && a.project) {
        const rootSessionId = parentComment.sessionId
        const isRootAgent = !!rootSessionId || parentComment.creator?.type === 'agent'
        const rootAgentId = parentComment.creatorId

        if (isRootAgent && rootAgentId) {
          const explicitMention = mentionedAgentIds.has(rootAgentId)
          await tx.workflowTask.create({
            data: {
              assetId: a.id,
              type: 'chat',
              status: 'pending',
              teamId: a.project.team.id,
              projectId: a.project.id,
              payload: {
                userCommentId: comment.id,
                agentId: rootAgentId,
                projectId: a.project.id,
                sessionId: rootSessionId || undefined,
                explicitMention,
              },
            },
          })
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
          if (agent) foundAgent = true
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
                userCommentId: comment.id,
                agentId: agentId,
                projectId: a.project.id,
                explicitMention: true,
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
        asset: true,
        attachments: { include: { asset: true } },
        replies: {
          include: {
            creator: true,
            attachments: { include: { asset: true } },
          },
          orderBy: { id: 'asc' },
        },
      },
    })
    if (!c) throw new Error('Comment not found')
    return this.toCommentInfo(c)
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
            asset: true,
            attachments: { include: { asset: true } },
            replies: {
              include: {
                creator: true,
                attachments: { include: { asset: true } },
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

  private async toAssetInfos(assets: AssetWithIncludes[]): Promise<AssetInfo[]> {
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
        where: { parentId: { in: Array.from(stackIds) }, removed: false },
        include: { creator: true, metadataValues: true },
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
                  creator: v.creator ? { id: v.creator.id, name: v.creator.name } : null,
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
        ? { id: latestVersion.creator.id, name: latestVersion.creator.name }
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
          fieldValues.push({ fieldId: mv.fieldId, value })
        }
      }

      const media = latestVersion.media as PrismaJson.MediaInfo | null
      if (media && media.videoPreview?.key) {
        media.videoPreview.url = await s3Service.presign(
          process.env.S3_BUCKET || 'shumai',
          media.videoPreview.key,
          'GET',
        )
      }

      result.push({
        id: a.id,
        name:
          a.type === AssetType.version_stack && (a.name === '' || !a.name)
            ? latestVersion.name
            : a.name,
        sizeByte: latestVersion.sizeByte,
        fileCount: latestVersion.fileCount,
        type: a.type,
        targetType: a.type === AssetType.symlink ? a.target?.type : null,
        status: latestVersion.status,
        mediaType: latestVersion.mediaType,
        latestChildren,
        preview,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
        deletedAt: a.deletedAt ? a.deletedAt.toISOString() : null,
        creator,
        fieldValues,
        sortIndex: a.sortIndex,
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
      creator: { id: string; name: string | null } | null
    }>
  > {
    const versions = await this.prismaClient.asset.findMany({
      where: { parentId: stackId, removed: false },
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
          creator: v.creator ? { id: v.creator.id, name: v.creator.name } : null,
        }
      }),
    )
  }

  private async toPreviewInfo(asset: Asset | AssetWithIncludes): Promise<PreviewInfo | null> {
    if (!asset.media) return null

    let thumbnailUrl = undefined
    if (asset.mediaType?.startsWith('image/') && asset.media.thumbnail?.key) {
      thumbnailUrl = await s3Service.presign(
        process.env.S3_BUCKET || 'shumai',
        asset.media.thumbnail.key,
        'GET',
      )
    } else if (asset.mediaType?.startsWith('video/') && asset.media.poster?.key) {
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
      mediaType: asset.mediaType,
      thumbnailUrl,
      originalHeight: asset.media.metadata?.originalHeight,
      originalWidth: asset.media.metadata?.originalWidth,
      spriteUrl,
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
        if (a.asset?.key) {
          const url = await s3Service.presign(process.env.S3_BUCKET || 'shumai', a.asset.key, 'GET')
          attachments.push({
            id: a.id,
            assetId: a.asset.id,
            url,
            mediaType: a.asset.mediaType,
          })
        }
      }
    }

    const mentions: UserInfo[] = []
    const botMentionMatch = (c.message || '').match(/<@([^>]+)>/g)
    if (botMentionMatch) {
      const userIds = botMentionMatch.map((m: string) => m.replace('<@', '').replace('>', ''))
      const users = await this.prismaClient.user.findMany({
        where: { id: { in: userIds } },
      })
      for (const u of users) {
        mentions.push({ id: u.id, name: u.name })
      }
    }

    const creator: UserInfo = { id: '', name: '' }
    if (c.sessionId) {
      creator.id = c.creatorId || ''
      creator.name = c.creator?.name || 'Ai Bot'
    } else if (c.creator) {
      creator.id = c.creator.id
      creator.name = c.creator.name
    }

    return {
      id: c.id,
      assetId: c.assetId,
      message: c.message,
      annotations: c.annotation,
      creator,
      replies,
      attachments,
      mentions,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      sessionId: c.sessionId,
    }
  }
}

export const assetService = new AssetService()
