import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { kanbanService } from '@shumai/core/src/kanban/kanban'
import { notificationService } from '@shumai/core/src/notification/notification'
import { auditLogService } from '@shumai/core/src/auditLog/auditLog'
import {
  authzService,
  Permission,
  ResourceType,
  resolveEffectiveRole,
} from '@shumai/core/src/authz/authz'
import {
  createKanbanTaskSchema,
  updateKanbanTaskSchema,
  listKanbanTasksRequestSchema,
  AuditAction,
} from '@shumai/dtos'
import type { Prisma } from '@shumai/db'
import { HTTPException } from 'hono/http-exception'

type User = Prisma.UserGetPayload<Record<string, never>>

const route = new Hono<{ Variables: { user: User } }>()
  .post('/teams/:teamId/kanban/tasks', zValidator('json', createKanbanTaskSchema), async (c) => {
    const { teamId } = c.req.param()
    const req = c.req.valid('json')
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Team,
      id: teamId,
    })

    const role = await resolveEffectiveRole(teamId, undefined, user.id)
    if (!role) {
      throw new HTTPException(403, { message: 'User is not a member of the team' })
    }

    const task = await kanbanService.createTask(teamId, req, user.id, role)

    await auditLogService.logAction({
      action: AuditAction.kanban_task_create,
      teamId,
      userId: user.id,
      projectId: task.projectId ?? undefined,
      itemId: task.id,
    })

    if (req.assigneeId && req.assigneeId !== user.id) {
      notificationService.notifyKanbanTaskEvent({
        type: 'kanban_task_assigned',
        teamId,
        projectId: task.projectId,
        creatorId: user.id,
        kanbanTaskId: task.id,
        targetUserId: req.assigneeId,
      })
    }

    if (req.reporterId && req.reporterId !== user.id && req.reporterId !== req.assigneeId) {
      notificationService.notifyKanbanTaskEvent({
        type: 'kanban_task_created',
        teamId,
        projectId: task.projectId,
        creatorId: user.id,
        kanbanTaskId: task.id,
        targetUserId: req.reporterId,
      })
    }

    return c.json(task)
  })
  .get(
    '/teams/:teamId/kanban/tasks',
    zValidator('query', listKanbanTasksRequestSchema),
    async (c) => {
      const { teamId } = c.req.param()
      const req = c.req.valid('query')
      const user = c.get('user')

      await authzService.hasPermission({
        user,
        permission: Permission.Read,
        type: ResourceType.Team,
        id: teamId,
      })

      const result = await kanbanService.listTasks(teamId, req)
      return c.json(result)
    },
  )
  .get('/teams/:teamId/kanban/tasks/:taskId', async (c) => {
    const { taskId } = c.req.param()
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.KanbanTask,
      id: taskId,
    })

    const task = await kanbanService.getTask(taskId)
    return c.json(task)
  })
  .patch(
    '/teams/:teamId/kanban/tasks/:taskId',
    zValidator('json', updateKanbanTaskSchema),
    async (c) => {
      const { teamId, taskId } = c.req.param()
      const req = c.req.valid('json')
      const user = c.get('user')

      await authzService.hasPermission({
        user,
        permission: Permission.Edit,
        type: ResourceType.KanbanTask,
        id: taskId,
      })

      const existing = await kanbanService.getTask(taskId)
      const role = await resolveEffectiveRole(teamId, undefined, user.id)
      const task = await kanbanService.updateTask(taskId, req, user.id, role)

      const hasMeaningfulChanges =
        req.title !== undefined ||
        req.description !== undefined ||
        req.priority !== undefined ||
        req.startDate !== undefined ||
        req.dueDate !== undefined ||
        req.goalId !== undefined ||
        req.assigneeId !== undefined ||
        req.reporterId !== undefined ||
        req.targetFolderId !== undefined ||
        (req.status !== undefined && req.status !== existing.status)

      if (hasMeaningfulChanges) {
        await auditLogService.logAction({
          action: AuditAction.kanban_task_update,
          teamId,
          userId: user.id,
          projectId: task.projectId ?? undefined,
          itemId: task.id,
        })
      }

      if (req.status !== undefined && req.status !== existing.status) {
        notificationService.notifyKanbanTaskEvent({
          type: 'kanban_task_status_updated',
          teamId,
          projectId: task.projectId,
          creatorId: user.id,
          kanbanTaskId: task.id,
          stakeholderIds: [task.creator?.id, task.assignee?.id, task.reporter?.id],
        })
      }

      if (
        req.assigneeId !== undefined &&
        req.assigneeId !== existing.assignee?.id &&
        req.assigneeId !== null &&
        req.assigneeId !== user.id
      ) {
        notificationService.notifyKanbanTaskEvent({
          type: 'kanban_task_assigned',
          teamId,
          projectId: task.projectId,
          creatorId: user.id,
          kanbanTaskId: task.id,
          targetUserId: req.assigneeId,
        })
      }

      const hasOtherDetailsChanged =
        req.title !== undefined ||
        req.description !== undefined ||
        req.priority !== undefined ||
        req.startDate !== undefined ||
        req.dueDate !== undefined ||
        req.goalId !== undefined ||
        req.reporterId !== undefined ||
        req.targetFolderId !== undefined

      if (hasOtherDetailsChanged && req.status === undefined) {
        notificationService.notifyKanbanTaskEvent({
          type: 'kanban_task_updated',
          teamId,
          projectId: task.projectId,
          creatorId: user.id,
          kanbanTaskId: task.id,
          stakeholderIds: [task.creator?.id, task.assignee?.id, task.reporter?.id],
        })
      }

      return c.json(task)
    },
  )
  .delete('/teams/:teamId/kanban/tasks/:taskId', async (c) => {
    const { teamId, taskId } = c.req.param()
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Edit,
      type: ResourceType.KanbanTask,
      id: taskId,
    })

    const role = await resolveEffectiveRole(teamId, undefined, user.id)
    const existing = await kanbanService.getTask(taskId)

    notificationService.notifyKanbanTaskEvent({
      type: 'kanban_task_deleted',
      teamId,
      projectId: existing.projectId,
      creatorId: user.id,
      kanbanTaskId: taskId,
      stakeholderIds: [existing.creator?.id, existing.assignee?.id, existing.reporter?.id],
    })

    await auditLogService.logAction({
      action: AuditAction.kanban_task_delete,
      teamId,
      userId: user.id,
      projectId: existing.projectId ?? undefined,
      itemId: taskId,
    })

    await kanbanService.deleteTask(taskId, user.id, role)
    return c.json({ success: true })
  })

export default route
