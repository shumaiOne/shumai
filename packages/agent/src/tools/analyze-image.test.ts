import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAnalyzeImageTool } from './analyze-image'
import {
  prisma,
  WorkflowTaskStatus,
  type Asset,
  type AssetComment,
  type WorkflowTask,
} from '@shumai/db'
import { s3Service } from '@shumai/core/src/s3/s3'
import { workflowService } from '@shumai/workflow-core'

vi.mock('@shumai/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shumai/db')>()
  return {
    ...actual,
    prisma: {
      asset: {
        findUnique: vi.fn(),
      },
      assetComment: {
        findUnique: vi.fn(),
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
  },
}))

vi.mock('@shumai/workflow-core', () => ({
  workflowService: {
    executeWait: vi.fn(),
  },
}))

describe('analyzeImageTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch the image from S3 when comment has no annotations', async () => {
    vi.mocked(prisma.asset.findUnique).mockResolvedValue({
      id: 'asset-1',
      projectId: 'project-1',
      storageKey: { key: 'raw-image.png' },
      media: null,
    } as unknown as Asset)

    vi.mocked(prisma.assetComment.findUnique).mockResolvedValue({
      id: 'comment-1',
      annotation: null,
    } as unknown as AssetComment)

    vi.mocked(s3Service.getObject).mockResolvedValue({
      buffer: Buffer.from('fake-image-bytes'),
      contentType: 'image/png',
    } as unknown as { buffer: Buffer; contentType: string })

    const tool = createAnalyzeImageTool('asset-1', 'comment-1')
    const result = await tool.execute('call-1', {})

    expect(result.content[0].type).toBe('image')
    expect((result.content[0] as unknown as { data: string }).data).toBe(
      Buffer.from('fake-image-bytes').toString('base64'),
    )
    expect(result.details.sourceKeys).toEqual(['raw-image.png'])

    expect(prisma.workflowTask.create).not.toHaveBeenCalled()
  })

  it('should trigger overlay transcode workflow when comment has annotations', async () => {
    vi.mocked(prisma.asset.findUnique).mockResolvedValue({
      id: 'asset-1',
      projectId: 'project-1',
      storageKey: { key: 'raw-image.png' },
      media: {
        imageTranscodes: [{ key: 'transcoded-image.webp' }],
      },
    } as unknown as Asset)

    vi.mocked(prisma.assetComment.findUnique).mockResolvedValue({
      id: 'comment-1',
      annotation: [
        {
          type: 'box',
          color: '#ff0000',
          points: [
            [0, 0],
            [1, 1],
          ],
        },
      ],
    } as unknown as AssetComment)

    vi.mocked(prisma.workflowTask.create).mockResolvedValue({
      id: 'task-1',
    } as unknown as WorkflowTask)

    vi.mocked(workflowService.executeWait).mockResolvedValue({
      id: 'task-1',
      status: WorkflowTaskStatus.completed,
      output: { key: 'annotated-image.webp' },
    } as unknown as WorkflowTask)

    vi.mocked(s3Service.getObject).mockResolvedValue({
      buffer: Buffer.from('fake-annotated-image-bytes'),
      contentType: 'image/webp',
    } as unknown as { buffer: Buffer; contentType: string })

    const tool = createAnalyzeImageTool('asset-1', 'comment-1')
    const result = await tool.execute('call-1', {})

    expect(prisma.workflowTask.create).toHaveBeenCalledWith({
      data: {
        assetId: 'asset-1',
        projectId: 'project-1',
        type: 'transcode_image_annotation',
        status: 'pending',
        payload: {
          projectId: 'project-1',
          imageAnnotation: {
            annotations: [
              {
                type: 'box',
                color: '#ff0000',
                points: [
                  [0, 0],
                  [1, 1],
                ],
              },
            ],
          },
        },
      },
    })

    expect(result.content[0].type).toBe('image')
    expect((result.content[0] as unknown as { data: string }).data).toBe(
      Buffer.from('fake-annotated-image-bytes').toString('base64'),
    )
    expect(result.details.sourceKeys).toEqual(['annotated-image.webp'])
  })
})
