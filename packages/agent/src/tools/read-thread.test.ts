import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createReadThreadTool } from './read-thread'
import { prisma } from '@shumai/db'
import { authzService } from '@shumai/core/src/authz/authz'

vi.mock('@shumai/core/src/authz/authz', () => ({
  authzService: {
    hasPermission: vi.fn().mockResolvedValue(undefined),
  },
  Permission: { Read: 'read' },
  ResourceType: { Asset: 'asset' },
}))

vi.mock('@shumai/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shumai/db')>()
  return {
    ...actual,
    prisma: {
      assetComment: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      asset: {
        findUnique: vi.fn(),
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
    vi.mocked(prisma.asset.findUnique).mockResolvedValue(null)

    const tool = createReadThreadTool({ userId: 'user-1', teamId: 'team-1' })
    const result = await tool.execute('call-1', { threadId: 'non-existent' })
    const textContent = (result.content[0] as { text: string }).text

    expect(textContent).toContain('Comment thread with ID "non-existent" not found.')
  })

  it('should return specific error text when threadId is an asset ID', async () => {
    vi.mocked(prisma.assetComment.findUnique).mockResolvedValue(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock return
    vi.mocked(prisma.asset.findUnique).mockResolvedValue({ id: 'asset-1' } as any)

    const tool = createReadThreadTool({ userId: 'user-1', teamId: 'team-1' })
    const result = await tool.execute('call-asset', { threadId: 'asset-1' })
    const textContent = (result.content[0] as { text: string }).text

    expect(textContent).toContain('ID "asset-1" is an Asset ID, not a Comment Thread ID')
  })

  it('should return thread root message and notice when there are no replies', async () => {
    vi.mocked(prisma.assetComment.findUnique).mockResolvedValue({
      id: 'root-1',
      assetId: 'asset-1',
      message: 'Initial top-level question',
      creator: { name: 'Alice' },
      second: 12.5,
      annotation: [{ type: 'box' }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    vi.mocked(prisma.assetComment.findMany).mockResolvedValue([])

    const tool = createReadThreadTool({ userId: 'user-1', teamId: 'team-1' })
    const result = await tool.execute('call-2', { threadId: 'root-1' })
    const textContent = (result.content[0] as { text: string }).text

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: { id: 'user-1' },
      permission: 'read',
      type: 'asset',
      id: 'asset-1',
    })
    expect(textContent).toContain(
      'Thread Root [Alice] (id: root-1, time: 12.5s, has_markup: true): Initial top-level question',
    )
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
        second: 15.0,
        annotation: [{ type: 'line' }],
      },
      {
        id: 'reply-2',
        message: 'Second reply to thread',
        creator: { name: 'Charlie' },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any)

    const tool = createReadThreadTool({ userId: 'user-1', teamId: 'team-1' })
    const result = await tool.execute('call-3', { threadId: 'root-1' })
    const textContent = (result.content[0] as { text: string }).text

    expect(textContent).toContain(
      'Thread Root [Alice] (id: root-1, has_markup: false): Initial top-level question',
    )
    expect(textContent).toContain(
      '- [Bob] (id: reply-1, time: 15s, has_markup: true): First reply to thread',
    )
    expect(textContent).toContain(
      '- [Charlie] (id: reply-2, has_markup: false): Second reply to thread',
    )
  })

  it('should label agent replies as [Ai Agent] when creator is null but sessionId exists', async () => {
    vi.mocked(prisma.assetComment.findUnique).mockResolvedValue({
      id: 'root-1',
      message: 'Question to agent',
      creator: { name: 'Alice' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    vi.mocked(prisma.assetComment.findMany).mockResolvedValue([
      {
        id: 'reply-1',
        message: 'Agent answer',
        creator: null,
        sessionId: 'session-123',
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any)

    const tool = createReadThreadTool({ userId: 'user-1', teamId: 'team-1' })
    const result = await tool.execute('call-agent', { threadId: 'root-1' })
    const textContent = (result.content[0] as { text: string }).text

    expect(textContent).toContain('- [Ai Agent] (id: reply-1, has_markup: false): Agent answer')
  })

  it('should format 3d asset comment timestamps as degree: X°', async () => {
    vi.mocked(prisma.assetComment.findUnique).mockResolvedValue({
      id: 'root-3d',
      message: 'Notice this angle',
      creator: { name: 'Alice' },
      second: 0.5,
      annotation: [{ type: 'box' }],
      asset: {
        media: { proxyType: '3d' },
        mediaType: 'model/gltf-binary',
        name: 'robot.glb',
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    vi.mocked(prisma.assetComment.findMany).mockResolvedValue([
      {
        id: 'reply-3d-1',
        message: 'Looking at back side',
        creator: { name: 'Bob' },
        second: 2.0,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any)

    const tool = createReadThreadTool({ userId: 'user-1', teamId: 'team-1' })
    const result = await tool.execute('call-3d', { threadId: 'root-3d' })
    const textContent = (result.content[0] as { text: string }).text

    expect(textContent).toContain(
      'Thread Root [Alice] (id: root-3d, degree: 45°, has_markup: true): Notice this angle',
    )
    expect(textContent).toContain(
      '- [Bob] (id: reply-3d-1, degree: 180°, has_markup: false): Looking at back side',
    )
  })

  it('should describe threadId parameter as referencing <thread id="..." /> in <context>', () => {
    const tool = createReadThreadTool({ userId: 'user-1', teamId: 'team-1' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const description = (tool.parameters as any).properties.threadId.description
    expect(description).toContain('<thread id="..." />')
  })
})
