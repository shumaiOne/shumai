import { describe, it, expect, vi, beforeEach } from 'vitest'
import { collectionService } from '@/services/collection/collection'
import { authzService, Permission, ResourceType } from '@/services/authz/authz'
import { Hono, Context, Next } from 'hono'
import collectionRoute from './collection'

vi.mock('@/api/middleware/auth', () => ({
  authMiddleware: async (c: Context, next: Next) => {
    c.set('user', { id: 'user-1', name: 'Test User' })
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
    Project: 'project',
    Collection: 'collection',
  },
}))

describe('Collection API', () => {
  const projectId = 'project-1'
  const collectionId = 'col-1'
  const authMiddleware = async (c: Context, next: Next) => {
    c.set('user', { id: 'user-1', name: 'Test User' })
    await next()
  }
  const app = new Hono().use('*', authMiddleware).route('/', collectionRoute)

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(authzService.hasPermission).mockResolvedValue(undefined)
  })

  it('POST /projects/:projectId/collections', async () => {
    const mockCreate = vi.spyOn(collectionService, 'createCollection').mockResolvedValue({
      id: collectionId,
      name: 'New Collection',
      filter: {
        sourceFolderId: 'root-1',
        searchFilter: { conditions: [], operator: 'AND', recursively: true },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      projectId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const res = await app.request(`/projects/${projectId}/collections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'New Collection',
        filter: {
          sourceFolderId: 'root-1',
          searchFilter: { conditions: [], operator: 'AND', recursively: true },
        },
      }),
    })

    expect(res.status).toBe(200)
    expect(mockCreate).toHaveBeenCalledWith(projectId, expect.any(Object))
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.any(Object),
      permission: Permission.Edit,
      type: ResourceType.Project,
      id: projectId,
    })
  })

  it('GET /projects/:projectId/collections', async () => {
    const mockList = vi.spyOn(collectionService, 'listCollections').mockResolvedValue({
      data: [
        {
          id: collectionId,
          name: 'Col 1',
          filter: {
            sourceFolderId: 'root-1',
            searchFilter: { conditions: [], operator: 'AND', recursively: true },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
          projectId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      pageInfo: { total: 1 },
    })

    const res = await app.request(`/projects/${projectId}/collections`)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(1)
    expect(mockList).toHaveBeenCalled()
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.any(Object),
      permission: Permission.Read,
      type: ResourceType.Project,
      id: projectId,
    })
  })

  it('GET /collections/:collectionId', async () => {
    const mockGet = vi.spyOn(collectionService, 'getCollection').mockResolvedValue({
      id: collectionId,
      name: 'Col 1',
      filter: {
        sourceFolderId: 'root-1',
        searchFilter: { conditions: [], operator: 'AND', recursively: true },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      projectId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const res = await app.request(`/collections/${collectionId}`)

    expect(res.status).toBe(200)
    expect(mockGet).toHaveBeenCalledWith(collectionId)
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.any(Object),
      permission: Permission.Read,
      type: ResourceType.Collection,
      id: collectionId,
    })
  })

  it('PATCH /collections/:collectionId', async () => {
    const mockUpdate = vi.spyOn(collectionService, 'updateCollection').mockResolvedValue({
      id: collectionId,
      name: 'Updated Name',
      filter: {
        sourceFolderId: 'root-1',
        searchFilter: { conditions: [], operator: 'AND', recursively: true },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      projectId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const res = await app.request(`/collections/${collectionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Name' }),
    })

    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(collectionId, { name: 'Updated Name' })
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.any(Object),
      permission: Permission.Edit,
      type: ResourceType.Collection,
      id: collectionId,
    })
  })

  it('DELETE /collections/:collectionId', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockDelete = vi.spyOn(collectionService, 'deleteCollection').mockResolvedValue({} as any)

    const res = await app.request(`/collections/${collectionId}`, {
      method: 'DELETE',
    })

    expect(res.status).toBe(200)
    expect(mockDelete).toHaveBeenCalledWith(collectionId)
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.any(Object),
      permission: Permission.Edit,
      type: ResourceType.Collection,
      id: collectionId,
    })
  })
})
