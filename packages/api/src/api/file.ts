import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { prisma } from '@shumai/db'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { assetService } from '@shumai/core/src/asset/asset'
import { metadataService } from '@shumai/core/src/metadata/metadata'
import { notificationService } from '@shumai/core/src/notification/notification'
import { s3Service } from '@shumai/core/src/s3/s3'
import { transcodeService } from '@shumai/transcode/src/transcode'
import path from 'path'
import os from 'os'
import fs from 'fs'
import {
  updateFileRequestSchema,
  updateAssetOrderRequestSchema,
  deleteFilesRequestSchema,
  restoreFilesRequestSchema,
  createCommentRequestSchema,
  uploadFileRequestSchema,
} from '@shumai/dtos'
import { updateAssetMetadataRequestSchema } from '@shumai/dtos'
import { paginationParamsSchema } from '@shumai/dtos'
import { ulid } from 'ulid'
import { z } from 'zod'
import type { Prisma } from '@shumai/db'

type User = Prisma.UserGetPayload<Record<string, never>>

const route = new Hono<{ Variables: { user: User } }>()
  .get('/files/:fileId', async (c) => {
    const fileId = c.req.param('fileId')
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Asset,
      id: fileId,
    })

    const asset = await assetService.getAsset({ assetId: fileId })
    return c.json(asset)
  })
  .patch('/files/:fileId/order', zValidator('json', updateAssetOrderRequestSchema), async (c) => {
    const fileId = c.req.param('fileId')
    const user = c.get('user')
    const req = c.req.valid('json')

    await authzService.hasPermission({
      user,
      permission: Permission.Edit,
      type: ResourceType.Asset,
      id: fileId,
    })

    const updated = await assetService.updateAssetOrder(fileId, req)
    return c.json(updated)
  })
  .put('/files/:fileId', zValidator('json', updateFileRequestSchema), async (c) => {
    const fileId = c.req.param('fileId')
    const user = c.get('user')
    const req = c.req.valid('json')

    await authzService.hasPermission({
      user,
      permission: Permission.Edit,
      type: ResourceType.Asset,
      id: fileId,
    })

    const updatedAsset = await assetService.updateAssetName({
      id: fileId,
      name: req.name,
    })

    return c.json(updatedAsset)
  })
  .delete('/files', zValidator('json', deleteFilesRequestSchema), async (c) => {
    const user = c.get('user')
    const req = c.req.valid('json')

    for (const id of req.ids) {
      await authzService.hasPermission({
        user,
        permission: Permission.Edit,
        type: ResourceType.Asset,
        id,
      })
    }

    await assetService.deleteAssets(req.ids)
    return c.body(null, 204)
  })
  .patch(
    '/files/:fileId/metadata',
    zValidator('json', z.array(updateAssetMetadataRequestSchema)),
    async (c) => {
      const fileId = c.req.param('fileId')
      const user = c.get('user')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        user,
        permission: Permission.Edit,
        type: ResourceType.Asset,
        id: fileId,
      })

      try {
        await metadataService.updateAssetMetadata(fileId, req)
      } catch (err) {
        if (err instanceof Error && err.message.includes('is read-only')) {
          return c.json({ error: err.message }, 422)
        }
        throw err
      }

      const hasStatus = req.some((m) => m.key === 'status')
      if (hasStatus) {
        const context = await assetService.getAssetContext(fileId)
        if (context?.teamId) {
          notificationService.create({
            type: 'metadata_field_updated_status',
            teamId: context.teamId,
            creatorId: user.id,
            assetId: fileId,
          })
        }
      }

      return c.json('')
    },
  )
  .post(
    '/files/:fileId/comments',
    zValidator('json', createCommentRequestSchema.omit({ assetId: true, userId: true })),
    async (c) => {
      const fileId = c.req.param('fileId')
      const user = c.get('user')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        user,
        permission: Permission.Read,
        type: ResourceType.Asset,
        id: fileId,
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

      const context = await assetService.getAssetContext(fileId)

      if (context?.teamId) {
        let targetUserId: string | undefined
        if (req.replyToId) {
          const parentComment = await prisma.assetComment.findUnique({
            where: { id: req.replyToId },
          })
          if (parentComment?.creatorId) {
            targetUserId = parentComment.creatorId
          }
        }

        notificationService.create({
          type: notifType,
          teamId: context.teamId,
          creatorId: user.id,
          assetId: fileId,
          userId: targetUserId,
          commentMessage: req.message,
        })
      }

      return c.json(comment, 201)
    },
  )
  .get('/files/:fileId/comments', zValidator('query', paginationParamsSchema), async (c) => {
    const fileId = c.req.param('fileId')
    const user = c.get('user')
    const req = c.req.valid('query')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Asset,
      id: fileId,
    })

    const comments = await assetService.listComments(fileId, req)
    return c.json(comments)
  })
  .post('/files/restore', zValidator('json', restoreFilesRequestSchema), async (c) => {
    const user = c.get('user')
    const req = c.req.valid('json')

    for (const id of req.ids) {
      await authzService.hasPermission({
        user,
        permission: Permission.Edit,
        type: ResourceType.Asset,
        id,
      })
    }

    await assetService.restoreAssets(req.ids)
    return c.body(null, 204)
  })
  .post('/teams/:teamId/files', zValidator('form', uploadFileRequestSchema), async (c) => {
    const teamId = c.req.param('teamId')
    const user = c.get('user')
    const { file } = c.req.valid('form')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Team,
      id: teamId,
    })

    if (file.size > 10 * 1024 * 1024) {
      return c.json('file too large, max 10MB', 400)
    }

    let key = `files/${ulid()}`
    let buffer = Buffer.from(await file.arrayBuffer())
    let contentType = file.type

    if (
      file.type.startsWith('image/') &&
      !file.type.includes('svg') &&
      !file.type.includes('gif')
    ) {
      const tmpOut = path.join(os.tmpdir(), `transcode-${ulid()}.webp`)
      try {
        await transcodeService.transcodeImage(buffer, tmpOut, -1, 80, 540)
        buffer = fs.readFileSync(tmpOut)
        contentType = 'image/webp'
        key = `${key}.webp`
      } catch (err) {
        console.error('Failed to compress image:', err)
        // Fallback to original image if transcoding fails
      } finally {
        if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut)
      }
    }

    await s3Service.putObject(
      process.env.S3_BUCKET || 'shumai',
      key,
      buffer,
      buffer.length,
      contentType,
    )

    return c.json({ key })
  })

export default route
