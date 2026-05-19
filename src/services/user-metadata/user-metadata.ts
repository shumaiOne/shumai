import { prisma } from '@/db'
import { UserMetadataItem } from '@/dtos/user-metadata'

export class UserMetadataService {
  async upsertMetadata(userId: string, teamId: string, key: string, value: unknown) {
    return await prisma.userMetadata.upsert({
      where: {
        userIdTeamIdKey: {
          userId,
          teamId,
          key,
        },
      },
      update: {
        value,
      },
      create: {
        userId,
        teamId,
        key,
        value,
      },
    })
  }

  async listMetadata(userId: string, teamId: string): Promise<UserMetadataItem[]> {
    const items = await prisma.userMetadata.findMany({
      where: {
        userId,
        teamId,
      },
      orderBy: {
        key: 'asc',
      },
    })

    return items.map((item) => ({
      key: item.key,
      value: item.value,
    }))
  }

  async getMetadata(userId: string, teamId: string, key: string): Promise<UserMetadataItem | null> {
    const item = await prisma.userMetadata.findUnique({
      where: {
        userIdTeamIdKey: {
          userId,
          teamId,
          key,
        },
      },
    })

    if (!item) return null

    return {
      key: item.key,
      value: item.value,
    }
  }
}

export const userMetadataService = new UserMetadataService()
