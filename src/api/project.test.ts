import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import projectRoute from './project'
import { authMiddleware } from '@/api/middleware/auth'
import { projectService } from '@/services/project/project'
import { assetService } from '@/services/asset/asset'
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

describe('project api', () => {
  let mockListProjects: any // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockCreateProject: any // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockUpdateProject: any // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockGetProject: any // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockGetProjectTeam: any // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockListProjectMembers: any // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockReparentAssets: any // eslint-disable-line @typescript-eslint/no-explicit-any

  beforeEach(() => {
    mockListProjects = vi.fn()
    mockCreateProject = vi.fn()
    mockUpdateProject = vi.fn()
    mockGetProject = vi.fn()
    mockGetProjectTeam = vi.fn()
    mockListProjectMembers = vi.fn()
    mockReparentAssets = vi.fn()
    vi.mocked(authzService.hasPermission).mockClear()

    vi.spyOn(projectService, 'listProjects').mockImplementation(mockListProjects)
    vi.spyOn(projectService, 'createProject').mockImplementation(mockCreateProject)
    vi.spyOn(projectService, 'updateProject').mockImplementation(mockUpdateProject)
    vi.spyOn(projectService, 'getProject').mockImplementation(mockGetProject)
    vi.spyOn(projectService, 'getProjectTeam').mockImplementation(mockGetProjectTeam)
    vi.spyOn(projectService, 'listProjectMembers').mockImplementation(mockListProjectMembers)
    vi.spyOn(assetService, 'reparentAssets').mockImplementation(mockReparentAssets)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('GET /teams/:teamId/projects', async () => {
    mockListProjects.mockResolvedValue({
      data: [{ id: 'foo', name: 'foo.png', rootFolder: 'uid' }],
      pageInfo: { total: 100, cursor: 'abc' },
    })

    const app = new Hono().use('*', authMiddleware).route('/', projectRoute)
    const res = await app.request('/teams/t/projects?page_size=10')

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(1)
    expect(json.pageInfo.total).toBe(100)
    expect(json.data[0].id).toBe('foo')
  })

  it('POST /teams/:teamId/projects', async () => {
    mockCreateProject.mockResolvedValue({
      id: 'foo',
      name: 'foo.png',
      coverImage: 'http://s3/bucket/key',
    })

    const app = new Hono().use('*', authMiddleware).route('/', projectRoute)
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
  })

  it('PUT /teams/:teamId/projects/:projectId', async () => {
    mockUpdateProject.mockResolvedValue({
      id: 'foo',
      name: 'updated',
      coverImage: 'http://s3/bucket/key',
    })

    const app = new Hono().use('*', authMiddleware).route('/', projectRoute)
    const res = await app.request('/teams/t/projects/foo', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'updated' }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.name).toBe('updated')
  })

  it('GET /projects/:projectId', async () => {
    mockGetProject.mockResolvedValue({
      id: 'p',
      name: 'foo.png',
      rootFolder: 'root_folder_id',
    })

    const app = new Hono().use('*', authMiddleware).route('/', projectRoute)
    const res = await app.request('/projects/p')

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.rootFolder).toBe('root_folder_id')
    expect(json.id).toBe('p')
  })

  it('GET /projects/:projectId/team', async () => {
    mockGetProjectTeam.mockResolvedValue('teamId')

    const app = new Hono().use('*', authMiddleware).route('/', projectRoute)
    const res = await app.request('/projects/p/team')

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.teamId).toBe('teamId')
  })

  it('POST /projects/:projectId/reparent', async () => {
    mockReparentAssets.mockResolvedValue(undefined)

    const app = new Hono().use('*', authMiddleware).route('/', projectRoute)
    const res = await app.request('/projects/p/reparent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newParentId: 'new_parent_id',
        assetIds: ['asset_1', 'asset_2'],
      }),
    })

    expect(res.status).toBe(204)
    expect(authzService.hasPermission).toHaveBeenNthCalledWith(1, {
      assetId: 'new_parent_id',
      user: { id: 'user1', name: 'Test User' },
      permission: 'Edit',
    })
    expect(authzService.hasPermission).toHaveBeenNthCalledWith(2, {
      assetId: 'asset_1',
      user: { id: 'user1', name: 'Test User' },
      permission: 'Edit',
    })
    expect(authzService.hasPermission).toHaveBeenNthCalledWith(3, {
      assetId: 'asset_2',
      user: { id: 'user1', name: 'Test User' },
      permission: 'Edit',
    })
    expect(mockReparentAssets).toHaveBeenCalledWith({
      newParentId: 'new_parent_id',
      assetIds: ['asset_1', 'asset_2'],
      creatorId: 'user1',
    })
  })
})
