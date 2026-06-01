import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Hono, type Context, type Next } from 'hono'
import metadataRoute from './metadata'
import { metadataService } from '@shumai/core/src/metadata/metadata'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'

vi.mock('@/api/middleware/auth', () => ({
  authMiddleware: async (
    c: Context<{ Variables: { user: { id: string; name: string } } }>,
    next: Next,
  ) => {
    c.set('user', { id: 'user1', name: 'Test User' })
    await next()
  },
}))

vi.mock('@shumai/core/src/authz/authz')
vi.mock('@shumai/core/src/metadata/metadata')

describe('metadata api', () => {
  const app = new Hono<{ Variables: { user: { id: string; name: string } } }>()
    .use('*', async (c, next) => {
      c.set('user', { id: 'user1', name: 'Test User' })
      await next()
    })
    .route('/', metadataRoute)

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(authzService.hasPermission).mockResolvedValue(undefined)
  })

  it('GET /teams/:teamId/fields', async () => {
    const mockField = {
      key: 'field1',
      scope: 'TEAM',
      config: { name: 'Test Field', type: 'text' },
      readOnly: false,
      description: 'desc',
      aiAutofill: true,
    }

    // Using any here because mocking complex service return types or Hono context is overly verbose for this test.
    vi.mocked(metadataService.listTeamFields).mockResolvedValue([mockField as any]) // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await app.request('/teams/t1/fields')

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveLength(1)
    expect(json[0].id).toBe('field1')
    expect(json[0].config.name).toBe('Test Field')
    expect(json[0].aiAutofill).toBe(true)
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.anything(),
      permission: Permission.Read,
      type: ResourceType.Team,
      id: 't1',
    })
  })

  it('POST /teams/:teamId/fields', async () => {
    const mockField = {
      key: 'newfield',
      scope: 'TEAM',
      config: { name: 'New Field', type: 'text' },
      readOnly: false,
      description: 'desc',
      aiAutofill: true,
    }

    // Using any here because mocking complex service return types or Hono context is overly verbose for this test.
    vi.mocked(metadataService.createTeamField).mockResolvedValue(mockField as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await app.request('/teams/t1/fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: { name: 'New Field', type: 'text' },
        aiAutofill: true,
        description: 'desc',
      }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.id).toBe('newfield')
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.anything(),
      permission: Permission.Admin,
      type: ResourceType.Team,
      id: 't1',
    })
  })

  it('GET /projects/:projectId/fields', async () => {
    const mockField = {
      key: 'field1',
      scope: 'PROJECT',
      config: { name: 'Project Field', type: 'text' },
      readOnly: false,
      description: 'desc',
      aiAutofill: false,
    }

    vi.mocked(metadataService.listProjectFields).mockResolvedValue([
      { field: mockField, visible: true } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    ])

    const res = await app.request('/projects/p1/fields')

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveLength(1)
    expect(json[0].id).toBe('field1')
    expect(json[0].visible).toBe(true)
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.anything(),
      permission: Permission.Read,
      type: ResourceType.Project,
      id: 'p1',
    })
  })

  it('PATCH /projects/:projectId/fields/order', async () => {
    // Using any here because mocking complex service return types or Hono context is overly verbose for this test.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(metadataService.updateProjectFieldsOrder).mockResolvedValue(undefined as any)

    const res = await app.request('/projects/p1/fields/order', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ fieldId: 'field1', visible: true }]),
    })

    expect(res.status).toBe(204)
    expect(metadataService.updateProjectFieldsOrder).toHaveBeenCalledWith('user1', 'p1', [
      { fieldId: 'field1', visible: true },
    ])
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.anything(),
      permission: Permission.Admin,
      type: ResourceType.Project,
      id: 'p1',
    })
  })

  it('DELETE /fields/:fieldId', async () => {
    // Using any here because mocking complex service return types or Hono context is overly verbose for this test.
    vi.mocked(metadataService.getFieldByKey).mockResolvedValue({
      key: 'f1',
      teamId: 't1',
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    // Using any here because mocking complex service return types or Hono context is overly verbose for this test.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(metadataService.deleteTeamField).mockResolvedValue(undefined as any)

    const res = await app.request('/fields/f1', {
      method: 'DELETE',
    })

    expect(res.status).toBe(204)
    expect(metadataService.deleteTeamField).toHaveBeenCalledWith('t1', 'f1')
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.anything(),
      permission: Permission.Admin,
      type: ResourceType.MetadataField,
      id: 'f1',
    })
  })

  it('PUT /fields/:fieldId', async () => {
    const mockField = {
      key: 'f1',
      scope: 'TEAM',
      config: { name: 'Updated Field', type: 'text' },
      readOnly: false,
      description: 'desc',
      aiAutofill: true,
      teamId: 't1',
    }

    // Using any here because mocking complex service return types or Hono context is overly verbose for this test.
    vi.mocked(metadataService.getFieldByKey).mockResolvedValue(mockField as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    // Using any here because mocking complex service return types or Hono context is overly verbose for this test.
    vi.mocked(metadataService.updateTeamField).mockResolvedValue(mockField as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await app.request('/fields/f1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: { name: 'Updated Field', type: 'text' },
        aiAutofill: true,
        description: 'desc',
      }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.id).toBe('f1')
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.anything(),
      permission: Permission.Admin,
      type: ResourceType.MetadataField,
      id: 'f1',
    })
  })
})
