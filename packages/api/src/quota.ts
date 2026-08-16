import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { quotaService } from '@shumai/core/src/quota/quota-service'
import {
  createQuotaPolicyRequestSchema,
  updateQuotaPolicyRequestSchema,
  AuditAction,
} from '@shumai/dtos'
import type { Prisma } from '@shumai/db'
import { auditLogService } from '@shumai/core/src/auditLog/auditLog'

type User = Prisma.UserGetPayload<Record<string, never>>

const route = new Hono<{ Variables: { user: User } }>()
  .get('/teams/:teamId/quotas', async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.Team,
      id: teamId,
    })

    const data = await quotaService.listPolicies(teamId)
    return c.json(data)
  })
  .post('/teams/:teamId/quotas', zValidator('json', createQuotaPolicyRequestSchema), async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')
    const req = c.req.valid('json')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.Team,
      id: teamId,
    })

    const policy = await quotaService.createPolicy(teamId, req)
    await auditLogService.logAction({
      action: AuditAction.quota_policy_create,
      teamId,
      userId: user?.id,
      itemId: policy.id,
    })
    return c.json(policy, 201)
  })
  .get('/teams/:teamId/quotas/:id', async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')
    const id = c.req.param('id')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.Team,
      id: teamId,
    })

    const policy = await quotaService.getPolicy(teamId, id)
    return c.json(policy)
  })
  .put(
    '/teams/:teamId/quotas/:id',
    zValidator('json', updateQuotaPolicyRequestSchema),
    async (c) => {
      const user = c.get('user')
      const teamId = c.req.param('teamId')
      const id = c.req.param('id')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        user,
        permission: Permission.Admin,
        type: ResourceType.Team,
        id: teamId,
      })

      const policy = await quotaService.updatePolicy(teamId, id, req)
      await auditLogService.logAction({
        action: AuditAction.quota_policy_update,
        teamId,
        userId: user?.id,
        itemId: id,
      })
      return c.json(policy)
    },
  )
  .delete('/teams/:teamId/quotas/:id', async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')
    const id = c.req.param('id')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.Team,
      id: teamId,
    })

    await quotaService.deletePolicy(teamId, id)
    await auditLogService.logAction({
      action: AuditAction.quota_policy_delete,
      teamId,
      userId: user?.id,
      itemId: id,
    })
    return new Response(null, { status: 204 })
  })

export default route
