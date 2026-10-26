import type { Prisma } from '@shumai/db'
import { apiTokenService } from '@shumai/core/src/user/api-token'
import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'

type User = Prisma.UserGetPayload<Record<string, never>>

/** Reads an API token from `Authorization: Bearer <token>` or `x-api-key`. */
function readApiToken(c: Context): string | null {
  const authHeader = c.req.header('Authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  return c.req.header('x-api-key') || null
}

/**
 * Optional API token authentication: sets `user` when a valid token is present, rejects
 * invalid tokens, and otherwise falls through to session authentication.
 */
export const tokenAuthMiddleware = createMiddleware<{
  Variables: {
    user: User
  }
}>(async (c, next) => {
  const token = readApiToken(c)

  if (token) {
    const user = await apiTokenService.validateToken(token)

    if (!user) {
      return c.json({ error: 'Unauthorized: Invalid API Key' }, 401)
    }

    c.set('user', user)
  }

  await next()
})

/**
 * Required API token authentication for programmatic endpoints (`/ops`, `/mcp`). Session
 * cookies are not accepted, so these endpoints cannot be driven from a browser session.
 */
export const requireApiTokenMiddleware = createMiddleware<{
  Variables: {
    user: User
  }
}>(async (c, next) => {
  const token = readApiToken(c)
  const user = token ? await apiTokenService.validateToken(token) : null

  if (!user) {
    c.header('WWW-Authenticate', 'Bearer realm="shumai"')
    return c.json(
      {
        error: token
          ? 'Unauthorized: Invalid API Key'
          : 'Unauthorized: an API token is required (Authorization: Bearer <token>)',
      },
      401,
    )
  }

  c.set('user', user)
  await next()
})
