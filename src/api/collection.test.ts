import { describe, it, expect, vi, beforeEach } from 'vitest'
import { collectionService } from '@/services/collection/collection'
import { authzService } from '@/services/authz/authz'
import app from './collection'

vi.mock('@/api/middleware/auth', () => ({
  authMiddleware: vi.fn(async (c, next) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    c.set('user', { id: 'user-1', name: 'Test User' } as any)
    await next()
  }),
}))

describe('Collection API', () => {
  const teamId = 'team-1'
  const projectId = 'project-1'
  const collectionId = 'col-1'

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('POST /teams/:teamId/projects/:projectId/collections', async () => {
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

    const mockAuthz = vi.spyOn(authzService, 'hasPermission').mockResolvedValue(undefined)

    const res = await app.request(
      `/teams/${teamId}/projects/${projectId}/collections`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New Collection',
          filter: {
            sourceFolderId: 'root-1',
            searchFilter: { conditions: [], operator: 'AND', recursively: true },
          },
        }),
      },
      {
        user: { id: 'user-1' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    )

    expect(res.status).toBe(200)
    expect(mockCreate).toHaveBeenCalledWith(projectId, expect.any(Object))
    expect(mockAuthz).toHaveBeenCalled()
  })

  it('GET /teams/:teamId/projects/:projectId/collections', async () => {
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

    const mockAuthz = vi.spyOn(authzService, 'hasPermission').mockResolvedValue(undefined)

    const res = await app.request(`/teams/${teamId}/projects/${projectId}/collections`)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(1)
    expect(mockList).toHaveBeenCalled()
    expect(mockAuthz).toHaveBeenCalled()
  })

  it('GET /teams/:teamId/projects/:projectId/collections/:collectionId', async () => {
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

    const mockAuthz = vi.spyOn(authzService, 'hasPermission').mockResolvedValue(undefined)

    const res = await app.request(
      `/teams/${teamId}/projects/${projectId}/collections/${collectionId}`,
    )

    expect(res.status).toBe(200)
    expect(mockGet).toHaveBeenCalledWith(collectionId)
    expect(mockAuthz).toHaveBeenCalled()
  })

  it('PATCH /teams/:teamId/projects/:projectId/collections/:collectionId', async () => {
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

    const mockAuthz = vi.spyOn(authzService, 'hasPermission').mockResolvedValue(undefined)

    const res = await app.request(
      `/teams/${teamId}/projects/${projectId}/collections/${collectionId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Name' }),
      },
    )

    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(collectionId, { name: 'Updated Name' })
    expect(mockAuthz).toHaveBeenCalled()
  })

  it('DELETE /teams/:teamId/projects/:projectId/collections/:collectionId', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockDelete = vi.spyOn(collectionService, 'deleteCollection').mockResolvedValue({} as any)
    const mockAuthz = vi.spyOn(authzService, 'hasPermission').mockResolvedValue(undefined)

    const res = await app.request(
      `/teams/${teamId}/projects/${projectId}/collections/${collectionId}`,
      {
        method: 'DELETE',
      },
    )

    expect(res.status).toBe(200)
    expect(mockDelete).toHaveBeenCalledWith(collectionId)
    expect(mockAuthz).toHaveBeenCalled()
  })
})
