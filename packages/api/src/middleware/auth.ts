import type { Prisma } from '@shumai/db'
import { auth } from '@shumai/core/src/auth/auth'
import { userService } from '@shumai/core/src/user/user'
import { teamService } from '@shumai/core/src/team/team'
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
    const user = await userService.getUserById(session.user.id)

    if (!user) {
      return c.json({ error: 'User not found' }, 401)
    }

    c.set('user', user)

    if (process.env.SHUMAI_DEMO_MODE === '1') {
      const method = c.req.method.toUpperCase()
      const path = c.req.path
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !path.endsWith('/search')) {
        const hasWritable = await teamService.hasWritableRoleInAnyTeam(user.id)

        if (!hasWritable) {
          return c.json({ error: 'System is in read-only mode' }, 403)
        }
      }
    }

    await next()
  } catch {
    return c.json({ error: 'Authentication failed' }, 401)
  }
})
