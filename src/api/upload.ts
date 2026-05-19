import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { uploadService } from '@/services/upload/upload'
import {
  confirmFileUploadRequestSchema,
  createUploadTaskRequestSchema,
  localUploadQuerySchema,
} from '@/dtos/upload'
import { paginationParamsSchema } from '@/dtos/pagination'
import { authzService, Permission } from '@/services/authz/authz'
import { notificationService } from '@/services/notification/notification'
import { NotificationType } from '@/generated/prisma/client'
import { s3Service, verifyLocalUrlSignature } from '@/services/s3/s3'
import type { Prisma } from '@/generated/prisma/client'

type User = Prisma.UserGetPayload<Record<string, never>>

const route = new Hono<{ Variables: { user: User } }>()
  .put('/upload/local', zValidator('query', localUploadQuerySchema), async (c) => {
    const { bucket, key, Signature } = c.req.valid('query')

    if (!verifyLocalUrlSignature(bucket, key, Signature)) {
      return c.text('Invalid signature', 403)
    }

    const contentType = c.req.header('Content-Type')
    let buffer: Buffer
    let size: number
    let finalContentType = contentType

    if (contentType?.includes('multipart/form-data')) {
      const body = await c.req.parseBody()
      const file = body['file'] as File
      if (!file) {
        return c.text('No file uploaded', 400)
      }
      buffer = Buffer.from(await file.arrayBuffer())
      size = file.size
      finalContentType = file.type || 'application/octet-stream'
    } else {
      const arrayBuffer = await c.req.arrayBuffer()
      buffer = Buffer.from(arrayBuffer)
      size = arrayBuffer.byteLength
    }

    await s3Service.putObject(bucket, key, buffer, size, finalContentType)

    return c.json({ success: true })
  })
  .get('/teams/:teamId/upload/tasks', zValidator('query', paginationParamsSchema), async (c) => {
    const user = c.get('user')
    const params = c.req.valid('query')

    const tasks = await uploadService.listUploadTasks(user.id, params)
    return c.json(tasks)
  })
  .post(
    '/teams/:teamId/upload/tasks',
    zValidator('json', createUploadTaskRequestSchema),
    async (c) => {
      const teamId = c.req.param('teamId')
      const user = c.get('user')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        teamId,
        assetId: req.parentId,
        user,
        permission: Permission.Edit,
      })

      const resp = await uploadService.createUploadTask(user.id, req)
      return c.json(resp)
    },
  )
  .patch(
    '/teams/:teamId/upload/tasks/:taskId',
    zValidator('json', confirmFileUploadRequestSchema),
    async (c) => {
      const teamId = c.req.param('teamId')
      const taskId = c.req.param('taskId')
      const user = c.get('user')
      const req = c.req.valid('json')

      await uploadService.confirmFileUpload(user.id, taskId, req)

      if (!req.errorMessage) {
        await notificationService.create({
          type: NotificationType.successful_file_uploaded,
          teamId: teamId,
          creatorId: user.id,
          assetId: req.fileId,
          taskId: taskId,
        })
      }

      return c.json({ success: true })
    },
  )

export default route
