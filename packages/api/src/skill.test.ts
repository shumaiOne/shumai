import { describe, expect, test, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import skillRoute from './skill'
import { skillService } from '@shumai/core/src/skill/skill'
import { authMiddleware } from './middleware/auth'
import { authzService, ResourceType, Permission } from '@shumai/core/src/authz/authz'

import { auditLogService } from '@shumai/core/src/auditLog/auditLog'

vi.mock('@shumai/core/src/auditLog/auditLog', () => ({
  auditLogService: {
    logAction: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('@shumai/core/src/skill/skill', () => ({
  skillService: {
    listSkills: vi.fn(),
    upsertSkill: vi.fn(),
    deleteSkill: vi.fn(),
    updateSkillConfig: vi.fn(),
    updateSkillPermission: vi.fn(),
    getSkill: vi.fn().mockResolvedValue({ id: 'skill1', teamId: 'team1' }),
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
    Skill: 'skill',
  },
}))

describe('Skill API', () => {
  const app = new Hono().use('*', authMiddleware).route('/', skillRoute)

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(authzService.hasPermission).mockResolvedValue(undefined)
    vi.mocked(skillService.getSkill).mockResolvedValue({
      id: 'skill1',
      teamId: 'team1',
    } as unknown as Awaited<ReturnType<typeof skillService.getSkill>>)
  })

  describe('GET /teams/:teamId/skills', () => {
    test('Success', async () => {
      const mockSkills = [
        {
          id: 'skill1',
          name: 'Skill 1',
          description: 'Desc 1',
          config: null,
          assetId: 'asset1',
          hash: 'hash1',
          permission: 'reviewer' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]
      vi.spyOn(skillService, 'listSkills').mockResolvedValue(mockSkills)

      const res = await app.request('/teams/team1/skills', {
        method: 'GET',
        headers: { Authorization: 'Bearer test' },
      })

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ skills: mockSkills })
      expect(authzService.hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ResourceType.Team,
          id: 'team1',
          permission: Permission.Admin,
        }),
      )
    })
  })

  describe('POST /teams/:teamId/skills', () => {
    test('Success with assetId', async () => {
      const mockSkill = {
        id: 'skill1',
        name: 'Skill 1',
        description: 'Desc 1',
        config: null,
        assetId: 'asset1',
        hash: 'hash1',
        permission: 'reviewer' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      vi.spyOn(skillService, 'upsertSkill').mockResolvedValue(mockSkill)

      const res = await app.request('/teams/team1/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test' },
        body: JSON.stringify({ assetId: 'asset1' }),
      })

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual(mockSkill)
      expect(authzService.hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ResourceType.Team,
          id: 'team1',
          permission: Permission.Admin,
        }),
      )
      expect(skillService.upsertSkill).toHaveBeenCalledWith('team1', { assetId: 'asset1' })
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        action: 'skill_create',
        teamId: 'team1',
        userId: 'user1',
        itemId: 'skill1',
      })
    })

    test('Success with githubUrl', async () => {
      const mockSkill = {
        id: 'skill1',
        name: 'Skill 1',
        description: 'Desc 1',
        config: null,
        assetId: 'asset1',
        hash: 'hash1',
        permission: 'reviewer' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      vi.spyOn(skillService, 'upsertSkill').mockResolvedValue(mockSkill)

      const res = await app.request('/teams/team1/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test' },
        body: JSON.stringify({ githubUrl: 'https://github.com/test/repo' }),
      })

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual(mockSkill)
      expect(skillService.upsertSkill).toHaveBeenCalledWith('team1', {
        githubUrl: 'https://github.com/test/repo',
      })
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        action: 'skill_create',
        teamId: 'team1',
        userId: 'user1',
        itemId: 'skill1',
      })
    })

    test('Forbidden without Admin permission', async () => {
      vi.mocked(authzService.hasPermission).mockRejectedValueOnce(new Error('Forbidden'))

      const res = await app.request('/teams/team1/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test' },
        body: JSON.stringify({ assetId: 'asset1' }),
      })

      expect(res.status).toBe(500) // The app uses a global error handler that returns 500 for thrown errors in these tests
    })
  })

  describe('DELETE /skills/:id', () => {
    test('Success', async () => {
      vi.spyOn(skillService, 'deleteSkill').mockResolvedValue(undefined)

      const res = await app.request('/skills/skill1', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test' },
      })

      expect(res.status).toBe(204)
      expect(authzService.hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ResourceType.Skill,
          id: 'skill1',
          permission: Permission.Admin,
        }),
      )
      expect(skillService.deleteSkill).toHaveBeenCalledWith('skill1')
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        action: 'skill_delete',
        teamId: 'team1',
        userId: 'user1',
        itemId: 'skill1',
      })
    })
  })

  describe('PATCH /skills/:id/config', () => {
    test('Success', async () => {
      const mockConfig = {
        environmentVariables: [{ name: 'TEST_VAR', default: 'test_val' }],
      }
      const mockSkill = {
        id: 'skill1',
        name: 'Skill 1',
        description: 'Desc 1',
        config: mockConfig,
        assetId: 'asset1',
        hash: 'hash1',
        permission: 'reviewer' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      vi.spyOn(skillService, 'updateSkillConfig').mockResolvedValue(mockSkill)

      const res = await app.request('/skills/skill1/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test' },
        body: JSON.stringify({ config: mockConfig }),
      })

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual(mockSkill)
      expect(authzService.hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ResourceType.Skill,
          id: 'skill1',
          permission: Permission.Admin,
        }),
      )
      expect(skillService.updateSkillConfig).toHaveBeenCalledWith('skill1', mockConfig)
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        action: 'skill_update',
        teamId: 'team1',
        userId: 'user1',
        itemId: 'skill1',
      })
    })
  })

  describe('PATCH /skills/:id/permission', () => {
    test('Success', async () => {
      const mockSkill = {
        id: 'skill1',
        name: 'Skill 1',
        description: 'Desc 1',
        config: null,
        assetId: 'asset1',
        hash: 'hash1',
        permission: 'owner' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      vi.spyOn(skillService, 'updateSkillPermission').mockResolvedValue(mockSkill)

      const res = await app.request('/skills/skill1/permission', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test' },
        body: JSON.stringify({ permission: 'owner' }),
      })

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual(mockSkill)
      expect(authzService.hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ResourceType.Skill,
          id: 'skill1',
          permission: Permission.Admin,
        }),
      )
      expect(skillService.updateSkillPermission).toHaveBeenCalledWith('skill1', 'owner')
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        action: 'skill_update',
        teamId: 'team1',
        userId: 'user1',
        itemId: 'skill1',
      })
    })
  })
})
