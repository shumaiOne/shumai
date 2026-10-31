import { zValidator } from '@hono/zod-validator'
import { assetService } from '@shumai/core/src/asset/asset'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { commentService } from '@shumai/core/src/comment/comment'
import { s3Service } from '@shumai/core/src/s3/s3'
import type { Prisma } from '@shumai/db'
import { auditLogService } from '@shumai/core/src/auditLog/auditLog'
import {
  renameAssetOp,
  resolveCommentOp,
  runOperation,
  updateAssetMetadataOp,
} from '@shumai/core/src/operations'
import {
  createCommentRequestSchema,
  deleteFilesRequestSchema,
  batchGetFilesRequestSchema,
  paginationParamsSchema,
  restoreFilesRequestSchema,
  updateAssetMetadataRequestSchema,
  updateAssetOrderRequestSchema,
  updateFileRequestSchema,
  uploadFileRequestSchema,
  getDownloadLinksRequestSchema,
  completeCommentRequestSchema,
  exportCommentsRequestSchema,
  addCommentReactionRequestSchema,
  removeCommentReactionRequestSchema,
  AuditAction,
} from '@shumai/dtos'
import { transcodeService, buildContentDisposition } from '@shumai/core'
import fs from 'fs'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import os from 'os'
import path from 'path'
import { ulid } from 'ulid'
import { z } from 'zod'

type User = Prisma.UserGetPayload<Record<string, never>>

const route = new Hono<{ Variables: { user: User } }>()
  .post('/files/batch', zValidator('json', batchGetFilesRequestSchema), async (c) => {
    const user = c.get('user')
    const req = c.req.valid('json')

    if (req.ids.length === 0) {
      return c.json([])
    }

    const accessibleIds: string[] = []
    await Promise.all(
      req.ids.map(async (id) => {
        try {
          await authzService.hasPermission({
            user,
            permission: Permission.Read,
            type: ResourceType.Asset,
            id,
          })
          accessibleIds.push(id)
        } catch {
          // Permissive: silently ignore missing or unauthorized IDs
        }
      }),
    )

    if (accessibleIds.length === 0) {
      return c.json([])
    }

    const accessibleSet = new Set(accessibleIds)
    const orderedAccessibleIds = req.ids.filter((id) => accessibleSet.has(id))
    const assets = await assetService.listAssetsByIds(orderedAccessibleIds)
    return c.json(assets)
  })
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
    const req = c.req.valid('json')
    const file = await runOperation(
      renameAssetOp,
      { userId: c.get('user').id, via: 'api' },
      { assetId: c.req.param('fileId'), name: req.name },
    )
    return c.json(file)
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

    const contexts = await Promise.all(req.ids.map((id) => assetService.getAssetContext(id)))

    await assetService.deleteAssets(req.ids)

    for (let i = 0; i < req.ids.length; i++) {
      const ctx = contexts[i]
      await auditLogService.logAction({
        action: AuditAction.file_delete,
        teamId: ctx.teamId,
        userId: user.id,
        projectId: ctx.projectId,
        itemId: req.ids[i],
      })
    }

    return c.body(null, 204)
  })
  .patch(
    '/files/:fileId/metadata',
    zValidator('json', z.array(updateAssetMetadataRequestSchema)),
    async (c) => {
      const req = c.req.valid('json')
      if (req.length === 0) return c.json('')
      try {
        await runOperation(
          updateAssetMetadataOp,
          { userId: c.get('user').id, via: 'api' },
          {
            assetId: c.req.param('fileId'),
            values: Object.fromEntries(req.map((m) => [m.key, m.value])),
          },
        )
      } catch (err) {
        if (err instanceof HTTPException && err.status === 422) {
          return c.json({ error: err.message }, 422)
        }
        throw err
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

      // The web app can attach markup and files, which the create_comment Operation doesn't
      // expose; both post through the same service, so notifications are the same.
      const comment = await commentService.postComment({
        assetId: fileId,
        userId: user.id,
        replyToId: req.replyToId,
        message: req.message,
        annotations: req.annotations,
        second: req.second,
        attachmentIds: req.attachmentIds,
      })

      const context = await assetService.getAssetContext(fileId)
      await auditLogService.logAction({
        action: AuditAction.comment_create,
        teamId: context.teamId,
        userId: user.id,
        projectId: context.projectId,
        itemId: comment.id,
      })

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

    const comments = await assetService.listComments(fileId, req, user.id)
    return c.json(comments)
  })
  .post(
    '/files/:fileId/comments/export',
    zValidator('json', exportCommentsRequestSchema),
    async (c) => {
      const fileId = c.req.param('fileId')
      const user = c.get('user')
      const { format, timeZone } = c.req.valid('json')

      await authzService.hasPermission({
        user,
        permission: Permission.Read,
        type: ResourceType.Asset,
        id: fileId,
      })

      const result = await assetService.exportComments(fileId, format, { timeZone })

      c.header('Content-Type', result.mimeType)
      c.header('Content-Disposition', buildContentDisposition(result.filename))
      return c.body(result.content)
    },
  )
  .post(
    '/comments/:commentId/reactions',
    zValidator('json', addCommentReactionRequestSchema),
    async (c) => {
      const commentId = c.req.param('commentId')
      const user = c.get('user')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        user,
        permission: Permission.Read,
        type: ResourceType.Comment,
        id: commentId,
      })

      await assetService.addCommentReaction(commentId, user.id, req.code)

      return c.json({ success: true })
    },
  )
  .delete(
    '/comments/:commentId/reactions',
    zValidator('json', removeCommentReactionRequestSchema),
    async (c) => {
      const commentId = c.req.param('commentId')
      const user = c.get('user')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        user,
        permission: Permission.Read,
        type: ResourceType.Comment,
        id: commentId,
      })

      await assetService.removeCommentReaction(commentId, user.id, req.code)

      return c.json({ success: true })
    },
  )
  .post(
    '/comments/:commentId/complete',
    zValidator('json', completeCommentRequestSchema),
    async (c) => {
      const commentId = c.req.param('commentId')
      const user = c.get('user')
      const req = c.req.valid('json')

      await runOperation(
        resolveCommentOp,
        { userId: user.id, via: 'api' },
        { commentId, reopen: !req.isCompleted },
      )
      // The web app shows the whole comment, so respond with it rather than the summary.
      return c.json(await assetService.getComment(commentId, user.id))
    },
  )
  .delete('/comments/:commentId', async (c) => {
    const commentId = c.req.param('commentId')
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Comment,
      id: commentId,
    })

    const commentData = await assetService.getComment(commentId).catch(() => null)

    await assetService.deleteComment({ commentId, userId: user.id })

    if (commentData?.assetId) {
      const context = await assetService.getAssetContext(commentData.assetId)
      await auditLogService.logAction({
        action: AuditAction.comment_delete,
        teamId: context.teamId,
        userId: user.id,
        projectId: context.projectId,
        itemId: commentId,
      })
    }

    return c.json({ success: true })
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

    if (file.size > 30 * 1024 * 1024) {
      return c.json('file too large, max 30MB', 400)
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

    const url = await s3Service.presign(process.env.S3_BUCKET || 'shumai', key, 'GET')
    return c.json({ key, url })
  })
  .post('/files/download-links', zValidator('json', getDownloadLinksRequestSchema), async (c) => {
    const user = c.get('user')
    const req = c.req.valid('json')

    if (req.ids.length === 0) {
      return c.json({ files: [] })
    }

    // 1. Fetch project IDs from the service layer
    const projectIds = await assetService.getProjectIds(req.ids)

    if (projectIds.length === 0) {
      return c.json({ files: [] })
    }

    // 2. Validate same-project constraint
    if (projectIds.length !== 1) {
      return c.json({ error: 'All selected items must belong to the same project' }, 400)
    }

    const projectId = projectIds[0]

    // 3. Verify user has READ permission on this project
    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Project,
      id: projectId,
    })

    // 4. Generate download links
    const files = await assetService.getDownloadLinks(req.ids)
    return c.json({ files })
  })
  .post(
    '/files/download-url',
    zValidator('json', z.object({ key: z.string().min(1), assetId: z.string().min(1) })),
    async (c) => {
      const user = c.get('user')
      const req = c.req.valid('json')
      const { key, assetId } = req

      // Validate key format
      if (!key.startsWith('files/')) {
        return c.json({ error: 'Invalid key' }, 400)
      }

      // Verify user has read access to the asset
      await authzService.hasPermission({
        user,
        permission: Permission.Read,
        type: ResourceType.Asset,
        id: assetId,
      })

      // Verify key belongs to the asset and generate download URL
      const url = await assetService.getDownloadUrl(assetId, key)

      return c.json({ url })
    },
  )
  .get('/files/:fileId/m3u8', async (c) => {
    const fileId = c.req.param('fileId')
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Asset,
      id: fileId,
    })

    const playlist = await assetService.getHlsMasterPlaylist({ assetId: fileId })
    c.header('Content-Type', 'application/vnd.apple.mpegurl')
    return c.body(playlist)
  })
  .get('/files/:fileId/m3u8/master.m3u8', async (c) => {
    const fileId = c.req.param('fileId')
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Asset,
      id: fileId,
    })

    const playlist = await assetService.getHlsMasterPlaylist({ assetId: fileId })
    c.header('Content-Type', 'application/vnd.apple.mpegurl')
    return c.body(playlist)
  })
  .get('/files/:fileId/m3u8/:resolution', async (c) => {
    const fileId = c.req.param('fileId')
    let resolution = c.req.param('resolution')
    if (resolution.endsWith('.m3u8')) {
      resolution = resolution.replace(/\.m3u8$/, '')
    }
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Asset,
      id: fileId,
    })

    const playlist = await assetService.getHlsVariantPlaylist({ assetId: fileId, resolution })
    c.header('Content-Type', 'application/vnd.apple.mpegurl')
    return c.body(playlist)
  })
  .get('/files/:fileId/m3u8/:resolution/index.m3u8', async (c) => {
    const fileId = c.req.param('fileId')
    const resolution = c.req.param('resolution')
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Asset,
      id: fileId,
    })

    const playlist = await assetService.getHlsVariantPlaylist({ assetId: fileId, resolution })
    c.header('Content-Type', 'application/vnd.apple.mpegurl')
    return c.body(playlist)
  })

export default route
