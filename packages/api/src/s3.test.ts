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

  it('GET /files/* calls serveStatic with correct options', async () => {
    const { default: route } = await import('./s3')
    const app = new Hono().route('/files', route)

    const res = await app.request('/files/b1/test.webp')

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

  it('GET /files/* sets Content-Disposition: attachment only when download=1 query param is present', async () => {
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

    await app.request('/files/b1/test.webp?download=1')

    expect(onFoundCallback).toBeDefined()

    // Test with download=1
    const mockContextWithDownload = {
      req: { query: (key: string) => (key === 'download' ? '1' : undefined) },
      header: vi.fn(),
    }

    if (onFoundCallback) {
      onFoundCallback('/files/b1/test.webp', mockContextWithDownload)
      expect(mockContextWithDownload.header).toHaveBeenCalledWith(
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

  it('PUT /files/:bucket/:key calls s3Service.putObject', async () => {
    const { s3Service: service } = await import('@shumai/core/src/s3/s3')
    const mockPut = vi.spyOn(service, 'putObject').mockResolvedValue(undefined)

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

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('OK')
    expect(mockPut).toHaveBeenCalledWith('b1', 'test.webp', expect.any(ReadableStream), body.byteLength)
  })
})
