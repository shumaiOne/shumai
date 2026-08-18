import { describe, expect, test, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import quotaRoute from './quota'
import { quotaService } from '@shumai/core/src/quota/quota-service'
import { authMiddleware } from './middleware/auth'
import { authzService, ResourceType, Permission } from '@shumai/core/src/authz/authz'
import { auditLogService } from '@shumai/core/src/auditLog/auditLog'
import { AuditAction } from '@shumai/dtos'

vi.mock('@shumai/core/src/auditLog/auditLog', () => ({
  auditLogService: {
    logAction: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('@shumai/core/src/quota/quota-service', () => ({
  quotaService: {
    listRules: vi.fn(),
    createRule: vi.fn(),
    getRule: vi.fn(),
    listRuleRecords: vi.fn(),
    resetRecord: vi.fn(),
    updateRule: vi.fn(),
    deleteRule: vi.fn(),
  },
}))

vi.mock('./middleware/auth', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authMiddleware: async (c: any, next: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    c.set('user', { id: 'user1', name: 'Test User' } as any)
    await next()
  },
}))

vi.mock('@shumai/core/src/authz/authz', () => ({
  authzService: {
    hasPermission: vi.fn().mockResolvedValue(undefined),
  },
  Permission: {
    Read: 'Read',
    Edit: 'Edit',
    Admin: 'Admin',
  },
  ResourceType: {
    Team: 'team',
    QuotaRule: 'quotaRule',
  },
}))

describe('Quota API', () => {
  const app = new Hono().use('*', authMiddleware).route('/', quotaRoute)

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(authzService.hasPermission).mockResolvedValue(undefined)
  })

  describe('GET /teams/:teamId/quotas', () => {
    test('Success listing quota rules', async () => {
      const mockResult = {
        total: 1,
        rules: [
          {
            id: 'rule1',
            teamId: 'team1',
            scopeMode: 'all_members' as const,
            resource: 'agent_total_tokens' as const,
            limit: 50000,
            period: '1hour' as const,
            enabled: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      }
      vi.spyOn(quotaService, 'listRules').mockResolvedValue(mockResult)

      const res = await app.request('/teams/team1/quotas', {
        method: 'GET',
        headers: { Authorization: 'Bearer test' },
      })

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual(mockResult)
      expect(authzService.hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ResourceType.Team,
          id: 'team1',
          permission: Permission.Admin,
        }),
      )
    })
  })

  describe('POST /teams/:teamId/quotas', () => {
    test('Success creating rule with audit log', async () => {
      const mockRule = {
        id: 'rule1',
        teamId: 'team1',
        scopeMode: 'all_members' as const,
        resource: 'agent_total_tokens' as const,
        limit: 100000,
        period: '1day' as const,
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      vi.spyOn(quotaService, 'createRule').mockResolvedValue(mockRule)

      const res = await app.request('/teams/team1/quotas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test',
        },
        body: JSON.stringify({
          scopeMode: 'all_members',
          resource: 'agent_total_tokens',
          limit: 100000,
          period: '1day',
        }),
      })

      expect(res.status).toBe(201)
      expect(await res.json()).toEqual(mockRule)
      expect(quotaService.createRule).toHaveBeenCalledWith('team1', {
        scopeMode: 'all_members',
        resource: 'agent_total_tokens',
        limit: 100000,
        period: '1day',
        enabled: true,
      })
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        action: AuditAction.quota_rule_create,
        teamId: 'team1',
        userId: 'user1',
        itemId: 'rule1',
      })
    })
  })

  describe('GET /teams/:teamId/quotas/:id', () => {
    test('Success fetching single rule', async () => {
      const mockRule = {
        id: 'rule1',
        teamId: 'team1',
        scopeMode: 'all_members' as const,
        resource: 'agent_cost' as const,
        limit: 50,
        period: '1day' as const,
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      vi.spyOn(quotaService, 'getRule').mockResolvedValue(mockRule)

      const res = await app.request('/teams/team1/quotas/rule1', {
        method: 'GET',
        headers: { Authorization: 'Bearer test' },
      })

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual(mockRule)
    })
  })

  describe('GET /teams/:teamId/quotas/:id/records', () => {
    test('Success listing records for a rule', async () => {
      const mockRecordsResult = {
        total: 1,
        records: [
          {
            id: 'rec1',
            ruleId: 'rule1',
            teamId: 'team1',
            userId: null,
            user: null,
            periodStart: null,
            periodEnd: null,
            consumed: 0,
            remaining: 50,
            percent: 0,
            isWindowActive: false,
          },
        ],
      }
      vi.spyOn(quotaService, 'listRuleRecords').mockResolvedValue(mockRecordsResult)

      const res = await app.request('/teams/team1/quotas/rule1/records', {
        method: 'GET',
        headers: { Authorization: 'Bearer test' },
      })

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual(mockRecordsResult)
      expect(quotaService.listRuleRecords).toHaveBeenCalledWith('team1', 'rule1')
    })
  })

  describe('POST /teams/:teamId/quotas/:id/records/reset', () => {
    test('Rejects a reset request without a userId', async () => {
      const res = await app.request('/teams/team1/quotas/rule1/records/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test',
        },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(400)
      expect(quotaService.resetRecord).not.toHaveBeenCalled()
    })

    test('Success resetting a quota record with audit log', async () => {
      const mockRecord = {
        id: 'record1',
        ruleId: 'rule1',
        teamId: 'team1',
        userId: 'user2',
        user: null,
        periodStart: new Date().toISOString(),
        periodEnd: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        consumed: 0,
        remaining: 100,
        percent: 0,
        isWindowActive: true,
      }
      vi.spyOn(quotaService, 'resetRecord').mockResolvedValue(mockRecord)

      const res = await app.request('/teams/team1/quotas/rule1/records/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test',
        },
        body: JSON.stringify({ userId: 'user2' }),
      })

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual(mockRecord)
      expect(quotaService.resetRecord).toHaveBeenCalledWith('team1', 'rule1', 'user2')
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        action: AuditAction.quota_record_reset,
        teamId: 'team1',
        userId: 'user1',
        itemId: 'record1',
      })
    })
  })

  describe('PUT /teams/:teamId/quotas/:id', () => {
    test('Success updating rule with audit log', async () => {
      const updatedRule = {
        id: 'rule1',
        teamId: 'team1',
        scopeMode: 'all_members' as const,
        resource: 'agent_cost' as const,
        limit: 100,
        period: '1day' as const,
        enabled: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      vi.spyOn(quotaService, 'updateRule').mockResolvedValue(updatedRule)

      const res = await app.request('/teams/team1/quotas/rule1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test',
        },
        body: JSON.stringify({
          limit: 100,
          enabled: false,
        }),
      })

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual(updatedRule)
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        action: AuditAction.quota_rule_update,
        teamId: 'team1',
        userId: 'user1',
        itemId: 'rule1',
      })
    })
  })

  describe('DELETE /teams/:teamId/quotas/:id', () => {
    test('Success deleting rule with audit log', async () => {
      vi.spyOn(quotaService, 'deleteRule').mockResolvedValue(undefined)

      const res = await app.request('/teams/team1/quotas/rule1', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test' },
      })

      expect(res.status).toBe(204)
      expect(quotaService.deleteRule).toHaveBeenCalledWith('team1', 'rule1')
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        action: AuditAction.quota_rule_delete,
        teamId: 'team1',
        userId: 'user1',
        itemId: 'rule1',
      })
    })
  })
})
