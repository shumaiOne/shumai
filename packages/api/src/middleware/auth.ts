import type { Prisma } from '@shumai/db'
import { auth } from '@shumai/core/src/auth/auth'
import { prisma } from '@shumai/db'
import { createMiddleware } from 'hono/factory'

type User = Prisma.UserGetPayload<Record<string, never>>

export const authMiddleware = createMiddleware<{
  Variables: {
    user: User
  }
}>(async (c, next) => {
  if (c.get('user')) {
    await next()
    return
  }

  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  })

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!user) {
      return c.json({ error: 'User not found' }, 401)
    }

    c.set('user', user)

    if (process.env.SHUMAI_DEMO_MODE === '1') {
      const method = c.req.method.toUpperCase()
      const path = c.req.path
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !path.endsWith('/search')) {
        const member = await prisma.teamMember.findFirst({
          where: {
            userId: user.id,
            role: { in: ['owner', 'editor'] },
          },
        })

        if (!member) {
          return c.json({ error: 'System is in read-only mode' }, 403)
        }
      }
    }

    await next()
  } catch {
    return c.json({ error: 'Authentication failed' }, 401)
  }
})
