import { describe, expect, it } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { userService } from '@shumai/core/src/user/user'

describe('UserService', () => {
  setupTestDbHooks()

  describe('getUserById', () => {
    it('returns user when exists', async () => {
      const user = await prisma.user.create({
        data: {
          name: 'Test User',
          email: 'gu-test@example.com',
        },
      })

      const result = await userService.getUserById(user.id)

      expect(result).not.toBeNull()
      expect(result?.id).toBe(user.id)
      expect(result?.name).toBe('Test User')
      expect(result?.email).toBe('gu-test@example.com')
    })

    it('returns null for non-existent ID', async () => {
      const result = await userService.getUserById('nonexistent-id')

      expect(result).toBeNull()
    })
  })

  describe('createGuestUser', () => {
    it('creates user with correct fields', async () => {
      const result = await userService.createGuestUser({
        name: 'Guest',
        email: 'guest@example.com',
        guestEmail: 'original@example.com',
      })

      expect(result.name).toBe('Guest')
      expect(result.email).toBe('guest@example.com')
      expect(result.guestEmail).toBe('original@example.com')
      expect(result.type).toBe('human')
    })

    it('persists to database', async () => {
      const result = await userService.createGuestUser({
        name: 'Guest',
        email: 'guest@example.com',
        guestEmail: 'original@example.com',
      })

      const dbUser = await prisma.user.findUnique({
        where: { id: result.id },
      })

      expect(dbUser).not.toBeNull()
      expect(dbUser?.name).toBe('Guest')
      expect(dbUser?.email).toBe('guest@example.com')
      expect(dbUser?.guestEmail).toBe('original@example.com')
      expect(dbUser?.type).toBe('human')
    })
  })
})
