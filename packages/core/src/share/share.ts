import { prisma } from '@shumai/db'
import { AssetType, Prisma } from '@shumai/db'
import {
  ShareLinkInfo,
  CreateShareLinkRequest,
  UpdateShareLinkRequest,
  ListShareLinksRequest,
  AddAssetToShareRequest,
} from '@shumai/dtos'
import { PaginatedData, paginateQuery } from '@shumai/core/src/pagination'
import { getAvatarUrl } from '@shumai/core/src/user/avatar'

export class ShareService {
  async createShareLink(
    projectId: string,
    req: CreateShareLinkRequest,
    creatorId?: string,
  ): Promise<ShareLinkInfo> {
    let project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { shareRoot: true },
    })

    if (!project) throw new Error('Project not found')

    // Lazy create share root if missing (for existing projects)
    if (!project.shareRootId) {
      const shareRootFolder = await prisma.asset.create({
        data: {
          name: 'share_root',
          type: AssetType.share_root,
          status: 'processed',
          projectId: projectId,
        },
      })
      project = await prisma.project.update({
        where: { id: projectId },
        data: { shareRootId: shareRootFolder.id },
        include: { shareRoot: true },
      })
    }

    return await prisma.$transaction(async (tx) => {
      const shareFolder = await tx.asset.create({
        data: {
          name: req.name,
          type: AssetType.share,
          status: 'processed',
          projectId: projectId,
          parentId: project.shareRootId,
        },
      })

      const shareLink = await tx.shareLink.create({
        data: {
          name: req.name,
          expireAt: req.expireAt ? new Date(req.expireAt) : null,
          password: req.password,
          isDisabled: req.isDisabled ?? false,
          defaultSortOrder: req.defaultSortOrder,
          viewMode: req.viewMode,
          projectId: projectId,
          rootFolderId: shareFolder.id,
          creatorId,
        },
        include: { creator: true },
      })

      return await this.toShareLinkInfo(shareLink)
    })
  }

  async updateShareLink(shareLinkId: string, req: UpdateShareLinkRequest): Promise<ShareLinkInfo> {
    const shareLink = await prisma.shareLink.findUnique({
      where: { id: shareLinkId },
    })
    if (!shareLink) throw new Error('Share link not found')

    const updated = await prisma.shareLink.update({
      where: { id: shareLinkId },
      data: {
        name: req.name,
        expireAt:
          req.expireAt !== undefined ? (req.expireAt ? new Date(req.expireAt) : null) : undefined,
        password: req.password,
        isDisabled: req.isDisabled,
        defaultSortOrder: req.defaultSortOrder,
        viewMode: req.viewMode,
        fieldVisibility: (req.fieldVisibility as PrismaJson.ShareLinkFieldVisibility) ?? undefined,
      },
      include: { creator: true },
    })

    if (req.name) {
      await prisma.asset.update({
        where: { id: shareLink.rootFolderId },
        data: { name: req.name },
      })
    }

    return await this.toShareLinkInfo(updated)
  }

  async deleteShareLink(shareLinkId: string): Promise<void> {
    const shareLink = await prisma.shareLink.findUnique({
      where: { id: shareLinkId },
    })
    if (!shareLink) throw new Error('Share link not found')

    await prisma.$transaction(async (tx) => {
      await tx.shareLink.delete({ where: { id: shareLinkId } })
      // Delete the root folder asset, which should cascade to symlinks if set up correctly
      // But Asset relation in prisma might not cascade delete children unless configured.
      // Actually, targetId has onDelete: Cascade, but parentId doesn't necessarily.
      // Let's manually delete the asset tree or ensure it's handled.
      await tx.asset.delete({ where: { id: shareLink.rootFolderId } })
    })
  }

  async listProjectShareLinks(req: ListShareLinksRequest): Promise<PaginatedData<ShareLinkInfo[]>> {
    const where: Prisma.ShareLinkWhereInput = {
      projectId: req.projectId,
    }

    return paginateQuery(
      async (skip, take) => {
        const links = await prisma.shareLink.findMany({
          where,
          include: { creator: true },
          skip,
          take,
          orderBy: { createdAt: 'desc' },
        })
        return await Promise.all(links.map((l) => this.toShareLinkInfo(l)))
      },
      () => prisma.shareLink.count({ where }),
      req,
    )
  }

  async getShareLink(shareLinkId: string): Promise<ShareLinkInfo> {
    const shareLink = await prisma.shareLink.findUnique({
      where: { id: shareLinkId },
      include: { creator: true },
    })
    if (!shareLink) throw new Error('Share link not found')
    return await this.toShareLinkInfo(shareLink)
  }

  async addAssetToShare(shareLinkId: string, req: AddAssetToShareRequest): Promise<number> {
    const shareLink = await prisma.shareLink.findUnique({
      where: { id: shareLinkId },
    })
    if (!shareLink) throw new Error('Share link not found')

    const assetIds = req.assetIds
    const existingSymlinks = await prisma.asset.findMany({
      where: {
        parentId: shareLink.rootFolderId,
        targetId: { in: assetIds },
        type: AssetType.symlink,
      },
      select: { targetId: true },
    })

    const existingTargetIds = new Set(existingSymlinks.map((s) => s.targetId))
    const idsToAdd = assetIds.filter((id) => !existingTargetIds.has(id))

    if (idsToAdd.length === 0) return 0

    const targetAssets = await prisma.asset.findMany({
      where: { id: { in: idsToAdd } },
    })

    const targetAssetMap = new Map(targetAssets.map((a) => [a.id, a]))

    await prisma.$transaction(async (tx) => {
      for (const assetId of idsToAdd) {
        const targetAsset = targetAssetMap.get(assetId)
        if (!targetAsset) continue

        await tx.asset.create({
          data: {
            name: targetAsset.name,
            type: AssetType.symlink,
            status: 'processed',
            projectId: shareLink.projectId,
            parentId: shareLink.rootFolderId,
            targetId: assetId,
          },
        })
      }
      await tx.asset.update({
        where: { id: shareLink.rootFolderId },
        data: { fileCount: { increment: idsToAdd.length } },
      })
    })

    return idsToAdd.length
  }

  async removeAssetFromShare(shareLinkId: string, assetId: string): Promise<void> {
    // Here assetId is the id of the symlink asset
    const symlink = await prisma.asset.findUnique({
      where: { id: assetId },
    })
    if (!symlink || symlink.type !== AssetType.symlink) {
      throw new Error('Symlink not found')
    }

    const shareLink = await prisma.shareLink.findUnique({
      where: { id: shareLinkId },
    })
    if (!shareLink || symlink.parentId !== shareLink.rootFolderId) {
      throw new Error('Asset does not belong to this share link')
    }

    await prisma.$transaction(async (tx) => {
      await tx.asset.delete({ where: { id: assetId } })
      await tx.asset.update({
        where: { id: shareLink.rootFolderId },
        data: { fileCount: { decrement: 1 } },
      })
    })
  }

  async verifyPublicAccess(
    assetId: string,
    providedPassword?: string,
  ): Promise<Prisma.ShareLinkGetPayload<true>> {
    // 1. Trace ancestors of the current asset in the real tree
    // 2. Find if any ancestor (including itself) is the target of a symlink that belongs to a share
    // 3. Or if the asset itself is a descendant of a 'share' type folder (direct share link root or subfolder within)

    const rows = await prisma.$queryRaw<{ shareRootId: string }[]>`
      WITH RECURSIVE 
      -- Trace ancestors in the real asset tree
      real_ancestors AS (
        SELECT id, parent_id, type::text FROM assets WHERE id = ${assetId}
        UNION ALL
        SELECT a.id, a.parent_id, a.type::text FROM assets a
        INNER JOIN real_ancestors ra ON ra.parent_id = a.id
      ),
      -- Find all symlinks pointing to any of these real ancestors
      found_symlinks AS (
        SELECT s.id, s.parent_id, s.type::text FROM assets s
        INNER JOIN real_ancestors ra ON s.target_id = ra.id
        WHERE s.type = 'symlink'
      ),
      -- Combine: start with either real ancestors that are 'share' type, or symlinks that lead to 'share' type
      search_starts AS (
        SELECT id, parent_id, type FROM real_ancestors WHERE type = 'share'
        UNION
        SELECT id, parent_id, type FROM found_symlinks
      ),
      -- Trace UP from these search starts to find the ultimate 'share' root
      share_trace AS (
        SELECT id, parent_id, type FROM search_starts
        UNION ALL
        SELECT a.id, a.parent_id, a.type::text FROM assets a
        INNER JOIN share_trace st ON st.parent_id = a.id
      )
      SELECT id as "shareRootId" FROM share_trace WHERE type = 'share' LIMIT 1;
    `

    if (rows.length === 0) {
      throw new Error('Asset is not shared')
    }

    const shareRootId = rows[0].shareRootId
    const shareLink = await prisma.shareLink.findUnique({
      where: { rootFolderId: shareRootId },
    })

    if (!shareLink) {
      throw new Error('Share link not found for this asset')
    }

    if (shareLink.isDisabled) {
      throw new Error('Share link is disabled')
    }

    if (shareLink.expireAt && shareLink.expireAt < new Date()) {
      throw new Error('Share link has expired')
    }

    if (shareLink.password && shareLink.password !== providedPassword) {
      throw new Error('Invalid password for share link')
    }

    return shareLink
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async toShareLinkInfo(l: any): Promise<ShareLinkInfo> {
    const isExpired = l.expireAt ? new Date(l.expireAt) < new Date() : false
    const avatarUrl = l.creator ? await getAvatarUrl(l.creator.image) : undefined
    return {
      id: l.id,
      name: l.name,
      expireAt: l.expireAt?.toISOString(),
      isDisabled: l.isDisabled,
      hasPassword: !!l.password,
      defaultSortOrder: l.defaultSortOrder,
      viewMode: l.viewMode,
      fieldVisibility: l.fieldVisibility as Record<string, boolean> | undefined,
      rootFolderId: l.rootFolderId,
      projectId: l.projectId,
      isExpired,
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
      creator: l.creator ? { id: l.creator.id, name: l.creator.name, image: avatarUrl } : null,
    }
  }
}

export const shareService = new ShareService()
