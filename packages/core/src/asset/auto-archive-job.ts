import { prisma, Prisma } from '@shumai/db'
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

interface TeamArchiveBatch {
  teamId: string
  assetIds: string[]
  policy: {
    method: 'not_updated' | 'after_created'
    cutoffDate: Date
    restoreCutoffDate: Date
  }
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
        logger.error({ err }, 'Error in auto-archive background job')
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

    try {
      // Phase 1: Query & Scan under transaction-scoped advisory lock.
      // Automatically released as soon as this transaction completes.
      const teamBatches = await prisma.$transaction(async (tx) => {
        const lockRes = await tx.$queryRaw<Array<{ locked: boolean }>>`
          SELECT pg_try_advisory_xact_lock(hashtext('auto_archive_job')) AS locked
        `
        if (!lockRes || !lockRes[0]?.locked) {
          logger.debug(
            'Could not acquire transaction advisory lock for auto-archive scan, skipping',
          )
          return []
        }

        // Query only teams where autoArchive is enabled via JSON filter
        const eligibleTeams = await tx.team.findMany({
          where: {
            settings: {
              path: ['autoArchive', 'enabled'],
              equals: true,
            },
          },
          select: { id: true, settings: true },
        })

        if (eligibleTeams.length === 0) {
          return []
        }

        const batches: TeamArchiveBatch[] = []

        for (const team of eligibleTeams) {
          const settings = (team.settings || {}) as PrismaJson.Settings
          const autoArchive = settings.autoArchive
          const method = autoArchive?.method || 'not_updated'
          const days = Math.max(1, autoArchive?.days || 30)
          const postRestoreGraceDays = Math.max(1, autoArchive?.postRestoreGraceDays || 30)

          const now = Date.now()
          const cutoffDate = new Date(now - days * 86_400_000)
          const restoreCutoffDate = new Date(now - postRestoreGraceDays * 86_400_000)

          // Query candidate assets whose storage keys have NO ineligible sibling.
          // NOT EXISTS eliminates starvation from stuck/recent siblings at the database level.
          const candidateRows = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT a.id
            FROM assets a
            JOIN projects p ON a.project_id = p.id
            JOIN storage_keys sk ON a.storage_key_id = sk.id
            WHERE p.team_id = ${team.id}
              AND a.type = 'file'::"AssetType"
              AND a.status = 'processed'::"AssetStatus"
              AND a.is_deleted = false
              AND sk.is_archived = false
              AND ${
                method === 'not_updated'
                  ? Prisma.sql`a.updated_at <= ${cutoffDate}`
                  : Prisma.sql`a.created_at <= ${cutoffDate} AND a.updated_at <= ${restoreCutoffDate}`
              }
              AND NOT EXISTS (
                SELECT 1
                FROM assets sib
                WHERE sib.storage_key_id = a.storage_key_id
                  AND sib.is_deleted = false
                  AND (
                    sib.type != 'file'::"AssetType"
                    OR sib.status != 'processed'::"AssetStatus"
                    OR ${
                      method === 'not_updated'
                        ? Prisma.sql`sib.updated_at > ${cutoffDate}`
                        : Prisma.sql`sib.created_at > ${cutoffDate} OR sib.updated_at > ${restoreCutoffDate}`
                    }
                  )
              )
            ORDER BY a.id ASC
            LIMIT ${batchSize};
          `

          if (candidateRows.length > 0) {
            batches.push({
              teamId: team.id,
              assetIds: candidateRows.map((r) => r.id),
              policy: { method, cutoffDate, restoreCutoffDate },
            })
          }
        }

        return batches
      })

      if (teamBatches.length === 0) {
        return { archivedCount: 0 }
      }

      // Phase 2: Execute archival in chunks per team batch.
      // Each asset/storageKey transition is protected by row-level lock and re-verifies policy.
      let totalArchived = 0
      const chunkSize = 50

      for (const batch of teamBatches) {
        for (let i = 0; i < batch.assetIds.length; i += chunkSize) {
          const chunk = batch.assetIds.slice(i, i + chunkSize)
          const result = await assetArchiveService.archiveAssets(chunk, {
            suppressBusyErrors: true,
            autoArchivePolicy: batch.policy,
          })
          totalArchived += result.archivedAssetIds.length
        }
      }

      logger.info({ totalArchived }, 'Auto-archive job completed run')
      return { archivedCount: totalArchived }
    } finally {
      this.isProcessing = false
    }
  }
}

export const autoArchiveJobService = new AutoArchiveJobService()
