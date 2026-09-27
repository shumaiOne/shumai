import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { prisma, NotificationType, NotificationEmailStatus } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { emailService } from './email'
import { notificationJobService } from './notification-job'
import { userMetadataService } from '@shumai/core/src/user-metadata/user-metadata'

describe('NotificationJobService', () => {
  setupTestDbHooks()

  let sendMailSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    sendMailSpy = vi
      .spyOn(emailService, 'sendMail')
      .mockResolvedValue({ messageId: '<mock-id@shumai.test>' })
  })

  afterEach(() => {
    sendMailSpy.mockRestore()
    notificationJobService.stop()
  })

  async function createTeamWithEmail(name = 'Email Team') {
    return prisma.team.create({
      data: {
        name,
        settings: {
          emailNotification: {
            enabled: true,
            host: 'smtp.test.com',
            port: 587,
            username: 'user',
            password: 'pw',
            smtps: false,
            ignoreCert: false,
            from: 'noreply@test.com',
          },
        },
      },
    })
  }

  it('picks up pending notifications, sends batched email, and marks them processed', async () => {
    const team = await createTeamWithEmail()
    const sender = await prisma.user.create({
      data: { name: 'Alice', email: 'alice@test.com', password: 'p' },
    })
    const recipient = await prisma.user.create({
      data: { name: 'Bob', email: 'bob@test.com', password: 'p' },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: recipient.id, role: 'editor' },
    })

    const project = await prisma.project.create({
      data: { name: 'Alpha Project', teamId: team.id },
    })
    const asset = await prisma.asset.create({
      data: {
        name: 'design.png',
        type: 'file',
        status: 'uploaded',
        project: { connect: { id: project.id } },
      },
    })

    // Create 2 pending notifications
    const n1 = await prisma.notification.create({
      data: {
        type: NotificationType.successful_file_uploaded,
        teamId: team.id,
        projectId: project.id,
        assetId: asset.id,
        creatorId: sender.id,
        emailStatus: NotificationEmailStatus.pending,
      },
    })
    const n2 = await prisma.notification.create({
      data: {
        type: NotificationType.comment_created,
        teamId: team.id,
        projectId: project.id,
        assetId: asset.id,
        creatorId: sender.id,
        emailStatus: NotificationEmailStatus.pending,
      },
    })

    const processedCount = await notificationJobService.processPendingNotifications(500)
    expect(processedCount).toBe(2)

    // Verify Bob received exactly 1 batched email containing both items
    expect(sendMailSpy).toHaveBeenCalledTimes(1)
    expect(sendMailSpy).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'smtp.test.com' }),
      expect.objectContaining({
        to: 'bob@test.com',
        subject: '[Shumai] 2 new notifications in Email Team',
      }),
    )

    // Verify notifications are marked processed in DB
    const updated1 = await prisma.notification.findUnique({ where: { id: n1.id } })
    const updated2 = await prisma.notification.findUnique({ where: { id: n2.id } })
    expect(updated1?.emailStatus).toBe(NotificationEmailStatus.processed)
    expect(updated2?.emailStatus).toBe(NotificationEmailStatus.processed)
  })

  it('skips already processed notifications', async () => {
    const team = await createTeamWithEmail()
    const sender = await prisma.user.create({
      data: { name: 'Alice', email: 'alice2@test.com', password: 'p' },
    })

    await prisma.notification.create({
      data: {
        type: NotificationType.comment_created,
        teamId: team.id,
        creatorId: sender.id,
        emailStatus: NotificationEmailStatus.processed,
      },
    })

    const processedCount = await notificationJobService.processPendingNotifications(500)
    expect(processedCount).toBe(0)
    expect(sendMailSpy).not.toHaveBeenCalled()
  })

  it('marks notifications processed without sending email if team SMTP is disabled', async () => {
    // Team without emailNotification configured
    const team = await prisma.team.create({
      data: { name: 'No Email Team' },
    })
    const sender = await prisma.user.create({
      data: { name: 'Alice', email: 'alice3@test.com', password: 'p' },
    })

    const notif = await prisma.notification.create({
      data: {
        type: NotificationType.new_user_join_team,
        teamId: team.id,
        creatorId: sender.id,
        emailStatus: NotificationEmailStatus.pending,
      },
    })

    const processedCount = await notificationJobService.processPendingNotifications(500)
    expect(processedCount).toBe(1)
    expect(sendMailSpy).not.toHaveBeenCalled()

    const updated = await prisma.notification.findUnique({ where: { id: notif.id } })
    expect(updated?.emailStatus).toBe(NotificationEmailStatus.processed)
  })

  it('excludes the actor from receiving notification about their own action', async () => {
    const team = await createTeamWithEmail()
    const alice = await prisma.user.create({
      data: { name: 'Alice', email: 'alice-self@test.com', password: 'p' },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: alice.id, role: 'editor' },
    })

    // Alice is the creator and only member
    await prisma.notification.create({
      data: {
        type: NotificationType.comment_created,
        teamId: team.id,
        creatorId: alice.id,
        emailStatus: NotificationEmailStatus.pending,
      },
    })

    await notificationJobService.processPendingNotifications(500)
    // Alice should not receive an email for her own comment
    expect(sendMailSpy).not.toHaveBeenCalled()
  })

  it('excludes AI agent users from receiving email notifications', async () => {
    const team = await createTeamWithEmail()
    const sender = await prisma.user.create({
      data: { name: 'Alice', email: 'alice-agent-test@test.com', password: 'p' },
    })
    const agentUser = await prisma.user.create({
      data: {
        name: 'AutoAgent',
        email: 'agent-bot@shumai.ai',
        password: 'p',
        type: 'agent',
      },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: agentUser.id, role: 'editor' },
    })

    await prisma.notification.create({
      data: {
        type: NotificationType.new_user_join_team,
        teamId: team.id,
        creatorId: sender.id,
        emailStatus: NotificationEmailStatus.pending,
      },
    })

    await notificationJobService.processPendingNotifications(500)
    expect(sendMailSpy).not.toHaveBeenCalled()
  })

  it('respects user notification preferences', async () => {
    const team = await createTeamWithEmail()
    const sender = await prisma.user.create({
      data: { name: 'Alice', email: 'alice-pref@test.com', password: 'p' },
    })
    const bob = await prisma.user.create({
      data: { name: 'Bob', email: 'bob-pref@test.com', password: 'p' },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: bob.id, role: 'editor' },
    })

    // Bob disabled comments in his notification settings
    await userMetadataService.upsertMetadata(bob.id, team.id, 'notification_settings', {
      comments: false,
      replies: true,
      mentions: true,
      yourUploads: false,
      otherUploads: true,
      statusUpdates: true,
      kanbanTasks: true,
      kanbanComments: true,
    })

    await prisma.notification.create({
      data: {
        type: NotificationType.comment_created,
        teamId: team.id,
        creatorId: sender.id,
        emailStatus: NotificationEmailStatus.pending,
      },
    })

    await notificationJobService.processPendingNotifications(500)
    expect(sendMailSpy).not.toHaveBeenCalled()
  })

  it('filters notifications by project scope for project-scoped members', async () => {
    const team = await createTeamWithEmail()
    const sender = await prisma.user.create({
      data: { name: 'Alice', email: 'alice-scope@test.com', password: 'p' },
    })
    const project1 = await prisma.project.create({
      data: { name: 'Project 1', teamId: team.id },
    })
    const project2 = await prisma.project.create({
      data: { name: 'Project 2', teamId: team.id },
    })

    const bob = await prisma.user.create({
      data: { name: 'Bob', email: 'bob-scope@test.com', password: 'p' },
    })
    const bobMember = await prisma.teamMember.create({
      data: { teamId: team.id, userId: bob.id, role: 'editor', scope: 'project' },
    })
    // Bob only belongs to Project 1
    await prisma.projectMember.create({
      data: { projectId: project1.id, teamMemberId: bobMember.id, role: 'editor' },
    })

    // Notification in Project 2
    await prisma.notification.create({
      data: {
        type: NotificationType.successful_file_uploaded,
        teamId: team.id,
        projectId: project2.id,
        creatorId: sender.id,
        emailStatus: NotificationEmailStatus.pending,
      },
    })

    await notificationJobService.processPendingNotifications(500)
    // Bob should not receive notification for Project 2
    expect(sendMailSpy).not.toHaveBeenCalled()
  })

  it('batches 5 uploads and 1 comment into 1 email with collapsed upload summary', async () => {
    const team = await createTeamWithEmail()
    const sender = await prisma.user.create({
      data: { name: 'UserB', email: 'userb@test.com', password: 'p' },
    })
    const recipient = await prisma.user.create({
      data: { name: 'Recipient', email: 'recip@test.com', password: 'p' },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: recipient.id, role: 'editor' },
    })

    const project = await prisma.project.create({
      data: { name: 'Project Alpha', teamId: team.id },
    })

    // 5 uploads by UserB in Project Alpha
    for (let i = 0; i < 5; i++) {
      const asset = await prisma.asset.create({
        data: {
          name: `img_${i}.png`,
          type: 'file',
          status: 'uploaded',
          project: { connect: { id: project.id } },
        },
      })
      await prisma.notification.create({
        data: {
          type: NotificationType.successful_file_uploaded,
          teamId: team.id,
          projectId: project.id,
          assetId: asset.id,
          creatorId: sender.id,
          emailStatus: NotificationEmailStatus.pending,
        },
      })
    }

    // 1 comment by UserB
    await prisma.notification.create({
      data: {
        type: NotificationType.comment_created,
        teamId: team.id,
        projectId: project.id,
        creatorId: sender.id,
        emailStatus: NotificationEmailStatus.pending,
      },
    })

    const count = await notificationJobService.processPendingNotifications(500)
    expect(count).toBe(6)

    // Recipient receives exactly 1 email containing all 6 events
    expect(sendMailSpy).toHaveBeenCalledTimes(1)
    const call = sendMailSpy.mock.calls[0]
    expect(call[1].to).toBe('recip@test.com')
    expect(call[1].subject).toBe('[Shumai] 6 new notifications in Email Team')
    // Uploads collapsed into 1 row because count > 3
    expect(call[1].html).toContain('UserB uploaded 5 assets to Project Alpha')
    // Comment rendered as individual row
    expect(call[1].html).toContain('Commented on')
  })

  it('starts and stops gracefully', () => {
    expect(() => {
      notificationJobService.start(100000, 100000)
      notificationJobService.stop()
    }).not.toThrow()
  })
})
