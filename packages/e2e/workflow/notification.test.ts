import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import {
  prisma,
  NotificationType,
  WorkflowTaskStatus,
  WorkflowTaskType,
  TeamMemberRole,
} from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { workflowService, TaskQueueNotification } from '@shumai/workflow-core'
import { initNotificationWorkflows } from '@shumai/core'
import { emailService } from '@shumai/core/src/notification/email'
import { fileURLToPath } from 'url'
import * as path from 'path'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const notificationWorkflowsPath = path.resolve(
  currentDir,
  '../../core/src/notification/workflows/notification.ts',
)

describe.each(['local', 'temporal'] as const)(
  'Workflow E2E - notification (executor: %s)',
  (mode) => {
    setupTestDbHooks()

    let notificationWorkerPromise: Promise<void> | null = null

    beforeAll(async () => {
      workflowService.setExecutorType(mode)
      initNotificationWorkflows()

      if (mode === 'temporal') {
        console.log('Starting background worker for notification Temporal E2E tests...')
        notificationWorkerPromise = workflowService.startWorkers(TaskQueueNotification, {
          workflowsPath: notificationWorkflowsPath,
        })
        await new Promise((resolve) => setTimeout(resolve, 2000))
      } else {
        console.log('Starting local workflow service polling...')
        workflowService.start()
      }
    })

    afterAll(async () => {
      if (mode === 'temporal') {
        console.log('Shutting down Temporal workers...')
        await workflowService.shutdownWorkers()
        await Promise.all([notificationWorkerPromise].filter(Boolean))
      }
      workflowService.close()
      vi.restoreAllMocks()
    })

    it('processes comment notification and sends email to team members', async () => {
      const team = await prisma.team.create({
        data: {
          name: `E2E Notification Team (${mode})`,
          settings: {
            emailNotification: {
              enabled: true,
              host: 'smtp.e2e.test',
              port: 587,
              from: 'noreply@e2e.test',
              uploadDebounceSeconds: 0,
            },
          },
        },
      })

      const project = await prisma.project.create({
        data: { name: 'E2E Notification Project', teamId: team.id, enableNotification: true },
      })

      const creator = await prisma.user.create({
        data: {
          name: 'E2E Creator',
          email: `e2e-creator-${mode}-${Date.now()}@shumai.test`,
          password: 'pw',
        },
      })

      const recipient = await prisma.user.create({
        data: {
          name: 'E2E Recipient',
          email: `e2e-recipient-${mode}-${Date.now()}@shumai.test`,
          password: 'pw',
        },
      })

      const agentUser = await prisma.user.create({
        data: {
          name: 'E2E Agent',
          email: `agent-${mode}-${Date.now()}@shumai.ai`,
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
          { teamId: team.id, userId: recipient.id, role: TeamMemberRole.editor },
          { teamId: team.id, userId: agentUser.id, role: TeamMemberRole.reviewer },
        ],
      })

      const sendMailSpy = vi
        .spyOn(emailService, 'sendMail')
        .mockResolvedValue({ messageId: '<e2e-msg-id@shumai.test>' })

      const task = await prisma.workflowTask.create({
        data: {
          type: WorkflowTaskType.notification,
          status: WorkflowTaskStatus.pending,
          teamId: team.id,
          projectId: project.id,
          payload: {
            projectId: project.id,
            notification: {
              type: NotificationType.comment_created,
              teamId: team.id,
              projectId: project.id,
              creatorId: creator.id,
              commentMessage: 'Hello from E2E test',
            },
          },
        },
      })

      const completed = await workflowService.executeWait(task, 30000)
      expect(completed.status).toBe(WorkflowTaskStatus.completed)

      const output = completed.output as {
        inSystemCreated: boolean
        emailsSent: number
        notificationId: string
      }
      expect(output.inSystemCreated).toBe(true)
      expect(output.emailsSent).toBe(1)
      expect(output.notificationId).toBeDefined()

      // Verify in-system notification in database
      const notif = await prisma.notification.findUnique({
        where: { id: output.notificationId },
      })
      expect(notif?.type).toBe(NotificationType.comment_created)
      expect(notif?.teamId).toBe(team.id)

      // Verify email was sent to recipient and never to agent
      expect(sendMailSpy).toHaveBeenCalledTimes(1)
      expect(sendMailSpy).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'smtp.e2e.test' }),
        expect.objectContaining({ to: recipient.email }),
      )
      expect(sendMailSpy).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ to: agentUser.email }),
      )
    })
  },
)
