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
    listPolicies: vi.fn(),
    createPolicy: vi.fn(),
    getPolicy: vi.fn(),
    updatePolicy: vi.fn(),
    deletePolicy: vi.fn(),
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
    QuotaPolicy: 'quotaPolicy',
  },
}))

describe('Quota API', () => {
  const app = new Hono().use('*', authMiddleware).route('/', quotaRoute)

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(authzService.hasPermission).mockResolvedValue(undefined)
  })

  describe('GET /teams/:teamId/quotas', () => {
    test('Success listing quota policies', async () => {
      const mockResult = {
        total: 1,
        policies: [
          {
            id: 'policy1',
            teamId: 'team1',
            scopeType: 'team' as const,
            resource: 'agent_total_tokens' as const,
            limit: 50000,
            period: '1hour' as const,
            enabled: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      }
      vi.spyOn(quotaService, 'listPolicies').mockResolvedValue(mockResult)

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
    test('Success creating policy with audit log', async () => {
      const mockPolicy = {
        id: 'policy1',
        teamId: 'team1',
        scopeType: 'team' as const,
        resource: 'agent_total_tokens' as const,
        limit: 100000,
        period: '1day' as const,
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      vi.spyOn(quotaService, 'createPolicy').mockResolvedValue(mockPolicy)

      const res = await app.request('/teams/team1/quotas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test',
        },
        body: JSON.stringify({
          scopeType: 'team',
          resource: 'agent_total_tokens',
          limit: 100000,
          period: '1day',
        }),
      })

      expect(res.status).toBe(201)
      expect(await res.json()).toEqual(mockPolicy)
      expect(quotaService.createPolicy).toHaveBeenCalledWith('team1', {
        scopeType: 'team',
        resource: 'agent_total_tokens',
        limit: 100000,
        period: '1day',
        enabled: true,
      })
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        action: AuditAction.quota_policy_create,
        teamId: 'team1',
        userId: 'user1',
        itemId: 'policy1',
      })
    })
  })

  describe('GET /teams/:teamId/quotas/:id', () => {
    test('Success fetching single policy', async () => {
      const mockPolicy = {
        id: 'policy1',
        teamId: 'team1',
        scopeType: 'team' as const,
        resource: 'agent_cost' as const,
        limit: 50,
        period: '1day' as const,
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      vi.spyOn(quotaService, 'getPolicy').mockResolvedValue(mockPolicy)

      const res = await app.request('/teams/team1/quotas/policy1', {
        method: 'GET',
        headers: { Authorization: 'Bearer test' },
      })

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual(mockPolicy)
    })
  })

  describe('PUT /teams/:teamId/quotas/:id', () => {
    test('Success updating policy with audit log', async () => {
      const updatedPolicy = {
        id: 'policy1',
        teamId: 'team1',
        scopeType: 'team' as const,
        resource: 'agent_cost' as const,
        limit: 100,
        period: '1day' as const,
        enabled: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      vi.spyOn(quotaService, 'updatePolicy').mockResolvedValue(updatedPolicy)

      const res = await app.request('/teams/team1/quotas/policy1', {
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
      expect(await res.json()).toEqual(updatedPolicy)
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        action: AuditAction.quota_policy_update,
        teamId: 'team1',
        userId: 'user1',
        itemId: 'policy1',
      })
    })
  })

  describe('DELETE /teams/:teamId/quotas/:id', () => {
    test('Success deleting policy with audit log', async () => {
      vi.spyOn(quotaService, 'deletePolicy').mockResolvedValue(undefined)

      const res = await app.request('/teams/team1/quotas/policy1', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test' },
      })

      expect(res.status).toBe(204)
      expect(quotaService.deletePolicy).toHaveBeenCalledWith('team1', 'policy1')
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        action: AuditAction.quota_policy_delete,
        teamId: 'team1',
        userId: 'user1',
        itemId: 'policy1',
      })
    })
  })
})
