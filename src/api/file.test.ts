import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { Hono, type Context, type Next } from 'hono'
import { prisma } from '@/db'
import fileRoute from './file'
import { assetService } from '@/services/asset/asset'
import { metadataService } from '@/services/metadata/metadata'
import { notificationService } from '@/services/notification/notification'
import { s3Service } from '@/services/s3/s3'
import { authMiddleware } from '@/api/middleware/auth'
import { authzService, ResourceType, Permission } from '@/services/authz/authz'

vi.mock('@/services/authz/authz', () => ({
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
    Team: 'team',
  },
}))

vi.mock('@/api/middleware/auth', () => ({
  authMiddleware: async (c: Context, next: Next) => {
    c.set('user', { id: 'user1', name: 'Test User' })
    await next()
  },
}))

describe('file api', () => {
  beforeEach(() => {
    vi.mocked(authzService.hasPermission).mockClear()

    vi.spyOn(assetService, 'getAsset').mockImplementation(vi.fn())
    vi.spyOn(assetService, 'getAssetContext').mockResolvedValue({ teamId: 'test-team' })
    vi.spyOn(assetService, 'updateAssetName').mockImplementation(vi.fn())
    vi.spyOn(assetService, 'deleteAssets').mockImplementation(vi.fn())
    vi.spyOn(assetService, 'createComment').mockImplementation(vi.fn())
    vi.spyOn(assetService, 'listComments').mockImplementation(vi.fn())
    vi.spyOn(assetService, 'restoreAssets').mockImplementation(vi.fn())
    vi.spyOn(metadataService, 'updateAssetMetadata').mockImplementation(vi.fn())
    vi.spyOn(notificationService, 'create').mockImplementation(vi.fn())
    vi.spyOn(s3Service, 'putObject').mockImplementation(vi.fn())
    vi.mocked(authzService.hasPermission).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('GET /files/:fileId', async () => {
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
    const res = await app.request('/files/test-id')

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.name).toBe('test-file')

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: { id: 'user1', name: 'Test User' },
      permission: Permission.Read,
      type: ResourceType.Asset,
      id: 'test-id',
    })
  })

  it('PUT /files/:fileId', async () => {
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
    const res = await app.request('/files/test-id', {
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
  })

  it('DELETE /files', async () => {
    vi.mocked(assetService.deleteAssets).mockResolvedValue(undefined)

    const app = new Hono().use('*', authMiddleware).route('/', fileRoute)
    const res = await app.request('/files', {
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
  })

  it('POST /files/restore', async () => {
    vi.mocked(assetService.restoreAssets).mockResolvedValue(undefined)

    const app = new Hono().use('*', authMiddleware).route('/', fileRoute)
    const res = await app.request('/files/restore', {
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

  it('POST /files/:fileId/comments', async () => {
    vi.mocked(assetService.createComment).mockResolvedValue({
      id: 'comment-id',
      assetId: 'file-id',
      message: 'hello',
      annotations: null,
      second: null,
      creator: { id: 'user-id', name: 'Test User' },
      replies: [],
      attachments: [],
      mentions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sessionId: null,
    })

    // Mock assetService.getAsset to return teamId for notification
    vi.mocked(assetService.getAsset).mockResolvedValue({
      id: 'test-id',
      project: { teamId: 'test-team' },
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const app = new Hono().use('*', authMiddleware).route('/', fileRoute)
    const res = await app.request('/files/test-id/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hello', attachmentIds: [] }),
    })

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.message).toBe('hello')

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: { id: 'user1', name: 'Test User' },
      permission: Permission.Read,
      type: ResourceType.Asset,
      id: 'test-id',
    })

    expect(notificationService.create).toHaveBeenCalledWith({
      type: 'comment_created',
      teamId: 'test-team',
      creatorId: 'user1',
      assetId: 'test-id',
      commentMessage: 'hello',
    })
  })

  it('POST /files/:fileId/comments - reply_created targets parent comment creator', async () => {
    vi.mocked(assetService.createComment).mockResolvedValue({
      id: 'comment-id',
      assetId: 'file-id',
      message: 'hello reply',
      annotations: null,
      second: null,
      creator: { id: 'user-id', name: 'Test User' },
      replies: [],
      attachments: [],
      mentions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sessionId: null,
    })

    // Mock assetService.getAsset to return teamId for notification
    vi.mocked(assetService.getAsset).mockResolvedValue({
      id: 'test-id',
      project: { teamId: 'test-team' },
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const mockFindUnique = vi.spyOn(prisma.assetComment, 'findUnique').mockResolvedValue({
      id: 'parent-comment-id',
      creatorId: 'parent-comment-creator-id',
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const app = new Hono().use('*', authMiddleware).route('/', fileRoute)
    const res = await app.request('/files/test-id/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'hello reply',
        replyToId: 'parent-comment-id',
        attachmentIds: [],
      }),
    })

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.message).toBe('hello reply')

    expect(notificationService.create).toHaveBeenCalledWith({
      type: 'reply_created',
      teamId: 'test-team',
      creatorId: 'user1',
      assetId: 'test-id',
      userId: 'parent-comment-creator-id',
      commentMessage: 'hello reply',
    })

    mockFindUnique.mockRestore()
  })

  it('GET /files/:fileId/comments', async () => {
    vi.mocked(assetService.listComments).mockResolvedValue({
      data: [
        {
          id: 'comment-id',
          assetId: 'file-id',
          message: 'hello',
          annotations: null,
          second: null,
          creator: { id: 'user-id', name: 'Test User' },
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
    const res = await app.request('/files/test-id/comments')

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(1)
    expect(json.data[0].message).toBe('hello')

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: { id: 'user1', name: 'Test User' },
      permission: Permission.Read,
      type: ResourceType.Asset,
      id: 'test-id',
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
      user: { id: 'user1', name: 'Test User' },
      permission: Permission.Read,
      type: ResourceType.Team,
      id: 'test-team',
    })
    expect(s3Service.putObject).toHaveBeenCalled()
  })

  it('PATCH /files/:fileId/metadata', async () => {
    vi.mocked(metadataService.updateAssetMetadata).mockResolvedValue(undefined)
    // Mock assetService.getAsset to return teamId for notification
    vi.mocked(assetService.getAsset).mockResolvedValue({
      id: 'test-id',
      project: { teamId: 'test-team' },
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const app = new Hono().use('*', authMiddleware).route('/', fileRoute)
    const res = await app.request('/files/test-id/metadata', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ key: 'status', value: 'approved' }]),
    })

    expect(res.status).toBe(200)

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: { id: 'user1', name: 'Test User' },
      permission: Permission.Edit,
      type: ResourceType.Asset,
      id: 'test-id',
    })

    expect(notificationService.create).toHaveBeenCalledWith({
      type: 'metadata_field_updated_status',
      teamId: 'test-team',
      creatorId: 'user1',
      assetId: 'test-id',
    })
  })

  it('PATCH /files/:fileId/metadata rejects readonly fields with 422', async () => {
    vi.mocked(metadataService.updateAssetMetadata).mockRejectedValue(
      new Error('Field some-key is read-only'),
    )

    const app = new Hono().use('*', authMiddleware).route('/', fileRoute)
    const res = await app.request('/files/test-id/metadata', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ key: 'some-key', value: 'approved' }]),
    })

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toContain('Field some-key is read-only')
  })

  it('PATCH /files/:fileId/order', async () => {
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
    const res = await app.request('/files/test-id/order', {
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
