import nodemailer, { type Transporter } from 'nodemailer'
import { HTTPException } from 'hono/http-exception'
import { prisma, NotificationType } from '@shumai/db'
import type { EmailNotificationSettings, UpdateEmailNotificationSettings } from '@shumai/dtos'
import { logger } from '@shumai/core/src/logger'

export interface SendMailOptions {
  to: string
  subject: string
  html: string
  text: string
}

export interface NotificationEmailContext {
  type: NotificationType
  creatorName: string
  teamName: string
  teamId: string
  projectName?: string
  projectId?: string
  assetName?: string
  assetId?: string
  kanbanTaskTitle?: string
  kanbanTaskId?: string
  commentMessage?: string
  fileCount?: number
  fileNames?: string[]
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
  uploadDebounceSeconds: 300,
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
      uploadDebounceSeconds:
        saved?.uploadDebounceSeconds ?? DEFAULT_EMAIL_SETTINGS.uploadDebounceSeconds,
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
      uploadDebounceSeconds:
        input.uploadDebounceSeconds ?? DEFAULT_EMAIL_SETTINGS.uploadDebounceSeconds,
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

    if (ctx.teamId) {
      if (ctx.projectId && ctx.assetId) {
        actionUrl = `${baseUrl}/teams/${ctx.teamId}/projects/${ctx.projectId}?assetId=${ctx.assetId}`
        actionText = 'View Asset'
      } else if (ctx.projectId) {
        actionUrl = `${baseUrl}/teams/${ctx.teamId}/projects/${ctx.projectId}`
        actionText = 'View Project'
      } else if (ctx.kanbanTaskId) {
        actionUrl = `${baseUrl}/teams/${ctx.teamId}?kanbanTaskId=${ctx.kanbanTaskId}`
        actionText = 'View Task'
      } else {
        actionUrl = `${baseUrl}/teams/${ctx.teamId}`
        actionText = 'Open Team'
      }
    }

    let subject = '[Shumai] Notification'
    let headline = 'You have a new notification'
    let detail = ''

    const actor = ctx.creatorName || 'Someone'

    switch (ctx.type) {
      case NotificationType.comment_created: {
        const target = ctx.assetName ? `"${ctx.assetName}"` : 'an asset'
        subject = `[Shumai] ${actor} commented on ${target}`
        headline = `${actor} left a comment`
        detail = ctx.commentMessage ? `"${ctx.commentMessage}"` : `New comment on ${target}`
        break
      }
      case NotificationType.reply_created: {
        const target = ctx.assetName ? `"${ctx.assetName}"` : 'an asset'
        subject = `[Shumai] ${actor} replied to your comment on ${target}`
        headline = `${actor} replied to your comment`
        detail = ctx.commentMessage ? `"${ctx.commentMessage}"` : `Reply on ${target}`
        break
      }
      case NotificationType.mention: {
        subject = `[Shumai] ${actor} mentioned you`
        headline = `${actor} mentioned you`
        detail = ctx.commentMessage ? `"${ctx.commentMessage}"` : 'You were mentioned in a comment'
        break
      }
      case NotificationType.successful_file_uploaded: {
        if (ctx.fileCount && ctx.fileCount > 1) {
          const projectInfo = ctx.projectName ? ` to ${ctx.projectName}` : ''
          subject = `[Shumai] ${actor} uploaded ${ctx.fileCount} files${projectInfo}`
          headline = `${actor} uploaded ${ctx.fileCount} new files${projectInfo}`
          if (ctx.fileNames && ctx.fileNames.length > 0) {
            const previewList = ctx.fileNames.slice(0, 3).join(', ')
            const remaining = ctx.fileNames.length - 3
            detail = remaining > 0 ? `${previewList}, and ${remaining} more` : previewList
          } else {
            detail = `${ctx.fileCount} new files were uploaded`
          }
        } else {
          const target = ctx.assetName ? `"${ctx.assetName}"` : 'a file'
          const projectInfo = ctx.projectName ? ` to ${ctx.projectName}` : ''
          subject = `[Shumai] ${actor} uploaded ${target}${projectInfo}`
          headline = `${actor} uploaded ${target}${projectInfo}`
          detail = `New asset uploaded to ${ctx.projectName || ctx.teamName}`
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
        detail = ctx.commentMessage || `Task ${task} was created`
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
        detail = ctx.commentMessage || `Status changed for ${task}`
        break
      }
      case NotificationType.kanban_task_updated: {
        const task = ctx.kanbanTaskTitle ? `"${ctx.kanbanTaskTitle}"` : 'a task'
        subject = `[Shumai] ${actor} updated task ${task}`
        headline = `${actor} updated task ${task}`
        detail = ctx.commentMessage || `Task ${task} was updated`
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
        detail = ctx.commentMessage ? `"${ctx.commentMessage}"` : `New comment on ${task}`
        break
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
    .header { font-size: 18px; font-weight: 700; margin-bottom: 8px; color: #111827; }
    .content { font-size: 14px; line-height: 1.6; color: #374151; margin-bottom: 24px; }
    .detail-box { background-color: #f3f4f6; border-left: 4px solid #4f46e5; padding: 12px 16px; border-radius: 4px; margin: 16px 0; font-size: 14px; color: #1f2937; }
    .btn { display: inline-block; background-color: #4f46e5; color: #ffffff !important; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500; margin-top: 12px; }
    .footer { font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 16px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
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
${detail ? `\n${detail}\n` : ''}
${actionText}: ${actionUrl}

Team: ${ctx.teamName}
`.trim()

    return { subject, html, text }
  }
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
