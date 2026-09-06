import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createReadAssetTool } from './read-asset'
import {
  prisma,
  WorkflowTaskType,
  WorkflowTaskStatus,
  type Asset,
  type WorkflowTask,
} from '@shumai/db'
import { s3Service } from '@shumai/core/src/s3/s3'
import { workflowService } from '@shumai/workflow-core'
import { authzService } from '@shumai/core/src/authz/authz'
import * as annotationResolver from './annotation-resolver'

vi.mock('@shumai/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shumai/db')>()
  return {
    ...actual,
    prisma: {
      asset: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
      workflowTask: {
        create: vi.fn(),
      },
    },
  }
})

vi.mock('@shumai/core/src/s3/s3', () => ({
  s3Service: {
    getObject: vi.fn(),
    presign: vi.fn().mockResolvedValue('https://mock-presigned-url.com'),
  },
}))

vi.mock('@shumai/workflow-core', () => ({
  workflowService: {
    executeWait: vi.fn(),
  },
}))

vi.mock('@shumai/core/src/authz/authz', () => ({
  authzService: {
    hasPermission: vi.fn(),
  },
  Permission: { Read: 'Read' },
  ResourceType: { Asset: 'asset' },
}))

describe('readAssetTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(annotationResolver, 'resolveAnnotationsById').mockResolvedValue({
      annotations: null,
      timestamp: null,
    })
  })

  it('should throw authorization error if user ID is empty', async () => {
    const tool = createReadAssetTool('')
    await expect(
      tool.execute('call-1', {
        assetId: 'asset-1',
        annotationId: null,
        imageConfig: null,
        videoConfig: null,
        docConfig: null,
      }),
    ).rejects.toThrow('User ID is required for authorization.')
  })

  it('should throw error if asset not found', async () => {
    vi.mocked(authzService.hasPermission).mockResolvedValue()
    vi.mocked(prisma.asset.findUnique).mockResolvedValue(null)

    const tool = createReadAssetTool('user-1')
    await expect(
      tool.execute('call-1', {
        assetId: 'asset-1',
        annotationId: null,
        imageConfig: null,
        videoConfig: null,
        docConfig: null,
      }),
    ).rejects.toThrow('Asset with ID asset-1 not found.')
  })

  describe('Image Assets', () => {
    it('should read image and return ImageContent and S3 key', async () => {
      vi.mocked(authzService.hasPermission).mockResolvedValue()
      vi.mocked(prisma.asset.findUnique).mockResolvedValue({
        id: 'img-1',
        name: 'photo.png',
        mediaType: 'image/png',
        storageKey: { key: 'raw/photo.png' },
        media: {
          proxyType: 'image',
          imageTranscodes: [{ key: 'proxy/photo.webp' }],
        },
      } as unknown as Asset)

      vi.mocked(s3Service.getObject).mockResolvedValue({
        buffer: Buffer.from('fake-image-bytes'),
        contentType: 'image/webp',
      } as unknown as { buffer: Buffer; contentType: string })

      const tool = createReadAssetTool('user-1')
      const result = await tool.execute('call-1', {
        assetId: 'img-1',
        annotationId: null,
        imageConfig: null,
        videoConfig: null,
        docConfig: null,
      })

      expect(authzService.hasPermission).toHaveBeenCalledWith({
        user: { id: 'user-1' },
        permission: 'Read',
        type: 'asset',
        id: 'img-1',
      })
      expect(s3Service.getObject).toHaveBeenCalledWith('shumai', 'proxy/photo.webp')

      const textItem = result.content[0] as { type: 'text'; text: string }
      const imageItem = result.content[1] as { type: 'image'; data: string; mimeType: string }

      expect(textItem.text).toContain('proxy/photo.webp')
      expect(imageItem.type).toBe('image')
      expect(imageItem.data).toBe(Buffer.from('fake-image-bytes').toString('base64'))
      expect(result.details.key).toBe('proxy/photo.webp')
    })

    it('should trigger image annotation transcode workflow when annotationId is provided', async () => {
      vi.mocked(authzService.hasPermission).mockResolvedValue()
      vi.mocked(prisma.asset.findUnique).mockResolvedValue({
        id: 'img-1',
        name: 'photo.png',
        mediaType: 'image/png',
        projectId: 'project-1',
        storageKey: { key: 'raw/photo.png' },
        media: {
          proxyType: 'image',
          imageTranscodes: [{ key: 'proxy/photo.webp' }],
        },
      } as unknown as Asset)

      vi.spyOn(annotationResolver, 'resolveAnnotationsById').mockResolvedValue({
        annotations: [
          {
            type: 'arrow',
            color: '#ff0000',
            points: [
              [0, 0],
              [10, 10],
            ],
          },
        ],
        timestamp: null,
      })

      vi.mocked(prisma.workflowTask.create).mockResolvedValue({
        id: 'task-anno',
      } as unknown as WorkflowTask)
      vi.mocked(workflowService.executeWait).mockResolvedValue({
        id: 'task-anno',
        output: { key: 'annotated/photo.webp' },
      } as unknown as WorkflowTask)

      vi.mocked(s3Service.getObject).mockResolvedValue({
        buffer: Buffer.from('annotated-bytes'),
        contentType: 'image/webp',
      } as unknown as { buffer: Buffer; contentType: string })

      const tool = createReadAssetTool('user-1')
      const result = await tool.execute('call-1', {
        assetId: 'img-1',
        annotationId: 'comment-1',
        imageConfig: null,
        videoConfig: null,
        docConfig: null,
      })

      expect(prisma.workflowTask.create).toHaveBeenCalledWith({
        data: {
          assetId: 'img-1',
          projectId: 'project-1',
          type: WorkflowTaskType.transcode_image_annotation,
          status: WorkflowTaskStatus.pending,
          payload: {
            projectId: 'project-1',
            imageAnnotation: {
              annotations: [
                {
                  type: 'arrow',
                  color: '#ff0000',
                  points: [
                    [0, 0],
                    [10, 10],
                  ],
                },
              ],
            },
          },
        },
      })

      expect(s3Service.getObject).toHaveBeenCalledWith('shumai', 'annotated/photo.webp')
      expect(result.details.key).toBe('annotated/photo.webp')
    })
  })

  describe('Video Assets', () => {
    it('should throw error if videoConfig is missing for video assets', async () => {
      vi.mocked(authzService.hasPermission).mockResolvedValue()
      vi.mocked(prisma.asset.findUnique).mockResolvedValue({
        id: 'vid-1',
        name: 'video.mp4',
        mediaType: 'video/mp4',
        media: { proxyType: 'video' },
      } as unknown as Asset)

      const tool = createReadAssetTool('user-1')
      await expect(
        tool.execute('call-1', {
          assetId: 'vid-1',
          annotationId: null,
          imageConfig: null,
          videoConfig: null,
          docConfig: null,
        }),
      ).rejects.toThrow('videoConfig with start, end, and count is required')
    })

    it('should throw error on invalid video time range', async () => {
      vi.mocked(authzService.hasPermission).mockResolvedValue()
      vi.mocked(prisma.asset.findUnique).mockResolvedValue({
        id: 'vid-1',
        name: 'video.mp4',
        mediaType: 'video/mp4',
        media: { proxyType: 'video' },
      } as unknown as Asset)

      const tool = createReadAssetTool('user-1')
      await expect(
        tool.execute('call-1', {
          assetId: 'vid-1',
          annotationId: null,
          imageConfig: null,
          videoConfig: { start: 10, end: 5, count: 1 },
          docConfig: null,
        }),
      ).rejects.toThrow(
        'Invalid video time range: start (10) must be less than or equal to end (5).',
      )
    })

    it('should extract frames and return ImageContent array and keys', async () => {
      vi.mocked(authzService.hasPermission).mockResolvedValue()
      vi.mocked(prisma.asset.findUnique).mockResolvedValue({
        id: 'vid-1',
        name: 'video.mp4',
        mediaType: 'video/mp4',
        projectId: 'project-1',
        media: { proxyType: 'video' },
      } as unknown as Asset)

      vi.mocked(prisma.workflowTask.create).mockResolvedValue({
        id: 'task-shot',
      } as unknown as WorkflowTask)
      vi.mocked(workflowService.executeWait).mockResolvedValue({
        id: 'task-shot',
        output: {
          screenshots: [
            { key: 'screenshots/shot1.webp', timestamp: 2.0 },
            { key: 'screenshots/shot2.webp', timestamp: 4.0 },
          ],
        },
      } as unknown as WorkflowTask)

      vi.mocked(s3Service.getObject).mockImplementation(async (_bucket, key) => ({
        buffer: Buffer.from(`bytes-for-${key}`),
        contentType: 'image/webp',
      }))

      const tool = createReadAssetTool('user-1')
      const result = await tool.execute('call-1', {
        assetId: 'vid-1',
        annotationId: null,
        imageConfig: null,
        videoConfig: { start: 2.0, end: 4.0, count: 2 },
        docConfig: null,
      })

      expect(prisma.workflowTask.create).toHaveBeenCalledWith({
        data: {
          assetId: 'vid-1',
          projectId: 'project-1',
          type: WorkflowTaskType.transcode_screenshot,
          status: WorkflowTaskStatus.pending,
          payload: {
            projectId: 'project-1',
            screenshot: {
              start: 2.0,
              end: 4.0,
              count: 2,
              commentTimestamp: null,
              annotations: null,
            },
          },
        },
      })

      expect(result.content.length).toBe(3) // 1 text + 2 images
      expect(result.details.keys).toEqual(['screenshots/shot1.webp', 'screenshots/shot2.webp'])
    })
  })

  describe('Document Assets', () => {
    it('should throw error if docConfig is missing for document assets', async () => {
      vi.mocked(authzService.hasPermission).mockResolvedValue()
      vi.mocked(prisma.asset.findUnique).mockResolvedValue({
        id: 'doc-1',
        name: 'doc.pdf',
        mediaType: 'application/pdf',
        media: { proxyType: 'pdf' },
      } as unknown as Asset)

      const tool = createReadAssetTool('user-1')
      await expect(
        tool.execute('call-1', {
          assetId: 'doc-1',
          annotationId: null,
          imageConfig: null,
          videoConfig: null,
          docConfig: null,
        }),
      ).rejects.toThrow('docConfig with mode ("pages" or "text") is required')
    })

    it('should render PDF pages in mode: "pages"', async () => {
      vi.mocked(authzService.hasPermission).mockResolvedValue()
      vi.mocked(prisma.asset.findUnique).mockResolvedValue({
        id: 'doc-1',
        name: 'doc.pdf',
        mediaType: 'application/pdf',
        projectId: 'project-1',
        media: { proxyType: 'pdf' },
      } as unknown as Asset)

      vi.mocked(prisma.workflowTask.create).mockResolvedValue({
        id: 'task-pdf',
      } as unknown as WorkflowTask)
      vi.mocked(workflowService.executeWait).mockResolvedValue({
        id: 'task-pdf',
        output: {
          pages: [
            { key: 'pdf_pages/page1.webp', page: 1 },
            { key: 'pdf_pages/page2.webp', page: 2 },
          ],
        },
      } as unknown as WorkflowTask)

      vi.mocked(s3Service.getObject).mockImplementation(async (_bucket, key) => ({
        buffer: Buffer.from(`bytes-for-${key}`),
        contentType: 'image/webp',
      }))

      const tool = createReadAssetTool('user-1')
      const result = await tool.execute('call-1', {
        assetId: 'doc-1',
        annotationId: null,
        imageConfig: null,
        videoConfig: null,
        docConfig: { mode: 'pages', startPage: 1, endPage: 2 },
      })

      expect(result.content.length).toBe(3) // 1 text + 2 images
      expect(result.details.keys).toEqual(['pdf_pages/page1.webp', 'pdf_pages/page2.webp'])
    })

    it('should throw error in mode: "pages" when page range exceeds 20 pages', async () => {
      vi.mocked(authzService.hasPermission).mockResolvedValue()
      vi.mocked(prisma.asset.findUnique).mockResolvedValue({
        id: 'doc-1',
        name: 'doc.pdf',
        mediaType: 'application/pdf',
        media: { proxyType: 'pdf' },
      } as unknown as Asset)

      const tool = createReadAssetTool('user-1')
      await expect(
        tool.execute('call-1', {
          assetId: 'doc-1',
          annotationId: null,
          imageConfig: null,
          videoConfig: null,
          docConfig: { mode: 'pages', startPage: 1, endPage: 25 },
        }),
      ).rejects.toThrow('exceeds the maximum limit of 20 pages')
    })

    it('should throw error in mode: "text" when called on binary PDF', async () => {
      vi.mocked(authzService.hasPermission).mockResolvedValue()
      vi.mocked(prisma.asset.findUnique).mockResolvedValue({
        id: 'doc-1',
        name: 'manual.pdf',
        mediaType: 'application/pdf',
        media: { proxyType: 'pdf' },
      } as unknown as Asset)

      const tool = createReadAssetTool('user-1')
      await expect(
        tool.execute('call-1', {
          assetId: 'doc-1',
          annotationId: null,
          imageConfig: null,
          videoConfig: null,
          docConfig: { mode: 'text', startPage: null, endPage: null },
        }),
      ).rejects.toThrow('is a binary PDF/document and cannot be read as raw text')
    })

    it('should throw error in mode: "text" when annotationId is provided', async () => {
      vi.mocked(authzService.hasPermission).mockResolvedValue()
      vi.mocked(prisma.asset.findUnique).mockResolvedValue({
        id: 'doc-1',
        name: 'notes.md',
        mediaType: 'text/markdown',
        media: { proxyType: 'pdf' },
      } as unknown as Asset)

      const tool = createReadAssetTool('user-1')
      await expect(
        tool.execute('call-1', {
          assetId: 'doc-1',
          annotationId: 'comment-123',
          imageConfig: null,
          videoConfig: null,
          docConfig: { mode: 'text', startPage: null, endPage: null },
        }),
      ).rejects.toThrow('annotationId cannot be used with docConfig mode "text"')
    })

    it('should throw error in mode: "text" when startPage or endPage is non-null', async () => {
      vi.mocked(authzService.hasPermission).mockResolvedValue()
      vi.mocked(prisma.asset.findUnique).mockResolvedValue({
        id: 'doc-1',
        name: 'notes.md',
        mediaType: 'text/markdown',
        media: { proxyType: 'pdf' },
      } as unknown as Asset)

      const tool = createReadAssetTool('user-1')
      await expect(
        tool.execute('call-1', {
          assetId: 'doc-1',
          annotationId: null,
          imageConfig: null,
          videoConfig: null,
          docConfig: { mode: 'text', startPage: 1, endPage: 2 },
        }),
      ).rejects.toThrow('startPage and endPage must be null when docConfig mode is "text"')
    })

    it('should read raw text from S3 in mode: "text" for markdown files', async () => {
      vi.mocked(authzService.hasPermission).mockResolvedValue()
      vi.mocked(prisma.asset.findUnique).mockResolvedValue({
        id: 'doc-md',
        name: 'README.md',
        mediaType: 'text/markdown',
        storageKey: { key: 'raw/README.md' },
        media: { proxyType: 'pdf' },
      } as unknown as Asset)

      vi.mocked(s3Service.getObject).mockResolvedValue({
        buffer: Buffer.from('# Hello Shumai\nThis is markdown text.'),
        contentType: 'text/markdown',
      } as unknown as { buffer: Buffer; contentType: string })

      const tool = createReadAssetTool('user-1')
      const result = await tool.execute('call-1', {
        assetId: 'doc-md',
        annotationId: null,
        imageConfig: null,
        videoConfig: null,
        docConfig: { mode: 'text', startPage: null, endPage: null },
      })

      expect(s3Service.getObject).toHaveBeenCalledWith('shumai', 'raw/README.md')
      expect(result.content[0].type).toBe('text')
      expect((result.content[0] as { type: 'text'; text: string }).text).toContain(
        '# Hello Shumai\nThis is markdown text.',
      )
      expect(result.details.key).toBe('raw/README.md')
    })
  })

  describe('Version Stack Resolution', () => {
    it('should resolve version_stack to latest version asset', async () => {
      vi.mocked(authzService.hasPermission).mockResolvedValue()
      vi.mocked(prisma.asset.findUnique).mockResolvedValue({
        id: 'stack-1',
        name: '',
        type: 'version_stack',
      } as unknown as Asset)

      vi.mocked(prisma.asset.findFirst).mockResolvedValue({
        id: 'file-v2',
        name: 'diagram_v2.png',
        type: 'file',
        mediaType: 'image/png',
        storageKey: { key: 'raw/diagram_v2.png' },
        media: {
          proxyType: 'image',
          imageTranscodes: [{ key: 'proxy/diagram_v2.webp' }],
        },
      } as unknown as Asset)

      vi.mocked(s3Service.getObject).mockResolvedValue({
        buffer: Buffer.from('v2-image-bytes'),
        contentType: 'image/webp',
      } as unknown as { buffer: Buffer; contentType: string })

      const tool = createReadAssetTool('user-1')
      const result = await tool.execute('call-1', {
        assetId: 'stack-1',
        annotationId: null,
        imageConfig: null,
        videoConfig: null,
        docConfig: null,
      })

      expect(prisma.asset.findFirst).toHaveBeenCalledWith({
        where: { parentId: 'stack-1', isDeleted: false },
        orderBy: { sortIndex: 'asc' },
        include: { storageKey: true },
      })
      expect(result.details.name).toBe('diagram_v2.png')
      expect(result.details.key).toBe('proxy/diagram_v2.webp')
    })
  })

  describe('s3KeyOnly mode', () => {
    it('returns only S3 key and MIME in text for image assets without fetching S3 buffer or attaching base64 image', async () => {
      vi.mocked(authzService.hasPermission).mockResolvedValue()
      vi.mocked(prisma.asset.findUnique).mockResolvedValue({
        id: 'img-1',
        name: 'photo.png',
        mediaType: 'image/png',
        storageKey: { key: 'raw/photo.png' },
        media: {
          proxyType: 'image',
          imageTranscodes: [{ key: 'proxy/photo.webp' }],
        },
      } as unknown as Asset)

      const tool = createReadAssetTool('user-1')
      const result = await tool.execute('call-1', {
        assetId: 'img-1',
        annotationId: null,
        s3KeyOnly: true,
        imageConfig: null,
        videoConfig: null,
        docConfig: null,
      })

      expect(s3Service.getObject).not.toHaveBeenCalled()
      expect(result.content.length).toBe(1)
      expect(result.content[0].type).toBe('text')
      expect((result.content[0] as { type: 'text'; text: string }).text).toBe(
        'Image asset "photo.png" (ID: img-1, MIME: image/webp, S3 Key: "proxy/photo.webp")',
      )
      expect(result.details.key).toBe('proxy/photo.webp')
    })

    it('returns only frame S3 keys and MIME in text for video assets without fetching S3 buffers or attaching base64 images', async () => {
      vi.mocked(authzService.hasPermission).mockResolvedValue()
      vi.mocked(prisma.asset.findUnique).mockResolvedValue({
        id: 'vid-1',
        name: 'clip.mp4',
        mediaType: 'video/mp4',
        projectId: 'project-1',
        media: { proxyType: 'video' },
      } as unknown as Asset)

      vi.mocked(prisma.workflowTask.create).mockResolvedValue({
        id: 'task-shot',
      } as unknown as WorkflowTask)
      vi.mocked(workflowService.executeWait).mockResolvedValue({
        id: 'task-shot',
        output: {
          screenshots: [{ key: 'screenshots/shot1.webp', timestamp: 1.5 }],
        },
      } as unknown as WorkflowTask)

      const tool = createReadAssetTool('user-1')
      const result = await tool.execute('call-1', {
        assetId: 'vid-1',
        annotationId: null,
        s3KeyOnly: true,
        imageConfig: null,
        videoConfig: { start: 1.5, end: 1.5, count: 1 },
        docConfig: null,
      })

      expect(s3Service.getObject).not.toHaveBeenCalled()
      expect(result.content.length).toBe(1)
      expect(result.content[0].type).toBe('text')
      const text = (result.content[0] as { type: 'text'; text: string }).text
      expect(text).toContain('- Frame at 1.5s (S3 Key: "screenshots/shot1.webp", MIME: image/webp)')
      expect(result.details.keys).toEqual(['screenshots/shot1.webp'])
    })

    it('returns only document S3 key and MIME in text for text mode without fetching S3 buffer', async () => {
      vi.mocked(authzService.hasPermission).mockResolvedValue()
      vi.mocked(prisma.asset.findUnique).mockResolvedValue({
        id: 'doc-md',
        name: 'notes.md',
        mediaType: 'text/markdown',
        storageKey: { key: 'raw/notes.md' },
        media: { proxyType: 'pdf' },
      } as unknown as Asset)

      const tool = createReadAssetTool('user-1')
      const result = await tool.execute('call-1', {
        assetId: 'doc-md',
        annotationId: null,
        s3KeyOnly: true,
        imageConfig: null,
        videoConfig: null,
        docConfig: { mode: 'text', startPage: null, endPage: null },
      })

      expect(s3Service.getObject).not.toHaveBeenCalled()
      expect(result.content.length).toBe(1)
      expect(result.content[0].type).toBe('text')
      expect((result.content[0] as { type: 'text'; text: string }).text).toBe(
        'Document "notes.md" (ID: doc-md, MIME: text/markdown, S3 Key: "raw/notes.md")',
      )
    })
  })
})
