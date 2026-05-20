import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setupTestDbHooks } from '@/db-test-hooks'
import { aiChatActivity } from './agent'
import { agentService } from '@/services/agent/agent'

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
    })

    expect(agentService.chatWithAgent).toHaveBeenCalledWith(
      't1',
      'b1',
      'Hi',
      [],
      '',
      undefined,
      undefined,
    )
  })
})
