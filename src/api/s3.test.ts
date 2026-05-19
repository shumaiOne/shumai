import { describe, it, expect, vi, beforeEach } from 'vitest'
import { s3Service } from '@/services/s3/s3'
import route from './s3'
import { Hono } from 'hono'

describe('S3 API', () => {
  const app = new Hono().route('/files', route)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET /files/:bucket/:key sets Content-Type', async () => {
    const mockHead = vi.spyOn(s3Service, 'headObject').mockResolvedValue({
      key: 'test.webp',
      size: 100,
      lastModified: new Date(),
      contentType: 'image/webp',
      eTag: '"test"',
    })
    const mockGet = vi.spyOn(s3Service, 'getObject').mockResolvedValue({ buffer: Buffer.from('test'), contentType: 'image/webp' })

    const res = await app.request('/files/b1/test.webp')

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/webp')
    expect(mockHead).toHaveBeenCalledWith('b1', 'test.webp')
    expect(mockGet).toHaveBeenCalledWith('b1', 'test.webp')
  })

  it('GET /files/:bucket/:key handles missing contentType', async () => {
    vi.spyOn(s3Service, 'headObject').mockResolvedValue({
      key: 'test',
      size: 100,
      lastModified: new Date(),
      contentType: 'application/octet-stream',
      eTag: '"test"',
    })
    vi.spyOn(s3Service, 'getObject').mockResolvedValue({ buffer: Buffer.from('test'), contentType: 'application/octet-stream' })

    const res = await app.request('/files/b1/test')

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/octet-stream')
  })

  it('GET /files/:bucket/:key returns 404 if not found', async () => {
    vi.spyOn(s3Service, 'headObject').mockRejectedValue(new Error('NoSuchKey'))

    const res = await app.request('/files/b1/not-found')

    expect(res.status).toBe(404)
  })
})
