import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createReadThreadTool } from './read-thread'
import { prisma, type AssetComment } from '@shumai/db'
import { authzService } from '@shumai/core/src/authz/authz'

vi.mock('@shumai/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shumai/db')>()
  return {
    ...actual,
    prisma: {
      assetComment: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
    },
  }
})

vi.mock('@shumai/core/src/authz/authz', () => ({
  authzService: {
    hasPermission: vi.fn(),
  },
  Permission: { Read: 'read' },
  ResourceType: { Asset: 'asset' },
}))

describe('read_thread tool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(authzService.hasPermission).mockResolvedValue(undefined)
  })

  it('should fetch root comment and replies for a given threadId', async () => {
    const rootComment = {
      id: 'cmt-root',
      assetId: 'asset-1',
      message: 'Root comment',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      creator: { name: 'Bob', type: 'human' },
    }
    const replyComment = {
      id: 'cmt-reply',
      assetId: 'asset-1',
      replyToId: 'cmt-root',
      message: 'Reply to root',
      createdAt: new Date('2026-01-01T00:01:00Z'),
      creator: { name: 'Alice', type: 'human' },
    }

    vi.mocked(prisma.assetComment.findUnique)
      .mockResolvedValueOnce(rootComment as unknown as AssetComment)
      .mockResolvedValueOnce(rootComment as unknown as AssetComment)

    vi.mocked(prisma.assetComment.findMany).mockResolvedValue([
      replyComment as unknown as AssetComment,
    ])

    const tool = createReadThreadTool('user-1')
    const result = await tool.execute('call-1', { threadId: 'cmt-root' })

    expect(authzService.hasPermission).toHaveBeenCalledWith(
      expect.objectContaining({
        user: { id: 'user-1' },
        id: 'asset-1',
      }),
    )

    const textContent =
      Array.isArray(result.content) && result.content[0].type === 'text'
        ? result.content[0].text
        : ''

    expect(textContent).toContain('[Bob]')
    expect(textContent).toContain('Root comment')
    expect(textContent).toContain('[Alice]')
    expect(textContent).toContain('Reply to root')
  })

  it('should throw an error if target comment thread is not found', async () => {
    vi.mocked(prisma.assetComment.findUnique).mockResolvedValue(null)

    const tool = createReadThreadTool('user-1')
    await expect(tool.execute('call-1', { threadId: 'non-existent' })).rejects.toThrow(
      'Comment thread with ID "non-existent" not found.',
    )
  })
})
