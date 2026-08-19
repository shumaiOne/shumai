import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { kanbanService } from '@shumai/core/src/kanban/kanban'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { createKanbanLinkSchema } from '@shumai/dtos'
import type { Prisma } from '@shumai/db'

type User = Prisma.UserGetPayload<Record<string, never>>

const route = new Hono<{ Variables: { user: User } }>()
  .post(
    '/teams/:teamId/kanban/tasks/:taskId/dependencies',
    zValidator('json', createKanbanLinkSchema),
    async (c) => {
      const { taskId } = c.req.param()
      const req = c.req.valid('json')
      const user = c.get('user')

      await authzService.hasPermission({
        user,
        permission: Permission.Edit,
        type: ResourceType.KanbanTask,
        id: taskId,
      })

      await kanbanService.addDependency(req.parentId, taskId, user.id)
      return c.json({ success: true })
    },
  )
  .delete('/teams/:teamId/kanban/tasks/:taskId/dependencies/:parentId', async (c) => {
    const { taskId, parentId } = c.req.param()
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Edit,
      type: ResourceType.KanbanTask,
      id: taskId,
    })

    await kanbanService.removeDependency(parentId, taskId, user.id)
    return c.json({ success: true })
  })

export default route
