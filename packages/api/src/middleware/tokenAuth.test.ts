import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { tokenAuthMiddleware } from './tokenAuth'
import { apiTokenService } from '@shumai/core/src/user/api-token'
import type { Prisma } from '@shumai/db'

vi.mock('@shumai/core/src/user/api-token', () => ({
  apiTokenService: {
    validateToken: vi.fn(),
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
    vi.mocked(apiTokenService.validateToken).mockResolvedValue({
      id: 'user123',
      name: 'John Doe',
      email: 'john@example.com',
    } as unknown as Prisma.UserGetPayload<Record<string, never>>)

    const res = await app.request('/test', {
      headers: {
        Authorization: 'Bearer ulid_token_123',
      },
    })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('user:user123')
    expect(apiTokenService.validateToken).toHaveBeenCalledWith('ulid_token_123')
  })

  it('sets user when valid x-api-key header is provided', async () => {
    vi.mocked(apiTokenService.validateToken).mockResolvedValue({
      id: 'user123',
      name: 'John Doe',
      email: 'john@example.com',
    } as unknown as Prisma.UserGetPayload<Record<string, never>>)

    const res = await app.request('/test', {
      headers: {
        'x-api-key': 'ulid_token_123',
      },
    })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('user:user123')
  })

  it('returns 401 when invalid token is provided', async () => {
    vi.mocked(apiTokenService.validateToken).mockResolvedValue(null)

    const res = await app.request('/test', {
      headers: {
        Authorization: 'Bearer invalid_token',
      },
    })
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized: Invalid API Key' })
  })
})
