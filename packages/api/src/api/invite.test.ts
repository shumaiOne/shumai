import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Hono, type Context, type Next } from 'hono'
import inviteRoute from './invite'
import publicInviteRoute from './public-invite'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { inviteService } from '@shumai/core/src/invite/invite'
import { notificationService } from '@shumai/core/src/notification/notification'

vi.mock('@shumai/core/src/invite/invite')
vi.mock('@shumai/core/src/notification/notification')
vi.mock('@shumai/core/src/authz/authz')

vi.mock('./middleware/auth', () => ({
  authMiddleware: async (
    c: Context<{ Variables: { user: { id: string; name: string } } }>,
    next: Next,
  ) => {
    c.set('user', { id: 'u1', name: 'Test User' })
    await next()
  },
}))

const getApp = () => {
  const app = new Hono<{ Variables: { user: { id: string; name: string } } }>()
    .route('/', publicInviteRoute)
    .use('*', async (c, next) => {
      c.set('user', { id: 'u1', name: 'Test User' })
      await next()
    })
    .route('/', inviteRoute)
  return app
}

describe('Invite API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(authzService.hasPermission).mockResolvedValue(undefined)
  })

  it('GET /invite/:code', async () => {
    const app = getApp()

    // Using any here because mocking complex service return types or Hono context is overly verbose for this test.
    vi.mocked(inviteService.getInvite).mockResolvedValue({
      code: 'code123',
      teamId: 't1',
      team: { name: 'My Team' },
      inviter: { name: 'Inviter' },
      role: 'editor',
      used: false,
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

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

    // Using any here because mocking complex service return types or Hono context is overly verbose for this test.
    vi.mocked(inviteService.createTeamInvite).mockResolvedValue({
      code: 'test-code',
      role: 'editor',
      teamId: 't1',
      team: { name: 'Team A' },
      inviter: { name: 'Inviter' },
      used: false,
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

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
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.anything(),
      permission: Permission.Admin,
      type: ResourceType.Team,
      id: 't1',
    })
    expect(inviteService.createTeamInvite).toHaveBeenCalledWith({
      teamId: 't1',
      role: 'editor',
      inviterId: 'u1',
    })
  })

  it('POST /projects/:projectId/invite', async () => {
    const app = getApp()

    // Using any here because mocking complex service return types or Hono context is overly verbose for this test.
    vi.mocked(inviteService.createProjectInvite).mockResolvedValue({
      code: 'proj-code',
      role: 'reviewer',
      teamId: 't1',
      team: { name: 'Team A' },
      project: { id: 'p1', name: 'Project A' },
      inviter: { name: 'Inviter' },
      used: false,
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

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
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.anything(),
      permission: Permission.Admin,
      type: ResourceType.Project,
      id: 'p1',
    })
    expect(inviteService.createProjectInvite).toHaveBeenCalledWith({
      projectId: 'p1',
      role: 'reviewer',
      inviterId: 'u1',
    })
  })

  it('POST /join (Team)', async () => {
    const app = getApp()
    // Using any here because mocking complex service return types or Hono context is overly verbose for this test.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(notificationService.create).mockResolvedValue(undefined as any)

    // Using any here because mocking complex service return types or Hono context is overly verbose for this test.
    vi.mocked(inviteService.getInvite).mockResolvedValue({
      code: 'code123',
      teamId: 't1',
      team: { name: 'Team A' },
      inviter: { name: 'Inviter' },
      used: false,
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    // Using any here because mocking complex service return types or Hono context is overly verbose for this test.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(inviteService.consumeInvite).mockResolvedValue(undefined as any)

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
