import { prisma } from '@shumai/db'
import { UserMetadataItem } from '@shumai/dtos'

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
    const [items, team] = await Promise.all([
      prisma.userMetadata.findMany({
        where: {
          userId,
          teamId,
        },
        orderBy: {
          key: 'asc',
        },
      }),
      prisma.team.findUnique({
        where: { id: teamId },
        select: { settings: true },
      }),
    ])

    const result: UserMetadataItem[] = items
      .filter((item) => item.key !== 'appearance.hideAgent')
      .map((item) => ({
        key: item.key,
        value: item.value,
      }))

    const teamSettings = team?.settings as PrismaJson.Settings | null
    const hideAgent = teamSettings?.appearance?.hideAgent ?? false

    result.push({
      key: 'appearance.hideAgent',
      value: hideAgent,
    })

    return result
  }

  async getMetadata(userId: string, teamId: string, key: string): Promise<UserMetadataItem | null> {
    if (key === 'appearance.hideAgent') {
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { settings: true },
      })
      const teamSettings = team?.settings as PrismaJson.Settings | null
      return {
        key: 'appearance.hideAgent',
        value: teamSettings?.appearance?.hideAgent ?? false,
      }
    }

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
