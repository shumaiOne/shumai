import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import providerRoute from './provider'
import { authMiddleware } from '@/api/middleware/auth'
import { providerService } from '@/services/provider/provider'
import { authzService } from '@/services/authz/authz'

vi.mock('@/services/authz/authz', () => ({
  authzService: {
    hasPermission: vi.fn(),
  },
  Permission: {
    Read: 'Read',
    Edit: 'Edit',
    Admin: 'Admin',
  },
}))

vi.mock('@/api/middleware/auth', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authMiddleware: async (c: any, next: any) => {
    c.set('user', { id: 'user1', name: 'Test User' })
    await next()
  },
}))

describe('provider api', () => {
  const app = new Hono().use('*', authMiddleware).route('/', providerRoute)

  let mockListByTeam: any // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockCreate: any // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockUpdate: any // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockDelete: any // eslint-disable-line @typescript-eslint/no-explicit-any

  beforeEach(() => {
    mockListByTeam = vi.spyOn(providerService, 'listByTeam')
    mockCreate = vi.spyOn(providerService, 'create')
    mockUpdate = vi.spyOn(providerService, 'update')
    mockDelete = vi.spyOn(providerService, 'delete')

    // Default to admin permission granted
    vi.mocked(authzService.hasPermission).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('GET /teams/:teamId/providers returns providers', async () => {
    mockListByTeam.mockResolvedValue([{ id: 'p1', name: 'openai', config: {} }])

    const res = await app.request('/teams/t1/providers')

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
    expect(data[0].id).toBe('p1')
    expect(authzService.hasPermission).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 't1',
        permission: 'Admin',
      }),
    )
  })

  it('GET /teams/:teamId/providers/:id/models returns models', async () => {
    const mockListModelsByProvider = vi.spyOn(providerService, 'listModelsByProvider')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockListModelsByProvider.mockResolvedValue([{ modelId: 'm1', name: 'model1' } as any])

    const res = await app.request('/teams/t1/providers/p1/models')

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
    expect(data[0].modelId).toBe('m1')
    expect(mockListModelsByProvider).toHaveBeenCalledWith('t1', 'p1')
  })

  it('POST /teams/:teamId/providers creates provider', async () => {
    const config = {
      baseUrl: 'https://api.openai.com/v1',
      api: 'openai-completions',
    }
    const models = [
      {
        modelId: 'gpt-4',
        name: 'GPT-4',
        config: {
          api: 'openai-completions',
          reasoning: false,
          input: ['text'],
          contextWindow: 128000,
          maxTokens: 4096,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        },
      },
    ]
    mockCreate.mockResolvedValue({ id: 'p1', name: 'openai', config, models })

    const res = await app.request('/teams/t1/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'openai', config, models }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.name).toBe('openai')
    expect(mockCreate).toHaveBeenCalledWith('t1', 'openai', config, models)
  })

  it('PUT /teams/:teamId/providers/:id updates provider', async () => {
    const config = {
      baseUrl: 'https://new-url.com',
      api: 'openai-completions',
    }
    const models = [
      {
        modelId: 'gpt-4',
        name: 'GPT-4',
        config: {
          api: 'openai-completions',
          reasoning: false,
          input: ['text'],
          contextWindow: 128000,
          maxTokens: 4096,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        },
      },
    ]
    mockUpdate.mockResolvedValue({ id: 'p1', name: 'openai', config, models })

    const res = await app.request('/teams/t1/providers/p1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, models }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.config.baseUrl).toBe('https://new-url.com')
    expect(mockUpdate).toHaveBeenCalledWith('t1', 'p1', config, models)
  })

  it('DELETE /teams/:teamId/providers/:id deletes provider', async () => {
    mockDelete.mockResolvedValue({ id: 'p1' })

    const res = await app.request('/teams/t1/providers/p1', {
      method: 'DELETE',
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(mockDelete).toHaveBeenCalledWith('t1', 'p1')
  })
})
