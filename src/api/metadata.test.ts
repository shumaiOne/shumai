import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import metadataRoute from './metadata'
import { metadataService } from '@/services/metadata/metadata'
import { Prisma } from '@/generated/prisma/client.ts'
import { authMiddleware } from '@/api/middleware/auth'

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

describe('metadata api', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('GET /teams/:teamId/fields', async () => {
    const mockField = {
      key: 'field1',
      scope: 'TEAM',
      config: { name: 'Test Field', type: 'text' },
      readOnly: false,
      description: 'desc',
      aiAutofill: true,
    } as Prisma.MetadataFieldGetPayload<Record<string, never>>

    vi.spyOn(metadataService, 'listTeamFields').mockResolvedValue([mockField])

    const app = new Hono().use('*', authMiddleware).route('/', metadataRoute)
    const res = await app.request('/teams/t1/fields')

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveLength(1)
    expect(json[0].id).toBe('field1')
    expect(json[0].config.name).toBe('Test Field')
    expect(json[0].aiAutofill).toBe(true)
  })

  it('POST /teams/:teamId/fields', async () => {
    const mockField = {
      key: 'newfield',
      scope: 'TEAM',
      config: { name: 'New Field', type: 'text' },
      readOnly: false,
      description: 'desc',
      aiAutofill: true,
    } as Prisma.MetadataFieldGetPayload<Record<string, never>>

    vi.spyOn(metadataService, 'createTeamField').mockResolvedValue(mockField)

    const app = new Hono().use('*', authMiddleware).route('/', metadataRoute)
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
  })

  it('GET /projects/:projectId/fields', async () => {
    const mockField = {
      key: 'field1',
      scope: 'PROJECT',
      config: { name: 'Project Field', type: 'text' },
      readOnly: false,
      description: 'desc',
      aiAutofill: false,
    } as Prisma.MetadataFieldGetPayload<Record<string, never>>

    vi.spyOn(metadataService, 'listProjectFields').mockResolvedValue([
      { field: mockField, visible: true },
    ])

    const app = new Hono().use('*', authMiddleware).route('/', metadataRoute)
    const res = await app.request('/projects/p1/fields')

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveLength(1)
    expect(json[0].id).toBe('field1')
    expect(json[0].visible).toBe(true)
  })

  it('PATCH /projects/:projectId/fields/order', async () => {
    vi.spyOn(metadataService, 'updateProjectFieldsOrder').mockResolvedValue(undefined)

    const app = new Hono().use('*', authMiddleware).route('/', metadataRoute)
    const res = await app.request('/projects/p1/fields/order', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ fieldId: 'field1', visible: true }]),
    })

    expect(res.status).toBe(204)
    expect(metadataService.updateProjectFieldsOrder).toHaveBeenCalledWith('user1', 'p1', [
      { fieldId: 'field1', visible: true },
    ])
  })

  it('DELETE /teams/:teamId/fields/:fieldId', async () => {
    vi.spyOn(metadataService, 'deleteTeamField').mockResolvedValue(undefined)

    const app = new Hono().use('*', authMiddleware).route('/', metadataRoute)
    const res = await app.request('/teams/t1/fields/f1', {
      method: 'DELETE',
    })

    expect(res.status).toBe(204)
    expect(metadataService.deleteTeamField).toHaveBeenCalledWith('t1', 'f1')
  })

  it('PATCH /teams/:teamId/files/:fileId/metadata', async () => {
    vi.spyOn(metadataService, 'updateAssetMetadata').mockResolvedValue(undefined)

    const app = new Hono().use('*', authMiddleware).route('/', metadataRoute)
    const res = await app.request('/teams/t1/files/f1/metadata', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ key: 'resolution_width', value: 1920 }]),
    })

    expect(res.status).toBe(204)
    expect(metadataService.updateAssetMetadata).toHaveBeenCalledWith('f1', [
      { key: 'resolution_width', value: 1920 },
    ])
  })
})
