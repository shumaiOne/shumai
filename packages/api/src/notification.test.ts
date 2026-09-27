import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Hono, type Context, type Next } from 'hono'
import notificationRoute from './notification'
import { notificationService } from '@shumai/core/src/notification/notification'
import { emailService } from '@shumai/core/src/notification/email'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { userMetadataService } from '@shumai/core/src/user-metadata/user-metadata'

const mockUser = { id: 'user1', name: 'Test User', email: 'test@example.com' }

vi.mock('./middleware/auth', () => ({
  authMiddleware: async (c: Context<{ Variables: { user: typeof mockUser } }>, next: Next) => {
    c.set('user', mockUser)
    await next()
  },
}))

vi.mock('@shumai/core/src/authz/authz')
vi.mock('@shumai/core/src/notification/notification')
vi.mock('@shumai/core/src/notification/email', () => ({
  emailService: {
    getEmailSettings: vi.fn(),
    updateEmailSettings: vi.fn(),
    sendTestEmail: vi.fn(),
  },
}))
vi.mock('@shumai/core/src/user-metadata/user-metadata')

describe('notification api', () => {
  const app = new Hono<{ Variables: { user: typeof mockUser } }>()
    .use('*', async (c, next) => {
      c.set('user', mockUser)
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
        kanbanTasks: true,
        kanbanComments: true,
      },
    )
  })

  it('GET /teams/:teamId/notifications/email - requires admin and returns settings', async () => {
    const mockSettings = {
      enabled: true,
      host: 'smtp.example.com',
      port: 587,
      username: 'user',
      password: 'secret-password',
      smtps: true,
      ignoreCert: false,
      from: 'noreply@example.com',
      replyTo: '',
      uploadDebounceSeconds: 300,
    }
    vi.mocked(emailService.getEmailSettings).mockResolvedValue(mockSettings)

    const res = await app.request('/teams/t1/notifications/email')

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual(mockSettings)
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.objectContaining({ id: 'user1' }),
      permission: Permission.Admin,
      type: ResourceType.Team,
      id: 't1',
    })
    expect(emailService.getEmailSettings).toHaveBeenCalledWith('t1')
  })

  it('PUT /teams/:teamId/notifications/email - requires admin and updates settings', async () => {
    const updateInput = {
      enabled: true,
      host: 'mail.example.com',
      port: 465,
      username: 'user',
      password: 'new-password',
      smtps: true,
      ignoreCert: false,
      from: 'shumai@example.com',
      replyTo: 'support@example.com',
      uploadDebounceSeconds: 60,
    }
    vi.mocked(emailService.updateEmailSettings).mockResolvedValue(updateInput)

    const res = await app.request('/teams/t1/notifications/email', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateInput),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual(updateInput)
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.objectContaining({ id: 'user1' }),
      permission: Permission.Admin,
      type: ResourceType.Team,
      id: 't1',
    })
    expect(emailService.updateEmailSettings).toHaveBeenCalledWith('t1', updateInput)
  })

  it('POST /teams/:teamId/notifications/email/test - requires admin and sends test email', async () => {
    const testReq = {
      host: 'smtp.example.com',
      port: 587,
      from: 'noreply@example.com',
    }
    vi.mocked(emailService.sendTestEmail).mockResolvedValue({
      success: true,
      messageId: '<test-msg-id@example.com>',
    })

    const res = await app.request('/teams/t1/notifications/email/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testReq),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({
      success: true,
      messageId: '<test-msg-id@example.com>',
    })
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.objectContaining({ id: 'user1' }),
      permission: Permission.Admin,
      type: ResourceType.Team,
      id: 't1',
    })
    expect(emailService.sendTestEmail).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ id: 'user1', email: 'test@example.com' }),
      testReq,
    )
  })
})
