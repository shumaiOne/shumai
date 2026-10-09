import { afterAll, describe, expect, it, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const base = vi.hoisted(
  () => `${process.env.TEMP || process.env.TMPDIR || '/tmp'}/shumai-local-route-${process.pid}`,
)

vi.mock('@shumai/core/src/s3/s3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shumai/core/src/s3/s3')>()
  return {
    ...actual,
    s3Service: new actual.LocalStorageService('http://localhost:3000', base),
  }
})

import { localUploadRoute, parseCompleteMultipartBody } from './upload'
import { s3Service, signLocalUrl } from '@shumai/core/src/s3/s3'

const app = localUploadRoute

// The route is mounted under /api in the app; here it is mounted at the root.
const routePath = (u: URL) => `${u.pathname.replace('/api', '')}${u.search}`

// Presign through the real service and call the route with the path + query it produced.
async function call(method: 'PUT' | 'POST' | 'GET' | 'DELETE', mp: object, body?: string | Buffer) {
  const { url } = await s3Service.presignMultipart('bkt', 'obj.bin', {
    key: 'obj.bin',
    method,
    fileId: 'f',
    ...mp,
  })
  const u = new URL(url)
  return app.request(`${routePath(u)}`, { method, body: body as BodyInit | undefined })
}

describe('local multipart upload route', () => {
  afterAll(() => {
    fs.rmSync(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
  })

  it('runs create, part uploads, list and complete end to end', async () => {
    const created = await (await call('POST', {})).text()
    const uploadId = /<UploadId>([^<]+)<\/UploadId>/.exec(created)![1]

    const etags: Record<number, string> = {}
    for (const [n, text] of [
      [2, 'world'],
      [1, 'hello '],
    ] as const) {
      const res = await call('PUT', { uploadId, partNumber: n }, text)
      expect(res.status).toBe(200)
      etags[n] = res.headers.get('ETag')!
      expect(etags[n]).toBeTruthy()
    }

    const listed = await (await call('GET', { uploadId })).text()
    expect(listed).toContain('<PartNumber>1</PartNumber>')
    expect(listed).toContain('<Size>6</Size>')

    const xml = `<CompleteMultipartUpload>${[1, 2]
      .map(
        (n) =>
          `<Part><PartNumber>${n}</PartNumber><ETag>${etags[n].replace(/"/g, '&quot;')}</ETag></Part>`,
      )
      .join('')}</CompleteMultipartUpload>`
    const done = await call('POST', { uploadId }, xml)
    expect(done.status).toBe(200)
    expect(fs.readFileSync(path.join(base, 'bkt', 'obj.bin'), 'utf8')).toBe('hello world')
  })

  it('aborts an upload with DELETE', async () => {
    const created = await (await call('POST', {})).text()
    const uploadId = /<UploadId>([^<]+)<\/UploadId>/.exec(created)![1]
    await call('PUT', { uploadId, partNumber: 1 }, 'x')
    expect((await call('DELETE', { uploadId })).status).toBe(204)
    expect((await call('GET', { uploadId })).status).toBe(404)
  })

  it('rejects a tampered part number with 403', async () => {
    const created = await (await call('POST', {})).text()
    const uploadId = /<UploadId>([^<]+)<\/UploadId>/.exec(created)![1]
    const { url } = await s3Service.presignMultipart('bkt', 'obj.bin', {
      key: 'obj.bin',
      method: 'PUT',
      fileId: 'f',
      uploadId,
      partNumber: 1,
    })
    const u = new URL(url)
    u.searchParams.set('partNumber', '2')
    const res = await app.request(`${routePath(u)}`, { method: 'PUT', body: 'x' })
    expect(res.status).toBe(403)
  })

  it('still accepts the legacy whole-object PUT', async () => {
    const { url } = await s3Service.presignMultipart('bkt', 'whole.txt', {
      key: 'whole.txt',
      method: 'PUT',
      fileId: 'f',
    })
    const u = new URL(url)
    const res = await app.request(`${routePath(u)}`, { method: 'PUT', body: 'single' })
    expect(res.status).toBe(200)
    expect(fs.readFileSync(path.join(base, 'bkt', 'whole.txt'), 'utf8')).toBe('single')
  })

  it('rejects an expired part URL and an expired whole-object URL with 403', async () => {
    const created = await (await call('POST', {})).text()
    const uploadId = /<UploadId>([^<]+)<\/UploadId>/.exec(created)![1]
    const longAgo = Date.now() - 6 * 3600 * 1000
    const part = signLocalUrl(
      'bkt',
      'obj.bin',
      { method: 'PUT', uploadId, partNumber: 1 },
      60,
      longAgo,
    )
    const res = await app.request(part.replace('/api', ''), { method: 'PUT', body: 'x' })
    expect(res.status).toBe(403)
    expect(await res.text()).toBe('URL expired')
    const whole = signLocalUrl('bkt', 'late.txt', undefined, 60, longAgo)
    expect(
      (await app.request(whole.replace('/api', ''), { method: 'PUT', body: 'x' })).status,
    ).toBe(403)
    expect(fs.existsSync(path.join(base, 'bkt', 'late.txt'))).toBe(false)
  })

  it('rejects a multipart URL whose expiry was removed or extended', async () => {
    const created = await (await call('POST', {})).text()
    const uploadId = /<UploadId>([^<]+)<\/UploadId>/.exec(created)![1]
    const { url } = await s3Service.presignMultipart('bkt', 'obj.bin', {
      key: 'obj.bin',
      method: 'PUT',
      fileId: 'f',
      uploadId,
      partNumber: 1,
    })
    const u = new URL(url)
    u.searchParams.delete('exp')
    expect((await app.request(routePath(u), { method: 'PUT', body: 'x' })).status).toBe(403)
    const v = new URL(url)
    v.searchParams.set('exp', String(Number(v.searchParams.get('exp')) + 100000))
    expect((await app.request(routePath(v), { method: 'PUT', body: 'x' })).status).toBe(403)
  })

  it('rejects a part larger than the cap with 413, by Content-Length and by streamed size', async () => {
    const created = await (await call('POST', {})).text()
    const uploadId = /<UploadId>([^<]+)<\/UploadId>/.exec(created)![1]
    const { url } = await s3Service.presignMultipart('bkt', 'obj.bin', {
      key: 'obj.bin',
      method: 'PUT',
      fileId: 'f',
      uploadId,
      partNumber: 1,
    })
    const target = routePath(new URL(url))
    const saved = process.env.MAX_REQUEST_BODY_SIZE
    process.env.MAX_REQUEST_BODY_SIZE = '8'
    try {
      const declared = await app.request(target, {
        method: 'PUT',
        body: 'x',
        headers: { 'Content-Length': '100' },
      })
      expect(declared.status).toBe(413)
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('12345'))
          controller.enqueue(new TextEncoder().encode('67890'))
          controller.close()
        },
      })
      const streamed = await app.request(target, {
        method: 'PUT',
        body: stream,
        duplex: 'half',
      } as RequestInit)
      expect(streamed.status).toBe(413)
      expect((await app.request(target, { method: 'PUT', body: '1234' })).status).toBe(200)
    } finally {
      if (saved === undefined) delete process.env.MAX_REQUEST_BODY_SIZE
      else process.env.MAX_REQUEST_BODY_SIZE = saved
    }
  })

  it('aborting an upload leaves an already-stored object at that key untouched', async () => {
    fs.mkdirSync(path.join(base, 'bkt'), { recursive: true })
    fs.writeFileSync(path.join(base, 'bkt', 'obj.bin'), 'precious')
    const created = await (await call('POST', {})).text()
    const uploadId = /<UploadId>([^<]+)<\/UploadId>/.exec(created)![1]
    expect((await call('DELETE', { uploadId })).status).toBe(204)
    expect(fs.readFileSync(path.join(base, 'bkt', 'obj.bin'), 'utf8')).toBe('precious')
  })

  it('parses the part list from a CompleteMultipartUpload body', () => {
    expect(
      parseCompleteMultipartBody(
        '<CompleteMultipartUpload><Part><PartNumber>1</PartNumber><ETag>&quot;a&quot;</ETag></Part><Part><PartNumber>2</PartNumber></Part></CompleteMultipartUpload>',
      ),
    ).toEqual([
      { partNumber: 1, etag: '"a"' },
      { partNumber: 2, etag: undefined },
    ])
  })
})
