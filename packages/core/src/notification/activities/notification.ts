import { prisma } from '@shumai/db'
import { NotificationType } from '@shumai/db'
import { ApplicationFailure } from '@temporalio/activity'
import type { NotificationSettings } from '@shumai/dtos'
import { userMetadataService } from '@shumai/core/src/user-metadata/user-metadata'
import { emailService } from '../email'
import { logger } from '@shumai/core/src/logger'

const mentionRegex = /<@([^>]+)>/g

export interface CreateInSystemNotificationResult {
  created: boolean
  notificationId?: string
  recipientUserIds: string[]
  debounceSeconds?: number
}

export async function createInSystemNotificationActivity(
  payload: PrismaJson.NotificationTaskPayload,
): Promise<CreateInSystemNotificationResult> {
  // 1. Verify team exists (skip gracefully if team was deleted)
  const team = await prisma.team.findUnique({
    where: { id: payload.teamId },
    select: { id: true },
  })
  if (!team) {
    logger.warn({ teamId: payload.teamId }, 'Team not found for notification, skipping')
    return { created: false, recipientUserIds: [] }
  }

  let projectId = payload.projectId

  // 2. Resolve & verify Asset
  let assetId = payload.assetId
  if (assetId) {
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: { id: true, projectId: true },
    })
    if (!asset) {
      assetId = undefined
    } else if (!projectId && asset.projectId) {
      projectId = asset.projectId
    }
  }

  // 3. Resolve & verify KanbanTask
  let kanbanTaskId = payload.kanbanTaskId
  if (kanbanTaskId) {
    const task = await prisma.kanbanTask.findUnique({
      where: { id: kanbanTaskId },
      select: { id: true, projectId: true },
    })
    if (!task) {
      kanbanTaskId = undefined
    } else if (!projectId && task.projectId) {
      projectId = task.projectId
    }
  }

  // 4. Verify Project & check notification settings
  if (projectId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, enableNotification: true },
    })
    if (!project) {
      projectId = undefined
    } else if (!project.enableNotification) {
      logger.debug({ projectId }, 'Project notification disabled, skipping notification')
      return { created: false, recipientUserIds: [] }
    }
  }

  // 5. Verify Creator and Target User
  let creatorId = payload.creatorId
  if (creatorId) {
    const creator = await prisma.user.findUnique({
      where: { id: creatorId },
      select: { id: true },
    })
    if (!creator) {
      creatorId = undefined
    }
  }

  let targetUserId = payload.userId
  if (targetUserId) {
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    })
    if (!targetUser) {
      targetUserId = undefined
    }
  }

  // 6. Create primary notification record
  let primaryNotification
  try {
    primaryNotification = await prisma.notification.create({
      data: {
        type: payload.type,
        teamId: payload.teamId,
        projectId: projectId,
        creatorId: creatorId,
        assetId: assetId,
        taskId: payload.taskId,
        kanbanTaskId: kanbanTaskId,
        userId: targetUserId,
      },
    })
  } catch (err) {
    logger.error({ err, type: payload.type }, 'Failed to save primary notification')
    throw ApplicationFailure.create({
      message: `Failed to save primary notification: ${err instanceof Error ? err.message : String(err)}`,
      nonRetryable: true,
    })
  }

  // 5. Handle Mentions for Comment/Reply types
  const mentionedUserIds = new Set<string>()
  if (
    (payload.type === NotificationType.comment_created ||
      payload.type === NotificationType.reply_created ||
      payload.type === NotificationType.kanban_task_comment_created) &&
    payload.commentMessage
  ) {
    const matches = [...payload.commentMessage.matchAll(mentionRegex)]
    for (const match of matches) {
      if (match.length > 1) {
        const uid = match[1]
        if (uid !== payload.creatorId && !mentionedUserIds.has(uid)) {
          mentionedUserIds.add(uid)
          try {
            await prisma.notification.create({
              data: {
                type: NotificationType.mention,
                teamId: payload.teamId,
                projectId: projectId,
                creatorId: payload.creatorId,
                assetId: payload.assetId,
                taskId: payload.taskId,
                kanbanTaskId: payload.kanbanTaskId,
                userId: uid,
              },
            })
          } catch (err) {
            logger.warn({ err, userId: uid }, 'Failed to save mention notification')
          }
        }
      }
    }
  }

  // 6. Recipient Determination (mirrors getListWhere logic)
  const recipientIds = new Set<string>()

  if (payload.userId) {
    // Direct targeted notification
    recipientIds.add(payload.userId)
  }
  for (const mId of mentionedUserIds) {
    recipientIds.add(mId)
  }

  // If userId was not specified, this is a broadcast event to eligible team/project members
  if (!payload.userId) {
    const members = await prisma.teamMember.findMany({
      where: {
        teamId: payload.teamId,
        ...(payload.creatorId ? { userId: { not: payload.creatorId } } : {}),
      },
      include: {
        projectMembers: true,
      },
    })

    for (const member of members) {
      // If member scope is project, they must belong to this project
      if (member.scope === 'project' && projectId) {
        const belongsToProject = member.projectMembers.some((pm) => pm.projectId === projectId)
        if (!belongsToProject) {
          continue
        }
      }

      // Check member's notification settings
      const settingsMeta = await userMetadataService.getMetadata(
        member.userId,
        payload.teamId,
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
            kanbanTasks: true,
            kanbanComments: true,
          }

      let isAllowed: boolean
      switch (payload.type) {
        case NotificationType.comment_created:
          isAllowed = settings.comments ?? true
          break
        case NotificationType.reply_created:
          isAllowed = settings.replies ?? true
          break
        case NotificationType.mention:
          isAllowed = settings.mentions ?? true
          break
        case NotificationType.successful_file_uploaded:
          if (member.userId === payload.creatorId) {
            isAllowed = settings.yourUploads ?? false
          } else {
            isAllowed = settings.otherUploads ?? true
          }
          break
        case NotificationType.metadata_field_updated_status:
          isAllowed = settings.statusUpdates ?? true
          break
        case NotificationType.kanban_task_created:
        case NotificationType.kanban_task_assigned:
        case NotificationType.kanban_task_status_updated:
        case NotificationType.kanban_task_updated:
        case NotificationType.kanban_task_deleted:
          isAllowed = settings.kanbanTasks ?? true
          break
        case NotificationType.kanban_task_comment_created:
          isAllowed = settings.kanbanComments ?? true
          break
        case NotificationType.new_user_join_team:
        case NotificationType.new_user_join_project:
          isAllowed = true
          break
        default:
          isAllowed = true
      }

      if (isAllowed) {
        recipientIds.add(member.userId)
      }
    }
  }

  // Remove creator if present
  if (payload.creatorId) {
    recipientIds.delete(payload.creatorId)
  }

  let debounceSeconds = 0
  if (payload.type === NotificationType.successful_file_uploaded) {
    const emailSettings = await emailService.getEmailSettings(payload.teamId)
    if (emailSettings.enabled) {
      debounceSeconds = emailSettings.uploadDebounceSeconds ?? 0
    }
  }

  return {
    created: true,
    notificationId: primaryNotification.id,
    recipientUserIds: Array.from(recipientIds),
    debounceSeconds,
  }
}

export interface SendEmailNotificationParams {
  payload: PrismaJson.NotificationTaskPayload
  recipientUserIds: string[]
  notificationId?: string
}

export interface SendEmailNotificationResult {
  sentCount: number
  skipped?: boolean
  reason?: string
}

export async function sendEmailNotificationActivity(
  params: SendEmailNotificationParams,
): Promise<SendEmailNotificationResult> {
  const { payload, recipientUserIds } = params

  if (recipientUserIds.length === 0) {
    logger.debug({ payload }, 'No email recipients found, skipping email delivery')
    return { sentCount: 0, skipped: true, reason: 'no_recipients' }
  }

  const emailSettings = await emailService.getEmailSettings(payload.teamId)
  if (!emailSettings.enabled) {
    logger.debug(
      { teamId: payload.teamId },
      'Team email notifications disabled, skipping email delivery',
    )
    return { sentCount: 0, skipped: true, reason: 'email_disabled' }
  }

  if (!emailSettings.host || !emailSettings.from) {
    logger.warn(
      { teamId: payload.teamId },
      'SMTP host or from address not configured, skipping email delivery',
    )
    return { sentCount: 0, skipped: true, reason: 'smtp_not_configured' }
  }

  // Query Context Information for email rendering
  const [team, creator, project, asset, kanbanTask] = await Promise.all([
    prisma.team.findUnique({ where: { id: payload.teamId }, select: { id: true, name: true } }),
    payload.creatorId
      ? prisma.user.findUnique({
          where: { id: payload.creatorId },
          select: { id: true, name: true },
        })
      : null,
    payload.projectId
      ? prisma.project.findUnique({
          where: { id: payload.projectId },
          select: { id: true, name: true },
        })
      : null,
    payload.assetId
      ? prisma.asset.findUnique({
          where: { id: payload.assetId },
          select: { id: true, name: true },
        })
      : null,
    payload.kanbanTaskId
      ? prisma.kanbanTask.findUnique({
          where: { id: payload.kanbanTaskId },
          select: { id: true, title: true },
        })
      : null,
  ])

  let fileCount: number | undefined
  let fileNames: string[] | undefined

  // For bulk file uploads, check recent uploads within debounce window
  if (
    payload.type === NotificationType.successful_file_uploaded &&
    payload.projectId &&
    emailSettings.uploadDebounceSeconds &&
    emailSettings.uploadDebounceSeconds > 0
  ) {
    const windowStart = new Date(Date.now() - emailSettings.uploadDebounceSeconds * 1000)
    const recentAssets = await prisma.asset.findMany({
      where: {
        projectId: payload.projectId,
        ...(payload.creatorId ? { creatorId: payload.creatorId } : {}),
        createdAt: { gte: windowStart },
      },
      select: { name: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    if (recentAssets.length > 1) {
      fileCount = recentAssets.length
      fileNames = recentAssets.map((a) => a.name)
    }
  }

  const emailContext = {
    type: payload.type,
    creatorName: creator?.name || 'Someone',
    teamName: team?.name || 'Team',
    teamId: payload.teamId,
    projectName: project?.name,
    projectId: payload.projectId,
    assetName: asset?.name,
    assetId: payload.assetId,
    kanbanTaskTitle: kanbanTask?.title,
    kanbanTaskId: payload.kanbanTaskId,
    commentMessage: payload.commentMessage,
    fileCount,
    fileNames,
  }

  const { subject, html, text } = emailService.renderNotificationEmail(emailContext)

  // Fetch recipient users and their emails
  const users = await prisma.user.findMany({
    where: {
      id: { in: recipientUserIds },
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  })

  let sentCount = 0

  for (const user of users) {
    if (!user.email) continue
    try {
      await emailService.sendMail(emailSettings, {
        to: user.email,
        subject,
        html,
        text,
      })
      sentCount++
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      const isAuthError =
        errMsg.toLowerCase().includes('auth') ||
        errMsg.toLowerCase().includes('535') ||
        errMsg.toLowerCase().includes('invalid login') ||
        errMsg.toLowerCase().includes('username and password not accepted')

      logger.error(
        { to: user.email, err: errMsg, isAuthError },
        'Failed to deliver notification email',
      )

      if (isAuthError) {
        throw ApplicationFailure.create({
          message: `Fatal SMTP authentication failure: ${errMsg}`,
          nonRetryable: true,
        })
      }
      // Re-throw retryable error so Temporal / executor can retry transient network issues
      throw err
    }
  }

  return { sentCount }
}
