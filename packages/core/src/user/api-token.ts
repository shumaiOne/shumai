import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '@shumai/db'

const TOKEN_PREFIX = 'shumai_'
const TOKEN_BYTES = 32
const TOKEN_HINT_LENGTH = 4

/**
 * Hex-encoded SHA-256 digest of a plaintext API token.
 *
 * Must stay in sync with the backfill expression in the `hash_api_tokens`
 * migration (`encode(sha256(convert_to(token, 'UTF8')), 'hex')`). A fast,
 * unsalted hash is sufficient because tokens are long random secrets, not
 * user-chosen passwords.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

function generateToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(TOKEN_BYTES).toString('base64url')}`
}

const tokenSelect = {
  id: true,
  name: true,
  tokenHint: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
} as const

export class ApiTokenService {
  async listTokens(userId: string) {
    return prisma.apiToken.findMany({
      where: { userId },
      select: tokenSelect,
      orderBy: { id: 'desc' },
    })
  }

  /**
   * Create a token for the user. The plaintext is returned only here; it is
   * never stored and cannot be retrieved later.
   */
  async createToken(userId: string, name: string) {
    const token = generateToken()
    const record = await prisma.apiToken.create({
      data: {
        userId,
        name,
        tokenHash: hashToken(token),
        tokenHint: token.slice(-TOKEN_HINT_LENGTH),
      },
      select: tokenSelect,
    })
    return { record, token }
  }

  async deleteToken(userId: string, tokenId: string) {
    return prisma.apiToken.delete({
      where: {
        id: tokenId,
        userId,
      },
      select: tokenSelect,
    })
  }

  async validateToken(tokenString: string) {
    const apiToken = await prisma.apiToken.findUnique({
      where: { tokenHash: hashToken(tokenString) },
      include: { user: true },
    })
    return apiToken ? apiToken.user : null
  }
}

export const apiTokenService = new ApiTokenService()
