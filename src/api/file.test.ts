import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import fileRoute from './file'
import { assetService } from '@/services/asset/asset'
import { metadataService } from '@/services/metadata/metadata'
import { notificationService } from '@/services/notification/notification'
import { s3Service } from '@/services/s3/s3'
import { authzService } from '@/services/authz/authz'
import { authMiddleware } from '@/api/middleware/auth'

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

describe('file api', () => {
  beforeEach(() => {
    vi.mocked(authzService.hasPermission).mockClear()

    vi.spyOn(assetService, 'getAsset').mockImplementation(vi.fn())
    vi.spyOn(assetService, 'updateAssetName').mockImplementation(vi.fn())
    vi.spyOn(assetService, 'deleteAssets').mockImplementation(vi.fn())
    vi.spyOn(assetService, 'createComment').mockImplementation(vi.fn())
    vi.spyOn(assetService, 'listComments').mockImplementation(vi.fn())
    vi.spyOn(assetService, 'getComment').mockImplementation(vi.fn())
    vi.spyOn(assetService, 'restoreAssets').mockImplementation(vi.fn())
    vi.spyOn(metadataService, 'updateAssetMetadata').mockImplementation(vi.fn())
    vi.spyOn(notificationService, 'create').mockImplementation(vi.fn())
    vi.spyOn(s3Service, 'putObject').mockImplementation(vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('GET /teams/:teamId/files/:fileId', async () => {
    vi.mocked(assetService.getAsset).mockResolvedValue({
      id: 'test-id',
      name: 'test-file',
      sizeByte: 10,
      fileCount: 1,
      type: 'file',
      status: 'active',
      mediaType: 'image/jpeg',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    const app = new Hono().use('*', authMiddleware).route('/', fileRoute)
    const res = await app.request('/teams/test-team/files/test-id')

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.name).toBe('test-file')

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      assetId: 'test-id',
      user: { id: 'user1', name: 'Test User' },
      permission: 'Read',
    })
  })

  it('PUT /teams/:teamId/files/:fileId', async () => {
    vi.mocked(assetService.updateAssetName).mockResolvedValue({
      id: 'test-id',
      name: 'new-name',
      sizeByte: 10,
      fileCount: 1,
      type: 'file',
      status: 'active',
      mediaType: 'image/jpeg',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    const app = new Hono().use('*', authMiddleware).route('/', fileRoute)
    const res = await app.request('/teams/test-team/files/test-id', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'new-name' }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.name).toBe('new-name')

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      assetId: 'test-id',
      user: { id: 'user1', name: 'Test User' },
      permission: 'Edit',
    })
  })

  it('DELETE /teams/:teamId/files', async () => {
    vi.mocked(assetService.deleteAssets).mockResolvedValue(undefined)

    const app = new Hono().use('*', authMiddleware).route('/', fileRoute)
    const res = await app.request('/teams/test-team/files', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ['test-id'] }),
    })

    expect(res.status).toBe(204)

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      assetId: 'test-id',
      user: { id: 'user1', name: 'Test User' },
      permission: 'Edit',
    })
    expect(assetService.deleteAssets).toHaveBeenCalledWith(['test-id'])
  })

  it('POST /teams/:teamId/files/restore', async () => {
    vi.mocked(assetService.restoreAssets).mockResolvedValue(undefined)

    const app = new Hono().use('*', authMiddleware).route('/', fileRoute)
    const res = await app.request('/teams/test-team/files/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ['test-id'] }),
    })

    expect(res.status).toBe(204)

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      assetId: 'test-id',
      user: { id: 'user1', name: 'Test User' },
      permission: 'Edit',
    })
    expect(assetService.restoreAssets).toHaveBeenCalledWith(['test-id'])
  })

  it('POST /teams/:teamId/files/:fileId/comments', async () => {
    vi.mocked(assetService.createComment).mockResolvedValue({
      id: 'comment-id',
      assetId: 'test-id',
      message: 'hello',
      annotations: null,
      creator: { id: 'user1', name: 'user-name' },
      replies: [],
      attachments: [],
      mentions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sessionId: null,
    })

    const app = new Hono().use('*', authMiddleware).route('/', fileRoute)
    const res = await app.request('/teams/test-team/files/test-id/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hello', attachmentIds: [] }),
    })

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.message).toBe('hello')

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      assetId: 'test-id',
      user: { id: 'user1', name: 'Test User' },
      permission: 'Read',
    })

    expect(notificationService.create).toHaveBeenCalledWith({
      type: 'comment_created',
      teamId: 'test-team',
      creatorId: 'user1',
      assetId: 'test-id',
      commentMessage: 'hello',
    })
  })

  it('GET /teams/:teamId/files/:fileId/comments', async () => {
    vi.mocked(assetService.listComments).mockResolvedValue({
      data: [
        {
          id: 'comment-id',
          assetId: 'test-id',
          message: 'hello',
          annotations: null,
          creator: { id: 'user1', name: 'user-name' },
          replies: [],
          attachments: [],
          mentions: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          sessionId: null,
        },
      ],
      pageInfo: { cursor: 'cursor', total: 1 },
    })

    const app = new Hono().use('*', authMiddleware).route('/', fileRoute)
    const res = await app.request('/teams/test-team/files/test-id/comments')

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(1)
    expect(json.data[0].message).toBe('hello')

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      assetId: 'test-id',
      user: { id: 'user1', name: 'Test User' },
      permission: 'Read',
    })
  })

  it('POST /teams/:teamId/files', async () => {
    vi.mocked(s3Service.putObject).mockResolvedValue(undefined)

    const formData = new FormData()
    const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' })
    formData.append('file', file)

    const app = new Hono().use('*', authMiddleware).route('/', fileRoute)
    const res = await app.request('/teams/test-team/files', {
      method: 'POST',
      body: formData,
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.key).toMatch(/^files\//)

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      teamId: 'test-team',
      user: { id: 'user1', name: 'Test User' },
      permission: 'Read',
    })
    expect(s3Service.putObject).toHaveBeenCalled()
  })

  it('PATCH /teams/:teamId/files/:fileId/metadata', async () => {
    vi.mocked(metadataService.updateAssetMetadata).mockResolvedValue(undefined)

    const app = new Hono().use('*', authMiddleware).route('/', fileRoute)
    const res = await app.request('/teams/test-team/files/test-id/metadata', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ key: 'status', value: 'approved' }]),
    })

    expect(res.status).toBe(200)

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      assetId: 'test-id',
      user: { id: 'user1', name: 'Test User' },
      permission: 'Edit',
    })

    expect(notificationService.create).toHaveBeenCalledWith({
      type: 'metadata_field_updated_status',
      teamId: 'test-team',
      creatorId: 'user1',
      assetId: 'test-id',
    })
  })

  it('PATCH /teams/:teamId/files/:fileId/order', async () => {
    vi.spyOn(assetService, 'updateAssetOrder').mockResolvedValue({
      id: 'test-id',
      name: 'test-file',
      sizeByte: 10,
      fileCount: 1,
      type: 'file',
      status: 'active',
      mediaType: 'image/jpeg',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    const app = new Hono().use('*', authMiddleware).route('/', fileRoute)
    const res = await app.request('/teams/test-team/files/test-id/order', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ beforeIndex: 'index-1' }),
    })

    expect(res.status).toBe(200)

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      assetId: 'test-id',
      user: { id: 'user1', name: 'Test User' },
      permission: 'Edit',
    })

    expect(assetService.updateAssetOrder).toHaveBeenCalledWith('test-id', {
      beforeIndex: 'index-1',
    })
  })
})
