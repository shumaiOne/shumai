import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import versionStackRoute from './versionStack'
import { authMiddleware } from '@/api/middleware/auth'
import { versionStackService } from '@/services/versionStack/versionStack'
import { assetService } from '@/services/asset/asset'

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

      expect(mockCreateVersionStack).toHaveBeenCalledWith({
        projectId: 'p1',
        creatorId: 'user1',
        fileIds: ['f1', 'f2'],
      })
      expect(mockGetAsset).toHaveBeenCalledWith({ assetId: 'stack1' })
    })

    it('should fail with validation error for invalid body', async () => {
      const app = new Hono().use('*', authMiddleware).route('/', versionStackRoute)

      const res = await app.request('/projects/p1/version_stacks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wrongField: [] }),
      })

      expect(res.status).toBe(400)
      expect(mockCreateVersionStack).not.toHaveBeenCalled()
    })
  })

  describe('POST /projects/:projectID/version_stacks/:stackID/order', () => {
    it('should change order and return 200', async () => {
      mockChangeStackFileVersion.mockResolvedValue()

      const app = new Hono().use('*', authMiddleware).route('/', versionStackRoute)

      const res = await app.request('/projects/p1/version_stacks/stack1/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: 'f1', beforeId: 'f2' }),
      })

      expect(res.status).toBe(200)

      expect(mockChangeStackFileVersion).toHaveBeenCalledWith({
        stackId: 'stack1',
        fileId: 'f1',
        beforeId: 'f2',
      })
    })

    it('should fail with validation error for invalid body', async () => {
      const app = new Hono().use('*', authMiddleware).route('/', versionStackRoute)

      const res = await app.request('/projects/p1/version_stacks/stack1/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: 'f1' }), // missing beforeId
      })

      expect(res.status).toBe(400)
      expect(mockChangeStackFileVersion).not.toHaveBeenCalled()
    })
  })

  describe('GET /projects/:projectID/version_stacks/:stackID/versions', () => {
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

      const res = await app.request('/projects/p1/version_stacks/stack1/versions', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual(mockVersions)

      expect(mockGetStackVersions).toHaveBeenCalledWith('stack1')
    })
  })
})
