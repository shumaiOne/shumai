import { Buffer } from 'buffer'
import nacl from 'tweetnacl'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function marshal(key: Uint8Array, v: any): string {
  const b = Buffer.from(JSON.stringify(v), 'utf8')
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength)
  const d = nacl.secretbox(b, nonce, key)

  const combined = Buffer.concat([nonce, d])
  return combined.toString('base64url')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function unmarshal(key: Uint8Array, s: string): any {
  if (!s) {
    return null
  }

  const combined = Buffer.from(s, 'base64url')
  if (combined.length < nacl.secretbox.nonceLength) {
    throw new Error('token too short')
  }

  const nonce = combined.subarray(0, nacl.secretbox.nonceLength)
  const d = combined.subarray(nacl.secretbox.nonceLength)

  const b = nacl.secretbox.open(d, nonce, key)
  if (!b) {
    throw new Error('decrypt token failed')
  }

  const jsonStr = Buffer.from(b).toString('utf8')
  return JSON.parse(jsonStr)
}
