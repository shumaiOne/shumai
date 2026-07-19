import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createReadPdfPagesTool } from './read-pdf-pages'
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

describe('readPdfPagesTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should trigger pdfPages transcode workflow and return image outputs', async () => {
    vi.mocked(prisma.asset.findUnique).mockResolvedValue({
      id: 'asset-1',
      projectId: 'project-1',
    } as unknown as Asset)

    vi.mocked(prisma.assetComment.findUnique).mockResolvedValue({
      id: 'comment-1',
      second: 2,
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
      output: {
        pages: [
          { key: 'pdf_pages/page_1.webp', page: 1 },
          { key: 'pdf_pages/page_2.webp', page: 2 },
        ],
      },
    } as unknown as WorkflowTask)

    vi.mocked(s3Service.getObject).mockImplementation(async (_bucket: string, key: string) => {
      return {
        buffer: Buffer.from(`fake-bytes-for-${key}`),
        contentType: 'image/webp',
      } as unknown as { buffer: Buffer; contentType: string }
    })

    const tool = createReadPdfPagesTool('asset-1', 'comment-1')
    const result = await tool.execute('call-1', { start: 1, end: 2 })

    expect(prisma.workflowTask.create).toHaveBeenCalledWith({
      data: {
        assetId: 'asset-1',
        projectId: 'project-1',
        type: 'transcode',
        status: 'pending',
        payload: {
          projectId: 'project-1',
          pdfPages: {
            start: 1,
            end: 2,
            commentTimestamp: 2,
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

    expect(result.content.length).toBe(2)
    expect(result.content[0].type).toBe('image')
    expect((result.content[0] as unknown as { data: string }).data).toBe(
      Buffer.from('fake-bytes-for-pdf_pages/page_1.webp').toString('base64'),
    )
    expect(result.details.sourceKeys).toEqual(['pdf_pages/page_1.webp', 'pdf_pages/page_2.webp'])
  })

  it('should return error text if asset not found', async () => {
    vi.mocked(prisma.asset.findUnique).mockResolvedValue(null)

    const tool = createReadPdfPagesTool('asset-1')
    const result = await tool.execute('call-1', { start: 1, end: 3 })

    expect(result.content[0]).toEqual({
      type: 'text',
      text: 'Asset with ID asset-1 not found.',
    })
  })
})
