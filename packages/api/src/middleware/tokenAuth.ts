import type { Prisma } from '@shumai/db'
import { apiTokenService } from '@shumai/core/src/user/api-token'
import { createMiddleware } from 'hono/factory'

type User = Prisma.UserGetPayload<Record<string, never>>

export const tokenAuthMiddleware = createMiddleware<{
  Variables: {
    user: User
  }
}>(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  const token =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : c.req.header('x-api-key') || null

  if (token) {
    const user = await apiTokenService.validateToken(token)

    if (!user) {
      return c.json({ error: 'Unauthorized: Invalid API Key' }, 401)
    }

    c.set('user', user)
  }

  await next()
})
