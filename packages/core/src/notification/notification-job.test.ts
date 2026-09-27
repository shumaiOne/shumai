import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { prisma, NotificationType, NotificationEmailStatus } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { emailService, type EmailAttachment } from './email'
import { notificationJobService } from './notification-job'
import { userMetadataService } from '@shumai/core/src/user-metadata/user-metadata'
import { s3Service } from '@shumai/core/src/s3/s3'
import '@shumai/db/src/prisma-json-types'

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

  it('embeds creator avatar and asset thumbnail as inline cid attachments', async () => {
    const team = await createTeamWithEmail()
    const sender = await prisma.user.create({
      data: {
        name: 'Alice Artist',
        email: 'alice.artist@test.com',
        password: 'p',
        image: 'avatars/alice.png',
      },
    })
    const recipient = await prisma.user.create({
      data: { name: 'Bob Reviewer', email: 'bob.reviewer@test.com', password: 'p' },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: recipient.id, role: 'editor' },
    })

    const project = await prisma.project.create({
      data: { name: 'Artwork Project', teamId: team.id },
    })
    const asset = await prisma.asset.create({
      data: {
        name: 'poster.png',
        type: 'file',
        status: 'uploaded',
        project: { connect: { id: project.id } },
        media: {
          thumbnail: { key: 'thumbnails/poster.jpg' },
        } as unknown as PrismaJson.MediaInfo,
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

    const getObjectSpy = vi
      .spyOn(s3Service, 'getObject')
      .mockImplementation(async (_bucket, key) => {
        if (key === 'avatars/alice.png') {
          return { buffer: Buffer.from('alice-avatar-bytes'), contentType: 'image/png' }
        }
        if (key === 'thumbnails/poster.jpg') {
          return { buffer: Buffer.from('poster-thumb-bytes'), contentType: 'image/jpeg' }
        }
        throw new Error('Not found')
      })

    try {
      const count = await notificationJobService.processPendingNotifications(500)
      expect(count).toBe(1)

      expect(sendMailSpy).toHaveBeenCalledTimes(1)
      const call = sendMailSpy.mock.calls[0]
      const options = call[1]
      expect(options.to).toBe('bob.reviewer@test.com')

      // Check attachments
      expect(options.attachments).toHaveLength(2)
      const avatarAtt = options.attachments.find((a: EmailAttachment) =>
        a.cid?.startsWith('avatar-'),
      )
      const thumbAtt = options.attachments.find((a: EmailAttachment) => a.cid?.startsWith('thumb-'))
      expect(avatarAtt).toBeDefined()
      expect(avatarAtt.content).toEqual(Buffer.from('alice-avatar-bytes'))
      expect(avatarAtt.cid).toBe(`avatar-${sender.id}@shumai.internal`)

      expect(thumbAtt).toBeDefined()
      expect(thumbAtt.content).toEqual(Buffer.from('poster-thumb-bytes'))
      expect(thumbAtt.cid).toBe(`thumb-${asset.id}@shumai.internal`)

      // Check HTML references the exact cid
      expect(options.html).toContain(`src="cid:${avatarAtt.cid}"`)
      expect(options.html).toContain(`src="cid:${thumbAtt.cid}"`)
    } finally {
      getObjectSpy.mockRestore()
    }
  })

  it('omits thumbnail attachments when cluster has count > 3', async () => {
    const team = await createTeamWithEmail()
    const sender = await prisma.user.create({
      data: {
        name: 'Bulk Uploader',
        email: 'bulk@test.com',
        password: 'p',
        image: 'avatars/bulk.png',
      },
    })
    const recipient = await prisma.user.create({
      data: { name: 'Recipient', email: 'bulk-recip@test.com', password: 'p' },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: recipient.id, role: 'editor' },
    })

    const project = await prisma.project.create({
      data: { name: 'Bulk Project', teamId: team.id },
    })

    for (let i = 0; i < 4; i++) {
      const asset = await prisma.asset.create({
        data: {
          name: `bulk_${i}.png`,
          type: 'file',
          status: 'uploaded',
          project: { connect: { id: project.id } },
          media: {
            thumbnail: { key: `thumbnails/bulk_${i}.jpg` },
          } as unknown as PrismaJson.MediaInfo,
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

    const getObjectSpy = vi
      .spyOn(s3Service, 'getObject')
      .mockImplementation(async (_bucket, key) => {
        if (key === 'avatars/bulk.png') {
          return { buffer: Buffer.from('bulk-avatar-bytes'), contentType: 'image/png' }
        }
        return { buffer: Buffer.from('thumb-bytes'), contentType: 'image/jpeg' }
      })

    try {
      const count = await notificationJobService.processPendingNotifications(500)
      expect(count).toBe(4)

      expect(sendMailSpy).toHaveBeenCalledTimes(1)
      const options = sendMailSpy.mock.calls[0][1]

      // Count > 3, so only avatar attachment is included, NO thumbnail attachments!
      expect(options.attachments).toHaveLength(1)
      expect(options.attachments[0].cid).toBe(`avatar-${sender.id}@shumai.internal`)
      expect(options.html).toContain(`src="cid:avatar-${sender.id}@shumai.internal"`)
      expect(options.html).not.toContain('src="cid:thumb-')
    } finally {
      getObjectSpy.mockRestore()
    }
  })

  it('gracefully handles missing images or S3 failure with fallback badge', async () => {
    const team = await createTeamWithEmail()
    const sender = await prisma.user.create({
      data: {
        name: 'Broken Image User',
        email: 'broken@test.com',
        password: 'p',
        image: 'avatars/non-existent.png',
      },
    })
    const recipient = await prisma.user.create({
      data: { name: 'Recipient', email: 'broken-recip@test.com', password: 'p' },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: recipient.id, role: 'editor' },
    })

    const project = await prisma.project.create({
      data: { name: 'Project', teamId: team.id },
    })
    const asset = await prisma.asset.create({
      data: {
        name: 'broken.png',
        type: 'file',
        status: 'uploaded',
        project: { connect: { id: project.id } },
        media: {
          thumbnail: { key: 'thumbnails/missing.jpg' },
        } as unknown as PrismaJson.MediaInfo,
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

    const getObjectSpy = vi.spyOn(s3Service, 'getObject').mockRejectedValue(new Error('S3 error'))

    try {
      const count = await notificationJobService.processPendingNotifications(500)
      expect(count).toBe(1)

      expect(sendMailSpy).toHaveBeenCalledTimes(1)
      const options = sendMailSpy.mock.calls[0][1]

      // No attachments because both avatar and thumb failed to load
      expect(options.attachments).toBeUndefined()
      // HTML falls back to letter badge "B" for "Broken Image User"
      expect(options.html).toContain('>B</td>')
      expect(options.html).not.toContain('<img')
    } finally {
      getObjectSpy.mockRestore()
    }
  })

  it('starts and stops gracefully', () => {
    expect(() => {
      notificationJobService.start(100000, 100000)
      notificationJobService.stop()
    }).not.toThrow()
  })
})
