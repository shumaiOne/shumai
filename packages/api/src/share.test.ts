import { describe, expect, test, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import shareRoute from './share'
import publicShareRoute from './public-share'
import { authMiddleware } from './middleware/auth'
import { shareService } from '@shumai/core/src/share/share'
import { assetService } from '@shumai/core/src/asset/asset'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { ShareLinkPasswordInvalidError, ShareLinkExpiredError } from '@shumai/core/src/share/errors'

import { auditLogService } from '@shumai/core/src/auditLog/auditLog'
import { watermarkService } from '@shumai/core/src/watermark/watermark'
import { s3Service } from '@shumai/core/src/s3/s3'

vi.mock('./middleware/auth', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authMiddleware: async (c: any, next: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    c.set('user', { id: 'user1', name: 'Test User' } as any)
    await next()
  },
}))

vi.mock('@shumai/core/src/authz/authz', () => ({
  authzService: {
    hasPermission: vi.fn().mockResolvedValue(undefined),
  },
  Permission: {
    Read: 'Read',
    Edit: 'Edit',
    Admin: 'Admin',
  },
  ResourceType: {
    Project: 'project',
    Share: 'share',
    Asset: 'asset',
  },
}))

vi.mock('@shumai/core/src/auditLog/auditLog', () => ({
  auditLogService: {
    logAction: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('@shumai/core/src/project/project', () => ({
  projectService: {
    getProjectTeam: vi.fn().mockResolvedValue('t1'),
  },
}))

function watermarkMediaInfo(overrides: Partial<PrismaJson.MediaInfo> = {}): PrismaJson.MediaInfo {
  return {
    duration: 1,
    filesize: 100,
    frames: 30,
    proxyType: 'video',
    imageTranscodes: [],
    videoTranscodes: [],
    finishedAt: new Date().toISOString(),
    metadata: {
      originalHeight: 360,
      originalWidth: 640,
      hasAudio: false,
      duration: 1,
      bitRate: 0,
      frameRate: 30,
      totalFrames: 30,
      startTimecode: '00:00:00:00',
      format: {},
    },
    original: {
      key: 'files/orig.mp4',
      filesizeInBytes: 100,
      codec: '',
    },
    ...overrides,
  }
}

describe('Share API', () => {
  const app = new Hono()
    .route('/', publicShareRoute)
    .use('*', authMiddleware)
    .route('/', shareRoute)

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(authzService.hasPermission).mockResolvedValue(undefined)
  })

  // Public Routes
  describe('GET /shares/:shareId/info', () => {
    test('Success', async () => {
      vi.spyOn(shareService, 'getShareLink').mockResolvedValue({
        id: 'share1',
        name: 'Public Share',
        isDisabled: false,
        isExpired: false,
        hasPassword: true,
        rootFolderId: 'folder1',
        projectId: 'project1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      vi.spyOn(shareService, 'verifyPublicAccess').mockResolvedValue({
        id: 'share1',
        name: 'Public Share',
        rootFolderId: 'folder1',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      const res = await app.request('/shares/share1/info', {
        method: 'GET',
        headers: { 'x-share-password': 'pass' },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.name).toBe('Public Share')
      expect(body.hasPassword).toBe(true)
      expect(shareService.verifyPublicAccess).toHaveBeenCalledWith('folder1', 'pass')
    })

    test('Unauthorized', async () => {
      vi.spyOn(shareService, 'getShareLink').mockResolvedValue({
        id: 'share1',
        name: 'Public Share',
        isDisabled: false,
        isExpired: false,
        hasPassword: true,
        rootFolderId: 'folder1',
        projectId: 'project1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      vi.spyOn(shareService, 'verifyPublicAccess').mockRejectedValue(
        new ShareLinkPasswordInvalidError('Invalid password for share link'),
      )

      const res = await app.request('/shares/share1/info', {
        method: 'GET',
        headers: { 'x-share-password': 'wrong' },
      })

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe('Unauthorized')
    })

    test('Expired/Disabled', async () => {
      vi.spyOn(shareService, 'getShareLink').mockResolvedValue({
        id: 'share1',
        name: 'Public Share',
        isDisabled: false,
        isExpired: false,
        hasPassword: true,
        rootFolderId: 'folder1',
        projectId: 'project1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      vi.spyOn(shareService, 'verifyPublicAccess').mockRejectedValue(
        new ShareLinkExpiredError('Share link has expired'),
      )

      const res = await app.request('/shares/share1/info', {
        method: 'GET',
      })

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toBe('Share link has expired')
    })
  })

  describe('GET /shares/:shareId/folders/:folderId/children', () => {
    test('Success', async () => {
      vi.spyOn(shareService, 'verifyPublicAccess').mockResolvedValue({
        id: 'share1',
        name: 'My Share',
        isDisabled: false,
        rootFolderId: 'folder1',
        projectId: 'project1',
        password: null,
        expireAt: null,
        defaultSortOrder: 'name:asc',
        fieldVisibility: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      vi.spyOn(assetService, 'listChildren').mockResolvedValue({
        data: [],
        pageInfo: { total: 0, cursor: undefined },
      })

      const res = await app.request('/shares/share1/folders/folder1/children?assetType=file', {
        method: 'GET',
        headers: { 'x-share-password': 'pass' },
      })

      expect(res.status).toBe(200)
      expect(shareService.verifyPublicAccess).toHaveBeenCalledWith('folder1', 'pass')
      expect(assetService.listChildren).toHaveBeenCalledWith(
        expect.objectContaining({
          assetId: 'folder1',
          assetType: 'file',
          sort: 'name',
          order: 'asc',
        }),
      )
    })

    test('applies per-file watermark proxies when watermark enabled', async () => {
      vi.spyOn(shareService, 'verifyPublicAccess').mockResolvedValue({
        id: 'share1',
        name: 'My Share',
        isDisabled: false,
        rootFolderId: 'folder1',
        projectId: 'project1',
        password: null,
        expireAt: null,
        watermarkConfigId: 'cfg1',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      vi.spyOn(assetService, 'listChildren').mockResolvedValue({
        data: [
          {
            id: 'video-ready',
            name: 'a.mp4',
            sizeByte: 1,
            fileCount: 0,
            type: 'file',
            status: 'processed',
            proxyType: 'video',
            media: {
              proxyType: 'video',
              videoTranscodes: [
                {
                  id: 'orig',
                  url: 'u',
                  key: 'files/orig.mp4',
                  width: 640,
                  height: 360,
                  size: 1,
                  isRaw: false,
                },
              ],
              imageTranscodes: [],
              original: { key: 'files/orig.mp4' },
            },
          },
          {
            id: 'video-pending',
            name: 'b.mp4',
            sizeByte: 1,
            fileCount: 0,
            type: 'file',
            status: 'processed',
            proxyType: 'video',
            media: {
              proxyType: 'video',
              videoTranscodes: [
                {
                  id: 'orig',
                  url: 'u',
                  key: 'files/orig.mp4',
                  width: 640,
                  height: 360,
                  size: 1,
                  isRaw: false,
                },
              ],
              imageTranscodes: [],
              original: { key: 'files/orig.mp4' },
            },
          },
          {
            id: 'doc',
            name: 'c.pdf',
            sizeByte: 1,
            fileCount: 0,
            type: 'file',
            status: 'processed',
            proxyType: 'pdf',
            media: {
              proxyType: 'pdf',
              pdfTranscode: { url: 'u', key: 'files/doc.pdf' },
              videoTranscodes: [],
              imageTranscodes: [],
              original: { key: 'files/doc.pdf' },
            },
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ] as any,
        pageInfo: { total: 3, cursor: undefined },
      })
      vi.spyOn(assetService, 'resolveTargetAssetId').mockImplementation(async (id) => id)
      vi.spyOn(s3Service, 'presign').mockResolvedValue('http://s3/presigned')
      vi.spyOn(watermarkService, 'getCompletedWatermarkMediaMap').mockResolvedValue(
        new Map([
          [
            'video-ready',
            watermarkMediaInfo({
              videoTranscodes: [{ key: 'files/wm-a.mp4', width: 640, height: 360 }],
            }),
          ],
        ]),
      )

      const res = await app.request('/shares/share1/folders/folder1/children?assetType=file', {
        method: 'GET',
        headers: { 'x-share-password': 'pass' },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      // Ready item → watermarked proxy
      expect(body.data[0].media.videoTranscodes).toEqual([
        {
          id: 'files/wm-a.mp4',
          url: 'http://s3/presigned',
          key: 'files/wm-a.mp4',
          width: 640,
          height: 360,
          size: 0,
          isRaw: false,
        },
      ])
      // Pending item → original transcodes emptied
      expect(body.data[1].media.videoTranscodes).toEqual([])
      expect(body.data[1].media.imageTranscodes).toEqual([])
      // Non-media item → untouched
      expect(body.data[2].media.pdfTranscode).toEqual({ url: 'u', key: 'files/doc.pdf' })
    })
  })

  describe('GET /shares/:shareId/files/:fileId', () => {
    const shareLinkWithWatermark = {
      id: 'share1',
      name: 'My Share',
      isDisabled: false,
      rootFolderId: 'folder1',
      projectId: 'project1',
      password: null,
      expireAt: null,
      watermarkConfigId: 'cfg1',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any

    const videoAsset = {
      id: 'file1',
      name: 'video.mp4',
      sizeByte: 1024,
      fileCount: 0,
      type: 'file',
      status: 'processed',
      proxyType: 'video',
      media: {
        proxyType: 'video',
        videoTranscodes: [
          {
            id: 'orig-360p',
            url: 'http://s3/original-360p',
            key: 'files/original-360p.mp4',
            width: 640,
            height: 360,
            size: 100,
            isRaw: false,
          },
        ],
        imageTranscodes: [],
        original: { key: 'files/original.mp4' },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any

    beforeEach(() => {
      vi.spyOn(assetService, 'getAsset').mockResolvedValue(videoAsset)
      vi.spyOn(assetService, 'resolveTargetAssetId').mockResolvedValue('file1')
      vi.spyOn(s3Service, 'presign').mockResolvedValue('http://s3/presigned')
    })

    test('serves watermarked transcodes when watermark enabled and completed', async () => {
      vi.spyOn(shareService, 'verifyPublicAccess').mockResolvedValue(shareLinkWithWatermark)
      vi.spyOn(watermarkService, 'getCompletedWatermarkMediaMap').mockResolvedValue(
        new Map([
          [
            'file1',
            watermarkMediaInfo({
              videoTranscodes: [{ key: 'files/watermarked-360p.mp4', width: 640, height: 360 }],
            }),
          ],
        ]),
      )

      const res = await app.request('/shares/share1/files/file1', {
        method: 'GET',
        headers: { 'x-share-password': 'pass' },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.media.videoTranscodes).toEqual([
        {
          id: 'files/watermarked-360p.mp4',
          url: 'http://s3/presigned',
          key: 'files/watermarked-360p.mp4',
          width: 640,
          height: 360,
          size: 0,
          isRaw: false,
        },
      ])
      expect(body.media.imageTranscodes).toEqual([])
    })

    test('serves empty transcode arrays while watermark transcoding is in flight', async () => {
      vi.spyOn(shareService, 'verifyPublicAccess').mockResolvedValue(shareLinkWithWatermark)
      vi.spyOn(watermarkService, 'getCompletedWatermarkMediaMap').mockResolvedValue(new Map())

      const res = await app.request('/shares/share1/files/file1', {
        method: 'GET',
        headers: { 'x-share-password': 'pass' },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.media.videoTranscodes).toEqual([])
      expect(body.media.imageTranscodes).toEqual([])
    })

    test('leaves non-video/image media untouched when watermark enabled', async () => {
      vi.spyOn(shareService, 'verifyPublicAccess').mockResolvedValue(shareLinkWithWatermark)
      vi.spyOn(assetService, 'getAsset').mockResolvedValue({
        id: 'file1',
        name: 'doc.pdf',
        sizeByte: 1024,
        fileCount: 0,
        type: 'file',
        status: 'processed',
        proxyType: 'pdf',
        media: {
          proxyType: 'pdf',
          pdfTranscode: { url: 'http://s3/doc', key: 'files/doc.pdf' },
          videoTranscodes: [],
          imageTranscodes: [],
          original: { key: 'files/doc.pdf' },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      const resolveSpy = vi.spyOn(assetService, 'resolveTargetAssetId')
      const wfSpy = vi.spyOn(watermarkService, 'getCompletedWatermarkMediaMap')

      const res = await app.request('/shares/share1/files/file1', {
        method: 'GET',
        headers: { 'x-share-password': 'pass' },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.media.pdfTranscode).toEqual({ url: 'http://s3/doc', key: 'files/doc.pdf' })
      expect(resolveSpy).not.toHaveBeenCalled()
      expect(wfSpy).not.toHaveBeenCalled()
    })

    test('serves original media unchanged when watermark disabled', async () => {
      vi.spyOn(shareService, 'verifyPublicAccess').mockResolvedValue({
        id: 'share1',
        name: 'My Share',
        isDisabled: false,
        rootFolderId: 'folder1',
        projectId: 'project1',
        password: null,
        expireAt: null,
        watermarkConfigId: null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      const wfSpy = vi.spyOn(watermarkService, 'getCompletedWatermarkMediaMap')

      const res = await app.request('/shares/share1/files/file1', {
        method: 'GET',
        headers: { 'x-share-password': 'pass' },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.media.videoTranscodes).toEqual([
        {
          id: 'orig-360p',
          url: 'http://s3/original-360p',
          key: 'files/original-360p.mp4',
          width: 640,
          height: 360,
          size: 100,
          isRaw: false,
        },
      ])
      expect(wfSpy).not.toHaveBeenCalled()
    })
  })

  // Protected Routes
  describe('POST /projects/:projectId/shares', () => {
    test('Success', async () => {
      vi.spyOn(shareService, 'createShareLink').mockResolvedValue({
        id: 'share1',
        name: 'test-share',
        isDisabled: false,
        rootFolderId: 'root1',
        projectId: 'project1',
        isExpired: false,
        hasPassword: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      const res = await app.request('/projects/project1/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'My Share' }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.id).toBe('share1')
      expect(authzService.hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ResourceType.Project,
          id: 'project1',
          permission: Permission.Edit,
        }),
      )
      expect(shareService.createShareLink).toHaveBeenCalledWith(
        'project1',
        { name: 'My Share' },
        'user1',
      )
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        action: 'share_create',
        teamId: 't1',
        userId: 'user1',
        projectId: 'project1',
        itemId: 'share1',
      })
    })
  })

  describe('GET /projects/:projectId/shares', () => {
    test('Success', async () => {
      vi.spyOn(shareService, 'listProjectShareLinks').mockResolvedValue({
        data: [],
        pageInfo: { total: 0, cursor: undefined },
      })

      const res = await app.request('/projects/project1/shares', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      expect(authzService.hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ResourceType.Project,
          id: 'project1',
          permission: Permission.Read,
        }),
      )
      expect(shareService.listProjectShareLinks).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'project1',
        }),
      )
    })
  })

  describe('GET /shares/:shareId', () => {
    test('Success', async () => {
      vi.spyOn(shareService, 'getShareLink').mockResolvedValue({
        id: 'share1',
        name: 'test-share',
        isDisabled: false,
        rootFolderId: 'root1',
        projectId: 'project1',
        isExpired: false,
        hasPassword: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      const res = await app.request('/shares/share1', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      expect(authzService.hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ResourceType.Share,
          id: 'share1',
          permission: Permission.Read,
        }),
      )
      expect(shareService.getShareLink).toHaveBeenCalledWith('share1')
    })
  })

  describe('POST /shares/:shareId/assets', () => {
    test('Success', async () => {
      vi.spyOn(shareService, 'getShareLink').mockResolvedValue({
        id: 'share1',
        name: 'test-share',
        isDisabled: false,
        rootFolderId: 'root1',
        projectId: 'project1',
        isExpired: false,
        hasPassword: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      vi.spyOn(shareService, 'addAssetToShare').mockResolvedValue(1)

      const res = await app.request('/shares/share1/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetIds: ['asset1'] }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.addedCount).toBe(1)
      expect(authzService.hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ResourceType.Share,
          id: 'share1',
          permission: Permission.Edit,
        }),
      )
      expect(authzService.hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ResourceType.Asset,
          id: 'asset1',
          permission: Permission.Read,
        }),
      )
      expect(shareService.addAssetToShare).toHaveBeenCalledWith('share1', { assetIds: ['asset1'] })
    })
  })

  describe('Watermark API', () => {
    test('PUT /shares/:shareId/watermark success', async () => {
      const { watermarkService } = await import('@shumai/core/src/watermark/watermark')
      vi.spyOn(watermarkService, 'updateShareLinkWatermark').mockResolvedValue({
        id: 'share1',
        name: 'test-share',
        isDisabled: false,
        rootFolderId: 'root1',
        projectId: 'project1',
        isExpired: false,
        hasPassword: false,
        watermarkStatus: 'processing',
        watermarkConfigId: 'cfg1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      const res = await app.request('/shares/share1/watermark', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: true,
          config: {
            blocks: [
              {
                id: 'b1',
                type: 'text',
                x: 0.5,
                y: 0.5,
                opacity: 0.5,
                rotation: 0,
                text: 'TEST',
                size: 0.1,
                color: '#FFF',
              },
            ],
          },
        }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.watermarkStatus).toBe('processing')
    })

    test('PUT /shares/:shareId/watermark conflict 409', async () => {
      const { watermarkService } = await import('@shumai/core/src/watermark/watermark')
      const { ShareLinkWatermarkProcessingError } = await import('@shumai/core/src/share/errors')
      vi.spyOn(watermarkService, 'updateShareLinkWatermark').mockRejectedValue(
        new ShareLinkWatermarkProcessingError(),
      )

      const res = await app.request('/shares/share1/watermark', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false }),
      })

      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error).toBe('Watermark transcoding is currently in progress')
    })

    test('PUT /shares/:shareId/watermark without config when enabled returns 400', async () => {
      const res = await app.request('/shares/share1/watermark', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
      })

      expect(res.status).toBe(400)
    })

    test('GET /shares/:shareId/watermark success', async () => {
      const { watermarkService } = await import('@shumai/core/src/watermark/watermark')
      vi.spyOn(watermarkService, 'getShareLinkWatermark').mockResolvedValue({
        watermarkStatus: 'ready',
        watermarkConfig: {
          id: 'cfg1',
          config: { blocks: [] },
          hash: 'h1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      })

      const res = await app.request('/shares/share1/watermark', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.watermarkStatus).toBe('ready')
      expect(body.watermarkConfig.hash).toBe('h1')
    })
  })
})
