import { describe, it, expect, vi, beforeEach } from 'vitest'
import { aiChatActivity } from './agent'
import { agentService } from '@/services/agent/agent'

vi.mock('@/services/agent/agent', () => ({
  agentService: {
    chatWithAgent: vi.fn(),
  },
}))

describe('Agent Activities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call aiChatActivity and delegate to agentService', async () => {
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
})
