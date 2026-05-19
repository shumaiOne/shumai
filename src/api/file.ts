import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authzService, Permission } from '@/services/authz/authz'
import { assetService } from '@/services/asset/asset'
import { metadataService } from '@/services/metadata/metadata'
import { notificationService } from '@/services/notification/notification'
import { s3Service } from '@/services/s3/s3'
import {
  updateFileRequestSchema,
  updateAssetOrderRequestSchema,
  deleteFilesRequestSchema,
  restoreFilesRequestSchema,
  createCommentRequestSchema,
  uploadFileRequestSchema,
} from '@/dtos/asset'
import { updateAssetMetadataRequestSchema } from '@/dtos/metadata'
import { paginationParamsSchema } from '@/dtos/pagination'
import { ulid } from 'ulid'
import { z } from 'zod'
import type { Prisma } from '@/generated/prisma/client'

type User = Prisma.UserGetPayload<Record<string, never>>

const route = new Hono<{ Variables: { user: User } }>()
  .get('/teams/:teamId/files/:fileId', async (c) => {
    const fileId = c.req.param('fileId')
    const user = c.get('user')

    await authzService.hasPermission({
      assetId: fileId,
      user,
      permission: Permission.Read,
    })

    const asset = await assetService.getAsset({ assetId: fileId })
    return c.json(asset)
  })
  .patch(
    '/teams/:teamId/files/:fileId/order',
    zValidator('json', updateAssetOrderRequestSchema),
    async (c) => {
      const fileId = c.req.param('fileId')
      const user = c.get('user')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        assetId: fileId,
        user,
        permission: Permission.Edit,
      })

      const updated = await assetService.updateAssetOrder(fileId, req)
      return c.json(updated)
    },
  )
  .put('/teams/:teamId/files/:fileId', zValidator('json', updateFileRequestSchema), async (c) => {
    const fileId = c.req.param('fileId')
    const user = c.get('user')
    const req = c.req.valid('json')

    await authzService.hasPermission({
      assetId: fileId,
      user,
      permission: Permission.Edit,
    })

    const updatedAsset = await assetService.updateAssetName({
      id: fileId,
      name: req.name,
    })

    return c.json(updatedAsset)
  })
  .delete('/teams/:teamId/files', zValidator('json', deleteFilesRequestSchema), async (c) => {
    const user = c.get('user')
    const req = c.req.valid('json')

    for (const id of req.ids) {
      await authzService.hasPermission({
        assetId: id,
        user,
        permission: Permission.Edit,
      })
    }

    await assetService.deleteAssets(req.ids)
    return c.body(null, 204)
  })
  .patch(
    '/teams/:teamId/files/:fileId/metadata',
    zValidator('json', z.array(updateAssetMetadataRequestSchema)),
    async (c) => {
      const teamId = c.req.param('teamId')
      const fileId = c.req.param('fileId')
      const user = c.get('user')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        assetId: fileId,
        user,
        permission: Permission.Edit,
      })

      await metadataService.updateAssetMetadata(fileId, req)

      const hasStatus = req.some((m) => m.key === 'status')
      if (hasStatus) {
        notificationService.create({
          type: 'metadata_field_updated_status',
          teamId,
          creatorId: user.id,
          assetId: fileId,
        })
      }

      return c.json('')
    },
  )
  .post(
    '/teams/:teamId/files/:fileId/comments',
    zValidator('json', createCommentRequestSchema.omit({ assetId: true, userId: true })),
    async (c) => {
      const teamId = c.req.param('teamId')
      const fileId = c.req.param('fileId')
      const user = c.get('user')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        assetId: fileId,
        user,
        permission: Permission.Read,
      })

      const comment = await assetService.createComment({
        assetId: fileId,
        userId: user.id,
        replyToId: req.replyToId,
        message: req.message,
        annotations: req.annotations,
        second: req.second,
        attachmentIds: req.attachmentIds,
      })

      const notifType = req.replyToId ? 'reply_created' : 'comment_created'

      notificationService.create({
        type: notifType,
        teamId,
        creatorId: user.id,
        assetId: fileId,
        commentMessage: req.message,
      })

      return c.json(comment, 201)
    },
  )
  .get(
    '/teams/:teamId/files/:fileId/comments',
    zValidator('query', paginationParamsSchema),
    async (c) => {
      const fileId = c.req.param('fileId')
      const user = c.get('user')
      const req = c.req.valid('query')

      await authzService.hasPermission({
        assetId: fileId,
        user,
        permission: Permission.Read,
      })

      const comments = await assetService.listComments(fileId, req)
      return c.json(comments)
    },
  )
  .get('/teams/:teamId/comments/:commentId', async (c) => {
    const commentId = c.req.param('commentId')
    const user = c.get('user')

    const comment = await assetService.getComment(commentId)

    await authzService.hasPermission({
      assetId: comment.assetId,
      user,
      permission: Permission.Read,
    })

    return c.json(comment)
  })
  .post(
    '/teams/:teamId/files/restore',
    zValidator('json', restoreFilesRequestSchema),
    async (c) => {
      const user = c.get('user')
      const req = c.req.valid('json')

      for (const id of req.ids) {
        await authzService.hasPermission({
          assetId: id,
          user,
          permission: Permission.Edit,
        })
      }

      await assetService.restoreAssets(req.ids)
      return c.body(null, 204)
    },
  )
  .post('/teams/:teamId/files', zValidator('form', uploadFileRequestSchema), async (c) => {
    const teamId = c.req.param('teamId')
    const user = c.get('user')
    const { file } = c.req.valid('form')

    await authzService.hasPermission({
      teamId,
      user,
      permission: Permission.Read,
    })

    if (file.size > 10 * 1024 * 1024) {
      return c.json('file too large, max 10MB', 400)
    }

    const key = `files/${ulid()}`
    const buffer = Buffer.from(await file.arrayBuffer())

    await s3Service.putObject(process.env.S3_BUCKET || 'shumai', key, buffer, file.size, file.type)

    return c.json({ key })
  })

export default route
