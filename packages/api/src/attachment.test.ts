import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import attachmentRoute from './attachment'
import { assetService } from '@shumai/core/src/asset/asset'
import { AssetType } from '@shumai/db'
import { authMiddleware } from './middleware/auth'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { auditLogService } from '@shumai/core/src/auditLog/auditLog'

vi.mock('./middleware/auth', () => ({
  // any is used here because Hono's Context and Next types are complex to mock in vitest.mock
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authMiddleware: async (c: any, next: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    c.set('user', { id: 'user1', name: 'Test User' } as any)
    await next()
  },
}))

vi.mock('@shumai/core/src/authz/authz')
vi.mock('@shumai/core/src/asset/asset')
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

vi.mock('@shumai/core/src/s3/s3', () => ({
  s3Service: {
    presign: vi.fn().mockResolvedValue('http://mock-s3-url'),
  },
}))

describe('Attachment API', () => {
  const app = new Hono().use('*', authMiddleware).route('/', attachmentRoute)

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(authzService.hasPermission).mockResolvedValue(undefined)
  })

  it('POST /projects/:projectId/attachments', async () => {
    // We only need the id for this test
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(assetService.createAsset).mockResolvedValue({ id: 'asset1' } as any)

    const res = await app.request('/projects/project1/attachments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test' },
      body: JSON.stringify({
        fileName: 'test.txt',
        contentType: 'text/plain',
        size: 100,
      }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.id).toBe('asset1')
    expect(json.uploadUrl).toBe('http://mock-s3-url')
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.anything(),
      permission: Permission.Edit,
      type: ResourceType.Project,
      id: 'project1',
    })
    expect(assetService.createAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'test.txt',
        type: AssetType.attachment,
        projectId: 'project1',
      }),
    )
    expect(auditLogService.logAction).toHaveBeenCalledWith({
      action: 'file_create',
      teamId: 't1',
      userId: 'user1',
      projectId: 'project1',
      itemId: 'asset1',
    })
  })
})
