import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { uploadService } from '@shumai/core/src/upload/upload'
import {
  confirmFileUploadRequestSchema,
  createUploadTaskRequestSchema,
  localUploadQuerySchema,
} from '@shumai/dtos'
import { paginationParamsSchema } from '@shumai/dtos'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { notificationService } from '@shumai/core/src/notification/notification'
import { NotificationType } from '@shumai/db'
import { s3Service, verifyLocalUrlSignature } from '@shumai/core/src/s3/s3'
import type { Prisma } from '@shumai/db'

type User = Prisma.UserGetPayload<Record<string, never>>

export const localUploadRoute = new Hono().put(
  '/upload/local',
  zValidator('query', localUploadQuerySchema),
  async (c) => {
    const { bucket, key, Signature } = c.req.valid('query')

    if (!verifyLocalUrlSignature(bucket, key, Signature)) {
      return c.text('Invalid signature', 403)
    }

    const contentType = c.req.header('Content-Type')
    let finalContentType = contentType
    const contentLength = parseInt(c.req.header('Content-Length') || '0', 10)

    if (contentType?.includes('multipart/form-data')) {
      const body = await c.req.parseBody()
      const file = body['file'] as File
      if (!file) {
        return c.text('No file uploaded', 400)
      }
      const buffer = Buffer.from(await file.arrayBuffer())
      const size = file.size
      finalContentType = file.type || 'application/octet-stream'
      await s3Service.putObject(bucket, key, buffer, size, finalContentType)
    } else {
      const body = c.req.raw.body ?? (await c.req.arrayBuffer())
      await s3Service.putObject(bucket, key, body, contentLength, finalContentType)
    }

    return c.json({ success: true })
  },
)

const route = new Hono<{ Variables: { user: User } }>()
  .get('/teams/:teamId/upload/tasks', zValidator('query', paginationParamsSchema), async (c) => {
    const teamId = c.req.param('teamId')
    const user = c.get('user')
    const params = c.req.valid('query')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Team,
      id: teamId,
    })

    const tasks = await uploadService.listUploadTasks(user.id, params)
    return c.json(tasks)
  })
  .post(
    '/teams/:teamId/upload/tasks',
    zValidator('json', createUploadTaskRequestSchema),
    async (c) => {
      const user = c.get('user')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        user,
        permission: Permission.Edit,
        type: ResourceType.Asset,
        id: req.parentId,
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

      await authzService.hasPermission({
        user,
        permission: Permission.Edit,
        type: ResourceType.Asset,
        id: req.fileId,
      })

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
