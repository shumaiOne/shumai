import { describe, it, expect, vi, beforeEach } from 'vitest'
import { agentChatActivity, autofillAiActivity } from './agent'
import * as piAgent from '@/agent'

vi.mock('@/agent', async () => {
  const actual = await vi.importActual('@/agent')
  return {
    ...actual,
    createAgentSession: vi.fn(),
    fieldsToTypeBoxSchema: vi.fn(),
  }
})

describe('Agent Activities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call agentChatActivity and prompt the harness', async () => {
    const mockHarness = {
      prompt: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'AI response' }],
        usage: { input: 10, output: 20 },
      }),
    }
    const mockSession = {
      getEntries: vi.fn().mockResolvedValue([]),
      getStorage: vi.fn().mockReturnValue({ sessionId: 'mock-session-id' }),
    }

    vi.mocked(piAgent.createAgentSession).mockResolvedValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock session type is not fully compatible with pi-agent-core Session
      session: mockSession as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock harness type is not fully compatible with pi-agent-core Harness
      harness: mockHarness as any,
    })

    const context = {
      agent: { id: 'b1', provider: { name: 'google' }, modelRef: { modelId: 'gemini' } },
      dbProviders: [],
      teamSkills: [],
      allowedDomains: [],
    }

    const res = await agentChatActivity({
      teamId: 't1',
      agentId: 'b1',
      message: 'Hi',
      imageUrls: [],
      projectId: 'p1',
      folderId: 'f1',
      sessionId: 'mock-session-id',
      context,
    })

    expect(res.text).toBe('AI response')
    expect(res.usage.inputTokens).toBe(10)
    expect(res.usage.outputTokens).toBe(20)
    expect(piAgent.createAgentSession).toHaveBeenCalled()
  })

  it('should call autofillAiActivity and run autofill tool', async () => {
    const mockHarness = {
      prompt: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Captured' }],
        usage: { input: 5, output: 5 },
      }),
    }
    const mockSession = {
      getEntries: vi.fn().mockResolvedValue([]),
      getStorage: vi.fn().mockReturnValue({ sessionId: 'mock-session-id' }),
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- config object is passed dynamically by test runner
    vi.mocked(piAgent.createAgentSession).mockImplementation(async (config: any) => {
      // Simulate tool execution
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- customTools type is dynamic and nested
      const tool = config.customTools.find((t: any) => t.name === 'autofill_metadata')
      if (tool) {
        await tool.execute('1', { f1: 'val' })
      }
      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock session type is not fully compatible with pi-agent-core Session
        session: mockSession as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock harness type is not fully compatible with pi-agent-core Harness
        harness: mockHarness as any,
      }
    })

    const context = {
      agent: { id: 'b1', provider: { name: 'google' }, modelRef: { modelId: 'gemini' } },
      dbProviders: [],
      teamSkills: [],
      allowedDomains: [],
    }

    const res = await autofillAiActivity({
      teamId: 't1',
      images: [],
      fields: [{ id: 'f1', config: { name: 'F1', type: 'text' } }],
      context,
    })

    expect(res.text).toBe('{"f1":"val"}')
    expect(res.usage.inputTokens).toBe(5)
  })
})
