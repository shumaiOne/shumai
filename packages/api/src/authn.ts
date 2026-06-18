import { Hono } from 'hono'
import { teamService } from '@shumai/core/src/team/team'
import { auth } from '@shumai/core/src/auth/auth'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { prisma } from '@shumai/db'
import { ulid } from 'ulid'

const app = new Hono()

const identifySchema = z.object({
  username: z.string().min(1),
  email: z.string().email(),
})

const route = app
  .get('/signup-info', async (c) => {
    const info = await teamService.getSignupInfo()
    return c.json({
      initialized: info.initialized,
      demoMode: info.demoMode,
    })
  })
  .get('/me', async (c) => {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    })
    return c.json({ id: session?.user?.id ?? null })
  })
  .post('/identify', zValidator('json', identifySchema), async (c) => {
    const { username, email } = c.req.valid('json')

    const dummyEmail = `guest_${ulid()}@guest.local`
    const user = await prisma.user.create({
      data: {
        name: username,
        email: dummyEmail,
        guestEmail: email,
        type: 'human',
      },
    })

    return c.json({ id: user.id })
  })
  .all('/auth/*', (c) => {
    return auth.handler(c.req.raw)
  })

export default route
