import { describe, expect, test, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import skillRoute from './skill'
import { skillService } from '@/services/skill/skill'
import { authMiddleware } from '@/api/middleware/auth'
import { authzService, ResourceType, Permission } from '@/services/authz/authz'

vi.mock('@/api/middleware/auth', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authMiddleware: async (c: any, next: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    c.set('user', { id: 'user1', name: 'Test User' } as any)
    await next()
  },
}))

vi.mock('@/services/authz/authz', () => ({
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
    })

    test('Success with githubUrl', async () => {
      const mockSkill = {
        id: 'skill1',
        name: 'Skill 1',
        description: 'Desc 1',
        config: null,
        assetId: 'asset1',
        hash: 'hash1',
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
    })
  })
})
