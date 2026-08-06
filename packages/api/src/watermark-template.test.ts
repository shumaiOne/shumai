import { describe, expect, test, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import watermarkTemplateRoute from './watermark-template'
import { authMiddleware } from './middleware/auth'
import { authzService } from '@shumai/core/src/authz/authz'
import { watermarkService } from '@shumai/core/src/watermark/watermark'
import { teamService } from '@shumai/core/src/team/team'

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
  },
}))

describe('Watermark Template API', () => {
  const app = new Hono().use('*', authMiddleware).route('/', watermarkTemplateRoute)

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(authzService.hasPermission).mockResolvedValue(undefined)
  })

  test('GET /watermark-templates', async () => {
    vi.spyOn(watermarkService, 'listTemplates').mockResolvedValue([
      {
        id: 'tpl1',
        name: 'Preset 1',
        config: { blocks: [] },
        teamId: 't1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ])

    const res = await app.request('/watermark-templates?teamId=t1', {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].name).toBe('Preset 1')
  })

  test("GET /watermark-templates without teamId scopes to the caller's teams", async () => {
    vi.spyOn(teamService, 'getUserTeams').mockResolvedValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: [{ id: 't1', name: 'My Team' }] as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pageInfo: {} as any,
    })
    vi.spyOn(watermarkService, 'listTemplates').mockResolvedValue([])

    const res = await app.request('/watermark-templates', {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    expect(watermarkService.listTemplates).toHaveBeenCalledWith(['t1'])
  })

  test('POST /watermark-templates', async () => {
    vi.spyOn(teamService, 'getUserTeams').mockResolvedValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: [{ id: 't1', name: 'My Team' }] as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pageInfo: {} as any,
    })
    vi.spyOn(watermarkService, 'createTemplate').mockResolvedValue({
      id: 'tpl1',
      name: 'New Preset',
      config: { blocks: [] },
      teamId: 't1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    const res = await app.request('/watermark-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'New Preset',
        config: { blocks: [] },
      }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe('New Preset')
  })

  test('DELETE /watermark-templates/:templateId', async () => {
    vi.spyOn(watermarkService, 'getTemplate').mockResolvedValue({
      id: 'tpl1',
      name: 'New Preset',
      config: { blocks: [] },
      teamId: 't1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    vi.spyOn(watermarkService, 'deleteTemplate').mockResolvedValue(undefined)

    const res = await app.request('/watermark-templates/tpl1', {
      method: 'DELETE',
    })

    expect(res.status).toBe(204)
    expect(watermarkService.deleteTemplate).toHaveBeenCalledWith('tpl1')
  })

  test('DELETE /watermark-templates/:templateId on a teamless template returns 403', async () => {
    vi.spyOn(watermarkService, 'getTemplate').mockResolvedValue({
      id: 'tpl-global',
      name: 'Platform Preset',
      config: { blocks: [] },
      teamId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    vi.spyOn(watermarkService, 'deleteTemplate').mockResolvedValue(undefined)

    const res = await app.request('/watermark-templates/tpl-global', {
      method: 'DELETE',
    })

    expect(res.status).toBe(403)
    expect(watermarkService.deleteTemplate).not.toHaveBeenCalled()
  })
})
