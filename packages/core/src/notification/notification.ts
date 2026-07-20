import { prisma } from '@shumai/db'
import type { Prisma } from '@shumai/db'
import { NotificationType } from '@shumai/db'
import {
  NotificationInfo,
  CreateNotificationRequest,
  ListNotificationParams,
  NotificationSettings,
} from '@shumai/dtos'
import { paginateQuery, PaginatedData } from '@shumai/core/src/pagination'
import '@shumai/db/src/prisma-json-types'
import { s3Service } from '@shumai/core/src/s3/s3'
import { userMetadataService } from '@shumai/core/src/user-metadata/user-metadata'

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

  private async getListWhere(
    teamId: string,
    userId: string,
    teamMember: Prisma.TeamMemberGetPayload<{ include: { lastReadNotification: true } }>,
    unreadOnly: boolean,
  ): Promise<Prisma.NotificationWhereInput> {
    // Permission Filtering based on Scope
    let projectFilter: string[] = []
    if (teamMember.scope === 'project') {
      const pms = await prisma.projectMember.findMany({
        where: { teamMemberId: teamMember.id },
        include: { project: true },
      })
      projectFilter = pms.filter((pm) => pm.project).map((pm) => pm.projectId)
    }

    // Load notification settings
    const settingsMeta = await userMetadataService.getMetadata(
      userId,
      teamId,
      'notification_settings',
    )
    const settings: NotificationSettings = settingsMeta
      ? (settingsMeta.value as NotificationSettings)
      : {
          comments: true,
          replies: true,
          mentions: true,
          yourUploads: false,
          otherUploads: true,
          statusUpdates: true,
        }

    const typeConditions: Prisma.NotificationWhereInput[] = []

    // 1. Comments
    if (settings.comments) {
      typeConditions.push({ type: NotificationType.comment_created, userId: null })
    }

    // 2. Replies
    if (settings.replies) {
      typeConditions.push({ type: NotificationType.reply_created, userId: userId })
      typeConditions.push({ type: NotificationType.reply_created, userId: null })
    }

    // 3. Mentions
    if (settings.mentions) {
      typeConditions.push({ type: NotificationType.mention, userId: userId })
    }

    // 4. Uploads
    if (settings.yourUploads && settings.otherUploads) {
      typeConditions.push({ type: NotificationType.successful_file_uploaded })
    } else if (settings.yourUploads) {
      typeConditions.push({ type: NotificationType.successful_file_uploaded, creatorId: userId })
    } else if (settings.otherUploads) {
      typeConditions.push({
        type: NotificationType.successful_file_uploaded,
        creatorId: { not: userId },
      })
    }

    // 5. Status Updates
    if (settings.statusUpdates) {
      typeConditions.push({ type: NotificationType.metadata_field_updated_status })
    }

    // 6. Always include team/project join notifications
    typeConditions.push({ type: NotificationType.new_user_join_team })
    typeConditions.push({ type: NotificationType.new_user_join_project })

    const where: Prisma.NotificationWhereInput = {
      teamId,
      OR: typeConditions,
      AND: [
        {
          OR: [
            ...(settings.yourUploads
              ? [{ type: NotificationType.successful_file_uploaded, creatorId: userId }]
              : []),
            { creatorId: null },
            { creatorId: { not: userId } },
          ],
        },
      ],
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

    if (unreadOnly && teamMember.lastReadNotification) {
      // We want notifications NEWER than the last read one.
      // String comparison works for ULID/KSUID.
      const currentAnd = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []
      where.AND = [
        ...currentAnd,
        { id: { gt: teamMember.lastReadNotification.id } },
      ] as Prisma.NotificationWhereInput[]
    }

    return where
  }

  async getUnreadCount(teamId: string, userId: string): Promise<number> {
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
      return 0
    }

    const where = await this.getListWhere(teamId, userId, teamMember, true)
    return prisma.notification.count({ where })
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

    const where = await this.getListWhere(teamId, userId, teamMember, !!params.unreadOnly)

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
      let thumbnailUrl = ''
      let originalWidth = 0
      let originalHeight = 0

      const media = a.media as PrismaJson.MediaInfo | null

      if (media) {
        const bucket = process.env.S3_BUCKET || 'shumai'
        try {
          if (media.sprite) {
            previewUrl = await s3Service.presign(bucket, media.sprite.key, 'GET')
            if (media.poster) {
              thumbnailUrl = await s3Service.presign(bucket, media.poster.key || '', 'GET')
            }
            if (media.metadata) {
              originalWidth = media.metadata.originalWidth
              originalHeight = media.metadata.originalHeight
            }
          } else if (media.thumbnail) {
            previewUrl = await s3Service.presign(bucket, media.thumbnail.key || '', 'GET')
            thumbnailUrl = previewUrl
          }
        } catch (e) {
          console.error('Failed to generate presigned url for notification asset preview:', e)
        }
      }

      info.asset = {
        id: a.id,
        name: a.name,
        proxyType: (a.media as PrismaJson.MediaInfo | null)?.proxyType || undefined,
        preview: previewUrl || undefined,
        thumbnailUrl: thumbnailUrl || undefined,
        originalWidth: originalWidth || undefined,
        originalHeight: originalHeight || undefined,
      }
    }

    return info
  }
}

export const notificationService = new NotificationService()
