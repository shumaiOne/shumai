import { describe, it, expect, vi, beforeEach } from 'vitest'
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
import { resolveAnnotationsById } from '@shumai/core/src/asset-read/annotations'
import { getOperation } from '@shumai/core/src/operations'
import { degreeToSecond } from '@shumai/core/src/utils/model3d'
import { toAgentTool } from '../operation-tools'
import { createAutofillReadAssetTool } from './read-asset'

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
        findUnique: vi.fn(),
      },
    },
  }
})

vi.mock('@shumai/core/src/s3/s3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shumai/core/src/s3/s3')>()
  return {
    ...actual,
    s3Service: {
      getObject: vi.fn(),
      presign: vi.fn().mockResolvedValue('https://mock-presigned-url.com'),
    },
  }
})

vi.mock('@shumai/workflow-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shumai/workflow-core')>()
  return {
    ...actual,
    workflowService: {
      waitFor: vi.fn(),
    },
  }
})

vi.mock('@shumai/core/src/authz/authz', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shumai/core/src/authz/authz')>()
  return {
    ...actual,
    authzService: {
      hasPermission: vi.fn(),
    },
  }
})

vi.mock('@shumai/core/src/asset-read/annotations', () => ({
  resolveAnnotationsById: vi.fn(),
}))

type TextBlock = { type: 'text'; text: string }
type ImageBlock = { type: 'image'; data: string; mimeType: string }

/** The agent's read_asset tool, as the chat agent gets it from the Operation registry. */
function readAssetTool(userId = 'user-1') {
  return toAgentTool(getOperation('read_asset')!, { userId })
}

function getAssetRenderTool(userId = 'user-1') {
  return toAgentTool(getOperation('get_asset_render')!, { userId })
}

// The harness passes untyped tool details; tests look at the read_asset details shape.
type Details = {
  assetId: string
  name: string
  key?: string
  keys: string[]
  sourceKeys: string[]
  status?: string
  taskId?: string
  isTruncated?: boolean
}
function details(result: { details: unknown }): Details {
  return result.details as Details
}

function textOf(result: { content: unknown[] }): string {
  return (result.content[0] as TextBlock).text
}

function mockAsset(asset: Record<string, unknown>) {
  vi.mocked(prisma.asset.findUnique).mockResolvedValue(asset as unknown as Asset)
}

function mockTaskCreated(id: string) {
  // Echo the created row back (with an ID) so the pipeline sees the payload it wrote.
  vi.mocked(prisma.workflowTask.create).mockImplementation(((args: {
    data: Record<string, unknown>
  }) =>
    Promise.resolve({
      id,
      ...args.data,
    } as unknown as WorkflowTask)) as unknown as typeof prisma.workflowTask.create)
}

function mockTaskFinished(id: string, output: Record<string, unknown>) {
  vi.mocked(workflowService.waitFor).mockResolvedValue({
    task: { id, status: WorkflowTaskStatus.completed, output } as unknown as WorkflowTask,
    done: true,
  })
}

function mockObjects() {
  vi.mocked(s3Service.getObject).mockImplementation(async (_bucket, key) => ({
    buffer: Buffer.from(`bytes-for-${key}`),
    contentType: 'image/webp',
  }))
}

const imageAsset = {
  id: 'img-1',
  name: 'photo.png',
  mediaType: 'image/png',
  projectId: 'project-1',
  storageKey: { key: 'raw/photo.png' },
  media: {
    proxyType: 'image',
    imageTranscodes: [{ key: 'proxy/photo.webp' }],
  },
}

const modelAsset = {
  id: 'model-1',
  name: 'robot.glb',
  mediaType: 'model/gltf-binary',
  projectId: 'proj-1',
  storageKey: { key: 'raw/robot.glb' },
  media: {
    proxyType: '3d',
    videoTranscodes: [{ key: 'proxy/turntable.mp4' }],
    imageTranscodes: [{ key: 'proxy/views.webp' }],
  },
}

const videoAsset = {
  id: 'vid-1',
  name: 'video.mp4',
  mediaType: 'video/mp4',
  projectId: 'project-1',
  media: { proxyType: 'video' },
}

const pdfAsset = {
  id: 'doc-1',
  name: 'doc.pdf',
  mediaType: 'application/pdf',
  projectId: 'project-1',
  media: { proxyType: 'pdf' },
}

const markdownAsset = {
  id: 'doc-md',
  name: 'README.md',
  mediaType: 'text/markdown',
  storageKey: { key: 'raw/README.md' },
  media: { proxyType: 'pdf' },
}

const arrow = [
  {
    type: 'arrow',
    color: '#ff0000',
    points: [
      [0, 0],
      [10, 10],
    ],
  },
] as unknown as PrismaJson.AnnotationList

describe('read_asset agent tool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(authzService.hasPermission).mockResolvedValue()
    vi.mocked(resolveAnnotationsById).mockResolvedValue({ annotations: null, timestamp: null })
  })

  it('exposes the agent-only s3KeyOnly parameter alongside the Operation input', () => {
    const tool = readAssetTool()
    const properties = (tool.parameters as { properties: Record<string, unknown> }).properties
    expect(Object.keys(properties)).toEqual(
      expect.arrayContaining([
        'assetId',
        'annotationId',
        'config3d',
        'imageConfig',
        'videoConfig',
        'docConfig',
        'maxWaitSeconds',
        's3KeyOnly',
      ]),
    )
  })

  it('throws an authorization error if the user ID is empty', async () => {
    await expect(readAssetTool('').execute('call-1', { assetId: 'asset-1' })).rejects.toThrow(
      'User ID is required for authorization.',
    )
  })

  it('throws if the asset is not found', async () => {
    vi.mocked(prisma.asset.findUnique).mockResolvedValue(null)
    await expect(
      readAssetTool().execute('call-1', {
        assetId: 'asset-1',
        annotationId: null,
        imageConfig: null,
        videoConfig: null,
        docConfig: null,
      }),
    ).rejects.toThrow('Asset with ID asset-1 not found.')
  })

  it('does not plan or render anything when Read is denied', async () => {
    vi.mocked(authzService.hasPermission).mockRejectedValue(new Error('Forbidden'))
    await expect(
      readAssetTool().execute('call-1', {
        assetId: 'vid-1',
        videoConfig: { start: 0, end: 1, count: 1 },
      }),
    ).rejects.toThrow('Forbidden')
    expect(prisma.asset.findUnique).not.toHaveBeenCalled()
    expect(prisma.workflowTask.create).not.toHaveBeenCalled()
  })

  it('rejects unsupported asset types', async () => {
    mockAsset({ id: 'zip-1', name: 'bundle.zip', mediaType: 'application/zip', media: null })
    await expect(readAssetTool().execute('call-1', { assetId: 'zip-1' })).rejects.toThrow(
      'Unsupported asset type for read_asset. Asset zip-1 has media type "application/zip".',
    )
  })

  describe('Image Assets', () => {
    it('reads the image proxy and returns an image block and S3 key', async () => {
      mockAsset(imageAsset)
      mockObjects()

      const result = await readAssetTool().execute('call-1', {
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

      expect(textOf(result)).toBe(
        'Image asset "photo.png" (ID: img-1):\n- Image (S3 Key: "proxy/photo.webp", MIME: image/webp)',
      )
      const image = result.content[1] as ImageBlock
      expect(image.type).toBe('image')
      expect(image.data).toBe(Buffer.from('bytes-for-proxy/photo.webp').toString('base64'))
      expect(image.mimeType).toBe('image/webp')
      expect(details(result)).toMatchObject({
        assetId: 'img-1',
        name: 'photo.png',
        key: 'proxy/photo.webp',
        keys: ['proxy/photo.webp'],
        sourceKeys: ['proxy/photo.webp'],
      })
    })

    it('ignores an empty imageConfig', async () => {
      mockAsset(imageAsset)
      mockObjects()
      const result = await readAssetTool().execute('call-1', { assetId: 'img-1', imageConfig: {} })
      expect(details(result).key).toBe('proxy/photo.webp')
    })

    it('rejects a config meant for another asset type', async () => {
      mockAsset(imageAsset)
      await expect(
        readAssetTool().execute('call-1', {
          assetId: 'img-1',
          docConfig: { mode: 'pages', startPage: 1, endPage: 1 },
        }),
      ).rejects.toThrow(
        "Asset img-1 is a image. Pass 'imageConfig: {}' or no config; do not pass docConfig.",
      )
    })

    it('renders the annotation overlay in a workflow task when annotationId is provided', async () => {
      mockAsset(imageAsset)
      vi.mocked(resolveAnnotationsById).mockResolvedValue({ annotations: arrow, timestamp: null })
      mockTaskCreated('task-anno')
      mockTaskFinished('task-anno', { key: 'annotated/photo.webp' })
      mockObjects()

      const result = await readAssetTool().execute('call-1', {
        assetId: 'img-1',
        annotationId: 'comment-1',
      })

      expect(resolveAnnotationsById).toHaveBeenCalledWith('img-1', 'comment-1')
      expect(prisma.workflowTask.create).toHaveBeenCalledWith({
        data: {
          assetId: 'img-1',
          projectId: 'project-1',
          type: WorkflowTaskType.transcode_image_annotation,
          status: WorkflowTaskStatus.pending,
          payload: {
            projectId: 'project-1',
            imageAnnotation: { annotations: arrow },
            assetRead: {
              reader: 'image',
              annotationId: 'comment-1',
              requestedBy: 'user-1',
            },
          },
        },
      })
      expect(s3Service.getObject).toHaveBeenCalledWith('shumai', 'annotated/photo.webp')
      expect(textOf(result)).toBe(
        'Image asset "photo.png" (ID: img-1) with visual markups overlaid:\n- Image with markups (S3 Key: "annotated/photo.webp", MIME: image/webp)',
      )
      expect(details(result).key).toBe('annotated/photo.webp')
    })
  })

  describe('3D Assets', () => {
    it('returns the 4-view composite with the quadrant legend', async () => {
      mockAsset(modelAsset)
      mockObjects()

      const result = await readAssetTool().execute('call-3d', { assetId: 'model-1' })

      expect(s3Service.getObject).toHaveBeenCalledWith('shumai', 'proxy/views.webp')
      const text = textOf(result)
      expect(text).toContain('3D asset "robot.glb" (ID: model-1):')
      expect(text).toContain('Orthogonal 4-view composite image')
      expect(text).toContain('Top-Left quadrant: Front view (0°)')
      expect(text).toContain('Top-Right quadrant: Right side view (90°)')
      expect(text).toContain('Bottom-Left quadrant: Back view (180°)')
      expect(text).toContain('Bottom-Right quadrant: Left side view (270°)')
      expect(text).toContain('- 4-view composite (S3 Key: "proxy/views.webp", MIME: image/webp)')
      expect((result.content[1] as ImageBlock).data).toBe(
        Buffer.from('bytes-for-proxy/views.webp').toString('base64'),
      )
      expect(details(result).key).toBe('proxy/views.webp')
    })

    it('supports s3KeyOnly for 3D assets', async () => {
      mockAsset(modelAsset)
      const result = await readAssetTool().execute('call-3d-s3', {
        assetId: 'model-1',
        s3KeyOnly: true,
      })
      expect(s3Service.getObject).not.toHaveBeenCalled()
      expect(result.content).toHaveLength(1)
      expect(textOf(result)).toContain('proxy/views.webp')
      expect(textOf(result)).toContain('Front view (0°)')
      expect(details(result).key).toBe('proxy/views.webp')
    })

    it('rejects videoConfig for 3D assets', async () => {
      mockAsset(modelAsset)
      await expect(
        readAssetTool().execute('call-3d-err', {
          assetId: 'model-1',
          videoConfig: { start: 0, end: 4, count: 4 },
        }),
      ).rejects.toThrow(
        "To inspect specific angles pass 'config3d: { degree: ... }'; do not pass videoConfig",
      )
    })

    it('throws if the 4-views image is missing when the overview is requested', async () => {
      mockAsset({ ...modelAsset, media: { proxyType: '3d', imageTranscodes: [] } })
      await expect(readAssetTool().execute('call-3d-err2', { assetId: 'model-1' })).rejects.toThrow(
        '4-views image (views.webp) is missing',
      )
    })

    it('renders a turntable frame when config3d.degree is provided', async () => {
      mockAsset(modelAsset)
      mockTaskCreated('task-shot-3d')
      mockTaskFinished('task-shot-3d', {
        screenshots: [{ key: 'proxy/shot-45.webp', timestamp: 0.5833 }],
      })
      mockObjects()

      const result = await readAssetTool().execute('call-3d-degree', {
        assetId: 'model-1',
        config3d: { degree: 45 },
      })

      const second = degreeToSecond(45)
      expect(prisma.workflowTask.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: WorkflowTaskType.transcode_screenshot,
          assetId: 'model-1',
          payload: {
            projectId: 'proj-1',
            screenshot: {
              start: second,
              end: second,
              count: 1,
              commentTimestamp: second,
              annotations: undefined,
            },
            assetRead: {
              reader: 'model3d',
              options: { degree: 45 },
              context: { degree: 45, hasMarkup: false },
              requestedBy: 'user-1',
            },
          },
        }),
      })
      expect(textOf(result)).toBe(
        '3D asset "robot.glb" (ID: model-1) view at 45°:\n- View at 45° (S3 Key: "proxy/shot-45.webp", MIME: image/webp)',
      )
      expect((result.content[1] as ImageBlock).data).toBe(
        Buffer.from('bytes-for-proxy/shot-45.webp').toString('base64'),
      )
      expect(details(result).key).toBe('proxy/shot-45.webp')
    })

    it('rejects degrees that are not a multiple of 15 or out of range', async () => {
      mockAsset(modelAsset)
      const tool = readAssetTool()
      await expect(
        tool.execute('call-1', { assetId: 'model-1', config3d: { degree: 40 } }),
      ).rejects.toThrow('Invalid turntable degree: 40')
      await expect(
        tool.execute('call-2', { assetId: 'model-1', config3d: { degree: 360 } }),
      ).rejects.toThrow('Invalid turntable degree: 360')
      expect(resolveAnnotationsById).not.toHaveBeenCalled()
    })

    it('renders the frame with markups at the annotation angle', async () => {
      mockAsset(modelAsset)
      vi.mocked(resolveAnnotationsById).mockResolvedValue({ annotations: arrow, timestamp: 0.5 })
      mockTaskCreated('task-shot-ann')
      mockTaskFinished('task-shot-ann', {
        screenshots: [{ key: 'proxy/shot-annotated.webp', timestamp: 0.5 }],
      })
      mockObjects()

      const result = await readAssetTool().execute('call-3d-ann', {
        assetId: 'model-1',
        annotationId: 'comm-1',
        config3d: null,
      })

      expect(prisma.workflowTask.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: WorkflowTaskType.transcode_screenshot,
          payload: expect.objectContaining({
            screenshot: {
              start: 0.5,
              end: 0.5,
              count: 1,
              commentTimestamp: 0.5,
              annotations: arrow,
            },
          }),
        }),
      })
      expect(textOf(result)).toContain('view at 45° with visual markups overlaid:')
      expect(details(result).key).toBe('proxy/shot-annotated.webp')
    })

    it('renders session annotations at their resolved degree', async () => {
      mockAsset(modelAsset)
      const expectedTime = degreeToSecond(90)
      vi.mocked(resolveAnnotationsById).mockResolvedValue({
        annotations: arrow,
        timestamp: expectedTime,
      })
      mockTaskCreated('task-shot-3d-session')
      mockTaskFinished('task-shot-3d-session', {
        screenshots: [{ key: 'proxy/shot-annotated-90.webp', timestamp: expectedTime }],
      })
      mockObjects()

      const result = await readAssetTool().execute('call-3d-session-ann', {
        assetId: 'model-1',
        annotationId: 'session-entry-1',
      })

      expect(prisma.workflowTask.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          payload: expect.objectContaining({
            screenshot: expect.objectContaining({
              start: expectedTime,
              end: expectedTime,
              commentTimestamp: expectedTime,
            }),
          }),
        }),
      })
      expect(textOf(result)).toContain('view at 90° with visual markups overlaid:')
      expect(details(result).key).toBe('proxy/shot-annotated-90.webp')
    })

    it('rejects a degree that conflicts with the annotation angle', async () => {
      mockAsset(modelAsset)
      vi.mocked(resolveAnnotationsById).mockResolvedValue({ annotations: arrow, timestamp: 0.5 })
      await expect(
        readAssetTool().execute('call-3d-conflict', {
          assetId: 'model-1',
          annotationId: 'comm-1',
          config3d: { degree: 90 },
        }),
      ).rejects.toThrow(
        'Annotation "comm-1" was drawn at 45°, but degree 90° was specified. Do not pass a conflicting degree with annotationId.',
      )
      expect(prisma.workflowTask.create).not.toHaveBeenCalled()
    })

    it('throws if the turntable video is missing when an angle is requested', async () => {
      mockAsset({ ...modelAsset, media: { proxyType: '3d', videoTranscodes: [] } })
      await expect(
        readAssetTool().execute('call-1', { assetId: 'model-1', config3d: { degree: 45 } }),
      ).rejects.toThrow('turntable video (turntable.mp4) is missing')
    })
  })

  describe('Video Assets', () => {
    it('requires videoConfig', async () => {
      mockAsset(videoAsset)
      await expect(readAssetTool().execute('call-1', { assetId: 'vid-1' })).rejects.toThrow(
        'videoConfig with start, end, and count is required',
      )
    })

    it('rejects an invalid time range', async () => {
      mockAsset(videoAsset)
      await expect(
        readAssetTool().execute('call-1', {
          assetId: 'vid-1',
          videoConfig: { start: 10, end: 5, count: 1 },
        }),
      ).rejects.toThrow(
        'Invalid video time range: start (10) must be less than or equal to end (5).',
      )
    })

    it('rejects more than 20 frames', async () => {
      mockAsset(videoAsset)
      await expect(
        readAssetTool().execute('call-1', {
          assetId: 'vid-1',
          videoConfig: { start: 0, end: 60, count: 21 },
        }),
      ).rejects.toThrow('exceeds the maximum of 20 frames per request')
    })

    it('extracts frames and returns image blocks and keys', async () => {
      mockAsset(videoAsset)
      mockTaskCreated('task-shot')
      mockTaskFinished('task-shot', {
        screenshots: [
          { key: 'screenshots/shot1.webp', timestamp: 2.0 },
          { key: 'screenshots/shot2.webp', timestamp: 4.0 },
        ],
      })
      mockObjects()

      const result = await readAssetTool().execute('call-1', {
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
            assetRead: {
              reader: 'video',
              options: { start: 2.0, end: 4.0, count: 2 },
              requestedBy: 'user-1',
            },
          },
        },
      })
      expect(workflowService.waitFor).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'task-shot' }),
        60_000,
      )
      expect(result.content.length).toBe(3) // 1 text + 2 images
      expect(textOf(result)).toBe(
        [
          'Extracted 2 frame(s) from "video.mp4" (2s - 4s):',
          '- Frame at 2s (S3 Key: "screenshots/shot1.webp", MIME: image/webp)',
          '- Frame at 4s (S3 Key: "screenshots/shot2.webp", MIME: image/webp)',
        ].join('\n'),
      )
      expect(details(result).keys).toEqual(['screenshots/shot1.webp', 'screenshots/shot2.webp'])
    })

    it('returns pending with the task ID when rendering outlasts the wait budget', async () => {
      mockAsset(videoAsset)
      mockTaskCreated('task-slow')
      vi.mocked(workflowService.waitFor).mockImplementation(async (task) => ({
        task,
        done: false,
      }))

      const result = await readAssetTool().execute('call-1', {
        assetId: 'vid-1',
        videoConfig: { start: 0, end: 10, count: 5 },
        maxWaitSeconds: 0,
      })

      expect(workflowService.waitFor).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'task-slow' }),
        0,
      )
      expect(result.content).toHaveLength(1)
      expect(textOf(result)).toBe(
        'Rendering is still in progress for "video.mp4". Call get_asset_render with taskId "task-slow" in about 5 seconds to get the result.',
      )
      expect(details(result)).toEqual({ taskId: 'task-slow', status: 'pending' })
    })

    it('never waits longer than the agent budget', async () => {
      mockAsset(videoAsset)
      mockTaskCreated('task-shot')
      mockTaskFinished('task-shot', { screenshots: [{ key: 's/1.webp', timestamp: 0 }] })
      mockObjects()

      await readAssetTool().execute('call-1', {
        assetId: 'vid-1',
        videoConfig: { start: 0, end: 0, count: 1 },
        maxWaitSeconds: 600,
      })
      expect(workflowService.waitFor).toHaveBeenCalledWith(expect.anything(), 60_000)
    })
  })

  describe('Document Assets', () => {
    it('requires docConfig', async () => {
      mockAsset(pdfAsset)
      await expect(readAssetTool().execute('call-1', { assetId: 'doc-1' })).rejects.toThrow(
        'docConfig with mode ("pages" or "text") is required',
      )
    })

    it('renders PDF pages in mode "pages"', async () => {
      mockAsset(pdfAsset)
      mockTaskCreated('task-pdf')
      mockTaskFinished('task-pdf', {
        pages: [
          { key: 'pdf_pages/page1.webp', page: 1 },
          { key: 'pdf_pages/page2.webp', page: 2 },
        ],
      })
      mockObjects()

      const result = await readAssetTool().execute('call-1', {
        assetId: 'doc-1',
        docConfig: { mode: 'pages', startPage: 1, endPage: 2 },
      })

      expect(prisma.workflowTask.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: WorkflowTaskType.transcode_pdf_pages,
          payload: expect.objectContaining({
            pdfPages: { start: 1, end: 2, commentTimestamp: null, annotations: null },
          }),
        }),
      })
      expect(result.content.length).toBe(3) // 1 text + 2 images
      expect(textOf(result)).toBe(
        [
          'Rendered 2 page(s) of "doc.pdf" (Pages 1 to 2):',
          '- Page 1 (S3 Key: "pdf_pages/page1.webp", MIME: image/webp)',
          '- Page 2 (S3 Key: "pdf_pages/page2.webp", MIME: image/webp)',
        ].join('\n'),
      )
      expect(details(result).keys).toEqual(['pdf_pages/page1.webp', 'pdf_pages/page2.webp'])
    })

    it('rejects page ranges over 20 pages', async () => {
      mockAsset(pdfAsset)
      await expect(
        readAssetTool().execute('call-1', {
          assetId: 'doc-1',
          docConfig: { mode: 'pages', startPage: 1, endPage: 25 },
        }),
      ).rejects.toThrow('exceeds the maximum limit of 20 pages')
    })

    it('rejects mode "text" on a binary PDF', async () => {
      mockAsset({ ...pdfAsset, name: 'manual.pdf' })
      await expect(
        readAssetTool().execute('call-1', {
          assetId: 'doc-1',
          docConfig: { mode: 'text', startPage: null, endPage: null },
        }),
      ).rejects.toThrow('is a binary PDF/document and cannot be read as raw text')
    })

    it('rejects mode "text" with annotationId', async () => {
      mockAsset(markdownAsset)
      await expect(
        readAssetTool().execute('call-1', {
          assetId: 'doc-md',
          annotationId: 'comment-123',
          docConfig: { mode: 'text', startPage: null, endPage: null },
        }),
      ).rejects.toThrow('annotationId cannot be used with docConfig mode "text"')
      expect(resolveAnnotationsById).not.toHaveBeenCalled()
    })

    it('rejects page numbers in mode "text"', async () => {
      mockAsset(markdownAsset)
      await expect(
        readAssetTool().execute('call-1', {
          assetId: 'doc-md',
          docConfig: { mode: 'text', startPage: 1, endPage: 2 },
        }),
      ).rejects.toThrow('startPage and endPage must be null when docConfig mode is "text"')
    })

    it('reads raw text in mode "text"', async () => {
      mockAsset(markdownAsset)
      vi.mocked(s3Service.getObject).mockResolvedValue({
        buffer: Buffer.from('# Hello Shumai\nThis is markdown text.'),
        contentType: 'text/markdown',
      })

      const result = await readAssetTool().execute('call-1', {
        assetId: 'doc-md',
        docConfig: { mode: 'text', startPage: null, endPage: null },
      })

      expect(s3Service.getObject).toHaveBeenCalledWith('shumai', 'raw/README.md')
      expect(result.content).toHaveLength(1)
      expect(textOf(result)).toBe(
        [
          'Document "README.md" (ID: doc-md):',
          '- Source file (S3 Key: "raw/README.md", MIME: text/markdown)',
          '',
          '# Hello Shumai\nThis is markdown text.',
        ].join('\n'),
      )
      expect(details(result)).toMatchObject({
        key: 'raw/README.md',
        keys: [],
        sourceKeys: ['raw/README.md'],
        isTruncated: false,
      })
    })

    it('truncates long text and tells the agent how to get the rest', async () => {
      mockAsset(markdownAsset)
      const lines = Array.from({ length: 1500 }, (_, i) => `line ${i + 1}`).join('\n')
      vi.mocked(s3Service.getObject).mockResolvedValue({
        buffer: Buffer.from(lines),
        contentType: 'text/markdown',
      })

      const result = await readAssetTool().execute('call-1', {
        assetId: 'doc-md',
        docConfig: { mode: 'text' },
      })

      const text = textOf(result)
      expect(text).toContain('line 1000')
      expect(text).not.toContain('line 1001')
      expect(text).toMatch(
        /\[Content truncated to 1000 lines \/ 50KB limit\. Use download_asset to process the full file\.\]$/,
      )
      expect(details(result).isTruncated).toBe(true)
    })
  })

  describe('Version Stack Resolution', () => {
    it('reads the latest version of a version stack', async () => {
      mockAsset({ id: 'stack-1', name: '', type: 'version_stack' })
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
      mockObjects()

      const result = await readAssetTool().execute('call-1', { assetId: 'stack-1' })

      expect(prisma.asset.findFirst).toHaveBeenCalledWith({
        where: { parentId: 'stack-1', isDeleted: false },
        orderBy: { sortIndex: 'asc' },
        include: { storageKey: true },
      })
      expect(details(result).name).toBe('diagram_v2.png')
      expect(details(result).key).toBe('proxy/diagram_v2.webp')
    })
  })

  describe('s3KeyOnly mode', () => {
    it('returns only the S3 key and MIME for image assets', async () => {
      mockAsset(imageAsset)
      const result = await readAssetTool().execute('call-1', {
        assetId: 'img-1',
        s3KeyOnly: true,
      })

      expect(s3Service.getObject).not.toHaveBeenCalled()
      expect(result.content).toHaveLength(1)
      expect(textOf(result)).toBe(
        'Image asset "photo.png" (ID: img-1):\n- Image (S3 Key: "proxy/photo.webp", MIME: image/webp)',
      )
      expect(details(result).key).toBe('proxy/photo.webp')
    })

    it('returns only frame S3 keys and MIME for video assets', async () => {
      mockAsset({ ...videoAsset, name: 'clip.mp4' })
      mockTaskCreated('task-shot')
      mockTaskFinished('task-shot', {
        screenshots: [{ key: 'screenshots/shot1.webp', timestamp: 1.5 }],
      })

      const result = await readAssetTool().execute('call-1', {
        assetId: 'vid-1',
        s3KeyOnly: true,
        videoConfig: { start: 1.5, end: 1.5, count: 1 },
      })

      expect(s3Service.getObject).not.toHaveBeenCalled()
      expect(result.content).toHaveLength(1)
      expect(textOf(result)).toContain(
        '- Frame at 1.5s (S3 Key: "screenshots/shot1.webp", MIME: image/webp)',
      )
      expect(details(result).keys).toEqual(['screenshots/shot1.webp'])
    })

    it('returns only the document S3 key and MIME without reading the text', async () => {
      mockAsset({ ...markdownAsset, name: 'notes.md', storageKey: { key: 'raw/notes.md' } })
      const result = await readAssetTool().execute('call-1', {
        assetId: 'doc-md',
        s3KeyOnly: true,
        docConfig: { mode: 'text', startPage: null, endPage: null },
      })

      expect(s3Service.getObject).not.toHaveBeenCalled()
      expect(result.content).toHaveLength(1)
      expect(textOf(result)).toBe(
        'Document "notes.md" (ID: doc-md):\n- Source file (S3 Key: "raw/notes.md", MIME: text/markdown)',
      )
    })
  })
})

describe('get_asset_render agent tool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(authzService.hasPermission).mockResolvedValue()
  })

  function mockPendingTask(requestedBy: string) {
    vi.mocked(prisma.workflowTask.findUnique).mockResolvedValue({
      id: 'task-1',
      assetId: 'vid-1',
      status: WorkflowTaskStatus.processing,
      payload: {
        projectId: 'project-1',
        assetRead: { reader: 'video', options: { start: 0, end: 4, count: 2 }, requestedBy },
      },
    } as unknown as WorkflowTask)
    mockAsset(videoAsset)
  }

  it('returns the frames once the render has finished', async () => {
    mockPendingTask('user-1')
    mockTaskFinished('task-1', {
      screenshots: [
        { key: 'screenshots/a.webp', timestamp: 0 },
        { key: 'screenshots/b.webp', timestamp: 4 },
      ],
    })
    mockObjects()

    const result = await getAssetRenderTool().execute('call-1', { taskId: 'task-1' })

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: { id: 'user-1' },
      permission: 'Read',
      type: 'asset',
      id: 'vid-1',
    })
    expect(result.content).toHaveLength(3)
    expect(textOf(result)).toContain('Extracted 2 frame(s) from "video.mp4" (0s - 4s):')
    expect(details(result).keys).toEqual(['screenshots/a.webp', 'screenshots/b.webp'])
  })

  it('returns pending again while the render is still running', async () => {
    mockPendingTask('user-1')
    vi.mocked(workflowService.waitFor).mockImplementation(async (task) => ({ task, done: false }))

    const result = await getAssetRenderTool().execute('call-1', { taskId: 'task-1' })
    expect(textOf(result)).toContain('Call get_asset_render with taskId "task-1"')
    expect(details(result)).toEqual({ taskId: 'task-1', status: 'pending' })
  })

  it('hides renders requested by another user', async () => {
    mockPendingTask('someone-else')
    await expect(getAssetRenderTool().execute('call-1', { taskId: 'task-1' })).rejects.toThrow(
      'Render not found',
    )
    expect(workflowService.waitFor).not.toHaveBeenCalled()
  })

  it('hides renders once the user loses access to the asset', async () => {
    mockPendingTask('user-1')
    vi.mocked(authzService.hasPermission).mockRejectedValue(new Error('Forbidden'))
    await expect(getAssetRenderTool().execute('call-1', { taskId: 'task-1' })).rejects.toThrow(
      'Render not found',
    )
  })

  it('hides workflow tasks that are not asset reads', async () => {
    vi.mocked(prisma.workflowTask.findUnique).mockResolvedValue({
      id: 'task-2',
      assetId: 'vid-1',
      payload: { projectId: 'project-1' },
    } as unknown as WorkflowTask)
    await expect(getAssetRenderTool().execute('call-1', { taskId: 'task-2' })).rejects.toThrow(
      'Render not found',
    )
  })
})

describe('autofill read_asset tool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires targetAssetId', async () => {
    const tool = createAutofillReadAssetTool({ teamId: 'team-1' })
    await expect(tool.execute('call-1', { assetId: 'asset-1' })).rejects.toThrow(
      'Target asset ID is required for autofill agent authorization.',
    )
  })

  it('requires teamId', async () => {
    const tool = createAutofillReadAssetTool({ targetAssetId: 'asset-1' })
    await expect(tool.execute('call-1', { assetId: 'asset-1' })).rejects.toThrow(
      'Team ID is required for autofill agent authorization.',
    )
  })

  it('denies assets from another team', async () => {
    mockAsset({ id: 'asset-1', project: { teamId: 'other-team' } })
    const tool = createAutofillReadAssetTool({ teamId: 'team-1', targetAssetId: 'asset-1' })
    await expect(tool.execute('call-1', { assetId: 'asset-1' })).rejects.toThrow(
      'Access denied: asset asset-1 does not belong to team team-1.',
    )
  })

  it('denies assets other than the target asset', async () => {
    mockAsset({ id: 'other-asset', parentId: null, project: { teamId: 'team-1' } })
    const tool = createAutofillReadAssetTool({
      teamId: 'team-1',
      targetAssetId: 'target-asset-id',
    })
    await expect(tool.execute('call-1', { assetId: 'other-asset' })).rejects.toThrow(
      'Access denied: autofill agent can only read target asset target-asset-id.',
    )
  })

  it('reads the target asset without a user', async () => {
    mockAsset({
      id: 'target-asset-id',
      name: 'test.png',
      mediaType: 'image/png',
      storageKey: { key: 'raw/test.png' },
      media: { proxyType: 'image' },
      project: { teamId: 'team-1' },
    })
    const tool = createAutofillReadAssetTool({
      teamId: 'team-1',
      targetAssetId: 'target-asset-id',
    })

    const result = await tool.execute('call-1', {
      assetId: 'target-asset-id',
      annotationId: null,
      s3KeyOnly: true,
      imageConfig: null,
    })

    expect(authzService.hasPermission).not.toHaveBeenCalled()
    expect(result.content).toHaveLength(1)
    expect(textOf(result)).toBe(
      'Image asset "test.png" (ID: target-asset-id):\n- Image (S3 Key: "raw/test.png", MIME: image/png)',
    )
  })

  it('waits up to two minutes for renders', async () => {
    mockAsset({ ...videoAsset, project: { teamId: 'team-1' } })
    mockTaskCreated('task-shot')
    mockTaskFinished('task-shot', { screenshots: [{ key: 's/1.webp', timestamp: 0 }] })

    const tool = createAutofillReadAssetTool({ teamId: 'team-1', targetAssetId: 'vid-1' })
    await tool.execute('call-1', {
      assetId: 'vid-1',
      s3KeyOnly: true,
      videoConfig: { start: 0, end: 0, count: 1 },
    })
    expect(workflowService.waitFor).toHaveBeenCalledWith(expect.anything(), 120_000)
    expect(prisma.workflowTask.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        payload: expect.objectContaining({
          assetRead: expect.objectContaining({ reader: 'video', requestedBy: undefined }),
        }),
      }),
    })
  })
})
