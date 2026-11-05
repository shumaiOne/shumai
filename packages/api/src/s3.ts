import { Hono } from 'hono'
import { buildContentDisposition, getStorageBackend } from '@shumai/core/src/s3/s3'
import { serveStatic } from 'hono/bun'

const route = new Hono()
  .use('*', async (c, next) => {
    if (getStorageBackend() !== 'local') {
      return c.notFound()
    }
    return next()
  })
  .get(
    '/*',
    serveStatic({
      root: './data',
      rewriteRequestPath: (path) => path.replace(/^\/files\//, ''),
      onFound: (_path, c) => {
        if (c.req.query('download') === '1') {
          c.header('Content-Disposition', buildContentDisposition(c.req.query('filename')))
        }
      },
    }),
  )

export default route
