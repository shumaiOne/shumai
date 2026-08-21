import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { kanbanService } from '@shumai/core/src/kanban/kanban'
import { auditLogService } from '@shumai/core/src/auditLog/auditLog'
import {
  authzService,
  Permission,
  ResourceType,
  resolveEffectiveRole,
} from '@shumai/core/src/authz/authz'
import {
  createKanbanGoalSchema,
  updateKanbanGoalSchema,
  listKanbanGoalsRequestSchema,
  AuditAction,
} from '@shumai/dtos'
import type { Prisma } from '@shumai/db'

type User = Prisma.UserGetPayload<Record<string, never>>

const route = new Hono<{ Variables: { user: User } }>()
  .post('/teams/:teamId/kanban/goals', zValidator('json', createKanbanGoalSchema), async (c) => {
    const { teamId } = c.req.param()
    const req = c.req.valid('json')
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.Team,
      id: teamId,
    })

    const role = await resolveEffectiveRole(teamId, undefined, user.id)
    const goal = await kanbanService.createGoal(teamId, req, user.id, role)

    await auditLogService.logAction({
      action: AuditAction.kanban_goal_create,
      teamId,
      userId: user.id,
      itemId: goal.id,
    })

    return c.json(goal)
  })
  .get(
    '/teams/:teamId/kanban/goals',
    zValidator('query', listKanbanGoalsRequestSchema),
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

      const goals = await kanbanService.listGoals(teamId, req)
      return c.json({ data: goals })
    },
  )
  .get('/teams/:teamId/kanban/goals/:goalId', async (c) => {
    const { goalId } = c.req.param()
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.KanbanGoal,
      id: goalId,
    })

    const goal = await kanbanService.getGoal(goalId)
    return c.json(goal)
  })
  .patch(
    '/teams/:teamId/kanban/goals/:goalId',
    zValidator('json', updateKanbanGoalSchema),
    async (c) => {
      const { teamId, goalId } = c.req.param()
      const req = c.req.valid('json')
      const user = c.get('user')

      await authzService.hasPermission({
        user,
        permission: Permission.Admin,
        type: ResourceType.KanbanGoal,
        id: goalId,
      })

      const role = await resolveEffectiveRole(teamId, undefined, user.id)
      const goal = await kanbanService.updateGoal(goalId, req, role)

      await auditLogService.logAction({
        action: AuditAction.kanban_goal_update,
        teamId,
        userId: user.id,
        itemId: goalId,
      })

      return c.json(goal)
    },
  )
  .delete('/teams/:teamId/kanban/goals/:goalId', async (c) => {
    const { teamId, goalId } = c.req.param()
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.KanbanGoal,
      id: goalId,
    })

    const role = await resolveEffectiveRole(teamId, undefined, user.id)
    await kanbanService.deleteGoal(goalId, role)

    await auditLogService.logAction({
      action: AuditAction.kanban_goal_delete,
      teamId,
      userId: user.id,
      itemId: goalId,
    })

    return c.json({ ok: true })
  })

export default route
