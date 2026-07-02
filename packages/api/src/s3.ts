import { Hono } from 'hono'
import { s3Service } from '@shumai/core/src/s3/s3'
import { serveStatic } from 'hono/bun'

const route = new Hono()
  .get(
    '/*',
    serveStatic({
      root: './data',
      rewriteRequestPath: (path) => path.replace(/^\/files\//, ''),
      onFound: (_path, c) => {
        if (c.req.query('download') === '1') {
          c.header('Content-Disposition', 'attachment')
        }
      },
    }),
  )
  .put('/:bucket/:key{.+}', async (c) => {
    const bucket = c.req.param('bucket')
    const key = c.req.param('key')
    const body = await c.req.arrayBuffer()

    try {
      await s3Service.putObject(bucket, key, Buffer.from(body), body.byteLength)
      return c.text('OK')
    } catch (e: unknown) {
      const error = e as Error
      return c.text(error.message || 'Internal Server Error', 500)
    }
  })

export default route
