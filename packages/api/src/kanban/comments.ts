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
import { createKanbanCommentSchema, postAttachmentRequestSchema, AuditAction } from '@shumai/dtos'
import type { Prisma } from '@shumai/db'

type User = Prisma.UserGetPayload<Record<string, never>>

const route = new Hono<{ Variables: { user: User } }>()
  .post(
    '/teams/:teamId/kanban/attachments',
    zValidator('json', postAttachmentRequestSchema),
    async (c) => {
      const { teamId } = c.req.param()
      const req = c.req.valid('json')
      const user = c.get('user')

      await authzService.hasPermission({
        user,
        permission: Permission.Read,
        type: ResourceType.Team,
        id: teamId,
      })

      const attachment = await kanbanService.createAttachment(teamId, req)
      return c.json(attachment)
    },
  )
  .post(
    '/teams/:teamId/kanban/tasks/:taskId/comments',
    zValidator('json', createKanbanCommentSchema),
    async (c) => {
      const { teamId, taskId } = c.req.param()
      const req = c.req.valid('json')
      const user = c.get('user')

      await authzService.hasPermission({
        user,
        permission: Permission.Read,
        type: ResourceType.KanbanTask,
        id: taskId,
      })

      const comment = await kanbanService.addComment(taskId, user.id, req.body, req.attachments)
      const task = await kanbanService.getTask(taskId)

      await auditLogService.logAction({
        action: AuditAction.kanban_comment_create,
        teamId,
        userId: user.id,
        projectId: task.projectId ?? undefined,
        itemId: comment.id,
      })

      notificationService.notifyKanbanTaskEvent({
        type: 'kanban_task_comment_created',
        teamId,
        projectId: task.projectId,
        creatorId: user.id,
        kanbanTaskId: taskId,
        stakeholderIds: [task.creator?.id, task.assignee?.id, task.reporter?.id],
        commentMessage: req.body,
      })

      return c.json(comment)
    },
  )
  .get('/teams/:teamId/kanban/tasks/:taskId/comments', async (c) => {
    const { taskId } = c.req.param()
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.KanbanTask,
      id: taskId,
    })

    const comments = await kanbanService.listComments(taskId)
    return c.json({ data: comments })
  })
  .delete('/teams/:teamId/kanban/tasks/:taskId/comments/:commentId', async (c) => {
    const { teamId, taskId, commentId } = c.req.param()
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.KanbanTask,
      id: taskId,
    })

    const userRole = await resolveEffectiveRole(teamId, undefined, user.id)
    const task = await kanbanService.getTask(taskId)
    await kanbanService.deleteComment(taskId, commentId, user.id, userRole)

    await auditLogService.logAction({
      action: AuditAction.kanban_comment_delete,
      teamId,
      userId: user.id,
      projectId: task.projectId ?? undefined,
      itemId: commentId,
    })

    return c.json({ success: true })
  })
  .get('/teams/:teamId/kanban/tasks/:taskId/events', async (c) => {
    const { taskId } = c.req.param()
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.KanbanTask,
      id: taskId,
    })

    const events = await kanbanService.listEvents(taskId)
    return c.json({ data: events })
  })

export default route
