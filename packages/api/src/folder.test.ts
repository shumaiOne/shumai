import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import folderRoute from './folder'
import { assetService } from '@shumai/core/src/asset/asset'
import { searchService } from '@shumai/core/src/search/search'
import { authzService, ResourceType, Permission } from '@shumai/core/src/authz/authz'
import { authMiddleware } from './middleware/auth'

import { auditLogService } from '@shumai/core/src/auditLog/auditLog'

vi.mock('@shumai/core/src/auditLog/auditLog', () => ({
  auditLogService: {
    logAction: vi.fn().mockResolvedValue({}),
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

describe('folder api', () => {
  beforeEach(() => {
    vi.mocked(authzService.hasPermission).mockClear()

    vi.spyOn(assetService, 'getAsset').mockImplementation(vi.fn())
    vi.spyOn(assetService, 'getAssetContext').mockResolvedValue({ teamId: 'test-team' })
    vi.spyOn(assetService, 'createAsset').mockImplementation(vi.fn())
    vi.spyOn(assetService, 'updateAssetName').mockImplementation(vi.fn())
    vi.spyOn(assetService, 'deleteAssets').mockImplementation(vi.fn())
    vi.spyOn(assetService, 'restoreAssets').mockImplementation(vi.fn())
    vi.spyOn(assetService, 'listChildren').mockImplementation(vi.fn())
    vi.spyOn(searchService, 'search').mockImplementation(vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('GET /folders/:folderId', async () => {
    vi.mocked(assetService.getAsset).mockResolvedValue({
      id: 'test-id',
      name: 'test-folder',
      sizeByte: 10,
      fileCount: 1,
      type: 'folder',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    const app = new Hono().use('*', authMiddleware).route('/', folderRoute)
    const res = await app.request('/folders/test-id')

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.name).toBe('test-folder')

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: { id: 'user1', name: 'Test User' },
      permission: Permission.Read,
      type: ResourceType.Asset,
      id: 'test-id',
    })
  })

  it('PUT /folders/:folderId', async () => {
    vi.mocked(assetService.updateAssetName).mockResolvedValue({
      id: 'test-id',
      name: 'new-name',
      sizeByte: 10,
      fileCount: 1,
      type: 'folder',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    const app = new Hono().use('*', authMiddleware).route('/', folderRoute)
    const res = await app.request('/folders/test-id', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'new-name' }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.name).toBe('new-name')

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: { id: 'user1', name: 'Test User' },
      permission: Permission.Edit,
      type: ResourceType.Asset,
      id: 'test-id',
    })
    expect(auditLogService.logAction).toHaveBeenCalledWith({
      action: 'folder_update',
      teamId: 'test-team',
      userId: 'user1',
      projectId: undefined,
      itemId: 'test-id',
    })
  })

  it('POST /folders', async () => {
    vi.mocked(assetService.createAsset).mockResolvedValue({
      id: 'new-id',
      name: 'new-folder',
      sizeByte: 0,
      fileCount: 0,
      type: 'folder',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    const app = new Hono().use('*', authMiddleware).route('/', folderRoute)
    const res = await app.request('/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'new-folder', parentId: 'parent-id' }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.name).toBe('new-folder')

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: { id: 'user1', name: 'Test User' },
      permission: Permission.Edit,
      type: ResourceType.Asset,
      id: 'parent-id',
    })
    expect(auditLogService.logAction).toHaveBeenCalledWith({
      action: 'folder_create',
      teamId: 'test-team',
      userId: 'user1',
      projectId: undefined,
      itemId: 'new-id',
    })
  })

  it('GET /folders/:folderId/children', async () => {
    vi.mocked(assetService.listChildren).mockResolvedValue({
      data: [
        {
          id: 'child-id',
          name: 'child-folder',
          sizeByte: 0,
          fileCount: 0,
          type: 'folder',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      pageInfo: { total: 1, cursor: '' },
    })

    const app = new Hono().use('*', authMiddleware).route('/', folderRoute)
    const res = await app.request('/folders/test-id/children?assetType=folder')

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(1)
    expect(json.data[0].name).toBe('child-folder')

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: { id: 'user1', name: 'Test User' },
      permission: Permission.Read,
      type: ResourceType.Asset,
      id: 'test-id',
    })
  })

  it('DELETE /folders', async () => {
    vi.mocked(assetService.deleteAssets).mockResolvedValue(undefined)

    const app = new Hono().use('*', authMiddleware).route('/', folderRoute)
    const res = await app.request('/folders', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ['test-id'] }),
    })

    expect(res.status).toBe(204)

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: { id: 'user1', name: 'Test User' },
      permission: Permission.Edit,
      type: ResourceType.Asset,
      id: 'test-id',
    })
    expect(assetService.deleteAssets).toHaveBeenCalledWith(['test-id'])
    expect(auditLogService.logAction).toHaveBeenCalledWith({
      action: 'folder_delete',
      teamId: 'test-team',
      userId: 'user1',
      projectId: undefined,
      itemId: 'test-id',
    })
  })

  it('POST /folders/restore', async () => {
    vi.mocked(assetService.restoreAssets).mockResolvedValue(undefined)

    const app = new Hono().use('*', authMiddleware).route('/', folderRoute)
    const res = await app.request('/folders/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ['test-id'] }),
    })

    expect(res.status).toBe(204)

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: { id: 'user1', name: 'Test User' },
      permission: Permission.Edit,
      type: ResourceType.Asset,
      id: 'test-id',
    })
    expect(assetService.restoreAssets).toHaveBeenCalledWith(['test-id'])
  })

  it('POST /folders/:folderId/search', async () => {
    vi.mocked(searchService.search).mockResolvedValue({
      data: [
        {
          id: 'result-id',
          name: 'result-folder',
          sizeByte: 0,
          fileCount: 0,
          type: 'folder',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      pageInfo: { total: 1, cursor: '' },
    })

    const app = new Hono().use('*', authMiddleware).route('/', folderRoute)
    const res = await app.request('/folders/test-id/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conditions: [{ field: 'name', operator: 'eq', value: 'result-folder' }],
      }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(1)
    expect(json.data[0].name).toBe('result-folder')

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: { id: 'user1', name: 'Test User' },
      permission: Permission.Read,
      type: ResourceType.Asset,
      id: 'test-id',
    })
  })

  it('PATCH /folders/:folderId/order', async () => {
    vi.spyOn(assetService, 'updateAssetOrder').mockResolvedValue({
      id: 'test-id',
      name: 'test-folder',
      sizeByte: 10,
      fileCount: 1,
      type: 'folder',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    const app = new Hono().use('*', authMiddleware).route('/', folderRoute)
    const res = await app.request('/folders/test-id/order', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ beforeIndex: 'index-1' }),
    })

    expect(res.status).toBe(200)

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: { id: 'user1', name: 'Test User' },
      permission: Permission.Edit,
      type: ResourceType.Asset,
      id: 'test-id',
    })

    expect(assetService.updateAssetOrder).toHaveBeenCalledWith('test-id', {
      beforeIndex: 'index-1',
    })
  })
})
