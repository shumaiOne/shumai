import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { Prisma } from '@shumai/db'
import { authMiddleware } from './auth'
import { auth } from '@shumai/core/src/auth/auth'
import { userService } from '@shumai/core/src/user/user'
import { teamService } from '@shumai/core/src/team/team'

type User = Prisma.UserGetPayload<Record<string, never>>

vi.mock('@shumai/core/src/auth/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

vi.mock('@shumai/core/src/user/user', () => ({
  userService: {
    getUserById: vi.fn(),
  },
}))

vi.mock('@shumai/core/src/team/team', () => ({
  teamService: {
    hasWritableRoleInAnyTeam: vi.fn(),
  },
}))

describe('authMiddleware', () => {
  const app = new Hono()
    .use('*', authMiddleware)
    .get('/test', (c) => c.text('ok'))
    .post('/test', (c) => c.text('ok'))
    .post('/test/search', (c) => c.text('ok'))
    .post('/test/recents/view', (c) => c.text('ok'))

  beforeEach(() => {
    vi.resetAllMocks()
    delete process.env.SHUMAI_DEMO_MODE
  })

  it('allows access when authenticated', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'user1' } } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(userService.getUserById).mockResolvedValue({ id: 'user1' } as any)

    const res = await app.request('/test')
    expect(res.status).toBe(200)
  })

  it('rejects when not authenticated', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null)

    const res = await app.request('/test')
    expect(res.status).toBe(401)
  })

  describe('read-only mode', () => {
    beforeEach(() => {
      process.env.SHUMAI_DEMO_MODE = '1'
    })

    it('allows GET for reviewer', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'user1' } } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(userService.getUserById).mockResolvedValue({ id: 'user1' } as any)

      const res = await app.request('/test')
      expect(res.status).toBe(200)
    })

    it('rejects POST for reviewer', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'user1' } } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(userService.getUserById).mockResolvedValue({ id: 'user1' } as any)
      vi.mocked(teamService.hasWritableRoleInAnyTeam).mockResolvedValue(false) // No owner/editor role

      const res = await app.request('/test', { method: 'POST' })
      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({ error: 'System is in read-only mode' })
    })

    it('allows POST /recents/view for reviewer', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'user1' } } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(userService.getUserById).mockResolvedValue({ id: 'user1' } as any)
      vi.mocked(teamService.hasWritableRoleInAnyTeam).mockResolvedValue(false)

      const res = await app.request('/test/recents/view', { method: 'POST' })
      expect(res.status).toBe(200)
    })

    it('allows POST /search for reviewer', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'user1' } } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(userService.getUserById).mockResolvedValue({ id: 'user1' } as any)

      const res = await app.request('/test/search', { method: 'POST' })
      expect(res.status).toBe(200)
    })

    it('allows POST for owner', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'user1' } } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(userService.getUserById).mockResolvedValue({ id: 'user1' } as any)
      vi.mocked(teamService.hasWritableRoleInAnyTeam).mockResolvedValue(true)

      const res = await app.request('/test', { method: 'POST' })
      expect(res.status).toBe(200)
    })

    it('allows POST for editor', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'user1' } } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(userService.getUserById).mockResolvedValue({ id: 'user1' } as any)
      vi.mocked(teamService.hasWritableRoleInAnyTeam).mockResolvedValue(true)

      const res = await app.request('/test', { method: 'POST' })
      expect(res.status).toBe(200)
    })

    const createTokenApp = () =>
      new Hono<{ Variables: { user: User } }>()
        .use('*', async (c, next) => {
          c.set('user', { id: 'token-user' } as unknown as User)
          await next()
        })
        .use('*', authMiddleware)
        .get('/test', (c) => c.text('ok'))
        .post('/test', (c) => c.text('ok'))
        .post('/test/search', (c) => c.text('ok'))
        .post('/test/recents/view', (c) => c.text('ok'))
        .put('/test', (c) => c.text('ok'))
        .delete('/test', (c) => c.text('ok'))

    it('rejects POST for token-authenticated user without writable role in demo mode', async () => {
      const tokenApp = createTokenApp()
      vi.mocked(teamService.hasWritableRoleInAnyTeam).mockResolvedValue(false)

      const res = await tokenApp.request('/test', { method: 'POST' })
      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({ error: 'System is in read-only mode' })
    })

    it('allows GET for token-authenticated user in demo mode', async () => {
      const tokenApp = createTokenApp()
      const res = await tokenApp.request('/test', { method: 'GET' })
      expect(res.status).toBe(200)
    })

    it('allows allowed demo write paths for token-authenticated user in demo mode', async () => {
      const tokenApp = createTokenApp()
      vi.mocked(teamService.hasWritableRoleInAnyTeam).mockResolvedValue(false)

      const searchRes = await tokenApp.request('/test/search', { method: 'POST' })
      expect(searchRes.status).toBe(200)

      const recentsRes = await tokenApp.request('/test/recents/view', { method: 'POST' })
      expect(recentsRes.status).toBe(200)
    })

    it('allows write operations for token-authenticated user with writable role in demo mode', async () => {
      const tokenApp = createTokenApp()
      vi.mocked(teamService.hasWritableRoleInAnyTeam).mockResolvedValue(true)

      const postRes = await tokenApp.request('/test', { method: 'POST' })
      expect(postRes.status).toBe(200)

      const putRes = await tokenApp.request('/test', { method: 'PUT' })
      expect(putRes.status).toBe(200)

      const delRes = await tokenApp.request('/test', { method: 'DELETE' })
      expect(delRes.status).toBe(200)
    })
  })
})
