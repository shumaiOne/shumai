import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import attachmentRoute from './attachment'
import { assetService } from '@/services/asset/asset'
import { AssetType } from '@/generated/prisma/client'
import { authMiddleware } from '@/api/middleware/auth'

vi.mock('@/api/middleware/auth', () => ({
  // any is used here because Hono's Context and Next types are complex to mock in vitest.mock
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authMiddleware: async (c: any, next: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    c.set('user', { id: 'user1', name: 'Test User' } as any)
    await next()
  },
}))

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

vi.mock('@/services/s3/s3', () => ({
  s3Service: {
    presign: vi.fn().mockResolvedValue('http://mock-s3-url'),
  },
}))

describe('Attachment API', () => {
  const app = new Hono().use('*', authMiddleware).route('/', attachmentRoute)

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('POST /projects/:projectId/attachments', async () => {
    // We only need the id for this test
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(assetService, 'createAsset').mockResolvedValue({ id: 'asset1' } as any)

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
    expect(assetService.createAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'test.txt',
        type: AssetType.attachment,
        projectId: 'project1',
      }),
    )
  })
})
