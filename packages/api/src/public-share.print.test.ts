import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import publicShareRoute from './public-share'
import { shareService } from '@shumai/core/src/share/share'
import { assetService } from '@shumai/core/src/asset/asset'
import { commentFrameService } from '@shumai/core/src/comment/comment-frame'
import { watermarkService } from '@shumai/core/src/watermark/watermark'
import { auth } from '@shumai/core/src/auth/auth'
import { ShareLinkPasswordInvalidError } from '@shumai/core/src/share/errors'

describe('public share print comments and frame api', () => {
  beforeEach(() => {
    vi.spyOn(auth.api, 'getSession').mockResolvedValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('GET /shares/:shareId/files/:fileId/comments/print returns share-scoped breadcrumbs and comments', async () => {
    vi.spyOn(shareService, 'verifyPublicAccess').mockResolvedValue({
      id: 'share-1',
      name: 'Client Review',
      rootFolderId: 'share-root',
      projectId: 'proj-1',
      watermarkConfigId: null,
    } as never)

    vi.spyOn(assetService, 'getAsset').mockResolvedValue({
      id: 'file-1',
      name: 'spot.mp4',
      sizeByte: 100,
      fileCount: 1,
      type: 'file',
      status: 'active',
      proxyType: 'video',
      ancestorFolders: [
        { id: 'inner', name: 'Inner Folder' },
        { id: 'share-root', name: 'Share Root' },
        { id: 'private-parent', name: 'Secret Project Folder' },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    vi.spyOn(assetService, 'resolveLatestVersionId').mockResolvedValue('file-1')
    vi.spyOn(assetService, 'resolveTargetAssetId').mockResolvedValue('file-1')
    vi.spyOn(assetService, 'listAllComments').mockResolvedValue([
      {
        id: 'c1',
        assetId: 'file-1',
        message: 'Great cut!',
        annotations: null,
        second: 3,
        creator: { id: 'u1', name: 'Guest' },
        replies: [],
        attachments: [],
        mentions: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sessionId: null,
        isCompleted: false,
        completionLastChangedBy: null,
        reactionCounts: [],
      },
    ])

    const app = new Hono().route('/', publicShareRoute)
    const res = await app.request('/shares/share-1/files/file-1/comments/print', {
      headers: { 'x-share-password': 'secret' },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.breadcrumbs).toEqual(['Client Review', 'Inner Folder'])
    expect(body.breadcrumbs).not.toContain('Secret Project Folder')
    expect(body.comments).toHaveLength(1)
  })

  it('GET /shares/:shareId/files/:fileId/comments/print returns 401 on invalid password', async () => {
    vi.spyOn(shareService, 'verifyPublicAccess').mockRejectedValue(
      new ShareLinkPasswordInvalidError('Invalid password'),
    )

    const app = new Hono().route('/', publicShareRoute)
    const res = await app.request('/shares/share-1/files/file-1/comments/print')

    expect(res.status).toBe(401)
  })

  it('GET /shares/:shareId/files/:fileId/comments/frame passes watermarkConfigId and password query param', async () => {
    const verifySpy = vi.spyOn(shareService, 'verifyPublicAccess').mockResolvedValue({
      id: 'share-1',
      name: 'Watermarked Review',
      rootFolderId: 'share-root',
      projectId: 'proj-1',
      watermarkConfigId: 'wm-1',
    } as never)
    vi.spyOn(assetService, 'resolveTargetAssetId').mockResolvedValue('target-file-1')
    const extractSpy = vi.spyOn(commentFrameService, 'extractFrame').mockResolvedValue({
      buffer: Buffer.from('wm-webp'),
      mimeType: 'image/webp',
    })
    vi.spyOn(watermarkService, 'getCompletedWatermarkMediaMap').mockResolvedValue(new Map())

    const app = new Hono().route('/', publicShareRoute)
    const res = await app.request(
      '/shares/share-1/files/file-1/comments/frame?second=4.2&width=400&p=pw123',
    )

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/webp')
    expect(verifySpy).toHaveBeenCalledWith('share-1', 'file-1', 'pw123')
    expect(extractSpy).toHaveBeenCalledWith({
      assetId: 'target-file-1',
      second: 4.2,
      width: 400,
      watermarkConfigId: 'wm-1',
      signal: expect.any(AbortSignal),
    })
  })
})
