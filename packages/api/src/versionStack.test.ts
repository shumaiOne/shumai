import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import versionStackRoute from './versionStack'
import { authMiddleware } from './middleware/auth'
import { versionStackService } from '@shumai/core/src/versionStack/versionStack'
import { assetService } from '@shumai/core/src/asset/asset'
import { authzService, ResourceType, Permission } from '@shumai/core/src/authz/authz'

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
    Asset: 'asset',
  },
}))

vi.mock('./middleware/auth', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authMiddleware: async (c: any, next: any) => {
    c.set('user', { id: 'user1', name: 'Test User' })
    await next()
  },
}))

describe('versionStack api', () => {
  let mockCreateVersionStack: any // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockChangeStackFileVersion: any // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockGetAsset: any // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockGetStackVersions: any // eslint-disable-line @typescript-eslint/no-explicit-any

  beforeEach(() => {
    mockCreateVersionStack = vi.spyOn(versionStackService, 'createVersionStack')
    mockChangeStackFileVersion = vi.spyOn(versionStackService, 'changeStackFileVersion')
    mockGetAsset = vi.spyOn(assetService, 'getAsset')
    mockGetStackVersions = vi.spyOn(assetService, 'getStackVersions')
    vi.mocked(authzService.hasPermission).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /projects/:projectID/version_stacks', () => {
    it('should create a version stack and return asset info', async () => {
      const mockStack = { id: 'stack1' }
      const mockAssetInfo = { id: 'stack1', type: 'version_stack', name: 'v1' }

      mockCreateVersionStack.mockResolvedValue(mockStack)
      mockGetAsset.mockResolvedValue(mockAssetInfo)

      const app = new Hono().use('*', authMiddleware).route('/', versionStackRoute)

      const res = await app.request('/projects/p1/version_stacks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: ['f1', 'f2'] }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual(mockAssetInfo)

      expect(authzService.hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ResourceType.Project,
          id: 'p1',
          permission: Permission.Edit,
        }),
      )
      expect(mockCreateVersionStack).toHaveBeenCalledWith({
        projectId: 'p1',
        creatorId: 'user1',
        fileIds: ['f1', 'f2'],
      })
      expect(mockGetAsset).toHaveBeenCalledWith({ assetId: 'stack1' })
    })
  })

  describe('POST /version_stacks/:stackID/order', () => {
    it('should change order and return 200', async () => {
      mockChangeStackFileVersion.mockResolvedValue()

      const app = new Hono().use('*', authMiddleware).route('/', versionStackRoute)

      const res = await app.request('/version_stacks/stack1/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: 'f1', beforeId: 'f2' }),
      })

      expect(res.status).toBe(200)

      expect(authzService.hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ResourceType.Asset,
          id: 'stack1',
          permission: Permission.Edit,
        }),
      )
      expect(mockChangeStackFileVersion).toHaveBeenCalledWith({
        stackId: 'stack1',
        fileId: 'f1',
        beforeId: 'f2',
      })
    })
  })

  describe('GET /version_stacks/:stackID/versions', () => {
    it('should return stack versions', async () => {
      const mockVersions = [
        {
          id: 'v1',
          version: 1,
          name: 'version1.png',
          previewUrl: 'http://preview1',
          creator: { id: 'u1', name: 'User 1' },
        },
      ]

      mockGetStackVersions.mockResolvedValue(mockVersions)

      const app = new Hono().use('*', authMiddleware).route('/', versionStackRoute)

      const res = await app.request('/version_stacks/stack1/versions', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual(mockVersions)

      expect(authzService.hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ResourceType.Asset,
          id: 'stack1',
          permission: Permission.Read,
        }),
      )
      expect(mockGetStackVersions).toHaveBeenCalledWith('stack1')
    })
  })
})
