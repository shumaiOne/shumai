import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { auth } from './auth'
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
