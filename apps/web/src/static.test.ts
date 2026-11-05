import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createHtmlHandler, createStaticFileHandler, isEtagMatching } from './static'

describe('Static Asset Serving & Caching', () => {
  const tempChunkPath = join(tmpdir(), `test-chunk-${Date.now()}.js`)
  const chunkContent = 'console.log("chunk loaded");'

  beforeAll(() => {
    writeFileSync(tempChunkPath, chunkContent, 'utf8')
  })

  afterAll(() => {
    try {
      unlinkSync(tempChunkPath)
    } catch {
      // Ignore cleanup error if already deleted
    }
  })

  describe('isEtagMatching', () => {
    it('matches exact etag string', () => {
      expect(isEtagMatching('"12345"', '"12345"')).toBe(true)
    })

    it('matches weak etag to strong or weak candidates', () => {
      expect(isEtagMatching('W/"12345"', '"12345"')).toBe(true)
      expect(isEtagMatching('"12345"', 'W/"12345"')).toBe(true)
      expect(isEtagMatching('W/"12345"', 'W/"12345"')).toBe(true)
    })

    it('matches wildcard *', () => {
      expect(isEtagMatching('"12345"', '*')).toBe(true)
    })

    it('matches comma-separated candidate lists', () => {
      expect(isEtagMatching('"12345"', '"old-etag", "12345", "other"')).toBe(true)
      expect(isEtagMatching('"12345"', '"old-etag", "mismatch"')).toBe(false)
    })

    it('returns false when etag or ifNoneMatch is missing or empty', () => {
      expect(isEtagMatching(undefined, '"12345"')).toBe(false)
      expect(isEtagMatching('"12345"', null)).toBe(false)
      expect(isEtagMatching('', '"12345"')).toBe(false)
      expect(isEtagMatching('"12345"', '')).toBe(false)
    })
  })

  describe('createStaticFileHandler', () => {
    it('sets immutable Cache-Control for immutable content-hashed assets', async () => {
      const handler = createStaticFileHandler(
        tempChunkPath,
        { 'content-type': 'text/javascript;charset=utf-8', etag: '"chunk-hash-1"' },
        true,
      )

      const req = new Request('http://localhost/chunk-123.js')
      const res = handler(req)

      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('text/javascript;charset=utf-8')
      expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
      expect(res.headers.get('etag')).toBe('"chunk-hash-1"')
      expect(await res.text()).toBe(chunkContent)
    })

    it('returns 304 Not Modified when If-None-Match matches the file etag', async () => {
      const handler = createStaticFileHandler(
        tempChunkPath,
        { 'content-type': 'text/javascript;charset=utf-8', etag: '"chunk-hash-1"' },
        true,
      )

      const req = new Request('http://localhost/chunk-123.js', {
        headers: { 'if-none-match': '"chunk-hash-1"' },
      })
      const res = handler(req)

      expect(res.status).toBe(304)
      expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
      expect(res.headers.get('etag')).toBe('"chunk-hash-1"')
      expect(await res.text()).toBe('')
    })

    it('sets no-cache Cache-Control for non-immutable static assets', async () => {
      const handler = createStaticFileHandler(
        tempChunkPath,
        { 'content-type': 'text/plain', etag: '"plain-1"' },
        false,
      )

      const req = new Request('http://localhost/robots.txt')
      const res = handler(req)

      expect(res.status).toBe(200)
      expect(res.headers.get('cache-control')).toBe('no-cache')
    })
  })

  describe('createHtmlHandler', () => {
    const htmlText = '<!DOCTYPE html><html><head><title>Shumai</title></head><body></body></html>'

    it('sets no-cache and generates deterministic ETag for HTML', async () => {
      const handler = createHtmlHandler(htmlText, { 'content-type': 'text/html;charset=utf-8' })

      const req = new Request('http://localhost/')
      const res = handler(req)

      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('text/html;charset=utf-8')
      expect(res.headers.get('cache-control')).toBe('no-cache')
      const etag = res.headers.get('etag')
      expect(etag).toBeTruthy()
      expect(await res.text()).toBe(htmlText)
    })

    it('returns 304 Not Modified when HTML If-None-Match matches', async () => {
      const handler = createHtmlHandler(htmlText, { 'content-type': 'text/html;charset=utf-8' })

      const initialRes = handler(new Request('http://localhost/'))
      const etag = initialRes.headers.get('etag')!

      const revalidateReq = new Request('http://localhost/', {
        headers: { 'if-none-match': etag },
      })
      const revalidateRes = handler(revalidateReq)

      expect(revalidateRes.status).toBe(304)
      expect(revalidateRes.headers.get('cache-control')).toBe('no-cache')
      expect(await revalidateRes.text()).toBe('')
    })
  })
})
