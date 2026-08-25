import { AsyncLocalStorage } from 'node:async_hooks'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from '@shumai/db'
import { teamService } from '@shumai/core/src/team/team'
import { inviteService } from '@shumai/core/src/invite/invite'
import { createAuthMiddleware } from 'better-auth/api'
import { userMetadataService } from '@shumai/core/src/user-metadata/user-metadata'

interface GeneratedResetLink {
  url: string
  token: string
}

const resetLinkStorage = new AsyncLocalStorage<GeneratedResetLink>()

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 3,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 3600,
    sendResetPassword: async ({ url, token }) => {
      const store = resetLinkStorage.getStore()
      if (store) {
        store.url = url
        store.token = token
      }
    },
  },
  secret: process.env.BETTER_AUTH_SECRET,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  baseURL:
    process.env.BETTER_AUTH_URL || `http://localhost:${process.env.SHUMAI_SERVER_PORT || '3000'}`,
  basePath: '/api/auth',
  trustedOrigins: [
    `http://localhost:${process.env.SHUMAI_SERVER_PORT || '3000'}`,
    `http://127.0.0.1:${process.env.SHUMAI_SERVER_PORT || '3000'}`,
  ],
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

        if (info.initialized) {
          if (!inviteCode) {
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

          const isValid = await inviteService.validateInvite(inviteCode)
          if (!isValid) {
            return ctx.json(
              {
                error: 'Invalid or expired invite code',
              },
              {
                status: 400,
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

            const locale = body?.locale
            if (locale === 'en' || locale === 'zh') {
              const joinedTeams = await prisma.teamMember.findMany({
                where: { userId: user.id },
                select: { teamId: true },
              })
              for (const member of joinedTeams) {
                await userMetadataService.upsertMetadata(user.id, member.teamId, 'locale', locale)
              }
            }
          } catch (err) {
            console.error(`[Better Auth Hook] Error in after hook: ${err}`)
          }
        }
      }
    }),
  },
})

export class AuthService {
  constructor(private readonly prismaClient: typeof prisma = prisma) {}

  async generatePasswordResetLink(email: string): Promise<string> {
    const user = await this.prismaClient.user.findUnique({
      where: { email },
    })

    if (!user) {
      throw new Error(`User with email "${email}" not found`)
    }

    const context: GeneratedResetLink = { url: '', token: '' }
    await resetLinkStorage.run(context, async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (auth.api.requestPasswordReset as any)({
        headers: new Headers(),
        body: {
          email,
          redirectTo: '/reset-password',
        },
      })

      if (res?.error) {
        throw new Error(res.error.message || 'Failed to generate reset link')
      }
    })

    if (context.token) {
      // Invalidate any other pending reset tokens for this user
      await this.prismaClient.verification.deleteMany({
        where: {
          value: user.id,
          identifier: {
            startsWith: 'reset-password:',
            not: `reset-password:${context.token}`,
          },
        },
      })

      const rawBaseUrl =
        process.env.BETTER_AUTH_URL ||
        `http://localhost:${process.env.SHUMAI_SERVER_PORT || '3000'}`
      const baseUrl = rawBaseUrl.replace(/\/$/, '')
      return `${baseUrl}/reset-password?token=${context.token}`
    }

    throw new Error('Failed to generate reset link')
  }

  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean }> {
    if (!token || !token.trim()) {
      throw new Error('Token is required')
    }

    if (!newPassword || newPassword.length < 3) {
      throw new Error('Password must be at least 3 characters')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (auth.api.resetPassword as any)({
      headers: new Headers(),
      body: {
        token,
        newPassword,
        password: newPassword,
      },
    })

    if (res?.error) {
      throw new Error(res.error.message || 'Failed to reset password')
    }

    return { success: true }
  }
}

export const authService = new AuthService()
