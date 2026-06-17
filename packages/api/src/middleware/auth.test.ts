import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { authMiddleware } from './auth'
import { auth } from '@shumai/core/src/auth/auth'
import { prisma } from '@shumai/db'

vi.mock('@shumai/core/src/auth/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

vi.mock('@shumai/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    teamMember: {
      findFirst: vi.fn(),
    },
  },
}))

describe('authMiddleware', () => {
  const app = new Hono()
    .use('*', authMiddleware)
    .get('/test', (c) => c.text('ok'))
    .post('/test', (c) => c.text('ok'))

  beforeEach(() => {
    vi.resetAllMocks()
    delete process.env.REVIEWER_READ_ONLY
  })

  it('allows access when authenticated', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'user1' } } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user1' } as any)

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
      process.env.REVIEWER_READ_ONLY = '1'
    })

    it('allows GET for reviewer', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'user1' } } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user1' } as any)

      const res = await app.request('/test')
      expect(res.status).toBe(200)
    })

    it('rejects POST for reviewer', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'user1' } } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user1' } as any)
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue(null) // No owner/editor role

      const res = await app.request('/test', { method: 'POST' })
      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({ error: 'System is in read-only mode' })
    })

    it('allows POST for owner', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'user1' } } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user1' } as any)
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member1',
        role: 'owner',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      const res = await app.request('/test', { method: 'POST' })
      expect(res.status).toBe(200)
    })

    it('allows POST for editor', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'user1' } } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user1' } as any)
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member1',
        role: 'editor',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      const res = await app.request('/test', { method: 'POST' })
      expect(res.status).toBe(200)
    })
  })
})
