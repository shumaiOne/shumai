import { prisma } from '@/db'
import { s3Service } from '@/services/s3/s3'
import { logger } from '@/logger'

export async function purgeUnreferencedStorageKeysActivity(): Promise<{
  purgedCount: number
  physicalFilesDeleted: number
}> {
  const bucket = process.env.S3_BUCKET || 'shumai'
  let purgedCount = 0
  let physicalFilesDeleted = 0

  // 1. Find storage keys with no associated assets and older than 24 hours
  // We use 24 hours to avoid race conditions with ongoing uploads or copies.
  const twentyFourHoursAgo = new Date()
  twentyFourHoursAgo.setDate(twentyFourHoursAgo.getDate() - 1)

  const unreferencedKeys = await prisma.storageKey.findMany({
    where: {
      assets: { none: {} },
      createdAt: { lt: twentyFourHoursAgo },
    },
    take: 100,
  })

  for (const sk of unreferencedKeys) {
    try {
      // Physically delete from S3
      // Handle complex keys (directories) same as before
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
      await prisma.storageKey.delete({
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

  return { purgedCount, physicalFilesDeleted }
}
