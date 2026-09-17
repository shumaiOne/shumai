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
  let user = c.get('user')

  if (!user) {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    })

    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    try {
      const fetchedUser = await userService.getUserById(session.user.id)

      if (!fetchedUser) {
        return c.json({ error: 'User not found' }, 401)
      }

      user = fetchedUser
      c.set('user', user)
    } catch {
      return c.json({ error: 'Authentication failed' }, 401)
    }
  }

  if (process.env.SHUMAI_DEMO_MODE === '1') {
    const method = c.req.method.toUpperCase()
    const path = c.req.path
    const isAllowedDemoWrite =
      method === 'POST' && (path.endsWith('/search') || path.endsWith('/recents/view'))
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !isAllowedDemoWrite) {
      const hasWritable = await teamService.hasWritableRoleInAnyTeam(user.id)

      if (!hasWritable) {
        return c.json({ error: 'System is in read-only mode' }, 403)
      }
    }
  }

  await next()
})
