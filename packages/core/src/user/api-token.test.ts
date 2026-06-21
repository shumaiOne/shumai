import { describe, expect, it } from 'vitest'
import { setupTestDbHooks } from '@shumai/db/test'
import { prisma } from '@shumai/db'
import { apiTokenService } from './api-token'

describe('ApiTokenService', () => {
  setupTestDbHooks()

  it('can create, list, validate, and delete api tokens', async () => {
    const user = await prisma.user.create({
      data: {
        name: 'Test Dev',
        email: 'dev@shumai.com',
        password: 'password',
      },
    })

    const token = await apiTokenService.createToken(user.id, 'My CLI Key')
    expect(token.id).toBeDefined()
    expect(token.token).toBeDefined()
    expect(token.name).toBe('My CLI Key')
    expect(token.userId).toBe(user.id)

    const tokens = await apiTokenService.listTokens(user.id)
    expect(tokens.length).toBe(1)
    expect(tokens[0].id).toBe(token.id)

    const validatedUser = await apiTokenService.validateToken(token.token)
    expect(validatedUser).toBeDefined()
    expect(validatedUser?.id).toBe(user.id)

    await apiTokenService.deleteToken(user.id, token.id)
    const tokensAfterDelete = await apiTokenService.listTokens(user.id)
    expect(tokensAfterDelete.length).toBe(0)

    const validatedAfterDelete = await apiTokenService.validateToken(token.token)
    expect(validatedAfterDelete).toBeNull()
  })
})
