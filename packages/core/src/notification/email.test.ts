import { describe, expect, it, vi, beforeEach } from 'vitest'
import nodemailer from 'nodemailer'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { NotificationType } from '@shumai/db'
import { emailService, DEFAULT_EMAIL_SETTINGS } from './email'

const mockSendMail = vi.fn().mockResolvedValue({ messageId: '<mock-msg-id@shumai.test>' })
const mockVerify = vi.fn().mockResolvedValue(true)
const mockClose = vi.fn()

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: mockSendMail,
      verify: mockVerify,
      close: mockClose,
    })),
  },
}))

describe('EmailService', () => {
  setupTestDbHooks()

  beforeEach(() => {
    vi.clearAllMocks()
    mockSendMail.mockResolvedValue({ messageId: '<mock-msg-id@shumai.test>' })
    mockVerify.mockResolvedValue(true)
  })

  describe('getEmailSettings', () => {
    it('returns default settings when team settings are not set', async () => {
      const team = await prisma.team.create({ data: { name: 'Team Alpha' } })
      const settings = await emailService.getEmailSettings(team.id)

      expect(settings).toEqual(DEFAULT_EMAIL_SETTINGS)
      expect(settings.enabled).toBe(false)
      expect(settings.port).toBe(587)
    })

    it('returns saved email settings when configured', async () => {
      const team = await prisma.team.create({
        data: {
          name: 'Team Beta',
          settings: {
            emailNotification: {
              enabled: true,
              host: 'smtp.beta.test',
              port: 465,
              username: 'beta_user',
              password: 'secret_password',
              smtps: true,
              ignoreCert: false,
              from: 'beta@shumai.test',
              replyTo: 'reply@shumai.test',
            },
          },
        },
      })

      const settings = await emailService.getEmailSettings(team.id)
      expect(settings.enabled).toBe(true)
      expect(settings.host).toBe('smtp.beta.test')
      expect(settings.port).toBe(465)
      expect(settings.password).toBe('secret_password')
    })

    it('throws 404 if team does not exist', async () => {
      await expect(emailService.getEmailSettings('non-existent-team-id')).rejects.toThrow()
    })
  })

  describe('updateEmailSettings', () => {
    it('updates email settings and saves to team.settings', async () => {
      const team = await prisma.team.create({ data: { name: 'Team Gamma' } })

      const updated = await emailService.updateEmailSettings(team.id, {
        enabled: true,
        host: 'smtp.gamma.test',
        port: 587,
        username: 'gamma',
        password: 'gamma_password',
        smtps: false,
        ignoreCert: true,
        from: 'gamma@shumai.test',
        replyTo: '',
      })

      expect(updated.enabled).toBe(true)
      expect(updated.host).toBe('smtp.gamma.test')
      expect(updated.password).toBe('gamma_password')
      expect(updated.ignoreCert).toBe(true)

      const reloaded = await prisma.team.findUnique({ where: { id: team.id } })
      expect(reloaded?.settings?.emailNotification?.host).toBe('smtp.gamma.test')
    })

    it('preserves existing password if empty string or undefined is provided in update', async () => {
      const team = await prisma.team.create({
        data: {
          name: 'Team Delta',
          settings: {
            emailNotification: {
              enabled: true,
              host: 'smtp.delta.test',
              port: 587,
              username: 'delta',
              password: 'original_super_secret',
              smtps: false,
              ignoreCert: false,
              from: 'delta@shumai.test',
              replyTo: '',
            },
          },
        },
      })

      const updated = await emailService.updateEmailSettings(team.id, {
        enabled: true,
        host: 'smtp.delta-updated.test',
        port: 587,
        username: 'delta_new',
        password: '', // Empty password should retain existing
        smtps: true,
        ignoreCert: false,
        from: 'delta@shumai.test',
      })

      expect(updated.host).toBe('smtp.delta-updated.test')
      expect(updated.password).toBe('original_super_secret')

      const reloaded = await prisma.team.findUnique({ where: { id: team.id } })
      expect(reloaded?.settings?.emailNotification?.password).toBe('original_super_secret')
    })
  })

  describe('sendMail and verifySmtp', () => {
    it('verifySmtp calls transport.verify and closes transport', async () => {
      const config = { ...DEFAULT_EMAIL_SETTINGS, host: 'smtp.test' }
      const ok = await emailService.verifySmtp(config)

      expect(ok).toBe(true)
      expect(mockVerify).toHaveBeenCalled()
      expect(mockClose).toHaveBeenCalled()
    })

    it('sendMail sends email using nodemailer transport', async () => {
      const config = { ...DEFAULT_EMAIL_SETTINGS, host: 'smtp.test', from: 'shumai@test.com' }
      const res = await emailService.sendMail(config, {
        to: 'user@test.com',
        subject: 'Hello',
        html: '<p>Hello World</p>',
        text: 'Hello World',
      })

      expect(res.messageId).toBe('<mock-msg-id@shumai.test>')
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'shumai@test.com',
          to: 'user@test.com',
          subject: 'Hello',
        }),
      )
      expect(mockClose).toHaveBeenCalled()
    })
  })

  describe('sendTestEmail', () => {
    it('sends test email to the current admin user', async () => {
      const team = await prisma.team.create({
        data: {
          name: 'Test Team',
          settings: {
            emailNotification: {
              enabled: true,
              host: 'smtp.test.com',
              port: 587,
              username: 'user',
              password: 'pw',
              smtps: false,
              ignoreCert: false,
              from: 'sender@test.com',
              replyTo: '',
            },
          },
        },
      })

      const currentUser = { id: 'admin1', email: 'admin@shumai.test', name: 'Admin' }
      const result = await emailService.sendTestEmail(team.id, currentUser)

      expect(result.success).toBe(true)
      expect(result.messageId).toBe('<mock-msg-id@shumai.test>')
      expect(mockVerify).toHaveBeenCalled()
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@shumai.test',
          subject: 'Test email from Shumai',
        }),
      )
    })

    it('allows overriding settings with input draft', async () => {
      const team = await prisma.team.create({ data: { name: 'Test Team 2' } })
      const currentUser = { id: 'admin2', email: 'admin2@shumai.test', name: 'Admin 2' }

      const result = await emailService.sendTestEmail(team.id, currentUser, {
        host: 'smtp.draft.com',
        from: 'draft@test.com',
        password: 'draft-password',
      })

      expect(result.success).toBe(true)
      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.draft.com',
        }),
      )
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'draft@test.com',
          to: 'admin2@shumai.test',
        }),
      )
    })

    it('throws error when host is missing', async () => {
      const team = await prisma.team.create({ data: { name: 'Empty Host Team' } })
      const currentUser = { id: 'admin3', email: 'admin3@shumai.test', name: 'Admin 3' }

      await expect(
        emailService.sendTestEmail(team.id, currentUser, { host: '', from: 'a@b.com' }),
      ).rejects.toThrow('SMTP host is required')
    })

    it('throws error when from address is missing', async () => {
      const team = await prisma.team.create({ data: { name: 'Empty From Team' } })
      const currentUser = { id: 'admin4', email: 'admin4@shumai.test', name: 'Admin 4' }

      await expect(
        emailService.sendTestEmail(team.id, currentUser, { host: 'smtp.test', from: '' }),
      ).rejects.toThrow('From address is required')
    })

    it('throws 400 when verify fails', async () => {
      const team = await prisma.team.create({ data: { name: 'Failing Team' } })
      const currentUser = { id: 'admin5', email: 'admin5@shumai.test', name: 'Admin 5' }

      mockVerify.mockRejectedValueOnce(new Error('Connection refused'))

      await expect(
        emailService.sendTestEmail(team.id, currentUser, {
          host: 'smtp.down.com',
          from: 'admin@down.com',
        }),
      ).rejects.toThrow('SMTP verification failed: Connection refused')
    })
  })

  describe('renderNotificationEmail', () => {
    it('renders comment notification', () => {
      const rendered = emailService.renderNotificationEmail({
        type: NotificationType.comment_created,
        creatorName: 'Alice',
        teamName: 'Designers',
        teamId: 'team-1',
        projectId: 'proj-1',
        assetId: 'asset-1',
        assetName: 'logo.png',
        commentMessage: 'Please make it bigger',
      })

      expect(rendered.subject).toContain('Alice commented on "logo.png"')
      expect(rendered.html).toContain('Please make it bigger')
      expect(rendered.html).toContain('logo.png')
      expect(rendered.text).toContain('Alice commented on "logo.png"')
    })

    it('renders mention notification', () => {
      const rendered = emailService.renderNotificationEmail({
        type: NotificationType.mention,
        creatorName: 'Bob',
        teamName: 'Developers',
        teamId: 'team-2',
        projectId: 'proj-2',
        assetId: 'asset-2',
        assetName: 'architecture.pdf',
        commentMessage: 'Take a look at this',
      })

      expect(rendered.subject).toContain('Bob mentioned you')
      expect(rendered.html).toContain('Bob mentioned you')
      expect(rendered.html).toContain('Take a look at this')
    })

    it('replaces user mentions with user names instead of user ID in comment emails', () => {
      const rendered = emailService.renderNotificationEmail({
        type: NotificationType.comment_created,
        creatorName: 'Bob',
        teamName: 'Designers',
        teamId: 'team-1',
        projectId: 'proj-1',
        assetId: 'asset-1',
        assetName: 'logo.png',
        commentMessage: '<@kUFrm1W4fKLCaLpw2XQP1OPe0gKACJpy> nice',
        mentionedUserNames: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          kUFrm1W4fKLCaLpw2XQP1OPe0gKACJpy: 'Alice',
        },
      })

      expect(rendered.html).toContain('@Alice nice')
      expect(rendered.html).not.toContain('<@kUFrm1W4fKLCaLpw2XQP1OPe0gKACJpy>')
      expect(rendered.text).toContain('@Alice nice')
      expect(rendered.text).not.toContain('<@kUFrm1W4fKLCaLpw2XQP1OPe0gKACJpy>')
    })

    it('renders asset upload notification with project name, creator profile image, and upload time', () => {
      const rendered = emailService.renderNotificationEmail({
        type: NotificationType.successful_file_uploaded,
        creatorName: 'Charlie',
        creatorAvatarUrl: 'https://example.com/avatar.jpg',
        teamName: 'Media',
        teamId: 'team-3',
        projectName: 'Marketing Campaign',
        projectId: 'proj-3',
        assetId: 'asset-3',
        assetName: 'video.mp4',
        fileCount: 1,
        uploadTime: new Date('2026-09-27T15:20:00Z'),
      })

      expect(rendered.subject).toContain('Charlie uploaded "video.mp4" to Marketing Campaign')
      expect(rendered.html).toContain('Marketing Campaign')
      expect(rendered.html).toContain('https://example.com/avatar.jpg')
      expect(rendered.html).toContain('Sep 27, 2026')
      expect(rendered.text).toContain('Marketing Campaign')
      expect(rendered.text).toContain('Sep 27, 2026')
    })

    it('renders single file uploaded notification', () => {
      const rendered = emailService.renderNotificationEmail({
        type: NotificationType.successful_file_uploaded,
        creatorName: 'Charlie',
        teamName: 'Media',
        teamId: 'team-3',
        projectId: 'proj-3',
        assetId: 'asset-3',
        assetName: 'video.mp4',
        fileCount: 1,
      })

      expect(rendered.subject).toContain('Charlie uploaded "video.mp4"')
      expect(rendered.html).toContain('video.mp4')
    })

    it('renders consolidated batch file upload notification', () => {
      const rendered = emailService.renderNotificationEmail({
        type: NotificationType.successful_file_uploaded,
        creatorName: 'Charlie',
        teamName: 'Media',
        teamId: 'team-3',
        projectName: 'Videos',
        projectId: 'proj-3',
        fileCount: 5,
        fileNames: ['img1.png', 'img2.png', 'img3.png', 'img4.png', 'img5.png'],
      })

      expect(rendered.subject).toContain('Charlie uploaded 5 files to Videos')
      expect(rendered.html).toContain('img1.png')
      expect(rendered.html).toContain('and 2 more')
    })

    it('renders user joined team notification', () => {
      const rendered = emailService.renderNotificationEmail({
        type: NotificationType.new_user_join_team,
        creatorName: 'Dave',
        teamName: 'Acme Corp',
        teamId: 'team-4',
      })

      expect(rendered.subject).toContain('Dave joined Acme Corp')
      expect(rendered.html).toContain('Dave is now a member of Acme Corp')
    })

    it('renders kanban task notifications', () => {
      const created = emailService.renderNotificationEmail({
        type: NotificationType.kanban_task_created,
        creatorName: 'Eva',
        teamName: 'Engineering',
        teamId: 'team-5',
        kanbanTaskId: 'kt-1',
        kanbanTaskTitle: 'Fix login bug',
      })
      expect(created.subject).toContain('Eva created task "Fix login bug"')

      const assigned = emailService.renderNotificationEmail({
        type: NotificationType.kanban_task_assigned,
        creatorName: 'Frank',
        teamName: 'Engineering',
        teamId: 'team-5',
        kanbanTaskId: 'kt-2',
        kanbanTaskTitle: 'Design DB schema',
      })
      expect(assigned.subject).toContain('Frank assigned you to task "Design DB schema"')

      const status = emailService.renderNotificationEmail({
        type: NotificationType.kanban_task_status_updated,
        creatorName: 'Grace',
        teamName: 'Engineering',
        teamId: 'team-5',
        kanbanTaskId: 'kt-3',
        kanbanTaskTitle: 'Refactor auth',
        commentMessage: 'Moved to In Progress',
      })
      expect(status.subject).toContain('Grace updated status of task "Refactor auth"')
      expect(status.html).toContain('Moved to In Progress')
    })
  })
})
