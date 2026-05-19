import { describe, expect, test, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import shareRoute from './share'
import publicShareRoute from './public-share'
import { authMiddleware } from '@/api/middleware/auth'
import { shareService } from '@/services/share/share'
import { assetService } from '@/services/asset/asset'

vi.mock('@/api/middleware/auth', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authMiddleware: async (c: any, next: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    c.set('user', { id: 'user1', name: 'Test User' } as any)
    await next()
  },
}))

vi.mock('@/services/authz/authz', () => ({
  authzService: {
    hasPermission: vi.fn().mockResolvedValue(undefined),
  },
  Permission: {
    Read: 'read',
    Edit: 'edit',
    Admin: 'admin',
  },
}))

describe('Share API', () => {
  const app = new Hono()
    .route('/', publicShareRoute)
    .use('*', authMiddleware)
    .route('/', shareRoute)

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // Public Routes
  describe('GET /shares/:shareId/info', () => {
    test('Success', async () => {
      vi.spyOn(shareService, 'getShareLink').mockResolvedValue({
        id: 'share1',
        name: 'Public Share',
        isDisabled: false,
        isExpired: false,
        hasPassword: true,
        rootFolderId: 'folder1',
        projectId: 'project1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      const res = await app.request('/shares/share1/info', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.name).toBe('Public Share')
      expect(body.hasPassword).toBe(true)
    })
  })

  describe('GET /shares/:shareId/folders/:folderId/children', () => {
    test('Success', async () => {
      vi.spyOn(shareService, 'verifyPublicAccess').mockResolvedValue({
        id: 'share1',
        name: 'My Share',
        isDisabled: false,
        rootFolderId: 'folder1',
        projectId: 'project1',
        password: null,
        expireAt: null,
        defaultSortOrder: 'name:asc',
        fieldVisibility: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      vi.spyOn(assetService, 'listChildren').mockResolvedValue({
        data: [],
        pageInfo: { total: 0, cursor: undefined },
      })

      const res = await app.request('/shares/share1/folders/folder1/children?assetType=file', {
        method: 'GET',
        headers: { 'x-share-password': 'pass' },
      })

      expect(res.status).toBe(200)
      expect(shareService.verifyPublicAccess).toHaveBeenCalledWith('folder1', 'pass')
      expect(assetService.listChildren).toHaveBeenCalledWith(
        expect.objectContaining({
          assetId: 'folder1',
          assetType: 'file',
          sort: 'name',
          order: 'asc',
        }),
      )
    })
  })

  // Protected Routes
  describe('POST /teams/:teamId/projects/:projectId/shares', () => {
    test('Success', async () => {
      vi.spyOn(shareService, 'createShareLink').mockResolvedValue({
        id: 'share1',
        name: 'test-share',
        isDisabled: false,
        rootFolderId: 'root1',
        projectId: 'project1',
        isExpired: false,
        hasPassword: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      const res = await app.request('/teams/team1/projects/project1/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'My Share' }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.id).toBe('share1')
      expect(shareService.createShareLink).toHaveBeenCalledWith('project1', { name: 'My Share' })
    })
  })

  describe('GET /teams/:teamId/projects/:projectId/shares', () => {
    test('Success', async () => {
      vi.spyOn(shareService, 'listProjectShareLinks').mockResolvedValue({
        data: [],
        pageInfo: { total: 0, cursor: undefined },
      })

      const res = await app.request('/teams/team1/projects/project1/shares', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      expect(shareService.listProjectShareLinks).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'project1',
        }),
      )
    })
  })

  describe('GET /teams/:teamId/shares/:shareId', () => {
    test('Success', async () => {
      vi.spyOn(shareService, 'getShareLink').mockResolvedValue({
        id: 'share1',
        name: 'test-share',
        isDisabled: false,
        rootFolderId: 'root1',
        projectId: 'project1',
        isExpired: false,
        hasPassword: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      const res = await app.request('/teams/team1/shares/share1', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      expect(shareService.getShareLink).toHaveBeenCalledWith('share1')
    })
  })

  describe('POST /teams/:teamId/shares/:shareId/assets', () => {
    test('Success', async () => {
      vi.spyOn(shareService, 'getShareLink').mockResolvedValue({
        id: 'share1',
        name: 'test-share',
        isDisabled: false,
        rootFolderId: 'root1',
        projectId: 'project1',
        isExpired: false,
        hasPassword: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      vi.spyOn(shareService, 'addAssetToShare').mockResolvedValue(1)

      const res = await app.request('/teams/team1/shares/share1/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetIds: ['asset1'] }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.addedCount).toBe(1)
      expect(shareService.addAssetToShare).toHaveBeenCalledWith('share1', { assetIds: ['asset1'] })
    })
  })
})
