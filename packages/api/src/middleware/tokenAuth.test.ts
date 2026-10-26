import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { requireApiTokenMiddleware, tokenAuthMiddleware } from './tokenAuth'
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

describe('requireApiTokenMiddleware', () => {
  const app = new Hono()
    .use('*', requireApiTokenMiddleware)
    .post('/test', (c) => c.text(`user:${c.get('user').id}`))

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('rejects requests without a token and advertises Bearer auth', async () => {
    const res = await app.request('/test', { method: 'POST' })

    expect(res.status).toBe(401)
    expect(res.headers.get('WWW-Authenticate')).toBe('Bearer realm="shumai"')
    expect(await res.json()).toEqual({
      error: 'Unauthorized: an API token is required (Authorization: Bearer <token>)',
    })
    expect(apiTokenService.validateToken).not.toHaveBeenCalled()
  })

  it('does not accept a session cookie in place of a token', async () => {
    const res = await app.request('/test', {
      method: 'POST',
      headers: { Cookie: 'better-auth.session_token=abc' },
    })

    expect(res.status).toBe(401)
  })

  it('rejects an invalid token', async () => {
    vi.mocked(apiTokenService.validateToken).mockResolvedValue(null)

    const res = await app.request('/test', {
      method: 'POST',
      headers: { Authorization: 'Bearer nope' },
    })

    expect(res.status).toBe(401)
    expect(res.headers.get('WWW-Authenticate')).toBe('Bearer realm="shumai"')
    expect(await res.json()).toEqual({ error: 'Unauthorized: Invalid API Key' })
  })

  it.each<Record<string, string>>([{ Authorization: 'Bearer good' }, { 'x-api-key': 'good' }])(
    'sets the user for a valid token (%o)',
    async (headers) => {
      vi.mocked(apiTokenService.validateToken).mockResolvedValue({
        id: 'user123',
      } as unknown as Prisma.UserGetPayload<Record<string, never>>)

      const res = await app.request('/test', { method: 'POST', headers })

      expect(res.status).toBe(200)
      expect(await res.text()).toBe('user:user123')
      expect(apiTokenService.validateToken).toHaveBeenCalledWith('good')
    },
  )
})
