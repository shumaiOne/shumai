import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { tokenAuthMiddleware } from './tokenAuth'
import { prisma } from '@shumai/db'

vi.mock('@shumai/db', () => ({
  prisma: {
    apiToken: {
      findUnique: vi.fn(),
    },
  },
}))

describe('tokenAuthMiddleware', () => {
  const app = new Hono().use('*', tokenAuthMiddleware).get('/test', (c) => {
    const user = c.get('user')
    if (user) {
      return c.text(`user:${user.id}`)
    }
    return c.text('no-user')
  })

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('proceeds with no user if no token is provided', async () => {
    const res = await app.request('/test')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('no-user')
  })

  it('sets user when valid Authorization Bearer token is provided', async () => {
    vi.mocked(prisma.apiToken.findUnique).mockResolvedValue({
      id: 'token1',
      token: 'ulid_token_123',
      name: 'cli-key',
      userId: 'user123',
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: 'user123',
        name: 'John Doe',
        email: 'john@example.com',
      },
      // Mocking the complex PrismaPromise return type of findUnique is not feasible without any here.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const res = await app.request('/test', {
      headers: {
        Authorization: 'Bearer ulid_token_123',
      },
    })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('user:user123')
    expect(prisma.apiToken.findUnique).toHaveBeenCalledWith({
      where: { token: 'ulid_token_123' },
      include: { user: true },
    })
  })

  it('sets user when valid x-api-key header is provided', async () => {
    vi.mocked(prisma.apiToken.findUnique).mockResolvedValue({
      id: 'token1',
      token: 'ulid_token_123',
      name: 'cli-key',
      userId: 'user123',
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: 'user123',
        name: 'John Doe',
        email: 'john@example.com',
      },
      // Mocking the complex PrismaPromise return type of findUnique is not feasible without any here.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const res = await app.request('/test', {
      headers: {
        'x-api-key': 'ulid_token_123',
      },
    })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('user:user123')
  })

  it('returns 401 when invalid token is provided', async () => {
    vi.mocked(prisma.apiToken.findUnique).mockResolvedValue(null)

    const res = await app.request('/test', {
      headers: {
        Authorization: 'Bearer invalid_token',
      },
    })
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized: Invalid API Key' })
  })
})
