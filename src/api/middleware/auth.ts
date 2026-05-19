import type { Prisma } from '@/generated/prisma/client'
import { auth } from '@/services/auth/auth'
import { prisma } from '@/db'
import { createMiddleware } from 'hono/factory'

type User = Prisma.UserGetPayload<Record<string, never>>

export const authMiddleware = createMiddleware<{
  Variables: {
    user: User
  }
}>(async (c, next) => {
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
    await next()
  } catch {
    return c.json({ error: 'Authentication failed' }, 401)
  }
})
