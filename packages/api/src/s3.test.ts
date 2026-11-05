import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

const { mockServeStatic } = vi.hoisted(() => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockServeStatic: vi.fn<(args: any) => any>(() => (c: any) => c.text('static-file')),
}))

vi.mock('hono/bun', () => ({
  serveStatic: mockServeStatic,
}))

describe('S3 API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('GET /files/* calls serveStatic with correct options when valid signature is provided', async () => {
    const { signLocalGetUrl } = await import('@shumai/core/src/s3/s3')
    const { signature, expires } = signLocalGetUrl('b1', 'test.webp')

    const { default: route } = await import('./s3')
    const app = new Hono().route('/files', route)

    const res = await app.request(`/files/b1/test.webp?Signature=${signature}&Expires=${expires}`)

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('static-file')
    expect(mockServeStatic).toHaveBeenCalledWith(
      expect.objectContaining({
        root: './data',
        rewriteRequestPath: expect.any(Function),
      }),
    )

    // Verify rewriteRequestPath logic
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options = vi.mocked(mockServeStatic).mock.calls[0][0] as any
    if (options && options.rewriteRequestPath) {
      expect(options.rewriteRequestPath('/files/b1/test.webp')).toBe('b1/test.webp')
    }
  })

  it('GET /files/* returns 403 Forbidden when signature is missing', async () => {
    const { default: route } = await import('./s3')
    const app = new Hono().route('/files', route)

    const res = await app.request('/files/b1/test.webp')
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toContain('Forbidden')
  })

  it('GET /files/* returns 403 Forbidden when signature is invalid', async () => {
    const { default: route } = await import('./s3')
    const app = new Hono().route('/files', route)

    const res = await app.request('/files/b1/test.webp?Signature=invalidsig&Expires=9999999999')
    expect(res.status).toBe(403)
  })

  it('GET /files/* returns 403 Forbidden when signature is expired', async () => {
    const { signLocalGetUrl } = await import('@shumai/core/src/s3/s3')
    // Signed with -10 seconds (expired)
    const { signature, expires } = signLocalGetUrl('b1', 'test.webp', -10)

    const { default: route } = await import('./s3')
    const app = new Hono().route('/files', route)

    const res = await app.request(`/files/b1/test.webp?Signature=${signature}&Expires=${expires}`)
    expect(res.status).toBe(403)
  })

  it('GET /files/* sets Content-Disposition with filename when download=1 & filename query params are present', async () => {
    const { signLocalGetUrl } = await import('@shumai/core/src/s3/s3')
    const { signature, expires } = signLocalGetUrl('b1', 'test.webp')

    // We need to capture the onFound callback from serveStatic options
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let onFoundCallback: ((path: string, c: any) => void) | undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockServeStatic.mockImplementationOnce((options: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onFoundCallback = (options as any).onFound
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (c: any) => c.text('static-file')
    })

    const { default: route } = await import('./s3')
    const app = new Hono().route('/files', route)

    await app.request(
      `/files/b1/test.webp?Signature=${signature}&Expires=${expires}&download=1&filename=foo.png`,
    )

    expect(onFoundCallback).toBeDefined()

    // Test with download=1 and filename
    const mockContextWithDownload = {
      req: {
        query: (key: string) =>
          key === 'download' ? '1' : key === 'filename' ? 'foo.png' : undefined,
      },
      header: vi.fn(),
    }

    if (onFoundCallback) {
      onFoundCallback('/files/b1/test.webp', mockContextWithDownload)
      expect(mockContextWithDownload.header).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="foo.png"; filename*=UTF-8\'\'foo.png',
      )
    }

    // Test with download=1 but no filename
    const mockContextDownloadNoFilename = {
      req: { query: (key: string) => (key === 'download' ? '1' : undefined) },
      header: vi.fn(),
    }

    if (onFoundCallback) {
      onFoundCallback('/files/b1/test.webp', mockContextDownloadNoFilename)
      expect(mockContextDownloadNoFilename.header).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment',
      )
    }

    // Test without download param
    const mockContextWithout = {
      req: { query: () => undefined },
      header: vi.fn(),
    }

    if (onFoundCallback) {
      onFoundCallback('/files/b1/test.webp', mockContextWithout)
      expect(mockContextWithout.header).not.toHaveBeenCalled()
    }
  })

  it('PUT /files/:bucket/:key returns 404', async () => {
    const { default: route } = await import('./s3')
    const app = new Hono().route('/files', route)
    const body = new TextEncoder().encode('test-data')

    const res = await app.request('/files/b1/test.webp', {
      method: 'PUT',
      headers: {
        'content-length': body.byteLength.toString(),
      },
      body,
    })

    expect(res.status).toBe(404)
  })

  it('GET /files/* returns 404 when STORAGE_BACKEND is not local', async () => {
    const s3Module = await import('@shumai/core/src/s3/s3')
    vi.spyOn(s3Module, 'getStorageBackend').mockReturnValue('s3')

    const { default: route } = await import('./s3')
    const app = new Hono().route('/files', route)

    const res = await app.request('/files/b1/test.webp')
    expect(res.status).toBe(404)
  })
})
