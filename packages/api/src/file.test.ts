import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { Hono, type Context, type Next } from 'hono'
import { prisma } from '@shumai/db'
import fileRoute from './file'
import { assetService } from '@shumai/core/src/asset/asset'
import { metadataService } from '@shumai/core/src/metadata/metadata'
import { notificationService } from '@shumai/core/src/notification/notification'
import { s3Service } from '@shumai/core/src/s3/s3'
import { transcodeService } from '@shumai/core'
import { authMiddleware } from './middleware/auth'
import { authzService, ResourceType, Permission } from '@shumai/core/src/authz/authz'

vi.mock('fs', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  const actualDefault = actual.default as Record<string, unknown>
  return {
    ...actual,
    default: {
      ...actualDefault,
      readFileSync: vi.fn().mockReturnValue(Buffer.from('transcoded content')),
      existsSync: vi.fn().mockReturnValue(true),
      unlinkSync: vi.fn().mockReturnValue(undefined),
    },
  }
})

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
    Team: 'team',
    Project: 'project',
  },
}))

vi.mock('./middleware/auth', () => ({
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
    vi.spyOn(assetService, 'completeComment').mockImplementation(vi.fn())
    vi.spyOn(assetService, 'deleteComment').mockImplementation(vi.fn())
    vi.spyOn(assetService, 'listComments').mockImplementation(vi.fn())
    vi.spyOn(assetService, 'restoreAssets').mockImplementation(vi.fn())
    vi.spyOn(metadataService, 'updateAssetMetadata').mockImplementation(vi.fn())
    vi.spyOn(notificationService, 'create').mockImplementation(vi.fn())
    vi.spyOn(s3Service, 'putObject').mockImplementation(vi.fn())
    vi.spyOn(transcodeService, 'transcodeImage').mockResolvedValue(undefined)
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
      proxyType: 'image',
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
      proxyType: 'image',
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
      isCompleted: false,
      completionLastChangedBy: null,
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
      isCompleted: false,
      completionLastChangedBy: null,
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
          isCompleted: false,
          completionLastChangedBy: null,
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

  it('POST /comments/:commentId/complete', async () => {
    vi.mocked(assetService.completeComment).mockResolvedValue({
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
      isCompleted: true,
      completionLastChangedBy: { id: 'user1', name: 'Test User' },
    })

    const app = new Hono().use('*', authMiddleware).route('/', fileRoute)
    const res = await app.request('/comments/comment-id/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isCompleted: true }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.isCompleted).toBe(true)
    expect(json.completionLastChangedBy.id).toBe('user1')

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: { id: 'user1', name: 'Test User' },
      permission: Permission.Read,
      type: ResourceType.Comment,
      id: 'comment-id',
    })
  })

  it('DELETE /comments/:commentId', async () => {
    vi.mocked(assetService.deleteComment).mockResolvedValue(undefined)

    const app = new Hono().use('*', authMiddleware).route('/', fileRoute)
    const res = await app.request('/comments/comment-id', {
      method: 'DELETE',
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: { id: 'user1', name: 'Test User' },
      permission: Permission.Read,
      type: ResourceType.Comment,
      id: 'comment-id',
    })
    expect(assetService.deleteComment).toHaveBeenCalledWith({
      commentId: 'comment-id',
      userId: 'user1',
    })
  })

  it('POST /teams/:teamId/files - image with compression', async () => {
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
    expect(json.key).toMatch(/^files\/.*\.webp$/)

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: { id: 'user1', name: 'Test User' },
      permission: Permission.Read,
      type: ResourceType.Team,
      id: 'test-team',
    })
    expect(transcodeService.transcodeImage).toHaveBeenCalled()
    expect(s3Service.putObject).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringMatching(/\.webp$/),
      expect.any(Buffer),
      expect.any(Number),
      'image/webp',
    )
  })

  it('POST /teams/:teamId/files - non-image without compression', async () => {
    vi.mocked(s3Service.putObject).mockResolvedValue(undefined)

    const formData = new FormData()
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
    formData.append('file', file)

    const app = new Hono().use('*', authMiddleware).route('/', fileRoute)
    const res = await app.request('/teams/test-team/files', {
      method: 'POST',
      body: formData,
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.key).toMatch(/^files\/[A-Z0-9]+$/)

    expect(transcodeService.transcodeImage).not.toHaveBeenCalled()
    expect(s3Service.putObject).toHaveBeenCalledWith(
      expect.any(String),
      expect.not.stringMatching(/\.webp$/),
      expect.any(Buffer),
      expect.any(Number),
      expect.stringContaining('text/plain'),
    )
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
      proxyType: 'image',
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

  it('POST /files/download-links generates links if assets belong to the same project', async () => {
    const mockGetProjectIds = vi
      .spyOn(assetService, 'getProjectIds')
      .mockResolvedValue(['project-id-1'])

    const mockGetDownloadLinks = vi.spyOn(assetService, 'getDownloadLinks').mockResolvedValue([
      { id: 'file1', name: 'file1.txt', url: 'http://link1' },
      { id: 'file2', name: 'file2.txt', url: 'http://link2' },
    ])

    const app = new Hono().use('*', authMiddleware).route('/', fileRoute)
    const res = await app.request('/files/download-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ['asset1', 'asset2'] }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.files).toHaveLength(2)
    expect(json.files[0].name).toBe('file1.txt')

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: { id: 'user1', name: 'Test User' },
      permission: Permission.Read,
      type: 'project',
      id: 'project-id-1',
    })

    expect(assetService.getDownloadLinks).toHaveBeenCalledWith(['asset1', 'asset2'])

    mockGetProjectIds.mockRestore()
    mockGetDownloadLinks.mockRestore()
  })

  it('POST /files/download-links rejects if assets belong to different projects', async () => {
    const mockGetProjectIds = vi
      .spyOn(assetService, 'getProjectIds')
      .mockResolvedValue(['project-id-1', 'project-id-2'])

    const app = new Hono().use('*', authMiddleware).route('/', fileRoute)
    const res = await app.request('/files/download-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ['asset1', 'asset2'] }),
    })

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('All selected items must belong to the same project')

    mockGetProjectIds.mockRestore()
  })
})
