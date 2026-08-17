import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { quotaService } from '@shumai/core/src/quota/quota-service'
import {
  createQuotaRuleRequestSchema,
  updateQuotaRuleRequestSchema,
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

    const data = await quotaService.listRules(teamId)
    return c.json(data)
  })
  .post('/teams/:teamId/quotas', zValidator('json', createQuotaRuleRequestSchema), async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')
    const req = c.req.valid('json')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.Team,
      id: teamId,
    })

    const rule = await quotaService.createRule(teamId, req)
    await auditLogService.logAction({
      action: AuditAction.quota_rule_create,
      teamId,
      userId: user?.id,
      itemId: rule.id,
    })
    return c.json(rule, 201)
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

    const rule = await quotaService.getRule(teamId, id)
    return c.json(rule)
  })
  .get('/teams/:teamId/quotas/:id/records', async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')
    const id = c.req.param('id')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.Team,
      id: teamId,
    })

    const data = await quotaService.listRuleRecords(teamId, id)
    return c.json(data)
  })
  .put('/teams/:teamId/quotas/:id', zValidator('json', updateQuotaRuleRequestSchema), async (c) => {
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

    const rule = await quotaService.updateRule(teamId, id, req)
    await auditLogService.logAction({
      action: AuditAction.quota_rule_update,
      teamId,
      userId: user?.id,
      itemId: id,
    })
    return c.json(rule)
  })
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

    await quotaService.deleteRule(teamId, id)
    await auditLogService.logAction({
      action: AuditAction.quota_rule_delete,
      teamId,
      userId: user?.id,
      itemId: id,
    })
    return new Response(null, { status: 204 })
  })

export default route
