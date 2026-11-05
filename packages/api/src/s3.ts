import { Hono } from 'hono'
import {
  buildContentDisposition,
  getStorageBackend,
  verifyLocalGetUrlSignature,
} from '@shumai/core/src/s3/s3'
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
    async (c, next) => {
      const fullPath = c.req.path.replace(/^\/files\//, '').replace(/^\//, '')
      const slashIdx = fullPath.indexOf('/')
      if (slashIdx === -1) {
        return c.notFound()
      }
      const bucket = fullPath.slice(0, slashIdx)
      const key = fullPath.slice(slashIdx + 1)

      const signature = c.req.query('Signature')
      const expires = c.req.query('Expires')

      if (!verifyLocalGetUrlSignature(bucket, key, signature, expires)) {
        return c.json({ error: 'Forbidden: invalid or expired signature' }, 403)
      }

      return next()
    },
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
