import { describe, expect, test, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import shareRoute from './share'
import publicShareRoute from './public-share'
import { authMiddleware } from './middleware/auth'
import { shareService } from '@shumai/core/src/share/share'
import { assetService } from '@shumai/core/src/asset/asset'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { ShareLinkPasswordInvalidError, ShareLinkExpiredError } from '@shumai/core/src/share/errors'

import { auditLogService } from '@shumai/core/src/auditLog/auditLog'

vi.mock('./middleware/auth', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authMiddleware: async (c: any, next: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    c.set('user', { id: 'user1', name: 'Test User' } as any)
    await next()
  },
}))

vi.mock('@shumai/core/src/authz/authz', () => ({
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
    Share: 'share',
    Asset: 'asset',
  },
}))

vi.mock('@shumai/core/src/auditLog/auditLog', () => ({
  auditLogService: {
    logAction: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('@shumai/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shumai/db')>()
  return {
    ...actual,
    prisma: {
      project: {
        findUnique: vi.fn().mockResolvedValue({ teamId: 't1' }),
      },
    },
  }
})

describe('Share API', () => {
  const app = new Hono()
    .route('/', publicShareRoute)
    .use('*', authMiddleware)
    .route('/', shareRoute)

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(authzService.hasPermission).mockResolvedValue(undefined)
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
      vi.spyOn(shareService, 'verifyPublicAccess').mockResolvedValue({
        id: 'share1',
        name: 'Public Share',
        rootFolderId: 'folder1',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      const res = await app.request('/shares/share1/info', {
        method: 'GET',
        headers: { 'x-share-password': 'pass' },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.name).toBe('Public Share')
      expect(body.hasPassword).toBe(true)
      expect(shareService.verifyPublicAccess).toHaveBeenCalledWith('folder1', 'pass')
    })

    test('Unauthorized', async () => {
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
      vi.spyOn(shareService, 'verifyPublicAccess').mockRejectedValue(
        new ShareLinkPasswordInvalidError('Invalid password for share link'),
      )

      const res = await app.request('/shares/share1/info', {
        method: 'GET',
        headers: { 'x-share-password': 'wrong' },
      })

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe('Unauthorized')
    })

    test('Expired/Disabled', async () => {
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
      vi.spyOn(shareService, 'verifyPublicAccess').mockRejectedValue(
        new ShareLinkExpiredError('Share link has expired'),
      )

      const res = await app.request('/shares/share1/info', {
        method: 'GET',
      })

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toBe('Share link has expired')
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
  describe('POST /projects/:projectId/shares', () => {
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

      const res = await app.request('/projects/project1/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'My Share' }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.id).toBe('share1')
      expect(authzService.hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ResourceType.Project,
          id: 'project1',
          permission: Permission.Edit,
        }),
      )
      expect(shareService.createShareLink).toHaveBeenCalledWith(
        'project1',
        { name: 'My Share' },
        'user1',
      )
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        action: 'share_create',
        teamId: 't1',
        userId: 'user1',
        projectId: 'project1',
        itemId: 'share1',
      })
    })
  })

  describe('GET /projects/:projectId/shares', () => {
    test('Success', async () => {
      vi.spyOn(shareService, 'listProjectShareLinks').mockResolvedValue({
        data: [],
        pageInfo: { total: 0, cursor: undefined },
      })

      const res = await app.request('/projects/project1/shares', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      expect(authzService.hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ResourceType.Project,
          id: 'project1',
          permission: Permission.Read,
        }),
      )
      expect(shareService.listProjectShareLinks).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'project1',
        }),
      )
    })
  })

  describe('GET /shares/:shareId', () => {
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

      const res = await app.request('/shares/share1', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      expect(authzService.hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ResourceType.Share,
          id: 'share1',
          permission: Permission.Read,
        }),
      )
      expect(shareService.getShareLink).toHaveBeenCalledWith('share1')
    })
  })

  describe('POST /shares/:shareId/assets', () => {
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

      const res = await app.request('/shares/share1/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetIds: ['asset1'] }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.addedCount).toBe(1)
      expect(authzService.hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ResourceType.Share,
          id: 'share1',
          permission: Permission.Edit,
        }),
      )
      expect(authzService.hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ResourceType.Asset,
          id: 'asset1',
          permission: Permission.Read,
        }),
      )
      expect(shareService.addAssetToShare).toHaveBeenCalledWith('share1', { assetIds: ['asset1'] })
    })
  })
})
