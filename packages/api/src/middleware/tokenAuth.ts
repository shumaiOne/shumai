import type { Prisma } from '@shumai/db'
import { prisma } from '@shumai/db'
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
    const apiToken = await prisma.apiToken.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!apiToken) {
      return c.json({ error: 'Unauthorized: Invalid API Key' }, 401)
    }

    c.set('user', apiToken.user)
  }

  await next()
})
