import { describe, expect, it } from 'vitest'
import { setupTestDbHooks } from '@shumai/db/test'
import { prisma } from '@shumai/db'
import { apiTokenService, hashToken } from './api-token'

async function createUser(email = 'dev@shumai.com') {
  return prisma.user.create({
    data: {
      name: 'Test Dev',
      email,
      password: 'password',
    },
  })
}

describe('ApiTokenService', () => {
  setupTestDbHooks()

  it('can create, list, validate, and delete api tokens', async () => {
    const user = await createUser()

    const { record, token } = await apiTokenService.createToken(user.id, 'My CLI Key')
    expect(record.id).toBeDefined()
    expect(record.name).toBe('My CLI Key')
    expect(record.userId).toBe(user.id)

    const tokens = await apiTokenService.listTokens(user.id)
    expect(tokens.length).toBe(1)
    expect(tokens[0].id).toBe(record.id)

    const validatedUser = await apiTokenService.validateToken(token)
    expect(validatedUser).toBeDefined()
    expect(validatedUser?.id).toBe(user.id)

    await apiTokenService.deleteToken(user.id, record.id)
    const tokensAfterDelete = await apiTokenService.listTokens(user.id)
    expect(tokensAfterDelete.length).toBe(0)

    const validatedAfterDelete = await apiTokenService.validateToken(token)
    expect(validatedAfterDelete).toBeNull()
  })

  it('generates a prefixed, high-entropy token and returns it only at creation', async () => {
    const user = await createUser()

    const first = await apiTokenService.createToken(user.id, 'first')
    const second = await apiTokenService.createToken(user.id, 'second')

    // shumai_ + base64url(32 bytes) = 7 + 43 characters
    expect(first.token).toMatch(/^shumai_[A-Za-z0-9_-]{43}$/)
    expect(second.token).not.toBe(first.token)
    expect(first.record.tokenHint).toBe(first.token.slice(-4))
    expect(first.record).not.toHaveProperty('token')
    expect(first.record).not.toHaveProperty('tokenHash')
  })

  it('stores only the hash and hint, never the plaintext', async () => {
    const user = await createUser()

    const { record, token } = await apiTokenService.createToken(user.id, 'cli')

    const row = await prisma.apiToken.findUniqueOrThrow({ where: { id: record.id } })
    expect(row.tokenHash).toBe(hashToken(token))
    expect(row.tokenHash).not.toBe(token)
    expect(JSON.stringify(row)).not.toContain(token)
  })

  it('rejects unknown tokens and the stored hash itself', async () => {
    const user = await createUser()
    const { record } = await apiTokenService.createToken(user.id, 'cli')
    const row = await prisma.apiToken.findUniqueOrThrow({ where: { id: record.id } })

    expect(await apiTokenService.validateToken('shumai_not-a-real-token')).toBeNull()
    // Presenting the digest must not authenticate (it would be hashed again)
    expect(await apiTokenService.validateToken(row.tokenHash)).toBeNull()
  })

  it('validates legacy tokens hashed by the SQL migration', async () => {
    const user = await createUser()
    const legacyPlaintext = '01KV5VHB6MR3HCW66C1YRY0A9F'

    // Same expression as the hash_api_tokens migration backfill
    await prisma.$executeRaw`
      INSERT INTO "api_tokens" ("id", "token_hash", "token_hint", "name", "user_id", "updated_at")
      VALUES (
        'legacy-token-id',
        encode(sha256(convert_to(${legacyPlaintext}, 'UTF8')), 'hex'),
        right(${legacyPlaintext}, 4),
        'legacy',
        ${user.id},
        now()
      )
    `

    expect(hashToken(legacyPlaintext)).toBe(
      'd190d6daae5269c015a7e99a23cffa21193f1a56bb785579b337c9ca7708f12c',
    )
    const validatedUser = await apiTokenService.validateToken(legacyPlaintext)
    expect(validatedUser?.id).toBe(user.id)

    const [legacy] = await apiTokenService.listTokens(user.id)
    expect(legacy.tokenHint).toBe('0A9F')
  })
})
