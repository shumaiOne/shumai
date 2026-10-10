import { AssetStatus, AssetType, prisma } from '@shumai/db'
import type { Prisma } from '@shumai/db'
import type { ListDuplicatesResponse, ResolveDuplicatesResponse } from '@shumai/dtos'
import { HTTPException } from 'hono/http-exception'
import { assetService } from './asset'
import {
  groupDuplicateRows,
  planDuplicateResolution,
  type DuplicateRow,
  type FolderRef,
} from './duplicates-group'

const MAX_ANCESTOR_LOOKUPS = 64

export class DuplicateService {
  constructor(private readonly prismaClient: typeof prisma = prisma) {}

  /** Live, non-symlink files of a project. */
  private liveFilesWhere(projectId: string): Prisma.AssetWhereInput {
    return {
      projectId,
      type: AssetType.file,
      isDeleted: false,
      targetId: null,
      status: { notIn: [AssetStatus.trashed, AssetStatus.pending_purge] },
    }
  }

  /** Live, non-symlink files of a project that already have a content hash. */
  private hashedFilesWhere(projectId: string): Prisma.AssetWhereInput {
    return { ...this.liveFilesWhere(projectId), contentHash: { not: null } }
  }

  private async loadFolders(parentIds: (string | null)[]): Promise<Map<string, FolderRef>> {
    const folders = new Map<string, FolderRef>()
    let pending = [...new Set(parentIds.filter((id): id is string => !!id))]
    for (let depth = 0; pending.length > 0 && depth < MAX_ANCESTOR_LOOKUPS; depth++) {
      const rows = await this.prismaClient.asset.findMany({
        where: { id: { in: pending } },
        select: { id: true, name: true, parentId: true, type: true },
      })
      for (const row of rows) folders.set(row.id, row)
      pending = [
        ...new Set(
          rows.map((r) => r.parentId).filter((id): id is string => !!id && !folders.has(id)),
        ),
      ]
    }
    return folders
  }

  private async fetchRows(projectId: string, hashes: string[]): Promise<DuplicateRow[]> {
    const rows = await this.prismaClient.asset.findMany({
      where: { ...this.hashedFilesWhere(projectId), contentHash: { in: hashes } },
      select: {
        id: true,
        name: true,
        parentId: true,
        sizeByte: true,
        createdAt: true,
        contentHash: true,
      },
    })
    return rows.filter((r): r is typeof r & { contentHash: string } => !!r.contentHash)
  }

  /** Lists groups of byte-identical files in a project, biggest wasted space first. */
  async listGroups(projectId: string, limit: number): Promise<ListDuplicatesResponse> {
    const grouped = await this.prismaClient.asset.groupBy({
      by: ['contentHash'],
      where: this.hashedFilesWhere(projectId),
      _count: { _all: true },
      _sum: { sizeByte: true },
      _max: { sizeByte: true },
      having: { contentHash: { _count: { gt: 1 } } },
    })

    const ranked = grouped
      .filter((g): g is typeof g & { contentHash: string } => !!g.contentHash)
      .map((g) => ({
        contentHash: g.contentHash,
        wasted: Number(g._sum.sizeByte ?? 0) - Number(g._max.sizeByte ?? 0),
      }))
      .sort((a, b) => b.wasted - a.wasted || a.contentHash.localeCompare(b.contentHash))

    const selected = ranked.slice(0, limit).map((g) => g.contentHash)
    if (selected.length === 0) return { groups: [], truncated: false }

    const rows = await this.fetchRows(projectId, selected)
    const folders = await this.loadFolders(rows.map((r) => r.parentId))
    return {
      groups: groupDuplicateRows(rows, folders),
      truncated: ranked.length > limit,
    }
  }

  /**
   * Moves extra copies of one duplicate group to trash. The client only names the file to keep and the
   * copies to delete; this re-checks against the database that the keeper is a live hashed file of the
   * project and that every file to delete is a live file of the same project with the same content hash
   * and size. If anything does not match (for example the group changed since it was listed) nothing is
   * deleted and a 409 is returned. Deletion goes through assetService.deleteAssets, the same path as
   * deleting files by hand, so counts and trash state stay consistent.
   */
  async resolveGroup(
    projectId: string,
    keepId: string,
    deleteIds: string[],
  ): Promise<ResolveDuplicatesResponse> {
    const ids = [...new Set([keepId, ...deleteIds])]
    const rows = await this.prismaClient.asset.findMany({
      where: { ...this.liveFilesWhere(projectId), id: { in: ids } },
      select: { id: true, contentHash: true, sizeByte: true },
    })
    const plan = planDuplicateResolution(keepId, deleteIds, rows)
    if (!plan.ok) throw new HTTPException(409, { message: plan.message })

    await assetService.deleteAssets(plan.deleteIds)
    return { deletedIds: plan.deleteIds }
  }
}

export const duplicateService = new DuplicateService()
