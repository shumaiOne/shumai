import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Hono, type Context, type Next } from 'hono'
import projectRoute from './project'
import { authzService, Permission, ResourceType } from '@/services/authz/authz'
import { projectService } from '@/services/project/project'
import { assetService } from '@/services/asset/asset'

vi.mock('@/api/middleware/auth', () => ({
  authMiddleware: async (c: Context, next: Next) => {
    c.set('user', { id: 'user1', name: 'Test User' })
    await next()
  },
}))

vi.mock('@/services/authz/authz')
vi.mock('@/services/project/project')
vi.mock('@/services/asset/asset')

describe('project api', () => {
  const app = new Hono()
    .use('*', async (c, next) => {
      c.set('user', { id: 'user1', name: 'Test User' })
      await next()
    })
    .route('/', projectRoute)

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(authzService.hasPermission).mockResolvedValue(undefined)
  })

  it('GET /teams/:teamId/projects', async () => {
    vi.mocked(projectService.listProjects).mockResolvedValue({
      data: [{ id: 'foo', name: 'foo.png', rootFolder: 'uid' }] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      pageInfo: { total: 100, cursor: 'abc' },
    })

    const res = await app.request('/teams/t/projects?page_size=10')

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(1)
    expect(json.pageInfo.total).toBe(100)
    expect(json.data[0].id).toBe('foo')
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.anything(),
      permission: Permission.Read,
      type: ResourceType.Team,
      id: 't',
    })
  })

  it('POST /teams/:teamId/projects', async () => {
    vi.mocked(projectService.createProject).mockResolvedValue({
      id: 'foo',
      name: 'foo.png',
      coverImage: 'http://s3/bucket/key',
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await app.request('/teams/t/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'foo.png', coverImageKey: 'key' }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.id).toBe('foo')
    expect(json.name).toBe('foo.png')
    expect(json.coverImage).toBe('http://s3/bucket/key')
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.anything(),
      permission: Permission.Edit,
      type: ResourceType.Team,
      id: 't',
    })
  })

  it('PUT /projects/:projectId', async () => {
    vi.mocked(projectService.updateProject).mockResolvedValue({
      id: 'foo',
      name: 'updated',
      coverImage: 'http://s3/bucket/key',
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await app.request('/projects/foo', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'updated' }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.name).toBe('updated')
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.anything(),
      permission: Permission.Edit,
      type: ResourceType.Project,
      id: 'foo',
    })
  })

  it('GET /projects/:projectId', async () => {
    vi.mocked(projectService.getProject).mockResolvedValue({
      id: 'p',
      name: 'foo.png',
      rootFolder: 'root_folder_id',
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await app.request('/projects/p')

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.rootFolder).toBe('root_folder_id')
    expect(json.id).toBe('p')
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.anything(),
      permission: Permission.Read,
      type: ResourceType.Project,
      id: 'p',
    })
  })

  it('GET /projects/:projectId/team', async () => {
    vi.mocked(projectService.getProjectTeam).mockResolvedValue('teamId')

    const res = await app.request('/projects/p/team')

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.teamId).toBe('teamId')
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.anything(),
      permission: Permission.Read,
      type: ResourceType.Project,
      id: 'p',
    })
  })

  it('POST /projects/:projectId/reparent', async () => {
    vi.mocked(assetService.reparentAssets).mockResolvedValue(undefined)

    const res = await app.request('/projects/p/reparent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newParentId: 'new_parent_id',
        assetIds: ['asset_1', 'asset_2'],
      }),
    })

    expect(res.status).toBe(204)
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.anything(),
      permission: Permission.Edit,
      type: ResourceType.Asset,
      id: 'new_parent_id',
    })
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.anything(),
      permission: Permission.Edit,
      type: ResourceType.Asset,
      id: 'asset_1',
    })
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.anything(),
      permission: Permission.Edit,
      type: ResourceType.Asset,
      id: 'asset_2',
    })
    expect(assetService.reparentAssets).toHaveBeenCalledWith({
      newParentId: 'new_parent_id',
      assetIds: ['asset_1', 'asset_2'],
      creatorId: 'user1',
    })
  })
})
