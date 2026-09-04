import { prisma } from '@shumai/db'
import { s3Service } from '@shumai/core/src/s3/s3'
import { logger } from '@shumai/core/src/logger'
import { ulid } from 'ulid'

export async function migrateLegacyAgentAvatars(
  client: typeof prisma = prisma,
): Promise<{ migrated: number; errors: number }> {
  const legacyUsers = await client.user.findMany({
    where: {
      type: 'agent',
      image: {
        startsWith: 'data:',
      },
    },
    select: {
      id: true,
      image: true,
    },
  })

  if (legacyUsers.length === 0) {
    return { migrated: 0, errors: 0 }
  }

  logger.info({ count: legacyUsers.length }, 'Starting migration of legacy agent avatars to S3')
  const bucket = process.env.S3_BUCKET || 'shumai'
  let migrated = 0
  let errors = 0

  for (const user of legacyUsers) {
    try {
      if (!user.image) continue

      const match = user.image.match(/^data:([^;]+);base64,(.+)$/)
      let buffer: Buffer
      let contentType = 'image/webp'
      let ext = 'webp'

      if (match) {
        contentType = match[1]
        buffer = Buffer.from(match[2], 'base64')
        const subtype = contentType.split('/')[1]
        if (subtype) ext = subtype
      } else {
        const commaIdx = user.image.indexOf(',')
        const rawBase64 = commaIdx !== -1 ? user.image.slice(commaIdx + 1) : user.image
        buffer = Buffer.from(rawBase64, 'base64')
      }

      const key = `files/${ulid()}.${ext}`
      await s3Service.putObject(bucket, key, buffer, buffer.length, contentType)

      await client.user.update({
        where: { id: user.id },
        data: { image: key },
      })

      migrated++
      logger.info({ userId: user.id, key }, 'Successfully migrated agent avatar to S3')
    } catch (err: unknown) {
      errors++
      logger.error({ userId: user.id, err }, 'Failed to migrate legacy agent avatar')
    }
  }

  logger.info({ migrated, errors }, 'Completed migration of legacy agent avatars')
  return { migrated, errors }
}
