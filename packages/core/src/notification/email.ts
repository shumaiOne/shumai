import nodemailer, { type Transporter } from 'nodemailer'
import { HTTPException } from 'hono/http-exception'
import { prisma, NotificationType } from '@shumai/db'
import type { EmailNotificationSettings, UpdateEmailNotificationSettings } from '@shumai/dtos'
import { logger } from '@shumai/core/src/logger'

export interface EmailAttachment {
  filename: string
  content?: Buffer | string
  path?: string
  cid?: string
  contentType?: string
}

export interface SendMailOptions {
  to: string
  subject: string
  html: string
  text: string
  attachments?: EmailAttachment[]
}

export interface NotificationEmailContext {
  type: NotificationType
  creatorName: string
  creatorAvatarUrl?: string
  teamName: string
  teamId: string
  projectName?: string
  projectId?: string
  assetName?: string
  assetId?: string
  kanbanTaskTitle?: string
  kanbanTaskId?: string
  commentMessage?: string
  mentionedUserNames?: Record<string, string>
  fileCount?: number
  fileNames?: string[]
  uploadTime?: string | Date
}

export interface BatchedNotificationItem {
  id: string
  type: NotificationType
  creatorName: string
  creatorAvatarUrl?: string
  teamId: string
  teamName: string
  projectId?: string
  projectName?: string
  assetId?: string
  assetName?: string
  assetThumbnailUrl?: string
  kanbanTaskId?: string
  kanbanTaskTitle?: string
  commentMessage?: string
  mentionedUserNames?: Record<string, string>
  uploadTime?: string | Date
  createdAt: Date
}

export interface BatchedEmailContext {
  teamId: string
  teamName: string
  recipientName: string
  items: BatchedNotificationItem[]
}

export function getNotificationBatchGroupKey(item: BatchedNotificationItem): string {
  return `${item.type}_${item.creatorName || ''}_${item.projectId || ''}_${item.teamId}`
}

export const DEFAULT_EMAIL_SETTINGS: EmailNotificationSettings = {
  enabled: false,
  host: '',
  port: 587,
  username: '',
  password: '',
  smtps: false,
  ignoreCert: false,
  from: '',
  replyTo: '',
}

export class EmailService {
  getBaseUrl(): string {
    const raw =
      process.env.APP_URL ||
      process.env.BETTER_AUTH_URL ||
      `http://localhost:${process.env.SHUMAI_SERVER_PORT || '3000'}`
    return raw.replace(/\/+$/, '')
  }

  createTransport(config: EmailNotificationSettings): Transporter {
    return nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.smtps,
      tls: {
        rejectUnauthorized: !config.ignoreCert,
      },
      auth:
        config.username || config.password
          ? {
              user: config.username,
              pass: config.password,
            }
          : undefined,
      connectionTimeout: 10000,
    })
  }

  async verifySmtp(config: EmailNotificationSettings): Promise<boolean> {
    const transport = this.createTransport(config)
    try {
      await transport.verify()
      return true
    } finally {
      transport.close()
    }
  }

  async sendMail(
    config: EmailNotificationSettings,
    options: SendMailOptions,
  ): Promise<{ messageId: string }> {
    const transport = this.createTransport(config)
    try {
      logger.debug(
        { to: options.to, from: config.from, subject: options.subject },
        'Sending email via nodemailer',
      )
      const info = await transport.sendMail({
        from: config.from,
        replyTo: config.replyTo || config.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
      })
      logger.info({ messageId: info.messageId, to: options.to }, 'Email sent successfully')
      return { messageId: info.messageId }
    } finally {
      transport.close()
    }
  }

  async getEmailSettings(teamId: string): Promise<EmailNotificationSettings> {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { settings: true },
    })
    if (!team) {
      throw new HTTPException(404, { message: 'Team not found' })
    }

    const saved = team.settings?.emailNotification
    return {
      enabled: saved?.enabled ?? DEFAULT_EMAIL_SETTINGS.enabled,
      host: saved?.host ?? DEFAULT_EMAIL_SETTINGS.host,
      port: saved?.port ?? DEFAULT_EMAIL_SETTINGS.port,
      username: saved?.username ?? DEFAULT_EMAIL_SETTINGS.username,
      password: saved?.password ?? DEFAULT_EMAIL_SETTINGS.password,
      smtps: saved?.smtps ?? DEFAULT_EMAIL_SETTINGS.smtps,
      ignoreCert: saved?.ignoreCert ?? DEFAULT_EMAIL_SETTINGS.ignoreCert,
      from: saved?.from ?? DEFAULT_EMAIL_SETTINGS.from,
      replyTo: saved?.replyTo ?? DEFAULT_EMAIL_SETTINGS.replyTo,
    }
  }

  async updateEmailSettings(
    teamId: string,
    input: UpdateEmailNotificationSettings,
  ): Promise<EmailNotificationSettings> {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { settings: true },
    })
    if (!team) {
      throw new HTTPException(404, { message: 'Team not found' })
    }

    const currentSettings = (team.settings || {}) as PrismaJson.Settings
    const existingEmailConfig = currentSettings.emailNotification

    // If password is not provided or empty, retain existing password
    const password =
      input.password !== undefined && input.password !== ''
        ? input.password
        : existingEmailConfig?.password || ''

    const updatedEmailConfig: PrismaJson.EmailNotificationSettings = {
      enabled: input.enabled,
      host: input.host,
      port: input.port,
      username: input.username || '',
      password,
      smtps: input.smtps,
      ignoreCert: input.ignoreCert,
      from: input.from,
      replyTo: input.replyTo || '',
    }

    currentSettings.emailNotification = updatedEmailConfig

    const updatedTeam = await prisma.team.update({
      where: { id: teamId },
      data: { settings: currentSettings as PrismaJson.Settings },
      select: { settings: true },
    })

    return updatedTeam.settings?.emailNotification as EmailNotificationSettings
  }

  async sendTestEmail(
    teamId: string,
    currentUser: { id: string; email: string; name: string },
    overrides?: Partial<EmailNotificationSettings>,
  ): Promise<{ success: boolean; messageId: string }> {
    const saved = await this.getEmailSettings(teamId)
    const effectiveConfig: EmailNotificationSettings = {
      ...saved,
      ...overrides,
      // If override password is empty, fall back to saved
      password:
        overrides?.password !== undefined && overrides.password !== ''
          ? overrides.password
          : saved.password,
    }

    if (!effectiveConfig.host) {
      throw new HTTPException(400, { message: 'SMTP host is required' })
    }
    if (!effectiveConfig.from) {
      throw new HTTPException(400, { message: 'From address is required' })
    }

    try {
      await this.verifySmtp(effectiveConfig)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      logger.warn({ teamId, err: errMsg }, 'SMTP verification failed during test email')
      throw new HTTPException(400, { message: `SMTP verification failed: ${errMsg}` })
    }

    const baseUrl = this.getBaseUrl()
    const subject = 'Test email from Shumai'
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Test Email from Shumai</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 24px; color: #111827; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; padding: 32px; }
    .header { font-size: 20px; font-weight: 700; margin-bottom: 16px; color: #111827; }
    .content { font-size: 14px; line-height: 1.6; color: #4b5563; margin-bottom: 24px; }
    .badge { display: inline-block; background-color: #ecfdf5; color: #065f46; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 9999px; margin-bottom: 16px; }
    .footer { font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 16px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">Shumai Notification System</div>
    <div class="badge">SMTP Verified</div>
    <div class="content">
      <p>Hello ${escapeHtml(currentUser.name || 'Admin')},</p>
      <p>This is a test email confirming that your SMTP server settings are correctly configured for team notifications in Shumai.</p>
      <p>Notifications for new comments, mentions, uploads, and Kanban tasks will now be delivered via this email service.</p>
    </div>
    <div class="footer">
      Sent from Shumai at <a href="${baseUrl}" style="color: #6366f1; text-decoration: none;">${baseUrl}</a>
    </div>
  </div>
</body>
</html>
`.trim()

    const text = `
Shumai Notification System - Test Email

Hello ${currentUser.name || 'Admin'},

This is a test email confirming that your SMTP server settings are correctly configured for team notifications in Shumai.

Sent from Shumai at ${baseUrl}
`.trim()

    try {
      const res = await this.sendMail(effectiveConfig, {
        to: currentUser.email,
        subject,
        html,
        text,
      })
      return { success: true, messageId: res.messageId }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      logger.error({ teamId, err: errMsg }, 'Failed to send test email')
      throw new HTTPException(400, { message: `Failed to send test email: ${errMsg}` })
    }
  }

  renderNotificationEmail(ctx: NotificationEmailContext): {
    subject: string
    html: string
    text: string
  } {
    const baseUrl = this.getBaseUrl()
    let actionUrl = baseUrl
    let actionText = 'View in Shumai'

    if (ctx.projectId && ctx.assetId) {
      actionUrl = `${baseUrl}/projects/${ctx.projectId}/files/${ctx.assetId}`
      actionText = 'View Asset'
    } else if (ctx.projectId) {
      actionUrl = `${baseUrl}/projects/${ctx.projectId}`
      actionText = 'View Project'
    } else if (ctx.teamId && ctx.kanbanTaskId) {
      actionUrl = `${baseUrl}/teams/${ctx.teamId}/kanban?taskId=${ctx.kanbanTaskId}`
      actionText = 'View Task'
    } else if (ctx.teamId) {
      actionUrl = `${baseUrl}/teams/${ctx.teamId}`
      actionText = 'Open Team'
    }

    let subject = '[Shumai] Notification'
    let headline = 'You have a new notification'
    let detail = ''

    const actor = ctx.creatorName || 'Someone'
    const actorInitial = (actor.trim()[0] || 'U').toUpperCase()
    const formattedUploadTime = formatUploadTime(ctx.uploadTime)

    let commentMessage = ctx.commentMessage
    if (commentMessage) {
      commentMessage = commentMessage.replace(/<@([^>]+)>/g, (match, uid) => {
        const name = ctx.mentionedUserNames?.[uid]
        return name ? `@${name}` : `@${uid}`
      })
    }

    switch (ctx.type) {
      case NotificationType.comment_created: {
        const target = ctx.assetName ? `"${ctx.assetName}"` : 'an asset'
        subject = `[Shumai] ${actor} commented on ${target}`
        headline = `${actor} left a comment`
        detail = commentMessage ? `"${commentMessage}"` : `New comment on ${target}`
        break
      }
      case NotificationType.reply_created: {
        const target = ctx.assetName ? `"${ctx.assetName}"` : 'an asset'
        subject = `[Shumai] ${actor} replied to your comment on ${target}`
        headline = `${actor} replied to your comment`
        detail = commentMessage ? `"${commentMessage}"` : `Reply on ${target}`
        break
      }
      case NotificationType.mention: {
        subject = `[Shumai] ${actor} mentioned you`
        headline = `${actor} mentioned you`
        detail = commentMessage ? `"${commentMessage}"` : 'You were mentioned in a comment'
        break
      }
      case NotificationType.successful_file_uploaded: {
        const target = ctx.assetName ? `"${ctx.assetName}"` : 'a file'
        const projectInfo = ctx.projectName ? ` to ${ctx.projectName}` : ''
        if (ctx.fileCount && ctx.fileCount > 1) {
          subject = `[Shumai] ${actor} uploaded ${ctx.fileCount} files${projectInfo}`
          headline = `${actor} uploaded ${ctx.fileCount} new files${projectInfo}`
          let filesSummary: string
          if (ctx.fileNames && ctx.fileNames.length > 0) {
            const previewList = ctx.fileNames.slice(0, 3).join(', ')
            const remaining = ctx.fileNames.length - 3
            filesSummary = remaining > 0 ? `${previewList}, and ${remaining} more` : previewList
          } else {
            filesSummary = `${ctx.fileCount} new files were uploaded`
          }
          const details: string[] = []
          if (ctx.projectName) details.push(`Project: ${ctx.projectName}`)
          if (formattedUploadTime) details.push(`Uploaded at: ${formattedUploadTime}`)
          details.push(`Files: ${filesSummary}`)
          detail = details.join('\n')
        } else {
          subject = `[Shumai] ${actor} uploaded ${target}${projectInfo}`
          headline = `${actor} uploaded ${target}${projectInfo}`
          const details: string[] = []
          if (ctx.assetName) details.push(`Asset: ${ctx.assetName}`)
          if (ctx.projectName) details.push(`Project: ${ctx.projectName}`)
          if (formattedUploadTime) details.push(`Uploaded at: ${formattedUploadTime}`)
          detail = details.join('\n')
        }
        break
      }
      case NotificationType.metadata_field_updated_status: {
        const target = ctx.assetName ? `"${ctx.assetName}"` : 'an asset'
        subject = `[Shumai] ${actor} updated status of ${target}`
        headline = `${actor} updated status of ${target}`
        detail = `Status update on ${target}`
        break
      }
      case NotificationType.new_user_join_team: {
        subject = `[Shumai] ${actor} joined ${ctx.teamName}`
        headline = `${actor} joined the team`
        detail = `${actor} is now a member of ${ctx.teamName}`
        break
      }
      case NotificationType.new_user_join_project: {
        const project = ctx.projectName || 'a project'
        subject = `[Shumai] ${actor} joined project ${project}`
        headline = `${actor} joined project ${project}`
        detail = `${actor} is now a member of ${project}`
        break
      }
      case NotificationType.kanban_task_created: {
        const task = ctx.kanbanTaskTitle ? `"${ctx.kanbanTaskTitle}"` : 'a task'
        subject = `[Shumai] ${actor} created task ${task}`
        headline = `${actor} created task ${task}`
        detail = commentMessage || `Task ${task} was created`
        break
      }
      case NotificationType.kanban_task_assigned: {
        const task = ctx.kanbanTaskTitle ? `"${ctx.kanbanTaskTitle}"` : 'a task'
        subject = `[Shumai] ${actor} assigned you to task ${task}`
        headline = `${actor} assigned you to task ${task}`
        detail = `You have been assigned to ${task}`
        break
      }
      case NotificationType.kanban_task_status_updated: {
        const task = ctx.kanbanTaskTitle ? `"${ctx.kanbanTaskTitle}"` : 'a task'
        subject = `[Shumai] ${actor} updated status of task ${task}`
        headline = `${actor} updated status of ${task}`
        detail = commentMessage || `Status changed for ${task}`
        break
      }
      case NotificationType.kanban_task_updated: {
        const task = ctx.kanbanTaskTitle ? `"${ctx.kanbanTaskTitle}"` : 'a task'
        subject = `[Shumai] ${actor} updated task ${task}`
        headline = `${actor} updated task ${task}`
        detail = commentMessage || `Task ${task} was updated`
        break
      }
      case NotificationType.kanban_task_deleted: {
        const task = ctx.kanbanTaskTitle ? `"${ctx.kanbanTaskTitle}"` : 'a task'
        subject = `[Shumai] ${actor} deleted task ${task}`
        headline = `${actor} deleted task ${task}`
        detail = `Task ${task} was deleted`
        break
      }
      case NotificationType.kanban_task_comment_created: {
        const task = ctx.kanbanTaskTitle ? `"${ctx.kanbanTaskTitle}"` : 'a task'
        subject = `[Shumai] ${actor} commented on task ${task}`
        headline = `${actor} commented on task ${task}`
        detail = commentMessage ? `"${commentMessage}"` : `New comment on ${task}`
        break
      }
    }

    const avatarHtml = ctx.creatorAvatarUrl
      ? `<img src="${escapeHtml(ctx.creatorAvatarUrl)}" alt="${escapeHtml(actor)}" width="36" height="36" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; display: block; border: 1px solid #e5e7eb;" />`
      : `<table cellpadding="0" cellspacing="0" border="0" style="width: 36px; height: 36px; border-radius: 50%; background-color: #4f46e5; text-align: center;"><tr><td style="color: #ffffff; font-weight: 600; font-size: 14px; text-align: center; vertical-align: middle;">${escapeHtml(actorInitial)}</td></tr></table>`

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(subject)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 24px; color: #111827; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; padding: 32px; }
    .header { font-size: 18px; font-weight: 700; margin-bottom: 8px; color: #111827; }
    .content { font-size: 14px; line-height: 1.6; color: #374151; margin-bottom: 24px; }
    .detail-box { background-color: #f3f4f6; border-left: 4px solid #4f46e5; padding: 12px 16px; border-radius: 4px; margin: 16px 0; font-size: 14px; color: #1f2937; white-space: pre-wrap; }
    .btn { display: inline-block; background-color: #4f46e5; color: #ffffff !important; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500; margin-top: 12px; }
    .footer { font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 16px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px;">
      <tr>
        <td style="vertical-align: middle; padding-right: 12px; width: 36px;">
          ${avatarHtml}
        </td>
        <td style="vertical-align: middle;">
          <div style="font-weight: 600; font-size: 15px; color: #111827; line-height: 1.2;">${escapeHtml(actor)}</div>
          ${formattedUploadTime ? `<div style="font-size: 12px; color: #6b7280; margin-top: 2px;">Uploaded at ${escapeHtml(formattedUploadTime)}</div>` : ''}
        </td>
      </tr>
    </table>
    <div class="header">${escapeHtml(headline)}</div>
    <div class="content">
      ${detail ? `<div class="detail-box">${escapeHtml(detail)}</div>` : ''}
      <a href="${actionUrl}" class="btn">${escapeHtml(actionText)}</a>
    </div>
    <div class="footer">
      Team: ${escapeHtml(ctx.teamName)} &bull; Sent from <a href="${baseUrl}" style="color: #6366f1; text-decoration: none;">Shumai</a>
    </div>
  </div>
</body>
</html>
`.trim()

    const text = `
${subject}

${headline}
${formattedUploadTime ? `Uploaded at: ${formattedUploadTime}\n` : ''}${detail ? `\n${detail}\n` : ''}
${actionText}: ${actionUrl}

Team: ${ctx.teamName}
`.trim()

    return { subject, html, text }
  }

  renderBatchedNotificationEmail(ctx: BatchedEmailContext): {
    subject: string
    html: string
    text: string
  } {
    const baseUrl = this.getBaseUrl()
    const teamUrl = `${baseUrl}/teams/${ctx.teamId}`

    if (ctx.items.length === 0) {
      return {
        subject: `[Shumai] Notifications in ${ctx.teamName}`,
        html: `<p>No new notifications.</p>`,
        text: `No new notifications.`,
      }
    }

    // Determine subject
    let subject = `[Shumai] ${ctx.items.length} new notifications in ${ctx.teamName}`
    if (ctx.items.length === 1) {
      const single = ctx.items[0]
      const actor = single.creatorName || 'Someone'
      const target = single.assetName ? `"${single.assetName}"` : 'a file'
      const projectInfo = single.projectName ? ` to ${single.projectName}` : ''
      switch (single.type) {
        case NotificationType.successful_file_uploaded:
          subject = `[Shumai] ${actor} uploaded ${target}${projectInfo}`
          break
        case NotificationType.comment_created:
          subject = `[Shumai] ${actor} commented on ${target}`
          break
        case NotificationType.reply_created:
          subject = `[Shumai] ${actor} replied to your comment on ${target}`
          break
        case NotificationType.mention:
          subject = `[Shumai] ${actor} mentioned you`
          break
        case NotificationType.kanban_task_assigned: {
          const task = single.kanbanTaskTitle ? `"${single.kanbanTaskTitle}"` : 'a task'
          subject = `[Shumai] ${actor} assigned you to task ${task}`
          break
        }
        case NotificationType.kanban_task_created: {
          const task = single.kanbanTaskTitle ? `"${single.kanbanTaskTitle}"` : 'a task'
          subject = `[Shumai] ${actor} created task ${task}`
          break
        }
        default:
          subject = `[Shumai] 1 new notification in ${ctx.teamName}`
          break
      }
    }

    // Group items: same type + actor + project
    const groups = new Map<string, BatchedNotificationItem[]>()
    for (const item of ctx.items) {
      const key = getNotificationBatchGroupKey(item)
      const list = groups.get(key)
      if (list) {
        list.push(item)
      } else {
        groups.set(key, [item])
      }
    }

    const htmlRows: string[] = []
    const textRows: string[] = []

    for (const [, cluster] of groups) {
      const first = cluster[0]
      const actor = first.creatorName || 'Someone'
      const avatarHtml = renderAvatarHtml(actor, first.creatorAvatarUrl)

      if (cluster.length <= 3) {
        // Render detailed individual rows
        for (const item of cluster) {
          const action = getItemAction(baseUrl, item)
          const timeStr = formatUploadTime(item.uploadTime || item.createdAt)
          const detail = getNotificationItemDetail(item)

          const thumbHtml = item.assetThumbnailUrl
            ? `<div style="margin-top: 8px;"><img src="${escapeHtml(item.assetThumbnailUrl)}" alt="${escapeHtml(item.assetName || 'Thumbnail')}" width="140" style="max-width: 140px; max-height: 90px; border-radius: 6px; border: 1px solid #e5e7eb; object-fit: cover; display: block;" /></div>`
            : ''

          htmlRows.push(
            `
            <div style="padding: 16px 0; border-bottom: 1px solid #f3f4f6;">
              <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                <tr>
                  <td style="vertical-align: top; width: 44px; padding-right: 12px;">
                    ${avatarHtml}
                  </td>
                  <td style="vertical-align: top;">
                    <div style="font-weight: 600; font-size: 14px; color: #111827;">${escapeHtml(actor)}</div>
                    <div style="font-size: 13px; color: #374151; margin-top: 2px;">${escapeHtml(detail.headline)}</div>
                    ${timeStr ? `<div style="font-size: 12px; color: #6b7280; margin-top: 2px;">${escapeHtml(timeStr)}</div>` : ''}
                    ${detail.message ? `<div style="background-color: #f9fafb; border-left: 3px solid #6366f1; padding: 8px 12px; border-radius: 4px; font-size: 13px; color: #4b5563; margin-top: 6px; white-space: pre-wrap;">${escapeHtml(detail.message)}</div>` : ''}
                    ${thumbHtml}
                    <div style="margin-top: 8px;">
                      <a href="${action.url}" style="display: inline-block; font-size: 12px; font-weight: 500; color: #4f46e5; text-decoration: none;">${escapeHtml(action.text)} &rarr;</a>
                    </div>
                  </td>
                </tr>
              </table>
            </div>
          `.trim(),
          )

          textRows.push(
            `- ${actor}: ${detail.headline}${timeStr ? ` (${timeStr})` : ''}${detail.message ? `\n  "${detail.message}"` : ''}\n  Link: ${action.url}`,
          )
        }
      } else {
        // Grouped summary row (count > 3, NO thumbnails)
        const count = cluster.length
        let summaryHeadline = `${actor} triggered ${count} updates`
        const projectName = first.projectName

        switch (first.type) {
          case NotificationType.successful_file_uploaded:
            summaryHeadline = `${actor} uploaded ${count} assets${projectName ? ` to ${projectName}` : ''}`
            break
          case NotificationType.comment_created:
            summaryHeadline = `${actor} left ${count} comments${projectName ? ` in ${projectName}` : ''}`
            break
          case NotificationType.reply_created:
            summaryHeadline = `${actor} replied ${count} times to your comments`
            break
          case NotificationType.mention:
            summaryHeadline = `${actor} mentioned you ${count} times`
            break
          case NotificationType.metadata_field_updated_status:
            summaryHeadline = `${actor} updated status of ${count} assets`
            break
          case NotificationType.kanban_task_created:
            summaryHeadline = `${actor} created ${count} tasks${projectName ? ` in ${projectName}` : ''}`
            break
          case NotificationType.kanban_task_assigned:
            summaryHeadline = `${actor} assigned you to ${count} tasks`
            break
          case NotificationType.kanban_task_status_updated:
            summaryHeadline = `${actor} updated status of ${count} tasks`
            break
          case NotificationType.kanban_task_updated:
            summaryHeadline = `${actor} updated ${count} tasks`
            break
          case NotificationType.kanban_task_comment_created:
            summaryHeadline = `${actor} commented on ${count} tasks`
            break
        }

        const latestTime = cluster.reduce((latest, it) => {
          const t = new Date(it.uploadTime || it.createdAt).getTime()
          return t > latest ? t : latest
        }, 0)
        const timeStr = latestTime > 0 ? formatUploadTime(new Date(latestTime)) : undefined
        const targetUrl = first.projectId ? `${baseUrl}/projects/${first.projectId}` : teamUrl

        htmlRows.push(
          `
          <div style="padding: 16px 0; border-bottom: 1px solid #f3f4f6;">
            <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
              <tr>
                <td style="vertical-align: top; width: 44px; padding-right: 12px;">
                  ${avatarHtml}
                </td>
                <td style="vertical-align: top;">
                  <div style="font-weight: 600; font-size: 14px; color: #111827;">${escapeHtml(summaryHeadline)}</div>
                  ${timeStr ? `<div style="font-size: 12px; color: #6b7280; margin-top: 2px;">Latest activity: ${escapeHtml(timeStr)}</div>` : ''}
                  <div style="margin-top: 8px;">
                    <a href="${targetUrl}" style="display: inline-block; font-size: 12px; font-weight: 500; color: #4f46e5; text-decoration: none;">View Project &rarr;</a>
                  </div>
                </td>
              </tr>
            </table>
          </div>
        `.trim(),
        )

        textRows.push(
          `- ${summaryHeadline}${timeStr ? ` (Latest: ${timeStr})` : ''}\n  Link: ${targetUrl}`,
        )
      }
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(subject)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 24px; color: #111827; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; padding: 32px; }
    .header { font-size: 18px; font-weight: 700; color: #111827; }
    .subtitle { font-size: 14px; color: #6b7280; margin-top: 4px; margin-bottom: 20px; }
    .btn { display: inline-block; background-color: #4f46e5; color: #ffffff !important; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500; margin-top: 20px; }
    .footer { font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 16px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">Shumai Notifications</div>
    <div class="subtitle">You have ${ctx.items.length} new update${ctx.items.length > 1 ? 's' : ''} in <strong>${escapeHtml(ctx.teamName)}</strong>:</div>
    <div>
      ${htmlRows.join('\n')}
    </div>
    <div style="text-align: center; margin-top: 20px;">
      <a href="${teamUrl}" class="btn">Open ${escapeHtml(ctx.teamName)}</a>
    </div>
    <div class="footer">
      Team: ${escapeHtml(ctx.teamName)} &bull; Sent from <a href="${baseUrl}" style="color: #6366f1; text-decoration: none;">Shumai</a>
    </div>
  </div>
</body>
</html>
`.trim()

    const text = `
Shumai Notifications

You have ${ctx.items.length} new update(s) in ${ctx.teamName}:

${textRows.join('\n\n')}

Open Team: ${teamUrl}
Sent from Shumai at ${baseUrl}
`.trim()

    return { subject, html, text }
  }
}

function getNotificationItemDetail(item: BatchedNotificationItem): {
  headline: string
  message?: string
} {
  const actor = item.creatorName || 'Someone'
  const asset = item.assetName ? `"${item.assetName}"` : 'an asset'
  const task = item.kanbanTaskTitle ? `"${item.kanbanTaskTitle}"` : 'a task'
  const project = item.projectName ? ` in ${item.projectName}` : ''

  let commentMessage = item.commentMessage
  if (commentMessage && item.mentionedUserNames) {
    commentMessage = commentMessage.replace(/<@([^>]+)>/g, (match, uid) => {
      const name = item.mentionedUserNames?.[uid]
      return name ? `@${name}` : `@${uid}`
    })
  }

  switch (item.type) {
    case NotificationType.successful_file_uploaded:
      return {
        headline: `Uploaded ${asset}${item.projectName ? ` to ${item.projectName}` : ''}`,
      }
    case NotificationType.comment_created:
      return {
        headline: `Commented on ${asset}${project}`,
        message: commentMessage,
      }
    case NotificationType.reply_created:
      return {
        headline: `Replied to your comment on ${asset}${project}`,
        message: commentMessage,
      }
    case NotificationType.mention:
      return {
        headline: `Mentioned you on ${item.kanbanTaskTitle ? `task ${task}` : asset}${project}`,
        message: commentMessage,
      }
    case NotificationType.metadata_field_updated_status:
      return {
        headline: `Updated status of ${asset}${project}`,
      }
    case NotificationType.kanban_task_created:
      return {
        headline: `Created task ${task}${project}`,
        message: commentMessage,
      }
    case NotificationType.kanban_task_assigned:
      return {
        headline: `Assigned you to task ${task}${project}`,
      }
    case NotificationType.kanban_task_status_updated:
      return {
        headline: `Updated status of task ${task}${project}`,
        message: commentMessage,
      }
    case NotificationType.kanban_task_updated:
      return {
        headline: `Updated task ${task}${project}`,
        message: commentMessage,
      }
    case NotificationType.kanban_task_deleted:
      return {
        headline: `Deleted task ${task}${project}`,
      }
    case NotificationType.kanban_task_comment_created:
      return {
        headline: `Commented on task ${task}${project}`,
        message: commentMessage,
      }
    case NotificationType.new_user_join_team:
      return {
        headline: `Joined the team ${item.teamName}`,
      }
    case NotificationType.new_user_join_project:
      return {
        headline: `Joined project ${item.projectName || 'a project'}`,
      }
    default:
      return {
        headline: `New activity from ${actor}`,
      }
  }
}

function getItemAction(
  baseUrl: string,
  item: BatchedNotificationItem,
): { url: string; text: string } {
  if (item.projectId && item.assetId) {
    return {
      url: `${baseUrl}/projects/${item.projectId}/files/${item.assetId}`,
      text: 'View Asset',
    }
  } else if (item.projectId) {
    return {
      url: `${baseUrl}/projects/${item.projectId}`,
      text: 'View Project',
    }
  } else if (item.teamId && item.kanbanTaskId) {
    return {
      url: `${baseUrl}/teams/${item.teamId}/kanban?taskId=${item.kanbanTaskId}`,
      text: 'View Task',
    }
  } else if (item.teamId) {
    return {
      url: `${baseUrl}/teams/${item.teamId}`,
      text: 'Open Team',
    }
  }
  return { url: baseUrl, text: 'Open Shumai' }
}

function renderAvatarHtml(actor: string, avatarUrl?: string): string {
  const actorInitial = (actor.trim()[0] || 'U').toUpperCase()
  if (avatarUrl) {
    return `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(actor)}" width="36" height="36" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; display: block; border: 1px solid #e5e7eb;" />`
  }
  return `<table cellpadding="0" cellspacing="0" border="0" style="width: 36px; height: 36px; border-radius: 50%; background-color: #4f46e5; text-align: center;"><tr><td style="color: #ffffff; font-weight: 600; font-size: 14px; text-align: center; vertical-align: middle;">${escapeHtml(actorInitial)}</td></tr></table>`
}

function formatUploadTime(time: string | Date | undefined): string | undefined {
  if (!time) return undefined
  if (time instanceof Date) {
    if (isNaN(time.getTime())) return undefined
    return (
      new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'UTC',
      }).format(time) + ' UTC'
    )
  }
  const parsed = new Date(time)
  if (!isNaN(parsed.getTime())) {
    return (
      new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'UTC',
      }).format(parsed) + ' UTC'
    )
  }
  return time
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export const emailService = new EmailService()
