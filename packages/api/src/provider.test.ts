import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Hono, type Context, type Next } from 'hono'
import providerRoute from './provider'
import { providerService } from '@shumai/core/src/provider/provider'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'

vi.mock('./middleware/auth', () => ({
  authMiddleware: async (
    c: Context<{ Variables: { user: { id: string; name: string } } }>,
    next: Next,
  ) => {
    c.set('user', { id: 'user1', name: 'Test User' })
    await next()
  },
}))

vi.mock('@shumai/core/src/authz/authz')
vi.mock('@shumai/core/src/provider/provider')

describe('provider api', () => {
  const app = new Hono<{ Variables: { user: { id: string; name: string } } }>()
    .use('*', async (c, next) => {
      c.set('user', { id: 'user1', name: 'Test User' })
      await next()
    })
    .route('/', providerRoute)

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(authzService.hasPermission).mockResolvedValue(undefined)
  })

  it('GET /teams/:teamId/providers returns providers', async () => {
    vi.mocked(providerService.listByTeam).mockResolvedValue([
      { id: 'p1', name: 'openai', config: { api: 'openai' } },
    ] as unknown as Awaited<ReturnType<typeof providerService.listByTeam>>)

    const res = await app.request('/teams/t1/providers')

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
    expect(data[0].id).toBe('p1')
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.anything(),
      permission: Permission.Admin,
      type: ResourceType.Team,
      id: 't1',
    })
  })

  it('GET /providers/:id/models returns models', async () => {
    vi.mocked(providerService.getById).mockResolvedValue({
      id: 'p1',
      teamId: 't1',
    } as unknown as Awaited<ReturnType<typeof providerService.getById>>)
    vi.mocked(providerService.listModelsByProvider).mockResolvedValue([
      { modelId: 'm1', name: 'model1' },
    ] as unknown as Awaited<ReturnType<typeof providerService.listModelsByProvider>>)

    const res = await app.request('/providers/p1/models')

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
    expect(data[0].modelId).toBe('m1')
    expect(providerService.listModelsByProvider).toHaveBeenCalledWith('t1', 'p1')
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.anything(),
      permission: Permission.Admin,
      type: ResourceType.Provider,
      id: 'p1',
    })
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
          input: ['text' as const],
          contextWindow: 128000,
          maxTokens: 4096,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        },
      },
    ]
    vi.mocked(providerService.create).mockResolvedValue({
      id: 'p1',
      name: 'openai',
      config,
      models,
    } as unknown as Awaited<ReturnType<typeof providerService.create>>)

    const res = await app.request('/teams/t1/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'openai', config, models }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.name).toBe('openai')
    expect(providerService.create).toHaveBeenCalledWith('t1', 'openai', config, models)
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.anything(),
      permission: Permission.Admin,
      type: ResourceType.Team,
      id: 't1',
    })
  })

  it('PUT /providers/:id updates provider', async () => {
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
          input: ['text' as const],
          contextWindow: 128000,
          maxTokens: 4096,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        },
      },
    ]
    vi.mocked(providerService.getById).mockResolvedValue({
      id: 'p1',
      teamId: 't1',
    } as unknown as Awaited<ReturnType<typeof providerService.getById>>)
    vi.mocked(providerService.update).mockResolvedValue({
      id: 'p1',
      name: 'openai',
      config,
      models,
    } as unknown as Awaited<ReturnType<typeof providerService.update>>)

    const res = await app.request('/providers/p1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, models }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.config.baseUrl).toBe('https://new-url.com')
    expect(providerService.update).toHaveBeenCalledWith('t1', 'p1', config, models)
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.anything(),
      permission: Permission.Admin,
      type: ResourceType.Provider,
      id: 'p1',
    })
  })

  it('DELETE /providers/:id deletes provider', async () => {
    vi.mocked(providerService.getById).mockResolvedValue({
      id: 'p1',
      teamId: 't1',
    } as unknown as Awaited<ReturnType<typeof providerService.getById>>)
    vi.mocked(providerService.delete).mockResolvedValue({
      id: 'p1',
    } as unknown as Awaited<ReturnType<typeof providerService.delete>>)

    const res = await app.request('/providers/p1', {
      method: 'DELETE',
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(providerService.delete).toHaveBeenCalledWith('t1', 'p1')
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.anything(),
      permission: Permission.Admin,
      type: ResourceType.Provider,
      id: 'p1',
    })
  })
})
