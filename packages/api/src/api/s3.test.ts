import { describe, it, expect, vi, beforeEach } from 'vitest'
import { s3Service } from '@shumai/core/src/s3/s3'
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

  it('GET /files/* with filename query parameter sets Content-Disposition header', async () => {
    // We need to capture the onFound callback from serveStatic options
    let onFoundCallback: Function | undefined
    mockServeStatic.mockImplementationOnce((options: any) => {
      onFoundCallback = options.onFound
      return (c: any) => c.text('static-file')
    })

    const { default: route } = await import('./s3')
    const app = new Hono().route('/files', route)

    // First, verify onFound is called through the mock
    await app.request('/files/b1/test.webp?filename=my-file.txt')

    expect(onFoundCallback).toBeDefined()

    // Test the callback directly
    const mockContext = {
      req: {
        query: (key: string) => (key === 'filename' ? 'my-file.txt' : undefined),
      },
      header: vi.fn(),
    }

    if (onFoundCallback) {
      onFoundCallback('/files/b1/test.webp', mockContext)
      expect(mockContext.header).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="my-file.txt"',
      )
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
      body,
    })

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('OK')
    expect(mockPut).toHaveBeenCalledWith('b1', 'test.webp', expect.any(Buffer), body.byteLength)
  })
})
