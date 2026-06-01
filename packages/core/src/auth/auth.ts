import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from '@shumai/db'
import { teamService } from '@shumai/core/src/team/team'
import { inviteService } from '@shumai/core/src/invite/invite'
import { createAuthMiddleware } from 'better-auth/api'

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 3,
  },
  secret: process.env.BETTER_AUTH_SECRET,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  baseURL: process.env.BETTER_AUTH_URL,
  basePath: '/api/auth',
  trustedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  advanced: {
    disableCSRFCheck: true,
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === '/sign-up/email') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const body = ctx.body as any
        const inviteCode = body?.inviteCode

        const info = await teamService.getSignupInfo()

        if (info.userCount > 0) {
          if (!inviteCode && !info.enablePublicSignup) {
            console.log('[Better Auth Hook] Public signup is disabled')
            return ctx.json(
              {
                error: 'Public signup is disabled',
              },
              {
                status: 403,
              },
            )
          }
        }
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path === '/sign-up/email') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = ctx.context.returned as any

        // Only proceed if the signup was successful and we have a user
        if (result && result.user && result.user.id) {
          const user = result.user
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const body = ctx.body as any
          const inviteCode = body?.inviteCode

          try {
            const info = await teamService.getSignupInfo()
            const defaultTeam = await teamService.ensureDefaultTeam()

            // If this is the very first user, make them owner
            if (info.userCount === 1) {
              await prisma.teamMember.create({
                data: {
                  teamId: defaultTeam.id,
                  userId: user.id,
                  role: 'owner',
                  scope: 'team',
                },
              })
            } else if (!inviteCode) {
              // If public signup is enabled and no invite code, add as editor
              await prisma.teamMember.create({
                data: {
                  teamId: defaultTeam.id,
                  userId: user.id,
                  role: 'editor',
                  scope: 'team',
                },
              })
            }

            if (inviteCode) {
              await inviteService.consumeInvite(inviteCode, user.id)
            }
          } catch (err) {
            console.error(`[Better Auth Hook] Error in after hook: ${err}`)
          }
        }
      }
    }),
  },
})
