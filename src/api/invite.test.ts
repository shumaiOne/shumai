import { describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import inviteRoute from './invite'
import publicInviteRoute from './public-invite'
import { authMiddleware } from '@/api/middleware/auth'

vi.mock('@/services/invite/invite', () => ({
  inviteService: {
    createTeamInvite: vi.fn(),
    createProjectInvite: vi.fn(),
    getInvite: vi.fn(),
    consumeInvite: vi.fn(),
  },
}))

vi.mock('@/services/notification/notification', () => ({
  notificationService: {
    create: vi.fn(),
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

vi.mock('@/api/middleware/auth', () => ({
  // any is used here because Hono's Context and Next types are complex to mock in vitest.mock
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authMiddleware: async (c: any, next: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    c.set('user', { id: 'u1', name: 'Test User' } as any)
    await next()
  },
}))

const getApp = () => {
  const app = new Hono()
    .route('/', publicInviteRoute)
    .use('*', authMiddleware)
    .route('/', inviteRoute)
  return app
}

describe('Invite API', () => {
  it('GET /invite/:code', async () => {
    const app = getApp()
    const { inviteService } = await import('@/services/invite/invite')
    vi.mocked(inviteService.getInvite).mockResolvedValue({
      code: 'code123',
      teamId: 't1',
      team: { name: 'My Team' },
      inviter: { name: 'Inviter' },
      role: 'editor',
      used: false,
    } as never)

    const res = await app.request('/invite/code123')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      code: 'code123',
      role: 'editor',
      teamId: 't1',
      teamName: 'My Team',
      inviterName: 'Inviter',
      isUsed: false,
    })
  })

  it('POST /teams/:teamId/invite', async () => {
    const app = getApp()
    const { authzService } = await import('@/services/authz/authz')
    const { inviteService } = await import('@/services/invite/invite')
    vi.mocked(authzService.hasPermission).mockResolvedValue(undefined as never)
    vi.mocked(inviteService.createTeamInvite).mockResolvedValue({
      code: 'test-code',
      role: 'editor',
      teamId: 't1',
      team: { name: 'Team A' },
      inviter: { name: 'Inviter' },
      used: false,
    } as never)

    const res = await app.request('/teams/t1/invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer fake',
      },
      body: JSON.stringify({ role: 'editor' }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      code: 'test-code',
      role: 'editor',
      teamId: 't1',
      teamName: 'Team A',
      inviterName: 'Inviter',
      isUsed: false,
    })
    expect(inviteService.createTeamInvite).toHaveBeenCalledWith({
      teamId: 't1',
      role: 'editor',
      inviterId: 'u1',
    })
  })

  it('POST /projects/:projectId/invite', async () => {
    const app = getApp()
    const { authzService } = await import('@/services/authz/authz')
    const { inviteService } = await import('@/services/invite/invite')
    vi.mocked(authzService.hasPermission).mockResolvedValue(undefined as never)
    vi.mocked(inviteService.createProjectInvite).mockResolvedValue({
      code: 'proj-code',
      role: 'reviewer',
      teamId: 't1',
      team: { name: 'Team A' },
      project: { id: 'p1', name: 'Project A' },
      inviter: { name: 'Inviter' },
      used: false,
    } as never)

    const res = await app.request('/projects/p1/invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer fake',
      },
      body: JSON.stringify({ role: 'reviewer' }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      code: 'proj-code',
      role: 'reviewer',
      teamId: 't1',
      teamName: 'Team A',
      projectId: 'p1',
      projectName: 'Project A',
      inviterName: 'Inviter',
      isUsed: false,
    })
    expect(inviteService.createProjectInvite).toHaveBeenCalledWith({
      projectId: 'p1',
      role: 'reviewer',
      inviterId: 'u1',
    })
  })

  it('POST /join (Team)', async () => {
    const app = getApp()
    const { inviteService } = await import('@/services/invite/invite')
    const { notificationService } = await import('@/services/notification/notification')

    vi.mocked(notificationService.create).mockResolvedValue(undefined as never)

    vi.mocked(inviteService.getInvite).mockResolvedValue({
      code: 'code123',
      teamId: 't1',
      team: { name: 'Team A' },
      inviter: { name: 'Inviter' },
      used: false,
    } as never)
    vi.mocked(inviteService.consumeInvite).mockResolvedValue(undefined as never)

    const res = await app.request('/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer fake',
      },
      body: JSON.stringify({ code: 'code123' }),
    })

    expect(res.status).toBe(200)
    expect(inviteService.consumeInvite).toHaveBeenCalledWith('code123', 'u1')
  })
})
