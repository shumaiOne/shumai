import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import notificationRoute from './notification'
import { notificationService } from '@/services/notification/notification'
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

describe('notification api', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockList: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockMarkRead: any

  beforeEach(() => {
    mockList = vi.fn()
    mockMarkRead = vi.fn()
    vi.spyOn(notificationService, 'list').mockImplementation(mockList)
    vi.spyOn(notificationService, 'markRead').mockImplementation(mockMarkRead)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('GET /teams/:teamId/notifications', async () => {
    mockList.mockResolvedValue({
      data: [{ id: 'n1', type: 'comment_created' }],
      pageInfo: { total: 1, cursor: 'abc' },
    })

    const app = new Hono().use('*', authMiddleware).route('/', notificationRoute)
    const res = await app.request('/teams/t1/notifications?unreadOnly=true&pageSize=10')

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(1)
    expect(json.pageInfo.total).toBe(1)
    expect(json.pageInfo.cursor).toBe('abc')

    expect(mockList).toHaveBeenCalledWith('t1', 'user1', {
      unreadOnly: true,
      after: undefined,
      pageSize: 10,
    })
  })

  it('POST /teams/:teamId/notifications/read', async () => {
    mockMarkRead.mockResolvedValue(undefined)

    const app = new Hono().use('*', authMiddleware).route('/', notificationRoute)
    const res = await app.request('/teams/t1/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId: 'n1' }),
    })

    expect(res.status).toBe(204)
    expect(mockMarkRead).toHaveBeenCalledWith('t1', 'user1', 'n1')
  })
})
