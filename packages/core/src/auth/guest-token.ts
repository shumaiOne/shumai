import * as crypto from 'crypto'

export interface GuestTokenPayload {
  userId: string
  shareId: string
  expiresAt: number
}

const GUEST_TOKEN_CONTEXT = 'shumai-guest-token:v1'
const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 days

function getSecret(): string {
  return process.env.BETTER_AUTH_SECRET || 'shumai-guest-secret'
}

function signPayload(payloadB64: string): string {
  return crypto
    .createHmac('sha256', getSecret())
    .update(`${GUEST_TOKEN_CONTEXT}:${payloadB64}`)
    .digest('base64url')
}

export function createGuestToken(
  params: { userId: string; shareId: string },
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): string {
  const payload: GuestTokenPayload = {
    userId: params.userId,
    shareId: params.shareId,
    expiresAt: Date.now() + ttlSeconds * 1000,
  }
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = signPayload(payloadB64)
  return `${payloadB64}.${signature}`
}

export function verifyGuestToken(token: string, expectedShareId: string): GuestTokenPayload | null {
  if (!token) return null
  const [payloadB64, signature, ...rest] = token.split('.')
  if (!payloadB64 || !signature || rest.length > 0) {
    return null
  }

  const expectedSignature = signPayload(payloadB64)
  const actualBuf = Buffer.from(signature)
  const expectedBuf = Buffer.from(expectedSignature)

  if (actualBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(actualBuf, expectedBuf)) {
    return null
  }

  try {
    const payload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8'),
    ) as GuestTokenPayload
    if (!payload.userId || !payload.shareId || typeof payload.expiresAt !== 'number') {
      return null
    }
    if (payload.shareId !== expectedShareId) {
      return null
    }
    if (Date.now() > payload.expiresAt) {
      return null
    }
    return payload
  } catch {
    return null
  }
}
