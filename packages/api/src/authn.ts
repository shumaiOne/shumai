import { Hono } from 'hono'
import { teamService } from '@shumai/core/src/team/team'
import { userService } from '@shumai/core/src/user/user'
import { auth } from '@shumai/core/src/auth/auth'
import { createGuestToken } from '@shumai/core/src/auth/guest-token'
import { isArchiveStorageEnabled } from '@shumai/core/src/s3/archive-storage'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { ulid } from 'ulid'
import { setCookie } from 'hono/cookie'

const app = new Hono()

const identifySchema = z.object({
  username: z.string().min(1),
  email: z.string().email(),
  shareId: z.string().min(1).optional(),
})

const route = app
  .get('/signup-info', async (c) => {
    const info = await teamService.getSignupInfo()
    return c.json({
      initialized: info.initialized,
      demoMode: info.demoMode,
      archiveStorageEnabled: isArchiveStorageEnabled(),
    })
  })
  .get('/me', async (c) => {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    })
    return c.json({ id: session?.user?.id ?? null })
  })
  .post('/identify', zValidator('json', identifySchema), async (c) => {
    const { username, email, shareId } = c.req.valid('json')

    const dummyEmail = `guest_${ulid()}@guest.local`
    const user = await userService.createGuestUser({
      name: username,
      email: dummyEmail,
      guestEmail: email,
    })

    if (shareId) {
      const token = createGuestToken({ userId: user.id, shareId })
      setCookie(c, `shumai_guest_${shareId}`, token, {
        httpOnly: true,
        path: '/',
        sameSite: 'Lax',
        secure: c.req.url.startsWith('https://') || process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60,
      })
    }

    return c.json({ id: user.id })
  })
  .all('/auth/*', (c) => {
    return auth.handler(c.req.raw)
  })

export default route
