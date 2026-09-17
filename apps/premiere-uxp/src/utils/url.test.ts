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
