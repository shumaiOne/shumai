import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { kanbanService } from '@shumai/core/src/kanban/kanban'
import {
  authzService,
  Permission,
  ResourceType,
  resolveEffectiveRole,
} from '@shumai/core/src/authz/authz'
import { createKanbanCommentSchema, postAttachmentRequestSchema } from '@shumai/dtos'
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
      const { taskId } = c.req.param()
      const req = c.req.valid('json')
      const user = c.get('user')

      await authzService.hasPermission({
        user,
        permission: Permission.Read,
        type: ResourceType.KanbanTask,
        id: taskId,
      })

      const comment = await kanbanService.addComment(taskId, user.id, req.body, req.attachments)
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
    await kanbanService.deleteComment(taskId, commentId, user.id, userRole)
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
