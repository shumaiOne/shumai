import { describe, expect, it } from 'vitest'
import { createGuestToken, verifyGuestToken } from './guest-token'

describe('guest-token', () => {
  it('creates and verifies a valid token for the expected shareId', () => {
    const token = createGuestToken({ userId: 'u1', shareId: 'share1' })
    const verified = verifyGuestToken(token, 'share1')
    expect(verified).not.toBeNull()
    expect(verified?.userId).toBe('u1')
    expect(verified?.shareId).toBe('share1')
  })

  it('rejects a token when verified against a different shareId', () => {
    const token = createGuestToken({ userId: 'u1', shareId: 'share1' })
    const verified = verifyGuestToken(token, 'share2')
    expect(verified).toBeNull()
  })

  it('rejects an expired token', () => {
    const token = createGuestToken({ userId: 'u1', shareId: 'share1' }, -10)
    const verified = verifyGuestToken(token, 'share1')
    expect(verified).toBeNull()
  })

  it('rejects a tampered signature', () => {
    const token = createGuestToken({ userId: 'u1', shareId: 'share1' })
    const [payload] = token.split('.')
    const tampered = `${payload}.invalidsignature`
    const verified = verifyGuestToken(tampered, 'share1')
    expect(verified).toBeNull()
  })

  it('rejects malformed token strings', () => {
    expect(verifyGuestToken('', 'share1')).toBeNull()
    expect(verifyGuestToken('singlepart', 'share1')).toBeNull()
    expect(verifyGuestToken('a.b.c', 'share1')).toBeNull()
  })
})
