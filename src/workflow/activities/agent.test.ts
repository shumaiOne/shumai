import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setupTestDbHooks } from '@/db-test-hooks'
import { prisma } from '@/db'
import { aiChatActivity } from './agent'
import { agentService } from '@/services/agent/agent'
import type { SessionTreeEntry } from '@earendil-works/pi-agent-core'

vi.mock('@/services/agent/agent', () => ({
  agentService: {
    chatWithAgent: vi.fn(),
  },
}))

describe('Agent Activities', () => {
  setupTestDbHooks()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call aiChatActivity', async () => {
    vi.mocked(agentService.chatWithAgent).mockResolvedValue({
      text: 'AI response',
      usage: { inputTokens: 1, outputTokens: 1, model: 'gpt-4' },
      sessionId: 'mock-session-id',
    })

    await aiChatActivity({
      teamId: 't1',
      agentId: 'b1',
      message: 'Hi',
      imageUrls: [],
      projectId: 'p1',
      folderId: 'f1',
      sessionId: 'mock-session-id',
    })

    expect(agentService.chatWithAgent).toHaveBeenCalledWith(
      't1',
      'b1',
      'Hi',
      [],
      '',
      'mock-session-id',
      undefined,
    )
  })

  it('should initialize a new session with chronological context (Rule 1 and Rule 2) and prefix username', async () => {
    const team = await prisma.team.create({ data: { name: 't1' } })
    const user1 = await prisma.user.create({
      data: { name: 'User One', email: 'user1@example.com' },
    })
    const project = await prisma.project.create({
      data: { name: 'p1', teamId: team.id },
    })
    const file = await prisma.asset.create({
      data: {
        name: 'test-file',
        type: 'file',
        projectId: project.id,
        creatorId: user1.id,
        status: 'uploaded',
      },
    })

    // Create existing comment 1
    const comment1 = await prisma.assetComment.create({
      data: {
        assetId: file.id,
        creatorId: user1.id,
        message: 'First comment message',
      },
    })

    // Create triggering comment 2 (Rule 1: no reply, mentions agent)
    const comment2 = await prisma.assetComment.create({
      data: {
        assetId: file.id,
        creatorId: user1.id,
        message: 'Hello <@agent-id>',
      },
    })

    vi.mocked(agentService.chatWithAgent).mockResolvedValue({
      text: 'AI response',
      usage: { inputTokens: 1, outputTokens: 1, model: 'gpt-4' },
      sessionId: 'generated-session-id',
    })

    await aiChatActivity({
      teamId: team.id,
      agentId: 'agent-id',
      message: 'Hello <@agent-id>',
      imageUrls: [],
      projectId: project.id,
      folderId: file.id,
      userCommentId: comment2.id,
    })

    // Verify chatWithAgent was called with a brand new sessionId (a ULID)
    expect(agentService.chatWithAgent).toHaveBeenCalled()
    const callArgs = vi.mocked(agentService.chatWithAgent).mock.calls[0]
    const createdSessionId = callArgs[5]
    expect(createdSessionId).toBeDefined()
    expect(createdSessionId).not.toBe('generated-session-id')

    // Verify session entries were populated with comment1 as context
    const entries = await prisma.agentSessionEntry.findMany({
      where: { sessionId: createdSessionId },
      orderBy: { id: 'asc' },
    })

    expect(entries.length).toBe(1)
    const entryData = entries[0].entry as unknown as SessionTreeEntry
    expect(entryData.id).toBeDefined()
    expect(entryData.id).not.toBe(comment1.id)
    if (entryData.type === 'message') {
      const msg = entryData.message as { role: 'user'; content: { type: 'text'; text: string }[] }
      expect(msg.content[0].text).toBe('[User One]: First comment message')
      expect(msg.role).toBe('user')
    } else {
      throw new Error('Expected entry to be a message')
    }
  })

  it('should support deleteCommentActivity', async () => {
    const team = await prisma.team.create({ data: { name: 't1' } })
    const user1 = await prisma.user.create({
      data: { name: 'User One', email: 'user1-delete@example.com' },
    })
    const project = await prisma.project.create({
      data: { name: 'p1', teamId: team.id },
    })
    const file = await prisma.asset.create({
      data: {
        name: 'test-file',
        type: 'file',
        projectId: project.id,
        creatorId: user1.id,
        status: 'uploaded',
      },
    })
    const comment = await prisma.assetComment.create({
      data: {
        assetId: file.id,
        creatorId: user1.id,
        message: 'To be deleted',
      },
    })

    const { deleteCommentActivity } = await import('./agent')
    await deleteCommentActivity(comment.id)

    const found = await prisma.assetComment.findUnique({
      where: { id: comment.id },
    })
    expect(found).toBeNull()
  })
})
