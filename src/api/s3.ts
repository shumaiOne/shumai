import { Hono } from 'hono'
import { s3Service } from '@/services/s3/s3'

const route = new Hono()
  .get('/:bucket/:key{.+}', async (c) => {
    const bucket = c.req.param('bucket')
    const key = c.req.param('key')

    try {
      const info = await s3Service.headObject(bucket, key)
      const { buffer: data, contentType } = await s3Service.getObject(bucket, key)

      if (contentType) {
        c.header('Content-Type', contentType)
      } else if (info.contentType) {
        c.header('Content-Type', info.contentType)
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return c.body(data as any)
    } catch (e: unknown) {
      const error = e as Error
      if (error.message?.includes('NoSuchKey')) {
        return c.text('Not Found', 404)
      }
      return c.text(error.message || 'Internal Server Error', 500)
    }
  })
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
