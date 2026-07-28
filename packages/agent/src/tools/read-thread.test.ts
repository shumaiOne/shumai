import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createReadThreadTool } from './read-thread'
import { prisma } from '@shumai/db'

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

describe('createReadThreadTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return error text when thread root comment is not found', async () => {
    vi.mocked(prisma.assetComment.findUnique).mockResolvedValue(null)

    const tool = createReadThreadTool()
    const result = await tool.execute('call-1', { threadId: 'non-existent' })
    const textContent = (result.content[0] as { text: string }).text

    expect(textContent).toContain('Comment thread with ID "non-existent" not found.')
  })

  it('should return thread root message and notice when there are no replies', async () => {
    vi.mocked(prisma.assetComment.findUnique).mockResolvedValue({
      id: 'root-1',
      message: 'Initial top-level question',
      creator: { name: 'Alice' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    vi.mocked(prisma.assetComment.findMany).mockResolvedValue([])

    const tool = createReadThreadTool()
    const result = await tool.execute('call-2', { threadId: 'root-1' })
    const textContent = (result.content[0] as { text: string }).text

    expect(textContent).toContain('Thread Root [Alice] (root-1): Initial top-level question')
    expect(textContent).toContain('(No replies in this thread yet)')
  })

  it('should return thread root message and formatted replies when replies exist', async () => {
    vi.mocked(prisma.assetComment.findUnique).mockResolvedValue({
      id: 'root-1',
      message: 'Initial top-level question',
      creator: { name: 'Alice' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    vi.mocked(prisma.assetComment.findMany).mockResolvedValue([
      {
        id: 'reply-1',
        message: 'First reply to thread',
        creator: { name: 'Bob' },
      },
      {
        id: 'reply-2',
        message: 'Second reply to thread',
        creator: { name: 'Charlie' },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any)

    const tool = createReadThreadTool()
    const result = await tool.execute('call-3', { threadId: 'root-1' })
    const textContent = (result.content[0] as { text: string }).text

    expect(textContent).toContain('Thread Root [Alice] (root-1): Initial top-level question')
    expect(textContent).toContain('- [Bob]: First reply to thread')
    expect(textContent).toContain('- [Charlie]: Second reply to thread')
  })
})
