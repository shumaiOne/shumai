import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import mediaGenerationRoute from './media-generation'
import { mediaGenerationService } from '@shumai/core/src/media-generation/media-generation'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'

vi.mock('@shumai/core/src/authz/authz')
vi.mock('@shumai/core/src/media-generation/media-generation')

describe('media-generation api', () => {
  const app = new Hono<{ Variables: { user: { id: string; name: string } } }>()
    .use('*', async (c, next) => {
      c.set('user', { id: 'user1', name: 'Test User' })
      await next()
    })
    .route('/', mediaGenerationRoute)

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(authzService.hasPermission).mockResolvedValue(undefined)
  })

  it('GET /teams/:teamId/media-generation returns settings', async () => {
    vi.mocked(mediaGenerationService.getSettings).mockResolvedValue({
      providers: [
        {
          provider: 'openai',
          defaultEnvKey: 'OPENAI_API_KEY',
          apiKeyConfigured: true,
          status: 'configured_env',
          supportedTypes: ['image'],
        },
      ],
      enabledModels: [],
    })

    const res = await app.request('/teams/t1/media-generation')

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.providers).toHaveLength(1)
    expect(data.providers[0].provider).toBe('openai')
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.anything(),
      permission: Permission.Admin,
      type: ResourceType.Team,
      id: 't1',
    })
    expect(mediaGenerationService.getSettings).toHaveBeenCalledWith('t1')
  })

  it('PUT /teams/:teamId/media-generation/providers/:provider updates api key and models', async () => {
    vi.mocked(mediaGenerationService.updateProvider).mockResolvedValue(undefined)

    const res = await app.request('/teams/t1/media-generation/providers/openai', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: 'sk-new-key',
        models: [{ type: 'image', modelId: 'dall-e-3', name: 'DALL-E 3' }],
      }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.anything(),
      permission: Permission.Admin,
      type: ResourceType.Team,
      id: 't1',
    })
    expect(mediaGenerationService.updateProvider).toHaveBeenCalledWith('t1', 'openai', {
      apiKey: 'sk-new-key',
      models: [{ type: 'image', modelId: 'dall-e-3', name: 'DALL-E 3' }],
    })
  })

  it('POST /teams/:teamId/media-generation/models adds an enabled model', async () => {
    vi.mocked(mediaGenerationService.addEnabledModel).mockResolvedValue({
      id: 'm1',
      type: 'image',
      provider: 'openai',
      modelId: 'dall-e-3',
      name: 'DALL-E 3',
      createdAt: new Date().toISOString(),
    })

    const res = await app.request('/teams/t1/media-generation/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'image',
        provider: 'openai',
        modelId: 'dall-e-3',
        name: 'DALL-E 3',
      }),
    })

    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.id).toBe('m1')
    expect(data.modelId).toBe('dall-e-3')
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.anything(),
      permission: Permission.Admin,
      type: ResourceType.Team,
      id: 't1',
    })
    expect(mediaGenerationService.addEnabledModel).toHaveBeenCalledWith('t1', {
      type: 'image',
      provider: 'openai',
      modelId: 'dall-e-3',
      name: 'DALL-E 3',
    })
  })

  it('DELETE /teams/:teamId/media-generation/models/:modelId removes an enabled model', async () => {
    vi.mocked(mediaGenerationService.removeEnabledModel).mockResolvedValue(undefined)

    const res = await app.request('/teams/t1/media-generation/models/m1', {
      method: 'DELETE',
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.anything(),
      permission: Permission.Admin,
      type: ResourceType.Team,
      id: 't1',
    })
    expect(mediaGenerationService.removeEnabledModel).toHaveBeenCalledWith('t1', 'm1')
  })
})
