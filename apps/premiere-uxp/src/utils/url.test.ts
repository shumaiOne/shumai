import { describe, it, expect } from 'vitest'
import { resolveAssetUrl } from './url'

describe('resolveAssetUrl', () => {
  it('returns undefined for empty or null inputs', () => {
    expect(resolveAssetUrl(null, 'http://localhost:3000')).toBeUndefined()
    expect(resolveAssetUrl(undefined, 'http://localhost:3000')).toBeUndefined()
    expect(resolveAssetUrl('', 'http://localhost:3000')).toBeUndefined()
  })

  it('returns original url if endpoint is not provided', () => {
    expect(resolveAssetUrl('/files/123')).toBe('/files/123')
    expect(resolveAssetUrl('http://example.com/img.png')).toBe('http://example.com/img.png')
  })

  it('prepends endpoint to relative paths', () => {
    expect(resolveAssetUrl('/files/shumai/cat.png', 'http://localhost:3000')).toBe(
      'http://localhost:3000/files/shumai/cat.png',
    )
    expect(resolveAssetUrl('/files/shumai/cat.png', 'http://localhost:3000/')).toBe(
      'http://localhost:3000/files/shumai/cat.png',
    )
  })

  it('rewrites host when server presigned with localhost but client connected via 127.0.0.1', () => {
    const raw = 'http://localhost:3000/files/shumai/files/cat.webp'
    const endpoint = 'http://127.0.0.1:3000'
    expect(resolveAssetUrl(raw, endpoint)).toBe('http://127.0.0.1:3000/files/shumai/files/cat.webp')
  })

  it('rewrites host and protocol when client connected via remote HTTPS server', () => {
    const raw = 'http://localhost:3000/files/shumai/files/cat.webp'
    const endpoint = 'https://shumai.example.com'
    expect(resolveAssetUrl(raw, endpoint)).toBe(
      'https://shumai.example.com/files/shumai/files/cat.webp',
    )
  })

  it('keeps matching absolute URLs intact', () => {
    const raw = 'http://localhost:3000/files/shumai/cat.png'
    expect(resolveAssetUrl(raw, 'http://localhost:3000')).toBe(raw)
  })
})
