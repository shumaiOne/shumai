import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createScreenshotTool } from './screenshot'
import {
  prisma,
  WorkflowTaskStatus,
  type Asset,
  type AssetComment,
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

describe('screenshotTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should trigger screenshot transcode workflow and return image outputs', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-1' } as User)
    vi.mocked(authzService.hasPermission).mockResolvedValue()

    vi.mocked(prisma.asset.findUnique).mockResolvedValue({
      id: 'asset-1',
      projectId: 'project-1',
    } as unknown as Asset)

    vi.mocked(prisma.assetComment.findUnique).mockResolvedValue({
      id: 'comment-1',
      assetId: 'asset-1',
      second: 5.0,
      annotation: [
        {
          type: 'line',
          color: '#00ff00',
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
        screenshots: [
          { key: 'screenshots/shot1.webp', timestamp: 0.0 },
          { key: 'screenshots/shot2.webp', timestamp: 5.0 },
        ],
      },
    } as unknown as WorkflowTask)

    vi.mocked(s3Service.getObject).mockImplementation(async (_bucket: string, key: string) => {
      return {
        buffer: Buffer.from(`fake-bytes-for-${key}`),
        contentType: 'image/webp',
      } as unknown as { buffer: Buffer; contentType: string }
    })

    const tool = createScreenshotTool('user-1', 'comment-1')
    const result = await tool.execute('call-1', { assetId: 'asset-1', start: 0, end: 10, count: 2 })

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
        type: 'transcode_screenshot',
        status: 'pending',
        payload: {
          projectId: 'project-1',
          screenshot: {
            start: 0,
            end: 10,
            count: 2,
            commentTimestamp: 5.0,
            annotations: [
              {
                type: 'line',
                color: '#00ff00',
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
      Buffer.from('fake-bytes-for-screenshots/shot1.webp').toString('base64'),
    )
    expect((result.content[1] as unknown as { data: string }).data).toBe(
      Buffer.from('fake-bytes-for-screenshots/shot2.webp').toString('base64'),
    )
    expect(result.details.sourceKeys).toEqual(['screenshots/shot1.webp', 'screenshots/shot2.webp'])
  })
})
