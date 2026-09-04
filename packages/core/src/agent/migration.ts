import { prisma } from '@shumai/db'
import { s3Service } from '@shumai/core/src/s3/s3'
import { logger } from '@shumai/core/src/logger'
import { ulid } from 'ulid'
import { PRESET_AVATAR_IDS, getPresetAvatarBuffer } from './presets'

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

      let matchedPresetId: string | undefined
      for (const id of PRESET_AVATAR_IDS) {
        const presetBuf = getPresetAvatarBuffer(id)
        if (presetBuf && buffer.equals(presetBuf)) {
          matchedPresetId = id
          break
        }
      }

      const key = `files/${ulid()}.${ext}`
      await s3Service.putObject(bucket, key, buffer, buffer.length, contentType)

      await client.user.update({
        where: { id: user.id },
        data: { image: key },
      })

      if (matchedPresetId) {
        const agent = await client.agent.findUnique({
          where: { id: user.id },
          select: { config: true },
        })
        if (agent) {
          const currentConfig = (agent.config as unknown as PrismaJson.AgentConfig) || {}
          await client.agent.update({
            where: { id: user.id },
            data: {
              config: {
                ...currentConfig,
                avatarPreset: matchedPresetId,
              },
            },
          })
        }
      }

      migrated++
      logger.info(
        { userId: user.id, key, avatarPreset: matchedPresetId },
        'Successfully migrated agent avatar to S3',
      )
    } catch (err: unknown) {
      errors++
      logger.error({ userId: user.id, err }, 'Failed to migrate legacy agent avatar')
    }
  }

  logger.info({ migrated, errors }, 'Completed migration of legacy agent avatars')
  return { migrated, errors }
}
