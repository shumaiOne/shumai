import { Hono } from 'hono'
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { getCookie } from 'hono/cookie'
import { zValidator } from '@hono/zod-validator'
import { shareService } from '@shumai/core/src/share/share'
import { shareActivityService } from '@shumai/core/src/share/share-activity'
import { assetService } from '@shumai/core/src/asset/asset'
import { commentFrameService } from '@shumai/core/src/comment/comment-frame'
import { watermarkService } from '@shumai/core/src/watermark/watermark'
import {
  paginationParamsSchema,
  assetTypeFilterSchema,
  commentFrameQuerySchema,
  recordShareViewRequestSchema,
} from '@shumai/dtos'
import { z } from 'zod'
import { metadataService } from '@shumai/core/src/metadata/metadata'
import { FieldInfo } from '@shumai/dtos'
import type { Prisma as PrismaType } from '@shumai/db'
import { projectService } from '@shumai/core/src/project/project'
import { userService } from '@shumai/core/src/user/user'
import { auth } from '@shumai/core/src/auth/auth'
import { verifyGuestToken } from '@shumai/core/src/auth/guest-token'
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
  shareId?: string,
  password?: string,
): Promise<AssetInfo> {
  if (!asset.media) return asset
  if (asset.proxyType !== 'video' && asset.proxyType !== 'image' && asset.proxyType !== '3d')
    return asset

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
            hdr: vt.hdr,
            resolution: vt.resolution,
          })),
        )
      : []

  if (watermarkMedia?.videoTranscodes && watermarkMedia.videoTranscodes.length > 0) {
    if (updatedMedia.videoPreview) {
      const watermarkedKey =
        watermarkMedia.videoPreview?.key || watermarkMedia.videoTranscodes[0]?.key
      if (watermarkedKey) {
        updatedMedia.videoPreview = {
          ...updatedMedia.videoPreview,
          key: watermarkedKey,
          url: await s3Service.presign(bucket, watermarkedKey, 'GET'),
        }
      }
    }
  } else {
    delete updatedMedia.videoPreview
  }

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

  if (watermarkMedia?.isHls && watermarkMedia.hls?.key && shareId) {
    const pwQuery = password ? `?p=${encodeURIComponent(password)}` : ''
    updatedMedia.isHls = true
    updatedMedia.hls = {
      key: watermarkMedia.hls.key,
      url: `/api/shares/${shareId}/files/${asset.id}/m3u8/master.m3u8${pwQuery}`,
      resolutions: watermarkMedia.hls.resolutions,
    }
  } else {
    updatedMedia.isHls = false
    delete updatedMedia.hls
  }

  return {
    ...asset,
    media: updatedMedia,
  }
}

/**
 * Keeps only the custom field values the share link is configured to show.
 * Fields are hidden by default; `fieldVisibility` lists the keys turned on
 * for this share, matching what `GET /shares/:shareId/fields` returns.
 */
function filterSharedFieldValues(asset: AssetInfo, fieldVisibility: unknown): AssetInfo {
  if (!asset.fieldValues) return asset
  const visibility = (fieldVisibility || {}) as Record<string, boolean>
  return {
    ...asset,
    fieldValues: asset.fieldValues.filter((fv) => Boolean(visibility[fv.fieldId])),
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
  if (err instanceof HTTPException) {
    throw err
  }
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

async function getPublicShareUserId(c: Context, shareId: string) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (session?.user) return session.user.id

  const token = getCookie(c, `shumai_guest_${shareId}`) || getCookie(c, 'shumai_guest')
  const verified = token && verifyGuestToken(token, shareId)
  if (!verified) return undefined

  const guestUser = await userService.getUserById(verified.userId)
  return guestUser?.guestEmail ? guestUser.id : undefined
}

const route = app
  .post('/shares/:shareId/views', zValidator('json', recordShareViewRequestSchema), async (c) => {
    const shareId = c.req.param('shareId')
    const password = c.req.header('x-share-password')
    const { assetId, isShareEntry } = c.req.valid('json')
    try {
      const share = await shareService.verifyPublicAccess(shareId, assetId, password)
      const targetId =
        assetId && assetId !== share.rootFolderId
          ? await assetService.resolveLatestVersionId(assetId)
          : undefined
      const userId = await getPublicShareUserId(c, shareId)
      await shareActivityService.recordView(shareId, { assetId: targetId, isShareEntry, userId })
      return c.body(null, 204)
    } catch (err) {
      return handlePublicShareError(c, err)
    }
  })
  .get('/shares/:shareId/info', async (c) => {
    const shareId = c.req.param('shareId')
    const password = c.req.header('x-share-password')
    try {
      const shareLink = await shareService.getShareLink(shareId)
      await shareService.verifyPublicAccess(shareId, shareLink.rootFolderId, password)
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
      await shareService.verifyPublicAccess(shareId, shareLink.rootFolderId, password)

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
      const shareId = c.req.param('shareId')
      const folderId = c.req.param('folderId')
      const password =
        c.req.header('x-share-password') || c.req.query('password') || c.req.query('p')
      const req = c.req.valid('query')

      try {
        const shareLink = await shareService.verifyPublicAccess(shareId, folderId, password)

        let sort: string | undefined
        let order: string | undefined

        if (shareLink.defaultSortOrder) {
          const parts = shareLink.defaultSortOrder.split(':')
          sort = parts[0]
          order = parts[1]
        }

        const res = await assetService.listChildren(
          {
            ...req,
            assetId: folderId,
            assetType: req.assetType || 'file',
            sort,
            order,
          },
          { excludeInternalComments: true },
        )

        if (shareLink.watermarkConfigId && res.data.length > 0) {
          // Resolve symlink targets once and reuse for the media lookup, so each
          // item costs a single query instead of two.
          const targetIds = await Promise.all(
            res.data.map((item) => assetService.resolveLatestVersionId(item.id)),
          )
          const wfMap = await watermarkService.getCompletedWatermarkMediaMap(
            targetIds,
            shareLink.watermarkConfigId,
          )

          res.data = await Promise.all(
            res.data.map(async (item, index) =>
              applyWatermarkToAssetMedia(
                item,
                wfMap.get(targetIds[index]) ?? null,
                shareLink.id,
                password,
              ),
            ),
          )
        } else if (res.data.length > 0) {
          const pwQuery = password ? `?p=${encodeURIComponent(password)}` : ''
          for (const item of res.data) {
            if (item.media?.isHls && item.media.hls?.key) {
              item.media.hls.url = `/api/shares/${shareLink.id}/files/${item.id}/m3u8/master.m3u8${pwQuery}`
            }
          }
        }

        res.data = res.data.map((item) => filterSharedFieldValues(item, shareLink.fieldVisibility))

        return c.json(res)
      } catch (err) {
        return handlePublicShareError(c, err)
      }
    },
  )
  .get('/shares/:shareId/files/:fileId', async (c) => {
    const shareId = c.req.param('shareId')
    const fileId = c.req.param('fileId')
    const password = c.req.header('x-share-password') || c.req.query('password') || c.req.query('p')

    try {
      const shareLink = await shareService.verifyPublicAccess(shareId, fileId, password)

      let asset = await assetService.getAsset(
        { assetId: fileId },
        { excludeInternalComments: true },
      )

      // Only video/image/3d assets are subject to watermark protection; skip the
      // watermark lookup entirely for other media types (pdf, audio, ...).
      if (
        shareLink.watermarkConfigId &&
        (asset.proxyType === 'video' || asset.proxyType === 'image' || asset.proxyType === '3d')
      ) {
        const targetAssetId = await assetService.resolveLatestVersionId(fileId)
        const wfMap = await watermarkService.getCompletedWatermarkMediaMap(
          [targetAssetId],
          shareLink.watermarkConfigId,
        )
        asset = await applyWatermarkToAssetMedia(
          asset,
          wfMap.get(targetAssetId) ?? null,
          shareLink.id,
          password,
        )
      } else if (asset.media?.isHls && asset.media.hls?.key) {
        const pwQuery = password ? `?p=${encodeURIComponent(password)}` : ''
        asset.media.hls.url = `/api/shares/${shareLink.id}/files/${asset.id}/m3u8/master.m3u8${pwQuery}`
      }

      return c.json(filterSharedFieldValues(asset, shareLink.fieldVisibility))
    } catch (err) {
      return handlePublicShareError(c, err)
    }
  })
  .post(
    '/shares/:shareId/files/:fileId/download-url',
    zValidator(
      'json',
      z.object({
        key: z.string().min(1),
        purpose: z.enum(['download', 'prepare', 'clipboard']).default('download'),
      }),
    ),
    async (c) => {
      const shareId = c.req.param('shareId')
      const fileId = c.req.param('fileId')
      const password = c.req.header('x-share-password')
      const { key, purpose } = c.req.valid('json')

      try {
        const shareLink = await shareService.verifyPublicAccess(shareId, fileId, password)

        if (!shareLink.allowDownload) {
          throw new ShareLinkDownloadDisabledError('Download is disabled for this share link')
        }

        if (!key.startsWith('files/')) {
          return c.json({ error: 'Invalid key' }, 400)
        }

        const { url, assetId } = await assetService.getDownloadUrlWithAsset(fileId, key)
        if (assetId !== fileId) await shareService.verifyPublicAccess(shareId, assetId, password)
        if (purpose === 'download') {
          const userId = await getPublicShareUserId(c, shareId)
          await shareActivityService.recordEvent(shareId, {
            kind: 'asset_downloaded',
            assetId,
            userId,
          })
        }
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
      const shareId = c.req.param('shareId')
      const fileId = c.req.param('fileId')
      const password = c.req.header('x-share-password')
      const req = c.req.valid('query')

      try {
        await shareService.verifyPublicAccess(shareId, fileId, password)

        const targetFileId = await assetService.resolveTargetAssetId(fileId)
        const userId = await getPublicShareUserId(c, shareId)
        const res = await assetService.listComments(targetFileId, req, userId, {
          excludeInternal: true,
        })
        return c.json(res)
      } catch (err) {
        return handlePublicShareError(c, err)
      }
    },
  )
  .get('/shares/:shareId/files/:fileId/comments/print', async (c) => {
    const shareId = c.req.param('shareId')
    const fileId = c.req.param('fileId')
    const password = c.req.header('x-share-password') || c.req.query('password') || c.req.query('p')

    try {
      const shareLink = await shareService.verifyPublicAccess(shareId, fileId, password)
      let asset = await assetService.getAsset(
        { assetId: fileId },
        { excludeInternalComments: true },
      )
      const targetAssetId = await assetService.resolveLatestVersionId(fileId)

      if (
        shareLink.watermarkConfigId &&
        (asset.proxyType === 'video' || asset.proxyType === 'image' || asset.proxyType === '3d')
      ) {
        const wfMap = await watermarkService.getCompletedWatermarkMediaMap(
          [targetAssetId],
          shareLink.watermarkConfigId,
        )
        asset = await applyWatermarkToAssetMedia(
          asset,
          wfMap.get(targetAssetId) ?? null,
          shareLink.id,
          password,
        )
      }

      const targetFileId = await assetService.resolveTargetAssetId(fileId)
      const userId = await getPublicShareUserId(c, shareId)
      const comments = await assetService.listAllComments(targetFileId, userId, {
        excludeInternal: true,
      })

      // Scope breadcrumbs strictly to folders inside the share link root so private
      // project and parent folder names are never leaked.
      const ancestors = asset.ancestorFolders ?? []
      const rootIndex = ancestors.findIndex((f) => f.id === shareLink.rootFolderId)
      const scopedAncestors = rootIndex !== -1 ? ancestors.slice(0, rootIndex) : []
      const scopedFolders = [...scopedAncestors]
        .reverse()
        .map((f) => f.name)
        .filter((name): name is string => Boolean(name))
      const breadcrumbs = shareLink.name ? [shareLink.name, ...scopedFolders] : scopedFolders

      return c.json({
        asset: {
          ...filterSharedFieldValues(asset, shareLink.fieldVisibility),
          ancestorFolders: scopedAncestors,
        },
        breadcrumbs,
        comments,
      })
    } catch (err) {
      return handlePublicShareError(c, err)
    }
  })
  .get(
    '/shares/:shareId/files/:fileId/comments/frame',
    zValidator('query', commentFrameQuerySchema),
    async (c) => {
      const shareId = c.req.param('shareId')
      const fileId = c.req.param('fileId')
      const password =
        c.req.header('x-share-password') || c.req.query('password') || c.req.query('p')
      const { second, width } = c.req.valid('query')

      try {
        const shareLink = await shareService.verifyPublicAccess(shareId, fileId, password)
        const targetFileId = await assetService.resolveTargetAssetId(fileId)
        const result = await commentFrameService.extractFrame({
          assetId: targetFileId,
          second,
          width,
          watermarkConfigId: shareLink.watermarkConfigId,
          signal: c.req.raw.signal,
        })

        return c.body(new Uint8Array(result.buffer), 200, {
          'Content-Type': result.mimeType,
          'Cache-Control': 'private, max-age=300',
        })
      } catch (err) {
        if (err instanceof HTTPException) {
          throw err
        }
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
      const req = c.req.valid('json')

      if (req.attachmentIds && req.attachmentIds.length > 0) {
        return c.json({ error: 'Attachments are not allowed on public share comments' }, 400)
      }

      if (req.isInternal) {
        return c.json({ error: 'Internal comments are not allowed on public share links' }, 400)
      }

      try {
        const shareLink = await shareService.verifyPublicAccess(shareId, fileId, password)

        const targetFileId = await assetService.resolveTargetAssetId(fileId)

        const teamId = await projectService.getProjectTeam(shareLink.projectId)

        const userId = await getPublicShareUserId(c, shareId)

        if (!userId) {
          return c.json({ error: 'Unauthorized' }, 401)
        }

        const comment = await assetService.createComment(
          {
            assetId: targetFileId,
            userId,
            replyToId: req.replyToId,
            message: req.message,
            annotations: req.annotations,
            second: req.second,
            attachmentIds: req.attachmentIds,
            isInternal: false,
          },
          { shareLinkId: shareId },
        )

        const notifType = req.replyToId ? 'reply_created' : 'comment_created'

        await notificationService.create({
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
  .get('/shares/:shareId/files/:fileId/m3u8', async (c) => {
    const shareId = c.req.param('shareId')
    const fileId = c.req.param('fileId')
    const password = c.req.header('x-share-password') || c.req.query('password') || c.req.query('p')

    try {
      const shareLink = await shareService.verifyPublicAccess(shareId, fileId, password)
      const targetAssetId = await assetService.resolveLatestVersionId(fileId)
      let playlist = await assetService.getHlsMasterPlaylist({
        assetId: targetAssetId,
        watermarkConfigId: shareLink.watermarkConfigId,
      })
      if (password) {
        playlist = playlist.replace(
          /([0-9]+p\/index\.m3u8)/g,
          `$1?p=${encodeURIComponent(password)}`,
        )
      }
      c.header('Content-Type', 'application/vnd.apple.mpegurl')
      return c.body(playlist)
    } catch (err) {
      return handlePublicShareError(c, err)
    }
  })
  .get('/shares/:shareId/files/:fileId/m3u8/master.m3u8', async (c) => {
    const shareId = c.req.param('shareId')
    const fileId = c.req.param('fileId')
    const password = c.req.header('x-share-password') || c.req.query('password') || c.req.query('p')

    try {
      const shareLink = await shareService.verifyPublicAccess(shareId, fileId, password)
      const targetAssetId = await assetService.resolveLatestVersionId(fileId)
      let playlist = await assetService.getHlsMasterPlaylist({
        assetId: targetAssetId,
        watermarkConfigId: shareLink.watermarkConfigId,
      })
      if (password) {
        playlist = playlist.replace(
          /([0-9]+p\/index\.m3u8)/g,
          `$1?p=${encodeURIComponent(password)}`,
        )
      }
      c.header('Content-Type', 'application/vnd.apple.mpegurl')
      return c.body(playlist)
    } catch (err) {
      return handlePublicShareError(c, err)
    }
  })
  .get('/shares/:shareId/files/:fileId/m3u8/:resolution', async (c) => {
    const shareId = c.req.param('shareId')
    const fileId = c.req.param('fileId')
    let resolution = c.req.param('resolution')
    if (resolution.endsWith('.m3u8')) {
      resolution = resolution.replace(/\.m3u8$/, '')
    }
    const password = c.req.header('x-share-password') || c.req.query('password') || c.req.query('p')

    try {
      const shareLink = await shareService.verifyPublicAccess(shareId, fileId, password)
      const targetAssetId = await assetService.resolveLatestVersionId(fileId)
      const playlist = await assetService.getHlsVariantPlaylist({
        assetId: targetAssetId,
        resolution,
        watermarkConfigId: shareLink.watermarkConfigId,
      })
      c.header('Content-Type', 'application/vnd.apple.mpegurl')
      return c.body(playlist)
    } catch (err) {
      return handlePublicShareError(c, err)
    }
  })
  .get('/shares/:shareId/files/:fileId/m3u8/:resolution/index.m3u8', async (c) => {
    const shareId = c.req.param('shareId')
    const fileId = c.req.param('fileId')
    const resolution = c.req.param('resolution')
    const password = c.req.header('x-share-password') || c.req.query('password') || c.req.query('p')

    try {
      const shareLink = await shareService.verifyPublicAccess(shareId, fileId, password)
      const targetAssetId = await assetService.resolveLatestVersionId(fileId)
      const playlist = await assetService.getHlsVariantPlaylist({
        assetId: targetAssetId,
        resolution,
        watermarkConfigId: shareLink.watermarkConfigId,
      })
      c.header('Content-Type', 'application/vnd.apple.mpegurl')
      return c.body(playlist)
    } catch (err) {
      return handlePublicShareError(c, err)
    }
  })

export default route
