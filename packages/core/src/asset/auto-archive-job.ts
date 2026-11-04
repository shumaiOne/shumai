import { AssetStatus, AssetType, prisma } from '@shumai/db'
import { isArchiveStorageEnabled } from '@shumai/core/src/s3/archive-storage'
import { assetArchiveService } from '@shumai/core/src/asset/asset-archive'
import { logger } from '@shumai/core/src/logger'

export function getAutoArchiveIntervalMs(): number {
  const raw = process.env.AUTO_ARCHIVE_INTERVAL_MINUTES
  if (raw) {
    const parsed = Number.parseFloat(raw)
    if (!Number.isNaN(parsed) && parsed > 0) {
      return Math.round(parsed * 60 * 1000)
    }
  }
  return 60 * 60 * 1000 // default 1 hour
}

export class AutoArchiveJobService {
  private isRunning = false
  private isProcessing = false
  private timer: NodeJS.Timeout | null = null

  start(initialDelayMs = 60_000, intervalMs?: number): void {
    if (this.isRunning) return
    this.isRunning = true
    logger.info('Starting auto-archive background job')

    const run = async () => {
      if (!this.isRunning) return
      try {
        await this.processAutoArchive()
      } catch (err: unknown) {
        logger.error(
          { err: err instanceof Error ? err.message : String(err) },
          'Error in auto-archive background job',
        )
      }

      if (this.isRunning) {
        const nextInterval = intervalMs ?? getAutoArchiveIntervalMs()
        this.timer = setTimeout(run, nextInterval)
      }
    }

    this.timer = setTimeout(run, initialDelayMs)
  }

  stop(): void {
    this.isRunning = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    logger.info('Stopped auto-archive background job')
  }

  async processAutoArchive(batchSize = 100): Promise<{ archivedCount: number }> {
    if (!isArchiveStorageEnabled()) {
      logger.debug('Archive storage is not configured; skipping auto-archive run')
      return { archivedCount: 0 }
    }

    if (this.isProcessing) {
      logger.debug('Auto-archive job turn already in progress, skipping')
      return { archivedCount: 0 }
    }

    this.isProcessing = true
    let advisoryLockAcquired = false

    try {
      // 1. Acquire advisory lock only for the query/scan phase
      const lockRes = await prisma.$queryRaw<Array<{ locked: boolean }>>`
        SELECT pg_try_advisory_lock(hashtext('auto_archive_job')) AS locked
      `
      if (!lockRes || !lockRes[0]?.locked) {
        logger.debug('Could not acquire advisory lock for auto-archive scan, skipping')
        return { archivedCount: 0 }
      }
      advisoryLockAcquired = true

      // 2. Query all teams with auto-archive enabled
      const teams = await prisma.team.findMany({
        select: { id: true, settings: true },
      })

      const eligibleTeams = teams.filter((t) => {
        const s = (t.settings || {}) as PrismaJson.Settings
        return Boolean(s.autoArchive?.enabled)
      })

      if (eligibleTeams.length === 0) {
        return { archivedCount: 0 }
      }

      // Collect candidate asset IDs to archive across teams
      const assetsToArchive: string[] = []

      for (const team of eligibleTeams) {
        const settings = (team.settings || {}) as PrismaJson.Settings
        const autoArchive = settings.autoArchive
        const method = autoArchive?.method || 'not_updated'
        const days = Math.max(1, autoArchive?.days || 30)
        const postRestoreGraceDays = Math.max(1, autoArchive?.postRestoreGraceDays || 30)

        const now = Date.now()
        const cutoffDate = new Date(now - days * 86_400_000)
        const restoreCutoffDate = new Date(now - postRestoreGraceDays * 86_400_000)

        // Find candidate files for this team
        const candidates = await prisma.asset.findMany({
          where: {
            project: { teamId: team.id },
            type: AssetType.file,
            status: AssetStatus.processed,
            isDeleted: false,
            storageKeyId: { not: null },
            storageKey: { isArchived: false },
            ...(method === 'not_updated'
              ? { updatedAt: { lte: cutoffDate } }
              : {
                  createdAt: { lte: cutoffDate },
                  updatedAt: { lte: restoreCutoffDate },
                }),
          },
          select: { id: true, storageKeyId: true },
          take: batchSize,
          orderBy: { id: 'asc' },
        })

        if (candidates.length === 0) {
          continue
        }

        const candidateStorageKeyIds = Array.from(
          new Set(candidates.map((c) => c.storageKeyId).filter((id): id is string => !!id)),
        )

        // Inspect all sibling files sharing these storage keys.
        // Policy: only archive if ALL sibling files sharing the key satisfy the age policy
        const allSiblings = await prisma.asset.findMany({
          where: {
            storageKeyId: { in: candidateStorageKeyIds },
            isDeleted: false,
            type: AssetType.file,
            status: { notIn: [AssetStatus.trashed, AssetStatus.pending_purge] },
          },
          select: {
            id: true,
            storageKeyId: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        })

        const siblingsByKey = new Map<string, typeof allSiblings>()
        for (const s of allSiblings) {
          if (!s.storageKeyId) continue
          const list = siblingsByKey.get(s.storageKeyId) || []
          list.push(s)
          siblingsByKey.set(s.storageKeyId, list)
        }

        for (const [keyId, siblings] of siblingsByKey.entries()) {
          const allEligible = siblings.every((sib) => {
            if (sib.status !== AssetStatus.processed) return false
            if (method === 'not_updated') {
              return sib.updatedAt <= cutoffDate
            }
            return sib.createdAt <= cutoffDate && sib.updatedAt <= restoreCutoffDate
          })

          if (allEligible) {
            // Add primary candidate IDs for this key
            const matchingCandidates = candidates.filter((c) => c.storageKeyId === keyId)
            for (const mc of matchingCandidates) {
              assetsToArchive.push(mc.id)
            }
          }
        }
      }

      // 3. Release the advisory lock immediately after the query/scan phase
      if (advisoryLockAcquired) {
        await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext('auto_archive_job'))`
        advisoryLockAcquired = false
      }

      // 4. Execute archival in batches (each item protected by row-level lock)
      if (assetsToArchive.length === 0) {
        return { archivedCount: 0 }
      }

      let totalArchived = 0
      const chunkSize = 50
      for (let i = 0; i < assetsToArchive.length; i += chunkSize) {
        const chunk = assetsToArchive.slice(i, i + chunkSize)
        const result = await assetArchiveService.archiveAssets(chunk, {
          suppressBusyErrors: true,
        })
        totalArchived += result.archivedAssetIds.length
      }

      logger.info({ totalArchived }, 'Auto-archive job completed run')
      return { archivedCount: totalArchived }
    } finally {
      if (advisoryLockAcquired) {
        await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext('auto_archive_job'))`.catch(
          () => {},
        )
      }
      this.isProcessing = false
    }
  }
}

export const autoArchiveJobService = new AutoArchiveJobService()
