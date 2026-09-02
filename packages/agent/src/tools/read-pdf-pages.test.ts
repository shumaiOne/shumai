import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createReadPdfPagesTool } from './read-pdf-pages'
import {
  prisma,
  WorkflowTaskStatus,
  type Asset,
  type AssetComment,
  type AgentSessionEntry,
  type User,
  type WorkflowTask,
} from '@shumai/db'
import { s3Service } from '@shumai/core/src/s3/s3'
import { workflowService } from '@shumai/workflow-core'
import { authzService } from '@shumai/core/src/authz/authz'

vi.mock('@shumai/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shumai/db')>()
  return {
    ...actual,
    prisma: {
      user: {
        findUnique: vi.fn(),
      },
      asset: {
        findUnique: vi.fn(),
      },
      assetComment: {
        findUnique: vi.fn(),
      },
      agentSessionEntry: {
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

vi.mock('@shumai/core/src/authz/authz', () => ({
  authzService: {
    hasPermission: vi.fn(),
  },
  Permission: { Read: 'Read' },
  ResourceType: { Asset: 'asset' },
}))

describe('readPdfPagesTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(authzService.hasPermission).mockResolvedValue()
  })

  it('should trigger pdfPages transcode workflow and return image outputs with annotation from AssetComment', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-1' } as User)

    vi.mocked(prisma.asset.findUnique).mockResolvedValue({
      id: 'asset-1',
      projectId: 'project-1',
      media: { proxyType: 'pdf' },
    } as unknown as Asset)

    vi.mocked(prisma.assetComment.findUnique).mockResolvedValue({
      id: 'comment-1',
      assetId: 'asset-1',
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

    const tool = createReadPdfPagesTool('user-1')
    const result = await tool.execute('call-1', {
      assetId: 'asset-1',
      start: 1,
      end: 2,
      annotationId: 'comment-1',
    })

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: { id: 'user-1' },
      permission: 'Read',
      type: 'asset',
      id: 'asset-1',
    })

    expect(prisma.workflowTask.create).toHaveBeenCalledWith({
      data: {
        assetId: 'asset-1',
        projectId: 'project-1',
        type: 'transcode_pdf_pages',
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

  it('should trigger pdfPages transcode workflow with annotations from AgentSessionEntry (1-on-1 chat mode)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-1' } as User)

    vi.mocked(prisma.asset.findUnique).mockResolvedValue({
      id: 'asset-1',
      projectId: 'project-1',
      media: { proxyType: 'pdf' },
    } as unknown as Asset)

    vi.mocked(prisma.assetComment.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.agentSessionEntry.findUnique).mockResolvedValue({
      id: 'entry-1',
      data: {
        details: {
          position: { type: 'page', page: 3 },
          annotations: [{ type: 'highlight', page: 3 }],
        },
      },
    } as unknown as AgentSessionEntry)

    vi.mocked(prisma.workflowTask.create).mockResolvedValue({
      id: 'task-1',
    } as unknown as WorkflowTask)

    vi.mocked(workflowService.executeWait).mockResolvedValue({
      id: 'task-1',
      status: WorkflowTaskStatus.completed,
      output: {
        pages: [{ key: 'pdf_pages/page_3.webp', page: 3 }],
      },
    } as unknown as WorkflowTask)

    vi.mocked(s3Service.getObject).mockImplementation(async (_bucket: string, key: string) => {
      return {
        buffer: Buffer.from(`fake-bytes-for-${key}`),
        contentType: 'image/webp',
      } as unknown as { buffer: Buffer; contentType: string }
    })

    const tool = createReadPdfPagesTool('user-1')
    await tool.execute('call-2', {
      assetId: 'asset-1',
      start: 1,
      end: 3,
      annotationId: 'entry-1',
    })

    expect(prisma.workflowTask.create).toHaveBeenCalledWith({
      data: {
        assetId: 'asset-1',
        projectId: 'project-1',
        type: 'transcode_pdf_pages',
        status: 'pending',
        payload: {
          projectId: 'project-1',
          pdfPages: {
            start: 1,
            end: 3,
            commentTimestamp: null,
            annotations: [{ type: 'highlight', page: 3 }],
          },
        },
      },
    })
  })

  it('should throw error if start page is less than 1', async () => {
    const tool = createReadPdfPagesTool('user-1')
    await expect(tool.execute('call-1', { assetId: 'asset-1', start: 0, end: 5 })).rejects.toThrow(
      'Invalid page range: start page (0) must be at least 1.',
    )
  })

  it('should throw error if start page is greater than end page', async () => {
    const tool = createReadPdfPagesTool('user-1')
    await expect(tool.execute('call-1', { assetId: 'asset-1', start: 6, end: 5 })).rejects.toThrow(
      'Invalid page range: start page (6) must be less than or equal to end page (5).',
    )
  })

  it('should throw error if requested page range exceeds maximum limit of 20', async () => {
    const tool = createReadPdfPagesTool('user-1')
    await expect(tool.execute('call-1', { assetId: 'asset-1', start: 1, end: 22 })).rejects.toThrow(
      'Page range (22 pages requested) exceeds the maximum limit of 20 pages per request.',
    )
  })

  it('should throw error if asset is not found', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-1' } as User)
    vi.mocked(prisma.asset.findUnique).mockResolvedValue(null)

    const tool = createReadPdfPagesTool('user-1')
    await expect(
      tool.execute('call-1', { assetId: 'non-existent', start: 1, end: 2 }),
    ).rejects.toThrow('Asset with ID non-existent not found.')
  })

  it('should throw error if asset is not a PDF proxyType', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-1' } as User)
    vi.mocked(prisma.asset.findUnique).mockResolvedValue({
      id: 'asset-video',
      media: { proxyType: 'video' },
    } as unknown as Asset)

    const tool = createReadPdfPagesTool('user-1')
    await expect(
      tool.execute('call-1', { assetId: 'asset-video', start: 1, end: 2 }),
    ).rejects.toThrow('Asset asset-video is not a PDF or document.')
  })
})
