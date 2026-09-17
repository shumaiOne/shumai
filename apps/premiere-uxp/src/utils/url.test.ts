import { describe, it, expect } from 'vitest'
import { resolveAssetUrl, normalizeEndpoint, isSameEndpoint } from './url'

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

  it('preserves absolute URLs intact even when hosts differ', () => {
    const localRaw = 'http://localhost:3000/files/shumai/files/cat.webp'
    const endpoint = 'http://127.0.0.1:3000'
    expect(resolveAssetUrl(localRaw, endpoint)).toBe(localRaw)

    const remoteEndpoint = 'https://shumai.example.com'
    expect(resolveAssetUrl(localRaw, remoteEndpoint)).toBe(localRaw)
  })

  it('keeps matching absolute URLs intact', () => {
    const raw = 'http://localhost:3000/files/shumai/cat.png'
    expect(resolveAssetUrl(raw, 'http://localhost:3000')).toBe(raw)
  })

  it('preserves remote cloud storage presigned URLs without rewriting host', () => {
    const r2Url =
      'https://04e37a3c563610bccea6a3ce6f8618ca.r2.cloudflarestorage.com/shumai/files/01KYKNT8NEJ3Q1G6A6K08M2XHC/Float%2002-480p.jpeg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=8112ab30'
    const endpoint = 'https://staging.shumai.one'
    expect(resolveAssetUrl(r2Url, endpoint)).toBe(r2Url)
  })
})

describe('normalizeEndpoint', () => {
  it('handles empty and null values', () => {
    expect(normalizeEndpoint('')).toBe('')
    expect(normalizeEndpoint(null)).toBe('')
    expect(normalizeEndpoint(undefined)).toBe('')
  })

  it('trims whitespace and trailing slashes and converts to lower case', () => {
    expect(normalizeEndpoint(' https://STAGING.shumai.one/// ')).toBe('https://staging.shumai.one')
    expect(normalizeEndpoint('http://localhost:3000/')).toBe('http://localhost:3000')
  })
})

describe('isSameEndpoint', () => {
  it('returns true when endpoints match ignoring slashes and casing', () => {
    expect(isSameEndpoint('https://staging.shumai.one/', 'https://STAGING.shumai.one')).toBe(true)
    expect(isSameEndpoint('http://localhost:3000', 'http://localhost:3000/')).toBe(true)
  })

  it('returns false when endpoints differ', () => {
    expect(isSameEndpoint('http://localhost:3000', 'https://staging.shumai.one')).toBe(false)
    expect(isSameEndpoint('http://localhost:3000', 'http://127.0.0.1:3000')).toBe(false)
    expect(isSameEndpoint('', 'http://localhost:3000')).toBe(false)
    expect(isSameEndpoint(null, undefined)).toBe(false)
  })
})
