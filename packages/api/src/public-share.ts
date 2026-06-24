import { Hono } from 'hono'
import type { Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { shareService } from '@shumai/core/src/share/share'
import { assetService } from '@shumai/core/src/asset/asset'
import { paginationParamsSchema } from '@shumai/dtos'
import { z } from 'zod'
import { metadataService } from '@shumai/core/src/metadata/metadata'
import { FieldInfo } from '@shumai/dtos'
import type { Prisma as PrismaType } from '@shumai/db'
import { auth } from '@shumai/core/src/auth/auth'
import { prisma } from '@shumai/db'
import { createCommentRequestSchema } from '@shumai/dtos'
import { notificationService } from '@shumai/core/src/notification/notification'
import {
  ShareLinkNotFoundError,
  ShareLinkDisabledError,
  ShareLinkExpiredError,
  ShareLinkPasswordInvalidError,
} from '@shumai/core/src/share/errors'

const app = new Hono()

function toFieldInfo(
  f: PrismaType.MetadataFieldGetPayload<Record<string, never>>,
  visible = false,
): FieldInfo {
  return {
    id: f.key,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: f.config as any,
    scope: f.scope ?? '',
    readOnly: f.readOnly,
    visible: visible,
    description: f.description,
    aiAutofill: f.aiAutofill,
  }
}

export function handlePublicShareError(c: Context, err: unknown) {
  if (err instanceof ShareLinkPasswordInvalidError) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  if (err instanceof ShareLinkExpiredError || err instanceof ShareLinkDisabledError) {
    const msg = err instanceof Error ? err.message : String(err)
    return c.json({ error: msg }, 403)
  }
  if (err instanceof ShareLinkNotFoundError) {
    const msg = err instanceof Error ? err.message : String(err)
    return c.json({ error: msg }, 404)
  }
  const msg = err instanceof Error ? err.message : String(err)
  return c.json({ error: msg }, 500)
}

const sharedChildrenRequestSchema = paginationParamsSchema.extend({
  assetType: z.string().optional(),
})

const route = app
  .get('/shares/:shareId/info', async (c) => {
    const shareId = c.req.param('shareId')
    const password = c.req.header('x-share-password')
    try {
      const shareLink = await shareService.getShareLink(shareId)
      await shareService.verifyPublicAccess(shareLink.rootFolderId, password)
      return c.json({
        id: shareLink.id,
        name: shareLink.name,
        expireAt: shareLink.expireAt,
        isDisabled: shareLink.isDisabled,
        isExpired: shareLink.isExpired,
        hasPassword: shareLink.hasPassword,
        rootFolderId: shareLink.rootFolderId,
        projectId: shareLink.projectId,
        viewMode: shareLink.viewMode,
        defaultSortOrder: shareLink.defaultSortOrder,
      })
    } catch (err) {
      return handlePublicShareError(c, err)
    }
  })
  .get('/shares/:shareId/fields', async (c) => {
    const shareId = c.req.param('shareId')
    const password = c.req.header('x-share-password')

    try {
      const shareLink = await shareService.getShareLink(shareId)
      await shareService.verifyPublicAccess(shareLink.rootFolderId, password)

      const fields = await metadataService.listProjectFields(null, shareLink.projectId)
      const fieldVisibility = (shareLink.fieldVisibility || {}) as Record<string, boolean>

      return c.json(
        fields
          .filter((f) => fieldVisibility[f.field.key])
          .map((f) => toFieldInfo(f.field, f.visible)),
      )
    } catch (err) {
      return handlePublicShareError(c, err)
    }
  })
  .get(
    '/shares/:shareId/folders/:folderId/children',
    zValidator('query', sharedChildrenRequestSchema),
    async (c) => {
      const folderId = c.req.param('folderId')
      const password = c.req.header('x-share-password')
      const req = c.req.valid('query')

      try {
        const shareLink = await shareService.verifyPublicAccess(folderId, password)

        let sort: string | undefined
        let order: string | undefined

        if (shareLink.defaultSortOrder) {
          const parts = shareLink.defaultSortOrder.split(':')
          sort = parts[0]
          order = parts[1]
        }

        const res = await assetService.listChildren({
          ...req,
          assetId: folderId,
          assetType: req.assetType || 'file',
          sort,
          order,
        })

        return c.json(res)
      } catch (err) {
        return handlePublicShareError(c, err)
      }
    },
  )
  .get('/shares/:shareId/files/:fileId', async (c) => {
    const fileId = c.req.param('fileId')
    const password = c.req.header('x-share-password')

    try {
      await shareService.verifyPublicAccess(fileId, password)

      const asset = await assetService.getAsset({ assetId: fileId })
      return c.json(asset)
    } catch (err) {
      return handlePublicShareError(c, err)
    }
  })
  .get(
    '/shares/:shareId/files/:fileId/comments',
    zValidator('query', paginationParamsSchema),
    async (c) => {
      const fileId = c.req.param('fileId')
      const password = c.req.header('x-share-password')
      const req = c.req.valid('query')

      try {
        await shareService.verifyPublicAccess(fileId, password)

        const targetFileId = await assetService.resolveTargetAssetId(fileId)
        const res = await assetService.listComments(targetFileId, req)
        return c.json(res)
      } catch (err) {
        return handlePublicShareError(c, err)
      }
    },
  )
  .post(
    '/shares/:shareId/files/:fileId/comments',
    zValidator('json', createCommentRequestSchema.omit({ assetId: true, userId: true })),
    async (c) => {
      const shareId = c.req.param('shareId')
      const fileId = c.req.param('fileId')
      const password = c.req.header('x-share-password')
      const guestUserId = c.req.header('x-guest-user-id')
      const req = c.req.valid('json')

      try {
        const shareLink = await shareService.getShareLink(shareId)
        await shareService.verifyPublicAccess(fileId, password)

        const targetFileId = await assetService.resolveTargetAssetId(fileId)

        const project = await prisma.project.findUnique({
          where: { id: shareLink.projectId },
          select: { teamId: true },
        })

        if (!project) {
          throw new Error('Project not found')
        }

        // Identify user
        let userId: string | null = null
        const session = await auth.api.getSession({
          headers: c.req.raw.headers,
        })

        if (session?.user) {
          userId = session.user.id
        } else if (guestUserId) {
          const guestUser = await prisma.user.findUnique({
            where: { id: guestUserId },
          })
          if (guestUser) {
            userId = guestUser.id
          }
        }

        if (!userId) {
          return c.json({ error: 'Unauthorized' }, 401)
        }

        const comment = await assetService.createComment({
          assetId: targetFileId,
          userId: userId,
          replyToId: req.replyToId,
          message: req.message,
          annotations: req.annotations,
          second: req.second,
          timecode: req.timecode,
          attachmentIds: req.attachmentIds,
        })

        const notifType = req.replyToId ? 'reply_created' : 'comment_created'

        notificationService.create({
          type: notifType,
          teamId: project.teamId,
          creatorId: userId,
          assetId: targetFileId,
          commentMessage: req.message,
        })

        return c.json(comment, 201)
      } catch (err) {
        return handlePublicShareError(c, err)
      }
    },
  )

export default route
