import {
  AssetStatus,
  AssetType,
  Prisma,
  prisma,
  type PrismaClient,
  WorkflowTaskStatus,
  WorkflowTaskType,
} from '@shumai/db'
import type { ArchiveAssetsResponse, RestoreArchivedAssetsResponse } from '@shumai/dtos'
import { HTTPException } from 'hono/http-exception'
import { isArchiveStorageEnabled } from '@shumai/core/src/s3/archive-storage'

export class AssetArchiveService {
  constructor(private readonly prismaClient: PrismaClient = prisma) {}

  async resolveCandidateFileAssetsForArchiveOrRestore(assetIds: string[]) {
    if (assetIds.length === 0) return []

    const topAssets = await this.prismaClient.asset.findMany({
      where: { id: { in: assetIds }, isDeleted: false },
      select: { id: true, type: true },
    })

    const foundIds = new Set(topAssets.map((a) => a.id))
    const uniqueRequested = Array.from(new Set(assetIds))
    if (foundIds.size !== uniqueRequested.length) {
      throw new HTTPException(404, { message: 'Asset not found' })
    }

    if (topAssets.some((a) => a.type === AssetType.symlink)) {
      throw new HTTPException(400, { message: 'Symlinks cannot be archived or restored' })
    }

    const startingIds = topAssets.map((a) => a.id)

    const expandIdsRecursively = async (rootIds: string[]) => {
      if (rootIds.length === 0) return []
      return this.prismaClient.$queryRaw<
        Array<{
          id: string
          type: string
        }>
      >`
        WITH RECURSIVE descendant AS (
          SELECT id, type::text AS type, is_deleted
          FROM assets
          WHERE id IN (${Prisma.join(rootIds)}) AND is_deleted = false AND type != 'symlink'
          UNION ALL
          SELECT a.id, a.type::text AS type, a.is_deleted
          FROM assets a
          INNER JOIN descendant d ON a.parent_id = d.id
          WHERE a.is_deleted = false AND a.type != 'symlink'
        )
        SELECT id, type FROM descendant;
      `
    }

    const descendants = await expandIdsRecursively(startingIds)
    const fileIds = Array.from(
      new Set(descendants.filter((r) => r.type === AssetType.file).map((r) => r.id)),
    )

    if (fileIds.length === 0) {
      return []
    }

    return this.prismaClient.asset.findMany({
      where: {
        id: { in: fileIds },
        isDeleted: false,
        type: AssetType.file,
        status: {
          notIn: [AssetStatus.trashed, AssetStatus.pending_purge],
        },
      },
      include: {
        storageKey: true,
        project: { select: { id: true, teamId: true } },
      },
      orderBy: { id: 'asc' },
    })
  }

  async archiveAssets(assetIds: string[]): Promise<ArchiveAssetsResponse> {
    if (!isArchiveStorageEnabled()) {
      throw new HTTPException(400, { message: 'Archive storage is not configured' })
    }
    if (assetIds.length === 0) {
      return { archivedAssetIds: [], taskIds: [], skippedCount: 0 }
    }

    const candidateFiles = await this.resolveCandidateFileAssetsForArchiveOrRestore(assetIds)
    if (candidateFiles.length === 0) {
      return { archivedAssetIds: [], taskIds: [], skippedCount: 0 }
    }

    const candidateStorageKeyIds = Array.from(
      new Set(candidateFiles.map((f) => f.storageKeyId).filter((id): id is string => !!id)),
    )

    // Sibling copies sharing the same storageKeyId must also be protected
    const allFilesForKeys = await this.prismaClient.asset.findMany({
      where: {
        storageKeyId: { in: candidateStorageKeyIds },
        isDeleted: false,
        type: AssetType.file,
        status: { notIn: [AssetStatus.trashed, AssetStatus.pending_purge] },
      },
      select: { id: true, storageKeyId: true, status: true },
    })

    const allFileIds = allFilesForKeys.map((f) => f.id)

    // Check active transcode/watermark tasks across candidate files AND all siblings sharing storage keys
    const activeTasks = await this.prismaClient.workflowTask.findMany({
      where: {
        assetId: { in: allFileIds },
        status: { in: [WorkflowTaskStatus.pending, WorkflowTaskStatus.processing] },
        type: {
          in: [
            WorkflowTaskType.transcode,
            WorkflowTaskType.transcode_video,
            WorkflowTaskType.transcode_image,
            WorkflowTaskType.transcode_pdf,
            WorkflowTaskType.transcode_pdf_pages,
            WorkflowTaskType.transcode_screenshot,
            WorkflowTaskType.transcode_image_annotation,
            WorkflowTaskType.transcode_watermark,
          ],
        },
      },
      select: { assetId: true },
    })
    const busyAssetIds = new Set(activeTasks.map((t) => t.assetId))

    const storageKeysWithBusyTask = new Set<string>()
    const storageKeysWithUnprocessedSiblings = new Set<string>()

    for (const f of allFilesForKeys) {
      if (!f.storageKeyId) continue
      if (busyAssetIds.has(f.id)) {
        storageKeysWithBusyTask.add(f.storageKeyId)
      }
      if (f.status === AssetStatus.uploading || f.status === AssetStatus.processing) {
        storageKeysWithUnprocessedSiblings.add(f.storageKeyId)
      }
    }

    const eligibleByStorageKey = new Map<string, typeof candidateFiles>()
    let skippedCount = 0
    let alreadyArchivedCount = 0
    let invalidStateCount = 0
    let busyCount = 0

    for (const file of candidateFiles) {
      if (!file.storageKeyId || !file.storageKey || !file.projectId || !file.project?.teamId) {
        skippedCount++
        continue
      }
      if (
        file.status === AssetStatus.archiving ||
        file.status === AssetStatus.archived ||
        file.storageKey.isArchived
      ) {
        skippedCount++
        alreadyArchivedCount++
        continue
      }
      if (busyAssetIds.has(file.id) || storageKeysWithBusyTask.has(file.storageKeyId)) {
        skippedCount++
        busyCount++
        continue
      }
      if (
        file.status !== AssetStatus.processed ||
        storageKeysWithUnprocessedSiblings.has(file.storageKeyId)
      ) {
        skippedCount++
        invalidStateCount++
        continue
      }

      const list = eligibleByStorageKey.get(file.storageKeyId) || []
      list.push(file)
      eligibleByStorageKey.set(file.storageKeyId, list)
    }

    if (eligibleByStorageKey.size === 0) {
      if (alreadyArchivedCount === 0 && busyCount > 0) {
        throw new HTTPException(409, {
          message: 'Cannot archive asset while a workflow task is in progress',
        })
      }
      if (alreadyArchivedCount === 0 && invalidStateCount > 0) {
        throw new HTTPException(409, {
          message: 'Only processed assets can be archived',
        })
      }
      return { archivedAssetIds: [], taskIds: [], skippedCount }
    }

    const archivedAssetIdsSet = new Set<string>()
    const taskIds: string[] = []

    for (const [storageKeyId, filesForKey] of eligibleByStorageKey.entries()) {
      const primaryFile = filesForKey[0]
      await this.prismaClient.$transaction(async (tx) => {
        const sharedAssets = await tx.asset.findMany({
          where: {
            storageKeyId,
            isDeleted: false,
            type: AssetType.file,
            status: AssetStatus.processed,
          },
          select: { id: true },
        })
        const sharedAssetIds = sharedAssets.map((a) => a.id)

        if (sharedAssetIds.length > 0) {
          await tx.asset.updateMany({
            where: { id: { in: sharedAssetIds } },
            data: { status: AssetStatus.archiving },
          })

          for (const id of sharedAssetIds) {
            archivedAssetIdsSet.add(id)
          }
        }

        const existingTask = await tx.workflowTask.findFirst({
          where: {
            assetId: { in: filesForKey.map((f) => f.id) },
            type: WorkflowTaskType.archive_asset,
            status: { in: [WorkflowTaskStatus.pending, WorkflowTaskStatus.processing] },
          },
          select: { id: true },
        })

        if (existingTask) {
          taskIds.push(existingTask.id)
        } else {
          const createdTask = await tx.workflowTask.create({
            data: {
              assetId: primaryFile.id,
              type: WorkflowTaskType.archive_asset,
              status: WorkflowTaskStatus.pending,
              teamId: primaryFile.project!.teamId,
              projectId: primaryFile.projectId!,
              payload: {
                projectId: primaryFile.projectId!,
                archive: { storageKeyId },
              },
            },
          })
          taskIds.push(createdTask.id)
        }
      })
    }

    return {
      archivedAssetIds: Array.from(archivedAssetIdsSet),
      taskIds,
      skippedCount,
    }
  }

  async restoreArchivedAssets(assetIds: string[]): Promise<RestoreArchivedAssetsResponse> {
    if (!isArchiveStorageEnabled()) {
      throw new HTTPException(400, { message: 'Archive storage is not configured' })
    }
    if (assetIds.length === 0) {
      return { restoredAssetIds: [], taskIds: [], skippedCount: 0 }
    }

    const candidateFiles = await this.resolveCandidateFileAssetsForArchiveOrRestore(assetIds)
    if (candidateFiles.length === 0) {
      return { restoredAssetIds: [], taskIds: [], skippedCount: 0 }
    }

    const candidateStorageKeyIds = Array.from(
      new Set(candidateFiles.map((f) => f.storageKeyId).filter((id): id is string => !!id)),
    )

    const allFilesForKeys = await this.prismaClient.asset.findMany({
      where: {
        storageKeyId: { in: candidateStorageKeyIds },
        isDeleted: false,
        type: AssetType.file,
        status: { notIn: [AssetStatus.trashed, AssetStatus.pending_purge] },
      },
      select: { id: true, storageKeyId: true, status: true },
    })

    const storageKeysWithArchivingSibling = new Set<string>()
    for (const f of allFilesForKeys) {
      if (!f.storageKeyId) continue
      if (f.status === AssetStatus.archiving) {
        storageKeysWithArchivingSibling.add(f.storageKeyId)
      }
    }

    const eligibleByStorageKey = new Map<string, typeof candidateFiles>()
    let skippedCount = 0
    let alreadyRestoringOrHotCount = 0
    let currentlyArchivingCount = 0

    for (const file of candidateFiles) {
      if (!file.storageKeyId || !file.storageKey || !file.projectId || !file.project?.teamId) {
        skippedCount++
        continue
      }
      if (
        file.status === AssetStatus.archiving ||
        storageKeysWithArchivingSibling.has(file.storageKeyId)
      ) {
        skippedCount++
        currentlyArchivingCount++
        continue
      }
      if (file.status === AssetStatus.restoring) {
        skippedCount++
        alreadyRestoringOrHotCount++
        continue
      }
      if (file.status !== AssetStatus.archived && !file.storageKey.isArchived) {
        skippedCount++
        alreadyRestoringOrHotCount++
        continue
      }

      const list = eligibleByStorageKey.get(file.storageKeyId) || []
      list.push(file)
      eligibleByStorageKey.set(file.storageKeyId, list)
    }

    if (eligibleByStorageKey.size === 0) {
      if (alreadyRestoringOrHotCount === 0 && currentlyArchivingCount > 0) {
        throw new HTTPException(409, {
          message: 'Cannot restore asset while it is currently archiving',
        })
      }
      return { restoredAssetIds: [], taskIds: [], skippedCount }
    }

    const restoredAssetIdsSet = new Set<string>()
    const taskIds: string[] = []

    for (const [storageKeyId, filesForKey] of eligibleByStorageKey.entries()) {
      const primaryFile = filesForKey[0]
      await this.prismaClient.$transaction(async (tx) => {
        const sharedAssets = await tx.asset.findMany({
          where: {
            storageKeyId,
            isDeleted: false,
            type: AssetType.file,
            status: AssetStatus.archived,
          },
          select: { id: true },
        })
        const sharedAssetIds = sharedAssets.map((a) => a.id)

        if (sharedAssetIds.length > 0) {
          await tx.asset.updateMany({
            where: { id: { in: sharedAssetIds } },
            data: { status: AssetStatus.restoring },
          })

          for (const id of sharedAssetIds) {
            restoredAssetIdsSet.add(id)
          }
        }

        const existingTask = await tx.workflowTask.findFirst({
          where: {
            assetId: { in: filesForKey.map((f) => f.id) },
            type: WorkflowTaskType.restore_asset,
            status: { in: [WorkflowTaskStatus.pending, WorkflowTaskStatus.processing] },
          },
          select: { id: true },
        })

        if (existingTask) {
          taskIds.push(existingTask.id)
        } else {
          const createdTask = await tx.workflowTask.create({
            data: {
              assetId: primaryFile.id,
              type: WorkflowTaskType.restore_asset,
              status: WorkflowTaskStatus.pending,
              teamId: primaryFile.project!.teamId,
              projectId: primaryFile.projectId!,
              payload: {
                projectId: primaryFile.projectId!,
                archive: { storageKeyId },
              },
            },
          })
          taskIds.push(createdTask.id)
        }
      })
    }

    return {
      restoredAssetIds: Array.from(restoredAssetIdsSet),
      taskIds,
      skippedCount,
    }
  }
}

export const assetArchiveService = new AssetArchiveService()

/**
 * Reverts assets referencing a StorageKey back to their baseline status (archived vs processed)
 * when an archive or restore task fails or recovers.
 */
export async function revertArchiveStateForStorageKey(
  storageKeyId: string,
  client: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<void> {
  const sk = await client.storageKey.findUnique({
    where: { id: storageKeyId },
    select: { isArchived: true },
  })
  if (!sk) return

  const fallbackStatus = sk.isArchived ? AssetStatus.archived : AssetStatus.processed
  await client.asset.updateMany({
    where: {
      storageKeyId,
      isDeleted: false,
      deletedAt: null,
      type: AssetType.file,
      status: { in: [AssetStatus.archiving, AssetStatus.restoring] },
    },
    data: { status: fallbackStatus },
  })
}

/**
 * Ensures an asset's storage key is not archived before allowing direct download of the original raw file.
 */
export async function assertStorageKeyNotArchived(
  key: string,
  client: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<void> {
  const sk = await client.storageKey.findUnique({
    where: { key },
    include: {
      assets: {
        where: { isDeleted: false },
        select: { status: true },
      },
    },
  })
  if (
    sk &&
    (sk.isArchived ||
      sk.assets.some(
        (a) =>
          a.status === AssetStatus.archiving ||
          a.status === AssetStatus.archived ||
          a.status === AssetStatus.restoring,
      ))
  ) {
    throw new Error(
      `Original file for storage key "${key}" is archived. Restore the asset first or download its proxy using assetIds with proxy: true.`,
    )
  }
}
