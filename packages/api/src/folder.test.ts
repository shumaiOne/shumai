import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import folderRoute from './folder'
import { assetService } from '@shumai/core/src/asset/asset'
import { searchService } from '@shumai/core/src/search/search'
import { authzService, ResourceType, Permission } from '@shumai/core/src/authz/authz'
import { authMiddleware } from './middleware/auth'
import { HTTPException } from 'hono/http-exception'
import {
  createFolderOp,
  getFolderInstructionsOp,
  renameAssetOp,
  runOperation,
} from '@shumai/core/src/operations'

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

vi.mock('@shumai/core/src/operations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shumai/core/src/operations')>()),
  runOperation: vi.fn(),
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

  it('PUT /folders/:folderId runs rename_asset', async () => {
    const summary = { id: 'test-id', name: 'new-name', type: 'folder', size: 10, projectId: 'p1' }
    vi.mocked(runOperation).mockResolvedValue(summary)

    const app = new Hono().use('*', authMiddleware).route('/', folderRoute)
    const res = await app.request('/folders/test-id', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'new-name' }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(summary)
    expect(runOperation).toHaveBeenCalledWith(
      renameAssetOp,
      { userId: 'user1', via: 'api' },
      { assetId: 'test-id', name: 'new-name' },
    )
  })

  it('POST /folders runs create_folder', async () => {
    const summary = { id: 'new-id', name: 'new-folder', type: 'folder', size: 0, projectId: 'p1' }
    vi.mocked(runOperation).mockResolvedValue(summary)

    const app = new Hono().use('*', authMiddleware).route('/', folderRoute)
    const res = await app.request('/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'new-folder', parentId: 'parent-id' }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(summary)
    expect(runOperation).toHaveBeenCalledWith(
      createFolderOp,
      { userId: 'user1', via: 'api' },
      { parent: 'parent-id', name: 'new-folder' },
    )
  })

  it('POST /folders surfaces Operation errors with their status', async () => {
    vi.mocked(runOperation).mockRejectedValue(new HTTPException(403, { message: 'Forbidden' }))

    const app = new Hono().use('*', authMiddleware).route('/', folderRoute)
    const res = await app.request('/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'new-folder', parentId: 'parent-id' }),
    })

    expect(res.status).toBe(403)
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
    expect(assetService.listChildren).toHaveBeenCalledWith({
      assetId: 'test-id',
      assetType: 'folder',
    })
  })

  it('GET /folders/:folderId/children forwards pagination parameters', async () => {
    vi.mocked(assetService.listChildren).mockResolvedValue({
      data: [
        {
          id: 'child-id-2',
          name: 'child-folder-2',
          sizeByte: 0,
          fileCount: 0,
          type: 'folder',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      pageInfo: { total: 30, cursor: 'cursorNextToken' },
    })

    const app = new Hono().use('*', authMiddleware).route('/', folderRoute)
    const res = await app.request(
      '/folders/test-id/children?assetType=folder&first=20&after=cursorToken123&prefix=sub',
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(1)
    expect(json.pageInfo.cursor).toBe('cursorNextToken')

    expect(assetService.listChildren).toHaveBeenCalledWith({
      assetId: 'test-id',
      assetType: 'folder',
      first: 20,
      after: 'cursorToken123',
      prefix: 'sub',
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

  it('POST /folders/:folderId/search passes previewFormat to searchService', async () => {
    vi.mocked(searchService.search).mockResolvedValue({
      data: [],
      pageInfo: { total: 0 },
    })

    const app = new Hono().use('*', authMiddleware).route('/', folderRoute)
    const res = await app.request('/folders/test-id/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        previewFormat: 'jpeg',
      }),
    })

    expect(res.status).toBe(200)
    expect(searchService.search).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({ previewFormat: 'jpeg' }),
    )
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

  it('GET /folders/:folderId/agentsmd runs get_folder_instructions', async () => {
    vi.mocked(runOperation).mockResolvedValue({
      folderId: 'test-id',
      content: '# Folder Guidelines',
    })

    const app = new Hono().use('*', authMiddleware).route('/', folderRoute)
    const res = await app.request('/folders/test-id/agentsmd')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ content: '# Folder Guidelines' })
    expect(runOperation).toHaveBeenCalledWith(
      getFolderInstructionsOp,
      { userId: 'user1', via: 'api' },
      { folderId: 'test-id' },
    )
  })

  it('PATCH /folders/:folderId/agentsmd', async () => {
    vi.spyOn(assetService, 'updateAgentsMd').mockResolvedValue({ content: '# Updated Guidelines' })

    const app = new Hono().use('*', authMiddleware).route('/', folderRoute)
    const res = await app.request('/folders/test-id/agentsmd', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '# Updated Guidelines' }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.content).toBe('# Updated Guidelines')

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: { id: 'user1', name: 'Test User' },
      permission: Permission.Admin,
      type: ResourceType.Asset,
      id: 'test-id',
    })
    expect(assetService.updateAgentsMd).toHaveBeenCalledWith('test-id', '# Updated Guidelines')
  })

  it('PATCH /folders/:folderId/agentsmd rejects oversized content', async () => {
    const mockUpdate = vi.spyOn(assetService, 'updateAgentsMd').mockResolvedValue({ content: '' })
    const app = new Hono().use('*', authMiddleware).route('/', folderRoute)
    const res = await app.request('/folders/test-id/agentsmd', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'x'.repeat(100_001) }),
    })

    expect(res.status).toBe(400)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
