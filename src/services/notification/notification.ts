import { prisma } from '@/db'
import type { Prisma } from '@/generated/prisma/client'
import { NotificationType } from '@/generated/prisma/client'
import {
  NotificationInfo,
  CreateNotificationRequest,
  ListNotificationParams,
} from '@/dtos/notification'
import { paginateQuery, PaginatedData } from '@/services/pagination'
import '@/prisma-json-types'
import { s3Service } from '@/services/s3/s3'

const mentionRegex = /<@([^>]+)>/g

export class NotificationService {
  async create(req: CreateNotificationRequest) {
    // Note: Do not await this, we fire and forget similarly to Go
    this.createAsync(req).catch((err) => {
      console.error('Failed to create notification asynchronously:', err)
    })
  }

  private async createAsync(req: CreateNotificationRequest) {
    let projectId = req.projectId

    // Resolve ProjectID from AssetID if missing
    if (!projectId && req.assetId) {
      const asset = await prisma.asset.findUnique({
        where: { id: req.assetId },
        include: { project: true },
      })
      if (asset?.projectId) {
        projectId = asset.projectId
      }
    }

    // Check project notification settings
    if (projectId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      })
      if (project && !project.enableNotification) {
        return
      }
    }

    // Helper to create a notification
    const create = async (t: NotificationType, targetUserId?: string) => {
      try {
        await prisma.notification.create({
          data: {
            type: t,
            teamId: req.teamId,
            projectId: projectId,
            creatorId: req.creatorId,
            assetId: req.assetId,
            taskId: req.taskId,
            userId: targetUserId,
          },
        })
      } catch (err) {
        console.error('Failed to save notification', { type: t, err })
      }
    }

    // 1. Create the primary notification
    await create(req.type, req.userId)

    // 2. Handle Mentions for Comment/Reply types
    if (
      (req.type === NotificationType.comment_created ||
        req.type === NotificationType.reply_created) &&
      req.commentMessage
    ) {
      const matches = [...req.commentMessage.matchAll(mentionRegex)]
      const mentionedIds = new Set<string>()

      for (const match of matches) {
        if (match.length > 1) {
          const userId = match[1]
          if (mentionedIds.has(userId)) {
            continue
          }
          mentionedIds.add(userId)

          // Don't notify self
          if (req.creatorId === userId) {
            continue
          }

          // Create mention notification
          await create(NotificationType.mention, userId)
        }
      }
    }
  }

  async list(
    teamId: string,
    userId: string,
    params: ListNotificationParams,
  ): Promise<PaginatedData<NotificationInfo[]>> {
    // Get user's last read notification
    const teamMember = await prisma.teamMember.findUnique({
      where: {
        teamIdUserId: {
          teamId,
          userId,
        },
      },
      include: {
        lastReadNotification: true,
      },
    })

    if (!teamMember) {
      throw new Error('failed to get team member')
    }

    // Permission Filtering based on Scope
    let projectFilter: string[] = []
    if (teamMember.scope === 'project') {
      const pms = await prisma.projectMember.findMany({
        where: { teamMemberId: teamMember.id },
        include: { project: true },
      })
      projectFilter = pms.filter((pm) => pm.project).map((pm) => pm.projectId)
    }

    const where: Prisma.NotificationWhereInput = {
      teamId,
      OR: [
        { type: { not: NotificationType.mention } },
        { type: NotificationType.mention, userId: userId },
      ],
      AND: [{ OR: [{ creatorId: null }, { creatorId: { not: userId } }] }],
    }

    if (teamMember.scope === 'project') {
      // Must be AND applied after the general rules
      const currentAnd = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []
      where.AND = [
        ...currentAnd,
        {
          OR: [
            { type: NotificationType.mention }, // Always allow mentions (targeted)
            { projectId: { in: projectFilter } }, // Only show notifications for projects user is member of
          ],
        },
      ] as Prisma.NotificationWhereInput[]
    }

    if (params.unreadOnly && teamMember.lastReadNotification) {
      // We want notifications NEWER than the last read one.
      // String comparison works for ULID/KSUID.
      const currentAnd = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []
      where.AND = [
        ...currentAnd,
        { id: { gt: teamMember.lastReadNotification.id } },
      ] as Prisma.NotificationWhereInput[]
    }

    return paginateQuery<NotificationInfo>(
      async (skip, take) => {
        const notifications = await prisma.notification.findMany({
          where,
          orderBy: { id: 'desc' },
          skip,
          take,
          include: {
            creator: true,
            team: true,
            project: true,
            asset: true,
            user: true,
          },
        })

        return Promise.all(
          notifications.map(async (n) => {
            return this.toNotificationInfo(n, teamMember.lastReadNotification)
          }),
        )
      },
      null, // we don't need count
      {
        after: params.after,
        first: params.pageSize,
        includeCount: false,
      },
    )
  }

  async markRead(teamId: string, userId: string, notificationId: string) {
    const teamMember = await prisma.teamMember.findUnique({
      where: {
        teamIdUserId: {
          teamId,
          userId,
        },
      },
      include: {
        lastReadNotification: true,
      },
    })

    if (!teamMember) {
      throw new Error('failed to get team member')
    }

    const notificationExists = await prisma.notification.findUnique({
      where: { id: notificationId },
    })

    if (!notificationExists) {
      throw new Error('notification not found')
    }

    let shouldUpdate = true
    if (teamMember.lastReadNotification) {
      if (notificationId <= teamMember.lastReadNotification.id) {
        shouldUpdate = false
      }
    }

    if (shouldUpdate) {
      await prisma.teamMember.update({
        where: { id: teamMember.id },
        data: { lastReadNotificationId: notificationId },
      })
    }
  }

  private async toNotificationInfo(
    n: Prisma.NotificationGetPayload<{
      include: { creator: true; team: true; project: true; asset: true; user: true }
    }>,
    lastRead: Prisma.NotificationGetPayload<Record<string, never>> | null,
  ): Promise<NotificationInfo> {
    const info: NotificationInfo = {
      id: n.id,
      type: n.type || undefined,
      createdAt: n.createdAt.toISOString(),
      isRead: lastRead !== null && n.id <= lastRead.id,
    }

    if (n.creator) {
      info.creator = {
        id: n.creator.id,
        name: n.creator.name,
      }
    }

    if (n.team) {
      info.team = {
        id: n.team.id,
        name: n.team.name,
      }
    }

    if (n.project) {
      info.project = {
        id: n.project.id,
        name: n.project.name,
      }
    }

    if (n.user) {
      info.user = {
        id: n.user.id,
        name: n.user.name,
      }
    }

    if (n.asset) {
      const a = n.asset
      let previewUrl = ''

      const media = a.media as PrismaJson.MediaInfo | null

      if (media) {
        const bucket = process.env.S3_BUCKET || 'shumai'
        try {
          if (media.sprite) {
            previewUrl = await s3Service.presign(bucket, media.sprite.key, 'GET')
          } else if (media.thumbnail) {
            previewUrl = await s3Service.presign(bucket, media.thumbnail.key || '', 'GET')
          }
        } catch (e) {
          console.error('Failed to generate presigned url for notification asset preview:', e)
        }
      }

      info.asset = {
        id: a.id,
        name: a.name,
        mediaType: a.mediaType || undefined,
        preview: previewUrl || undefined,
      }
    }

    return info
  }
}

export const notificationService = new NotificationService()
