import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { kanbanService } from '@shumai/core/src/kanban/kanban'
import { kanbanContextService } from '@shumai/core/src/kanban/kanban-context'
import {
  authzService,
  Permission,
  ResourceType,
  resolveEffectiveRole,
} from '@shumai/core/src/authz/authz'
import {
  createKanbanTaskSchema,
  updateKanbanTaskSchema,
  requestChangesSchema,
  listKanbanTasksRequestSchema,
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

      const role = await resolveEffectiveRole(teamId, undefined, user.id)
      const task = await kanbanService.updateTask(taskId, req, user.id, role)
      return c.json(task)
    },
  )
  .post('/teams/:teamId/kanban/tasks/:taskId/start', async (c) => {
    const { taskId } = c.req.param()
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Edit,
      type: ResourceType.KanbanTask,
      id: taskId,
    })

    const task = await kanbanService.startManualTask(taskId, user.id)
    return c.json(task)
  })
  .post('/teams/:teamId/kanban/tasks/:taskId/complete', async (c) => {
    const { taskId } = c.req.param()
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Edit,
      type: ResourceType.KanbanTask,
      id: taskId,
    })

    const task = await kanbanService.completeManualTask(taskId, user.id)
    return c.json(task)
  })
  .post('/teams/:teamId/kanban/tasks/:taskId/approve', async (c) => {
    const { teamId, taskId } = c.req.param()
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.KanbanTask,
      id: taskId,
    })

    const role = await resolveEffectiveRole(teamId, undefined, user.id)
    const task = await kanbanService.approveTask(taskId, user.id, role)
    return c.json(task)
  })
  .post(
    '/teams/:teamId/kanban/tasks/:taskId/request-changes',
    zValidator('json', requestChangesSchema),
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

      const role = await resolveEffectiveRole(teamId, undefined, user.id)
      const task = await kanbanService.requestChanges(taskId, req.reason, user.id, role)
      return c.json(task)
    },
  )
  .post('/teams/:teamId/kanban/tasks/:taskId/unblock', async (c) => {
    const { taskId } = c.req.param()
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Edit,
      type: ResourceType.KanbanTask,
      id: taskId,
    })

    const task = await kanbanService.unblockTask(taskId, user.id)
    return c.json(task)
  })
  .post('/teams/:teamId/kanban/tasks/:taskId/reopen', async (c) => {
    const { taskId } = c.req.param()
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Edit,
      type: ResourceType.KanbanTask,
      id: taskId,
    })

    const task = await kanbanService.reopenTask(taskId, user.id)
    return c.json(task)
  })
  .post('/teams/:teamId/kanban/tasks/:taskId/cancel', async (c) => {
    const { taskId } = c.req.param()
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Edit,
      type: ResourceType.KanbanTask,
      id: taskId,
    })

    const task = await kanbanService.cancelTask(taskId, user.id)
    return c.json(task)
  })
  .get('/teams/:teamId/kanban/tasks/:taskId/context', async (c) => {
    const { taskId } = c.req.param()
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.KanbanTask,
      id: taskId,
    })

    const context = await kanbanContextService.buildAgentContext(taskId)
    return c.json({ context })
  })

export default route
