import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Hono, type Context, type Next } from 'hono'
import notificationRoute from './notification'
import { notificationService } from '@shumai/core/src/notification/notification'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { userMetadataService } from '@shumai/core/src/user-metadata/user-metadata'

vi.mock('@/api/middleware/auth', () => ({
  authMiddleware: async (
    c: Context<{ Variables: { user: { id: string; name: string } } }>,
    next: Next,
  ) => {
    c.set('user', { id: 'user1', name: 'Test User' })
    await next()
  },
}))

vi.mock('@shumai/core/src/authz/authz')
vi.mock('@shumai/core/src/notification/notification')
vi.mock('@shumai/core/src/user-metadata/user-metadata')

describe('notification api', () => {
  const app = new Hono<{ Variables: { user: { id: string; name: string } } }>()
    .use('*', async (c, next) => {
      c.set('user', { id: 'user1', name: 'Test User' })
      await next()
    })
    .route('/', notificationRoute)

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(authzService.hasPermission).mockResolvedValue(undefined)
  })

  it('GET /teams/:teamId/notifications', async () => {
    vi.mocked(notificationService.list).mockResolvedValue({
      data: [{ id: 'n1', type: 'comment_created' }] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      pageInfo: { total: 1, cursor: 'abc' },
    })

    const res = await app.request('/teams/t1/notifications?unreadOnly=true&pageSize=10')

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(1)
    expect(json.pageInfo.total).toBe(1)
    expect(json.pageInfo.cursor).toBe('abc')

    expect(notificationService.list).toHaveBeenCalledWith('t1', 'user1', {
      unreadOnly: true,
      after: undefined,
      pageSize: 10,
    })
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.anything(),
      permission: Permission.Read,
      type: ResourceType.Team,
      id: 't1',
    })
  })

  it('POST /teams/:teamId/notifications/read', async () => {
    // Using any here because mocking complex service return types or Hono context is overly verbose for this test.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(notificationService.markRead).mockResolvedValue(undefined as any)

    const res = await app.request('/teams/t1/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId: 'n1' }),
    })

    expect(res.status).toBe(204)
    expect(notificationService.markRead).toHaveBeenCalledWith('t1', 'user1', 'n1')
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.anything(),
      permission: Permission.Read,
      type: ResourceType.Team,
      id: 't1',
    })
  })

  it('GET /teams/:teamId/notifications/settings - returns default settings', async () => {
    vi.mocked(userMetadataService.getMetadata).mockResolvedValue(null)

    const res = await app.request('/teams/t1/notifications/settings')

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.comments).toBe(true)
    expect(json.yourUploads).toBe(false)

    expect(userMetadataService.getMetadata).toHaveBeenCalledWith(
      'user1',
      't1',
      'notification_settings',
    )
  })

  it('GET /teams/:teamId/notifications/settings - returns saved settings', async () => {
    vi.mocked(userMetadataService.getMetadata).mockResolvedValue({
      key: 'notification_settings',
      value: {
        comments: false,
        replies: false,
        mentions: true,
        yourUploads: true,
        otherUploads: false,
        statusUpdates: true,
      },
    })

    const res = await app.request('/teams/t1/notifications/settings')

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.comments).toBe(false)
    expect(json.yourUploads).toBe(true)
  })

  it('POST /teams/:teamId/notifications/settings - saves settings', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(userMetadataService.upsertMetadata).mockResolvedValue(undefined as any)

    const res = await app.request('/teams/t1/notifications/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        comments: false,
        replies: false,
        mentions: true,
        yourUploads: true,
        otherUploads: false,
        statusUpdates: true,
      }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)

    expect(userMetadataService.upsertMetadata).toHaveBeenCalledWith(
      'user1',
      't1',
      'notification_settings',
      {
        comments: false,
        replies: false,
        mentions: true,
        yourUploads: true,
        otherUploads: false,
        statusUpdates: true,
      },
    )
  })
})
