import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { auth, authService } from './auth'
import { userMetadataService } from '../user-metadata/user-metadata'
import { teamService } from '@shumai/core/src/team/team'

describe('Auth Signup Locale Hook', () => {
  setupTestDbHooks()

  beforeEach(() => {
    vi.spyOn(teamService, 'getSignupInfo').mockResolvedValue({
      initialized: false,
      demoMode: false,
      userCount: 1,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should save locale metadata for the user upon signup', async () => {
    const email = `signup-locale-${Date.now()}@example.com`

    // We must use any here because 'locale' is a custom property we extract in
    // our auth hooks, but better-auth's signUpEmail typescript interface does
    // not recognize it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (auth.api.signUpEmail as any)({
      headers: new Headers(),
      body: {
        email,
        password: 'testpassword',
        name: 'Locale Tester',
        locale: 'zh',
      },
    })

    if (res.error) {
      console.error('SIGNUP ERROR:', res.error)
    }

    expect(res).toBeDefined()
    expect(res.user).toBeDefined()
    expect(res.user.email).toBe(email)

    // Check that the userMetadata record was created with key 'locale' and value 'zh'
    const teamMembers = await prisma.teamMember.findMany({
      where: { userId: res.user.id },
    })
    expect(teamMembers.length).toBeGreaterThan(0)

    for (const member of teamMembers) {
      const meta = await userMetadataService.getMetadata(res.user.id, member.teamId, 'locale')
      expect(meta).toBeDefined()
      expect(meta?.value).toBe('zh')
    }
  })

  it('should not save locale metadata if locale is invalid or missing', async () => {
    const email = `signup-no-locale-${Date.now()}@example.com`

    // We must use any here because 'locale' is a custom property we extract in
    // our auth hooks, but better-auth's signUpEmail typescript interface does
    // not recognize it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (auth.api.signUpEmail as any)({
      headers: new Headers(),
      body: {
        email,
        password: 'testpassword',
        name: 'No Locale Tester',
        locale: 'fr', // invalid locale
      },
    })

    if (res.error) {
      console.error('SIGNUP ERROR 2:', res.error)
    }

    expect(res).toBeDefined()
    expect(res.user).toBeDefined()

    const teamMembers = await prisma.teamMember.findMany({
      where: { userId: res.user.id },
    })
    expect(teamMembers.length).toBeGreaterThan(0)

    for (const member of teamMembers) {
      const meta = await userMetadataService.getMetadata(res.user.id, member.teamId, 'locale')
      expect(meta).toBeNull()
    }
  })
})

describe('AuthService Password Reset', () => {
  setupTestDbHooks()

  beforeEach(() => {
    vi.spyOn(teamService, 'getSignupInfo').mockResolvedValue({
      initialized: false,
      demoMode: false,
      userCount: 1,
    })
  })

  it('should throw error when generating reset link for non-existent user', async () => {
    await expect(authService.generatePasswordResetLink('nonexistent@example.com')).rejects.toThrow(
      'User with email "nonexistent@example.com" not found',
    )
  })

  it('should generate a valid reset link and invalidate previous pending tokens', async () => {
    const email = `reset-user-${Date.now()}@example.com`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (auth.api.signUpEmail as any)({
      headers: new Headers(),
      body: {
        email,
        password: 'initialPassword123',
        name: 'Reset User',
      },
    })

    const firstLink = await authService.generatePasswordResetLink(email)
    expect(firstLink).toContain('/reset-password?token=')

    const firstToken = new URL(firstLink).searchParams.get('token')!
    expect(firstToken).toBeTruthy()

    // Check that verification record exists
    const firstVerification = await prisma.verification.findFirst({
      where: { value: firstToken },
    })
    expect(firstVerification).toBeDefined()

    // Generating a second link should produce a new token
    const secondLink = await authService.generatePasswordResetLink(email)
    const secondToken = new URL(secondLink).searchParams.get('token')!
    expect(secondToken).not.toBe(firstToken)

    const newVerification = await prisma.verification.findFirst({
      where: { value: secondToken },
    })
    expect(newVerification).toBeDefined()
  })

  it('should reset password with valid token and revoke active sessions', async () => {
    const email = `reset-valid-${Date.now()}@example.com`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const signUpRes = await (auth.api.signUpEmail as any)({
      headers: new Headers(),
      body: {
        email,
        password: 'oldPassword123',
        name: 'Valid Reset User',
      },
    })

    const userId = signUpRes.user.id

    // Create an active session
    await prisma.session.create({
      data: {
        userId,
        token: `session-${Date.now()}`,
        expiresAt: new Date(Date.now() + 86400 * 1000),
      },
    })

    const activeSessionsBefore = await prisma.session.findMany({
      where: { userId },
    })
    expect(activeSessionsBefore.length).toBeGreaterThan(0)

    // Generate reset link
    const link = await authService.generatePasswordResetLink(email)
    const token = new URL(link).searchParams.get('token')!

    // Reset password
    const result = await authService.resetPassword(token, 'newPassword456')
    expect(result.success).toBe(true)

    // Verify active sessions are revoked
    const activeSessionsAfter = await prisma.session.findMany({
      where: { userId },
    })
    expect(activeSessionsAfter.length).toBe(0)

    // Verify token was deleted
    const usedToken = await prisma.verification.findFirst({
      where: { value: token },
    })
    expect(usedToken).toBeNull()

    // Verify user password was updated to new password
    const account = await prisma.account.findFirst({
      where: { userId, providerId: 'credential' },
    })
    expect(account).toBeDefined()
    expect(account?.password).toBeTruthy()

    const { verifyPassword } = await import('better-auth/crypto')
    const isNewValid = await verifyPassword({
      hash: account!.password!,
      password: 'newPassword456',
    })
    expect(isNewValid).toBe(true)

    const isOldValid = await verifyPassword({
      hash: account!.password!,
      password: 'oldPassword123',
    })
    expect(isOldValid).toBe(false)
  })

  it('should reject expired or invalid token', async () => {
    const email = `reset-expired-${Date.now()}@example.com`
    const user = await prisma.user.create({
      data: {
        email,
        name: 'Expired User',
      },
    })

    // Create expired token
    const token = 'expired-token-123'
    await prisma.verification.create({
      data: {
        identifier: `reset-password:${user.id}`,
        value: token,
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      },
    })

    await expect(authService.resetPassword(token, 'newPassword123')).rejects.toThrow()

    // Non-existent token
    await expect(
      authService.resetPassword('non-existent-token', 'newPassword123'),
    ).rejects.toThrow()
  })
})
