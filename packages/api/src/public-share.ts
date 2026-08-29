import { Hono } from 'hono'
import type { Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { shareService } from '@shumai/core/src/share/share'
import { assetService } from '@shumai/core/src/asset/asset'
import { watermarkService } from '@shumai/core/src/watermark/watermark'
import { paginationParamsSchema, assetTypeFilterSchema } from '@shumai/dtos'
import { z } from 'zod'
import { metadataService } from '@shumai/core/src/metadata/metadata'
import { FieldInfo } from '@shumai/dtos'
import type { Prisma as PrismaType } from '@shumai/db'
import { projectService } from '@shumai/core/src/project/project'
import { userService } from '@shumai/core/src/user/user'
import { auth } from '@shumai/core/src/auth/auth'
import { createCommentRequestSchema } from '@shumai/dtos'
import { notificationService } from '@shumai/core/src/notification/notification'
import {
  ShareLinkNotFoundError,
  ShareLinkDisabledError,
  ShareLinkExpiredError,
  ShareLinkPasswordInvalidError,
  ShareLinkDownloadDisabledError,
} from '@shumai/core/src/share/errors'
import { s3Service } from '@shumai/core/src/s3/s3'
import type { AssetInfo } from '@shumai/dtos'

/**
 * Replaces the served media entries with the watermarked proxy entries produced
 * by the watermark transcode activity. When no completed watermark proxy exists
 * yet (still transcoding, or failed), the video/image transcode slots are emptied
 * so original, unwatermarked proxies are never exposed on the public share.
 *
 * Only video/image assets are subject to watermark protection; other media types
 * (pdf, audio, ...) never receive watermark transcodes and pass through untouched.
 * `original`, `thumbnail` and `videoPreview` are intentionally left untouched here.
 * S3 GET URLs are generated for all watermarked proxies.
 */
async function applyWatermarkToAssetMedia(
  asset: AssetInfo,
  watermarkMedia: PrismaJson.MediaInfo | null,
): Promise<AssetInfo> {
  if (!asset.media) return asset
  if (asset.proxyType !== 'video' && asset.proxyType !== 'image') return asset

  const updatedMedia = { ...asset.media }
  const bucket = process.env.S3_BUCKET || 'shumai'

  updatedMedia.videoTranscodes =
    watermarkMedia?.videoTranscodes && watermarkMedia.videoTranscodes.length > 0
      ? await Promise.all(
          watermarkMedia.videoTranscodes.map(async (vt) => ({
            id: vt.key ?? '',
            url: vt.key ? await s3Service.presign(bucket, vt.key, 'GET') : '',
            key: vt.key ?? '',
            width: vt.width ?? 0,
            height: vt.height ?? 0,
            size: 0,
          })),
        )
      : []

  updatedMedia.imageTranscodes =
    watermarkMedia?.imageTranscodes && watermarkMedia.imageTranscodes.length > 0
      ? await Promise.all(
          watermarkMedia.imageTranscodes.map(async (it) => ({
            id: it.key ?? '',
            url: it.key ? await s3Service.presign(bucket, it.key, 'GET') : '',
            key: it.key ?? '',
            width: it.width ?? 0,
            height: it.height ?? 0,
            size: 0,
          })),
        )
      : []

  return {
    ...asset,
    media: updatedMedia,
  }
}

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
  if (err instanceof ShareLinkDownloadDisabledError) {
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
  assetType: assetTypeFilterSchema.optional().default('file'),
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
        allowDownload: shareLink.allowDownload,
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

        if (shareLink.watermarkConfigId && res.data.length > 0) {
          // Resolve symlink targets once and reuse for the media lookup, so each
          // item costs a single query instead of two.
          const targetIds = await Promise.all(
            res.data.map((item) => assetService.resolveTargetAssetId(item.id)),
          )
          const wfMap = await watermarkService.getCompletedWatermarkMediaMap(
            targetIds,
            shareLink.watermarkConfigId,
          )

          res.data = await Promise.all(
            res.data.map(async (item, index) =>
              applyWatermarkToAssetMedia(item, wfMap.get(targetIds[index]) ?? null),
            ),
          )
        }

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
      const shareLink = await shareService.verifyPublicAccess(fileId, password)

      let asset = await assetService.getAsset({ assetId: fileId })

      // Only video/image assets are subject to watermark protection; skip the
      // watermark lookup entirely for other media types (pdf, audio, ...).
      if (
        shareLink.watermarkConfigId &&
        (asset.proxyType === 'video' || asset.proxyType === 'image')
      ) {
        const targetAssetId = await assetService.resolveTargetAssetId(fileId)
        const wfMap = await watermarkService.getCompletedWatermarkMediaMap(
          [targetAssetId],
          shareLink.watermarkConfigId,
        )
        asset = await applyWatermarkToAssetMedia(asset, wfMap.get(targetAssetId) ?? null)
      }

      return c.json(asset)
    } catch (err) {
      return handlePublicShareError(c, err)
    }
  })
  .post(
    '/shares/:shareId/files/:fileId/download-url',
    zValidator('json', z.object({ key: z.string().min(1) })),
    async (c) => {
      const fileId = c.req.param('fileId')
      const password = c.req.header('x-share-password')
      const { key } = c.req.valid('json')

      try {
        const shareLink = await shareService.verifyPublicAccess(fileId, password)

        if (!shareLink.allowDownload) {
          throw new ShareLinkDownloadDisabledError('Download is disabled for this share link')
        }

        if (!key.startsWith('files/')) {
          return c.json({ error: 'Invalid key' }, 400)
        }

        const url = await assetService.getDownloadUrl(fileId, key)
        return c.json({ url })
      } catch (err) {
        return handlePublicShareError(c, err)
      }
    },
  )
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

        const teamId = await projectService.getProjectTeam(shareLink.projectId)

        // Identify user
        let userId: string | null = null
        const session = await auth.api.getSession({
          headers: c.req.raw.headers,
        })

        if (session?.user) {
          userId = session.user.id
        } else if (guestUserId) {
          const guestUser = await userService.getUserById(guestUserId)
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
          attachmentIds: req.attachmentIds,
        })

        const notifType = req.replyToId ? 'reply_created' : 'comment_created'

        notificationService.create({
          type: notifType,
          teamId: teamId,
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
