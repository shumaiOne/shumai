import { prisma, AssetType } from '@shumai/db'
import { AssetInfo, ListRecentsRequest } from '@shumai/dtos'
import { PaginatedData, paginateQuery } from '@shumai/core/src/pagination'
import { assetService, assetInclude, AssetWithIncludes } from '@shumai/core/src/asset/asset'

export class RecentsService {
  constructor(private readonly prismaClient: typeof prisma = prisma) {}

  /**
   * Record a file view by user in project.
   * If the asset is a child file in a version stack, resolves to the version stack.
   * Enforces a maximum cap of 100 recent file items per (userId, projectId).
   */
  async recordView(userId: string, projectId: string, assetId: string): Promise<void> {
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

        return await assetService.toAssetInfos(assets)
      },
      async () => {
        const total = await this.prismaClient.recentFileItem.count({ where })
        return Math.min(total, 100)
      },
      req,
    )
  }
}

export const recentsService = new RecentsService()
