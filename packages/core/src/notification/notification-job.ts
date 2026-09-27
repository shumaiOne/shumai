import { prisma, NotificationType, NotificationEmailStatus } from '@shumai/db'
import { emailService, getNotificationBatchGroupKey } from '@shumai/core/src/notification/email'
import type { BatchedNotificationItem, EmailAttachment } from '@shumai/core/src/notification/email'
import { userMetadataService } from '@shumai/core/src/user-metadata/user-metadata'
import { s3Service } from '@shumai/core/src/s3/s3'
import { logger } from '@shumai/core/src/logger'
import type { NotificationSettings } from '@shumai/dtos'
import '@shumai/db/src/prisma-json-types'

function getExtensionFromMime(mime?: string): string {
  if (!mime) return 'jpg'
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('gif')) return 'gif'
  if (mime.includes('svg')) return 'svg'
  return 'jpg'
}

export class NotificationJobService {
  private isRunning = false
  private timer: NodeJS.Timeout | null = null
  private isProcessing = false

  start(initialDelayMs = 5000, intervalMs = 3 * 60 * 1000): void {
    if (this.isRunning) return
    this.isRunning = true
    logger.info('Starting notification email background job')

    const run = async () => {
      if (!this.isRunning) return
      try {
        await this.processPendingNotifications()
      } catch (err) {
        logger.error(
          { err: err instanceof Error ? err.message : String(err) },
          'Error in notification email background job',
        )
      }

      if (this.isRunning) {
        this.timer = setTimeout(run, intervalMs)
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
    logger.info('Stopped notification email background job')
  }

  async processPendingNotifications(limit = 500): Promise<number> {
    if (this.isProcessing) {
      logger.debug('Notification job turn already in progress, skipping')
      return 0
    }

    this.isProcessing = true
    let batchIds: string[] = []

    try {
      // 1. Concurrency control: atomically lock up to limit pending notifications
      const locked = await prisma.$queryRaw<{ id: string }[]>`
        WITH candidates AS (
          SELECT id
          FROM notifications
          WHERE email_status = 'pending'::"NotificationEmailStatus"
          ORDER BY id ASC
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        )
        UPDATE notifications
        SET email_status = 'processing'::"NotificationEmailStatus", updated_at = NOW()
        FROM candidates
        WHERE notifications.id = candidates.id
        RETURNING notifications.id;
      `

      if (!locked || locked.length === 0) {
        return 0
      }

      batchIds = locked.map((r) => r.id)
      logger.info({ count: batchIds.length }, 'Picked up pending notifications for processing')

      // 2. Fetch full records with relations
      const notifications = await prisma.notification.findMany({
        where: { id: { in: batchIds } },
        include: {
          creator: { select: { id: true, name: true, image: true, type: true } },
          team: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
          asset: {
            select: {
              id: true,
              name: true,
              media: true,
              projectId: true,
              createdAt: true,
              project: { select: { id: true, name: true } },
            },
          },
          user: { select: { id: true, name: true, email: true, type: true } },
          kanbanTask: { select: { id: true, title: true, projectId: true } },
        },
        orderBy: { id: 'asc' },
      })

      // 3. Group notifications by teamId
      const byTeam = new Map<string, typeof notifications>()
      for (const n of notifications) {
        const list = byTeam.get(n.teamId)
        if (list) {
          list.push(n)
        } else {
          byTeam.set(n.teamId, [n])
        }
      }

      // 4. Process each team
      for (const [teamId, teamNotifs] of byTeam) {
        const emailSettings = await emailService.getEmailSettings(teamId)
        if (!emailSettings.enabled || !emailSettings.host || !emailSettings.from) {
          logger.debug(
            { teamId },
            'Team email notifications disabled or unconfigured, skipping delivery',
          )
          continue
        }

        // Fetch team members excluding AI agents
        const members = await prisma.teamMember.findMany({
          where: {
            teamId,
            user: {
              type: { not: 'agent' },
              agent: null,
            },
          },
          include: {
            user: { select: { id: true, name: true, email: true, type: true } },
            projectMembers: { select: { projectId: true } },
          },
        })

        const avatarCache = new Map<
          string,
          { cidUrl: string; attachment: EmailAttachment } | null
        >()
        const thumbCache = new Map<string, { cidUrl: string; attachment: EmailAttachment } | null>()
        const cidAttachmentMap = new Map<string, EmailAttachment>()

        const resolveAvatar = async (
          creatorId?: string | null,
          image?: string | null,
        ): Promise<string | undefined> => {
          if (!image) return undefined
          if (creatorId && avatarCache.has(creatorId)) {
            const cached = avatarCache.get(creatorId)
            return cached ? cached.cidUrl : undefined
          }

          const cid = `avatar-${creatorId || Math.random().toString(36).slice(2)}@shumai.internal`
          const cidUrl = `cid:${cid}`

          try {
            if (image.startsWith('http://') || image.startsWith('https://')) {
              const res = await fetch(image, { signal: AbortSignal.timeout(5000) })
              if (res.ok) {
                const arrayBuffer = await res.arrayBuffer()
                const buffer = Buffer.from(arrayBuffer)
                const contentType = res.headers.get('content-type') || 'image/jpeg'
                const ext = getExtensionFromMime(contentType)
                const resolved = {
                  cidUrl,
                  attachment: {
                    filename: `avatar-${creatorId || 'user'}.${ext}`,
                    content: buffer,
                    cid,
                    contentType,
                  },
                }
                if (creatorId) avatarCache.set(creatorId, resolved)
                cidAttachmentMap.set(cidUrl, resolved.attachment)
                return cidUrl
              }
            } else {
              const bucket = process.env.S3_BUCKET || 'shumai'
              const obj = await s3Service.getObject(bucket, image)
              if (obj && obj.buffer && obj.buffer.length > 0) {
                const contentType = obj.contentType || 'image/jpeg'
                const ext = getExtensionFromMime(contentType)
                const resolved = {
                  cidUrl,
                  attachment: {
                    filename: `avatar-${creatorId || 'user'}.${ext}`,
                    content: obj.buffer,
                    cid,
                    contentType,
                  },
                }
                if (creatorId) avatarCache.set(creatorId, resolved)
                cidAttachmentMap.set(cidUrl, resolved.attachment)
                return cidUrl
              }
            }
          } catch (err) {
            logger.debug(
              { err: err instanceof Error ? err.message : String(err), image, creatorId },
              'Failed to resolve avatar image for inline email attachment',
            )
          }

          if (creatorId) avatarCache.set(creatorId, null)
          return undefined
        }

        const resolveThumbnail = async (
          assetId?: string | null,
          media?: unknown,
        ): Promise<string | undefined> => {
          if (!assetId || !media) return undefined
          if (thumbCache.has(assetId)) {
            const cached = thumbCache.get(assetId)
            return cached ? cached.cidUrl : undefined
          }

          const m = media as PrismaJson.MediaInfo | null
          const key = m?.thumbnail?.key || m?.poster?.key
          if (!key) return undefined

          const cid = `thumb-${assetId}@shumai.internal`
          const cidUrl = `cid:${cid}`

          try {
            const bucket = process.env.S3_BUCKET || 'shumai'
            const obj = await s3Service.getObject(bucket, key)
            if (obj && obj.buffer && obj.buffer.length > 0) {
              const contentType = obj.contentType || 'image/jpeg'
              const ext = getExtensionFromMime(contentType)
              const resolved = {
                cidUrl,
                attachment: {
                  filename: `thumb-${assetId}.${ext}`,
                  content: obj.buffer,
                  cid,
                  contentType,
                },
              }
              thumbCache.set(assetId, resolved)
              cidAttachmentMap.set(cidUrl, resolved.attachment)
              return cidUrl
            }
          } catch (err) {
            logger.debug(
              { err: err instanceof Error ? err.message : String(err), assetId, key },
              'Failed to resolve thumbnail image for inline email attachment',
            )
          }

          thumbCache.set(assetId, null)
          return undefined
        }

        const userItemsMap = new Map<
          string,
          { user: (typeof members)[0]['user']; items: BatchedNotificationItem[] }
        >()

        for (const member of members) {
          if (!member.user.email) continue
          if (
            member.user.type === 'agent' ||
            member.user.email.endsWith('@shumai.ai') ||
            member.user.email.startsWith('agent-')
          ) {
            continue
          }

          const settingsMeta = await userMetadataService.getMetadata(
            member.userId,
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
                kanbanTasks: true,
                kanbanComments: true,
              }

          for (const n of teamNotifs) {
            // Actor check (do not notify self unless it's their upload and yourUploads is enabled)
            if (n.creatorId === member.userId) {
              if (n.type !== NotificationType.successful_file_uploaded || !settings.yourUploads) {
                continue
              }
            }

            // Targeted notification check
            if (n.userId && n.userId !== member.userId) {
              continue
            }

            // Project scope check
            if (member.scope === 'project' && n.projectId) {
              if (n.type !== NotificationType.mention && n.userId !== member.userId) {
                const inProject = member.projectMembers.some((pm) => pm.projectId === n.projectId)
                if (!inProject) continue
              }
            }

            // Settings preference check
            let allowed = false
            switch (n.type) {
              case NotificationType.comment_created:
                allowed = settings.comments ?? true
                break
              case NotificationType.reply_created:
                allowed = settings.replies ?? true
                break
              case NotificationType.mention:
                allowed = settings.mentions ?? true
                break
              case NotificationType.successful_file_uploaded:
                allowed =
                  member.userId === n.creatorId
                    ? (settings.yourUploads ?? false)
                    : (settings.otherUploads ?? true)
                break
              case NotificationType.metadata_field_updated_status:
                allowed = settings.statusUpdates ?? true
                break
              case NotificationType.kanban_task_created:
              case NotificationType.kanban_task_assigned:
              case NotificationType.kanban_task_status_updated:
              case NotificationType.kanban_task_updated:
              case NotificationType.kanban_task_deleted:
                allowed = settings.kanbanTasks ?? true
                break
              case NotificationType.kanban_task_comment_created:
                allowed = settings.kanbanComments ?? true
                break
              case NotificationType.new_user_join_team:
              case NotificationType.new_user_join_project:
                allowed = true
                break
              default:
                allowed = true
                break
            }

            if (!allowed) continue

            const creatorAvatarUrl = await resolveAvatar(n.creatorId, n.creator?.image)
            const assetThumbnailUrl = await resolveThumbnail(n.assetId, n.asset?.media)

            const item: BatchedNotificationItem = {
              id: n.id,
              type: n.type || NotificationType.successful_file_uploaded,
              creatorName: n.creator?.name || 'Someone',
              creatorAvatarUrl,
              teamId: n.teamId,
              teamName: n.team?.name || 'Team',
              projectId: n.projectId || n.asset?.projectId || undefined,
              projectName: n.project?.name || n.asset?.project?.name || undefined,
              assetId: n.assetId || undefined,
              assetName: n.asset?.name || undefined,
              assetThumbnailUrl,
              kanbanTaskId: n.kanbanTaskId || undefined,
              kanbanTaskTitle: n.kanbanTask?.title || undefined,
              uploadTime: n.asset?.createdAt || n.createdAt,
              createdAt: n.createdAt,
            }

            let entry = userItemsMap.get(member.userId)
            if (!entry) {
              entry = { user: member.user, items: [] }
              userItemsMap.set(member.userId, entry)
            }
            entry.items.push(item)
          }
        }

        // Deliver batched email to each user with pending items
        for (const [userId, { user, items }] of userItemsMap) {
          if (items.length === 0 || !user.email) continue
          try {
            const rendered = emailService.renderBatchedNotificationEmail({
              teamId,
              teamName: teamNotifs[0].team?.name || 'Team',
              recipientName: user.name || 'Member',
              items,
            })
            // Collect attachments for this email based on rendered items
            const attachmentsMap = new Map<string, EmailAttachment>()

            // Group items exactly as renderBatchedNotificationEmail does
            const groups = new Map<string, BatchedNotificationItem[]>()
            for (const item of items) {
              const key = getNotificationBatchGroupKey(item)
              const list = groups.get(key)
              if (list) {
                list.push(item)
              } else {
                groups.set(key, [item])
              }
            }

            for (const [, cluster] of groups) {
              const first = cluster[0]
              if (first.creatorAvatarUrl) {
                const att = cidAttachmentMap.get(first.creatorAvatarUrl)
                if (att?.cid) attachmentsMap.set(att.cid, att)
              }

              if (cluster.length <= 3) {
                // Detailed rows: individual avatars and thumbnails are rendered
                for (const item of cluster) {
                  if (item.creatorAvatarUrl) {
                    const att = cidAttachmentMap.get(item.creatorAvatarUrl)
                    if (att?.cid) attachmentsMap.set(att.cid, att)
                  }
                  if (item.assetThumbnailUrl) {
                    const att = cidAttachmentMap.get(item.assetThumbnailUrl)
                    if (att?.cid) attachmentsMap.set(att.cid, att)
                  }
                }
              }
              // If cluster.length > 3, thumbnails are not rendered, so we do not attach them
            }

            const attachments = Array.from(attachmentsMap.values())

            await emailService.sendMail(emailSettings, {
              to: user.email,
              subject: rendered.subject,
              html: rendered.html,
              text: rendered.text,
              attachments: attachments.length > 0 ? attachments : undefined,
            })
          } catch (err) {
            logger.error(
              {
                userId,
                email: user.email,
                err: err instanceof Error ? err.message : String(err),
              },
              'Failed to deliver batched notification email to user',
            )
          }
        }
      }

      // 5. Update batch status to processed
      await prisma.notification.updateMany({
        where: { id: { in: batchIds } },
        data: { emailStatus: NotificationEmailStatus.processed },
      })

      return batchIds.length
    } catch (err) {
      logger.error(
        { err: err instanceof Error ? err.message : String(err), batchCount: batchIds.length },
        'Unexpected failure in processPendingNotifications',
      )
      if (batchIds.length > 0) {
        // Mark as processed so subsequent turns aren't permanently blocked
        await prisma.notification
          .updateMany({
            where: { id: { in: batchIds } },
            data: { emailStatus: NotificationEmailStatus.processed },
          })
          .catch((cleanErr) =>
            logger.error({ cleanErr }, 'Failed to mark notifications processed on error'),
          )
      }
      throw err
    } finally {
      this.isProcessing = false
    }
  }
}

export const notificationJobService = new NotificationJobService()
