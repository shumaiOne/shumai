import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  prisma,
  NotificationType,
  WorkflowTaskStatus,
  WorkflowTaskType,
  TeamMemberRole,
  AssetStatus,
  AssetType,
  type WorkflowTask,
} from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import {
  createInSystemNotificationActivity,
  sendEmailNotificationActivity,
} from './activities/notification'
import { notificationWorkflow } from './workflows/notification'
import { initNotificationWorkflows } from './index'
import { emailService } from './email'
import { userMetadataService } from '@shumai/core/src/user-metadata/user-metadata'
import { workflowService } from '@shumai/workflow-core'

describe('Notification Workflow and Activities', () => {
  setupTestDbHooks()

  beforeEach(() => {
    vi.clearAllMocks()
    initNotificationWorkflows()
  })

  describe('createInSystemNotificationActivity', () => {
    it('creates primary notification and resolves recipients excluding creator', async () => {
      const team = await prisma.team.create({ data: { name: 'Team One' } })
      const creator = await prisma.user.create({
        data: { name: 'Creator', email: 'creator@test.com', password: 'pw' },
      })
      const member1 = await prisma.user.create({
        data: { name: 'Member 1', email: 'm1@test.com', password: 'pw' },
      })
      const member2 = await prisma.user.create({
        data: { name: 'Member 2', email: 'm2@test.com', password: 'pw' },
      })

      await prisma.teamMember.createMany({
        data: [
          { teamId: team.id, userId: creator.id, role: TeamMemberRole.owner },
          { teamId: team.id, userId: member1.id, role: TeamMemberRole.editor },
          { teamId: team.id, userId: member2.id, role: TeamMemberRole.editor },
        ],
      })

      const project = await prisma.project.create({
        data: { name: 'Project One', teamId: team.id, enableNotification: true },
      })

      const result = await createInSystemNotificationActivity({
        type: NotificationType.comment_created,
        teamId: team.id,
        projectId: project.id,
        creatorId: creator.id,
        commentMessage: 'Hello team',
      })

      expect(result.created).toBe(true)
      expect(result.notificationId).toBeDefined()
      expect(result.recipientUserIds).toContain(member1.id)
      expect(result.recipientUserIds).toContain(member2.id)
      expect(result.recipientUserIds).not.toContain(creator.id)

      const savedNotification = await prisma.notification.findUnique({
        where: { id: result.notificationId },
      })
      expect(savedNotification?.type).toBe(NotificationType.comment_created)
      expect(savedNotification?.teamId).toBe(team.id)
      expect(savedNotification?.projectId).toBe(project.id)
    })

    it('resolves projectId from assetId when projectId is missing', async () => {
      const team = await prisma.team.create({ data: { name: 'Team Two' } })
      const user = await prisma.user.create({
        data: { name: 'User A', email: 'a@test.com', password: 'pw' },
      })
      const project = await prisma.project.create({
        data: { name: 'Project Two', teamId: team.id, enableNotification: true },
      })
      const storageKey = await prisma.storageKey.create({
        data: { key: 'test/key/unique' },
      })
      const asset = await prisma.asset.create({
        data: {
          name: 'photo.jpg',
          type: AssetType.file,
          mediaType: 'image',
          status: AssetStatus.processed,
          projectId: project.id,
          storageKeyId: storageKey.id,
        },
      })

      const result = await createInSystemNotificationActivity({
        type: NotificationType.metadata_field_updated_status,
        teamId: team.id,
        creatorId: user.id,
        assetId: asset.id,
      })

      expect(result.created).toBe(true)
      const saved = await prisma.notification.findUnique({
        where: { id: result.notificationId },
      })
      expect(saved?.projectId).toBe(project.id)
    })

    it('creates mention notifications when user is mentioned in commentMessage', async () => {
      const team = await prisma.team.create({ data: { name: 'Team Mentions' } })
      const creator = await prisma.user.create({
        data: { name: 'Creator', email: 'c@test.com', password: 'pw' },
      })
      const mentionedUser = await prisma.user.create({
        data: { name: 'Mentioned', email: 'mentioned@test.com', password: 'pw' },
      })

      await prisma.teamMember.createMany({
        data: [
          { teamId: team.id, userId: creator.id, role: TeamMemberRole.owner },
          { teamId: team.id, userId: mentionedUser.id, role: TeamMemberRole.editor },
        ],
      })

      const project = await prisma.project.create({
        data: { name: 'Project Mention', teamId: team.id, enableNotification: true },
      })

      const result = await createInSystemNotificationActivity({
        type: NotificationType.comment_created,
        teamId: team.id,
        projectId: project.id,
        creatorId: creator.id,
        commentMessage: `Hey <@${mentionedUser.id}>, please check this out!`,
      })

      expect(result.created).toBe(true)
      expect(result.recipientUserIds).toContain(mentionedUser.id)

      const mentionNotification = await prisma.notification.findFirst({
        where: {
          teamId: team.id,
          userId: mentionedUser.id,
          type: NotificationType.mention,
        },
      })
      expect(mentionNotification).toBeDefined()
    })

    it('skips notification when project.enableNotification is false', async () => {
      const team = await prisma.team.create({ data: { name: 'Muted Team' } })
      const creator = await prisma.user.create({
        data: { name: 'Creator', email: 'cm@test.com', password: 'pw' },
      })
      const project = await prisma.project.create({
        data: { name: 'Muted Project', teamId: team.id, enableNotification: false },
      })

      const result = await createInSystemNotificationActivity({
        type: NotificationType.comment_created,
        teamId: team.id,
        projectId: project.id,
        creatorId: creator.id,
      })

      expect(result.created).toBe(false)
      expect(result.recipientUserIds).toEqual([])

      const count = await prisma.notification.count({ where: { projectId: project.id } })
      expect(count).toBe(0)
    })

    it('respects user notification preference settings', async () => {
      const team = await prisma.team.create({ data: { name: 'Pref Team' } })
      const creator = await prisma.user.create({
        data: { name: 'Creator', email: 'cp@test.com', password: 'pw' },
      })
      const userAllowed = await prisma.user.create({
        data: { name: 'Allowed', email: 'allowed@test.com', password: 'pw' },
      })
      const userBlocked = await prisma.user.create({
        data: { name: 'Blocked', email: 'blocked@test.com', password: 'pw' },
      })

      await prisma.teamMember.createMany({
        data: [
          { teamId: team.id, userId: creator.id, role: TeamMemberRole.owner },
          { teamId: team.id, userId: userAllowed.id, role: TeamMemberRole.editor },
          { teamId: team.id, userId: userBlocked.id, role: TeamMemberRole.editor },
        ],
      })

      // userBlocked disabled comments
      await userMetadataService.upsertMetadata(userBlocked.id, team.id, 'notification_settings', {
        comments: false,
        replies: true,
        mentions: true,
        yourUploads: false,
        otherUploads: true,
        statusUpdates: true,
      })

      const result = await createInSystemNotificationActivity({
        type: NotificationType.comment_created,
        teamId: team.id,
        creatorId: creator.id,
      })

      expect(result.recipientUserIds).toContain(userAllowed.id)
      expect(result.recipientUserIds).not.toContain(userBlocked.id)
    })

    it('excludes AI agents from recipientUserIds', async () => {
      const team = await prisma.team.create({ data: { name: 'Agent Test Team' } })
      const creator = await prisma.user.create({
        data: { name: 'Creator', email: 'creator@agent-test.com', password: 'pw' },
      })
      const humanMember = await prisma.user.create({
        data: { name: 'Human Member', email: 'human@agent-test.com', password: 'pw' },
      })
      const agentUser = await prisma.user.create({
        data: {
          name: 'AI Agent',
          email: 'agent-1788510405562-g1lgz8@shumai.ai',
          type: 'agent',
          password: 'pw',
        },
      })
      await prisma.agent.create({
        data: {
          id: agentUser.id,
          teamId: team.id,
          type: 'chat',
          config: { provider: 'openai', model: 'gpt-4' },
        },
      })

      await prisma.teamMember.createMany({
        data: [
          { teamId: team.id, userId: creator.id, role: TeamMemberRole.owner },
          { teamId: team.id, userId: humanMember.id, role: TeamMemberRole.editor },
          { teamId: team.id, userId: agentUser.id, role: TeamMemberRole.reviewer },
        ],
      })

      const result = await createInSystemNotificationActivity({
        type: NotificationType.comment_created,
        teamId: team.id,
        creatorId: creator.id,
      })

      expect(result.recipientUserIds).toContain(humanMember.id)
      expect(result.recipientUserIds).not.toContain(agentUser.id)
    })
  })

  describe('sendEmailNotificationActivity', () => {
    it('skips email delivery when recipientUserIds is empty', async () => {
      const result = await sendEmailNotificationActivity({
        payload: {
          type: NotificationType.comment_created,
          teamId: 'any-team',
        },
        recipientUserIds: [],
      })

      expect(result.skipped).toBe(true)
      expect(result.reason).toBe('no_recipients')
      expect(result.sentCount).toBe(0)
    })

    it('skips email delivery when team email settings are disabled', async () => {
      const team = await prisma.team.create({
        data: {
          name: 'Email Disabled Team',
          settings: { emailNotification: { enabled: false } },
        },
      })

      const result = await sendEmailNotificationActivity({
        payload: {
          type: NotificationType.comment_created,
          teamId: team.id,
        },
        recipientUserIds: ['user-1'],
      })

      expect(result.skipped).toBe(true)
      expect(result.reason).toBe('email_disabled')
      expect(result.sentCount).toBe(0)
    })

    it('sends email to recipients when team email settings are enabled', async () => {
      const team = await prisma.team.create({
        data: {
          name: 'Email Active Team',
          settings: {
            emailNotification: {
              enabled: true,
              host: 'smtp.active.test',
              port: 587,
              from: 'notify@active.test',
            },
          },
        },
      })

      const u1 = await prisma.user.create({
        data: { name: 'User 1', email: 'u1@shumai.test', password: 'pw' },
      })
      const u2 = await prisma.user.create({
        data: { name: 'User 2', email: 'u2@shumai.test', password: 'pw' },
      })

      const sendMailSpy = vi
        .spyOn(emailService, 'sendMail')
        .mockResolvedValue({ messageId: '<sent-id@shumai.test>' })

      const result = await sendEmailNotificationActivity({
        payload: {
          type: NotificationType.new_user_join_team,
          teamId: team.id,
        },
        recipientUserIds: [u1.id, u2.id],
      })

      expect(result.sentCount).toBe(2)
      expect(sendMailSpy).toHaveBeenCalledTimes(2)
      expect(sendMailSpy).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'smtp.active.test' }),
        expect.objectContaining({ to: 'u1@shumai.test' }),
      )
      expect(sendMailSpy).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'smtp.active.test' }),
        expect.objectContaining({ to: 'u2@shumai.test' }),
      )
    })

    it('throws non-retryable ApplicationFailure on SMTP authentication error', async () => {
      const team = await prisma.team.create({
        data: {
          name: 'Auth Fail Team',
          settings: {
            emailNotification: {
              enabled: true,
              host: 'smtp.fail.test',
              port: 587,
              from: 'notify@fail.test',
            },
          },
        },
      })

      const u1 = await prisma.user.create({
        data: { name: 'User Auth', email: 'auth@shumai.test', password: 'pw' },
      })

      vi.spyOn(emailService, 'sendMail').mockRejectedValue(
        new Error('535 Authentication failed: Invalid login'),
      )

      await expect(
        sendEmailNotificationActivity({
          payload: {
            type: NotificationType.comment_created,
            teamId: team.id,
          },
          recipientUserIds: [u1.id],
        }),
      ).rejects.toThrow('Fatal SMTP authentication failure')
    })

    it('never sends notification emails to AI agents even if present in recipientUserIds', async () => {
      const team = await prisma.team.create({
        data: {
          name: 'Agent Email Test Team',
          settings: {
            emailNotification: {
              enabled: true,
              host: 'smtp.agent-test.test',
              port: 587,
              from: 'notify@agent-test.test',
            },
          },
        },
      })

      const humanUser = await prisma.user.create({
        data: { name: 'Human User', email: 'human@shumai.test', password: 'pw' },
      })
      const agentUser = await prisma.user.create({
        data: {
          name: 'AI Agent',
          email: 'agent-1788510405562-g1lgz8@shumai.ai',
          type: 'agent',
          password: 'pw',
        },
      })
      await prisma.agent.create({
        data: {
          id: agentUser.id,
          teamId: team.id,
          type: 'chat',
          config: { provider: 'openai', model: 'gpt-4' },
        },
      })

      const sendMailSpy = vi
        .spyOn(emailService, 'sendMail')
        .mockResolvedValue({ messageId: '<sent-id@shumai.test>' })

      const result = await sendEmailNotificationActivity({
        payload: {
          type: NotificationType.comment_created,
          teamId: team.id,
        },
        recipientUserIds: [humanUser.id, agentUser.id],
      })

      expect(result.sentCount).toBe(1)
      expect(sendMailSpy).toHaveBeenCalledTimes(1)
      expect(sendMailSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ to: 'human@shumai.test' }),
      )
      expect(sendMailSpy).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ to: 'agent-1788510405562-g1lgz8@shumai.ai' }),
      )
    })

    it('resolves mentioned user names in comment email instead of raw ID', async () => {
      const team = await prisma.team.create({
        data: {
          name: 'Mention Resolution Team',
          settings: {
            emailNotification: {
              enabled: true,
              host: 'smtp.mention.test',
              port: 587,
              from: 'notify@mention.test',
            },
          },
        },
      })

      const commenter = await prisma.user.create({
        data: { name: 'Bob', email: 'bob@shumai.test', password: 'pw' },
      })
      const mentionedUser = await prisma.user.create({
        data: { name: 'Alice Smith', email: 'alice@shumai.test', password: 'pw' },
      })
      const recipient = await prisma.user.create({
        data: { name: 'Recipient', email: 'recipient@shumai.test', password: 'pw' },
      })

      const sendMailSpy = vi
        .spyOn(emailService, 'sendMail')
        .mockResolvedValue({ messageId: '<sent@shumai.test>' })

      await sendEmailNotificationActivity({
        payload: {
          type: NotificationType.comment_created,
          teamId: team.id,
          creatorId: commenter.id,
          commentMessage: `Hello <@${mentionedUser.id}>, nice work!`,
        },
        recipientUserIds: [recipient.id],
      })

      expect(sendMailSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          html: expect.stringContaining('@Alice Smith, nice work!'),
          text: expect.stringContaining('@Alice Smith, nice work!'),
        }),
      )
      expect(sendMailSpy).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          html: expect.stringContaining(`<@${mentionedUser.id}>`),
        }),
      )
    })

    it('resolves project name, creator profile image, and upload time for file upload email', async () => {
      const team = await prisma.team.create({
        data: {
          name: 'Upload Info Team',
          settings: {
            emailNotification: {
              enabled: true,
              host: 'smtp.upload.test',
              port: 587,
              from: 'notify@upload.test',
            },
          },
        },
      })

      const project = await prisma.project.create({
        data: { name: 'Marketing Campaign', teamId: team.id },
      })

      const uploader = await prisma.user.create({
        data: {
          name: 'Charlie',
          email: 'charlie@shumai.test',
          image: 'https://cdn.example.com/charlie.png',
          password: 'pw',
        },
      })

      const storageKey = await prisma.storageKey.create({
        data: { key: 'test/upload/charlie-asset.mp4' },
      })

      const uploadDate = new Date('2026-09-27T10:00:00Z')
      const asset = await prisma.asset.create({
        data: {
          name: 'promo.mp4',
          type: AssetType.file,
          mediaType: 'video',
          status: AssetStatus.processed,
          projectId: project.id,
          creatorId: uploader.id,
          storageKeyId: storageKey.id,
          createdAt: uploadDate,
        },
      })

      const recipient = await prisma.user.create({
        data: { name: 'Viewer', email: 'viewer@shumai.test', password: 'pw' },
      })

      const sendMailSpy = vi
        .spyOn(emailService, 'sendMail')
        .mockResolvedValue({ messageId: '<sent@shumai.test>' })

      // Note payload.projectId is omitted to verify it resolves from asset.projectId
      await sendEmailNotificationActivity({
        payload: {
          type: NotificationType.successful_file_uploaded,
          teamId: team.id,
          creatorId: uploader.id,
          assetId: asset.id,
        },
        recipientUserIds: [recipient.id],
      })

      expect(sendMailSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          subject: expect.stringContaining('Marketing Campaign'),
          html: expect.stringMatching(
            /Marketing Campaign.*https:\/\/cdn\.example\.com\/charlie\.png/s,
          ),
        }),
      )
    })
  })

  describe('notificationWorkflow', () => {
    it('successfully processes notificationWorkflow end to end', async () => {
      const team = await prisma.team.create({
        data: {
          name: 'Workflow Team',
          settings: {
            emailNotification: {
              enabled: true,
              host: 'smtp.wf.test',
              port: 587,
              from: 'wf@test.com',
            },
          },
        },
      })

      const creator = await prisma.user.create({
        data: { name: 'WF Creator', email: 'wf-c@test.com', password: 'pw' },
      })
      const recipient = await prisma.user.create({
        data: { name: 'WF Recipient', email: 'wf-r@test.com', password: 'pw' },
      })

      await prisma.teamMember.createMany({
        data: [
          { teamId: team.id, userId: creator.id, role: TeamMemberRole.owner },
          { teamId: team.id, userId: recipient.id, role: TeamMemberRole.editor },
        ],
      })

      vi.spyOn(emailService, 'sendMail').mockResolvedValue({ messageId: '<wf-msg@test.com>' })

      // Create a WorkflowTask
      const task = await prisma.workflowTask.create({
        data: {
          type: WorkflowTaskType.notification,
          status: WorkflowTaskStatus.pending,
          payload: {
            notification: {
              type: NotificationType.comment_created,
              teamId: team.id,
              creatorId: creator.id,
              commentMessage: 'Workflow test comment',
            },
          },
        },
      })

      const completed = await workflowService.executeWait(task)
      expect(completed.status).toBe(WorkflowTaskStatus.completed)
      const output = completed.output as { inSystemCreated: boolean; emailsSent: number }
      expect(output.inSystemCreated).toBe(true)
      expect(output.emailsSent).toBe(1)
    })

    it('fails non-retryably when payload.notification is missing', async () => {
      const mockTask = {
        id: 'mock-task-id',
        type: WorkflowTaskType.notification,
        status: WorkflowTaskStatus.pending,
        payload: {},
      } as unknown as WorkflowTask

      await expect(notificationWorkflow(mockTask)).rejects.toThrow(
        'Task payload.notification is missing',
      )
    })
  })
})
