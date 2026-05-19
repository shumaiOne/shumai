import { describe, expect, it, vi, beforeEach } from 'vitest'
import { prisma } from '@/db'
import { setupTestDbHooks } from '@/db-test-hooks'
import { agentExecutor, type AutofillField } from './executor'
import * as piAgent from '@mariozechner/pi-coding-agent'

vi.mock('@mariozechner/pi-coding-agent', async () => {
  const actual = await vi.importActual('@mariozechner/pi-coding-agent')
  return {
    ...actual,
    createAgentSession: vi.fn(),
  }
})

const mockProviderConfig: PrismaJson.ProviderConfig = {
  api: 'openai-completions',
  baseUrl: 'http://localhost:11434/v1',
  apiKey: 'test-key',
}

const mockModelConfig: PrismaJson.ModelConfig = {
  reasoning: false,
  input: ['text'],
  contextWindow: 1000,
  maxTokens: 1000,
  cost: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
  },
}

describe('AgentExecutor', () => {
  setupTestDbHooks()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('autofills with agent', async () => {
    const team = await prisma.team.create({
      data: {
        name: 'Autofill Team',
      },
    })

    const provider = await prisma.provider.create({
      data: {
        name: 'openai',
        teamId: team.id,
        config: mockProviderConfig,
      },
    })

    const model = await prisma.model.create({
      data: {
        modelId: 'gpt-4',
        name: 'GPT-4',
        providerId: provider.id,
        config: mockModelConfig,
      },
    })

    await prisma.user.create({
      data: {
        name: 'Autofiller',
        email: `autofiller-${Date.now()}@shumai.ai`,
        type: 'agent',
        agent: {
          create: {
            type: 'autofill',
            enabled: true,
            providerId: provider.id,
            modelId: model.id,
            config: {
              provider: 'openai',
              model: 'gpt-4',
            },
          },
        },
        teamMembers: {
          create: {
            teamId: team.id,
            role: 'reviewer',
          },
        },
      },
    })

    const mockSession = {
      sendUserMessage: vi.fn().mockImplementation(async () => {
        // Find the tool in the session's customTools and call its execute
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tool = (mockSession as any).customTools.find(
          (t: unknown) => (t as { name: string }).name === 'autofill_metadata',
        )
        if (tool) {
          await tool.execute('call_1', { data: 1 })
        }
      }),
      getSessionStats: vi.fn().mockReturnValue({ tokens: { input: 5, output: 5 } }),
      getLastAssistantText: vi.fn().mockReturnValue('{"data": 1}'),
      state: { tools: [], systemPrompt: '', messages: [] },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      customTools: [] as any[],
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(piAgent.createAgentSession as any).mockImplementation(async (config: any) => {
      mockSession.customTools = config.customTools
      return { session: mockSession }
    })

    const fields: AutofillField[] = [{ id: 'f1', config: { name: 'Field 1', type: 'text' } }]
    const resp = await agentExecutor.autofill(team.id, 'extract data', [], fields)
    expect(resp.text).toBe('{"data":1}')
    expect(resp.usage.inputTokens).toBe(5)
  })

  it('chats with bot', async () => {
    const team = await prisma.team.create({
      data: {
        name: 'Chat Bot Team',
      },
    })

    const provider = await prisma.provider.create({
      data: {
        name: 'google',
        teamId: team.id,
        config: mockProviderConfig,
      },
    })

    const model = await prisma.model.create({
      data: {
        modelId: 'gemini',
        name: 'Gemini',
        providerId: provider.id,
        config: mockModelConfig,
      },
    })

    await prisma.user.create({
      data: {
        name: 'Chatter',
        email: `chatter-${Date.now()}@shumai.ai`,
        type: 'agent',
        agent: {
          create: {
            type: 'chat',
            enabled: true,
            providerId: provider.id,
            modelId: model.id,
            config: {
              provider: 'google',
              model: 'gemini',
            },
          },
        },
        teamMembers: {
          create: {
            teamId: team.id,
            role: 'reviewer',
          },
        },
      },
    })

    const mockSession = {
      sendUserMessage: vi.fn().mockResolvedValue(undefined),
      getSessionStats: vi.fn().mockReturnValue({ tokens: { input: 5, output: 5 } }),
      getLastAssistantText: vi.fn().mockReturnValue('mock text'),
      state: { tools: [], systemPrompt: '', messages: [] },
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(piAgent.createAgentSession as any).mockResolvedValue({ session: mockSession })

    const resp = await agentExecutor.chat(team.id, 'hello')
    expect(resp.text).toBe('mock text')
  })

  it('chat with instruction', async () => {
    const team = await prisma.team.create({
      data: {
        name: 'Pirate Team',
      },
    })

    const provider = await prisma.provider.create({
      data: {
        name: 'google',
        teamId: team.id,
        config: mockProviderConfig,
      },
    })

    const model = await prisma.model.create({
      data: {
        modelId: 'gemini-pro',
        name: 'Gemini Pro',
        providerId: provider.id,
        config: mockModelConfig,
      },
    })

    const botUser = await prisma.user.create({
      data: { name: 'Pirate', email: 'pirate@shumai.ai', type: 'agent' },
    })

    const agent = await prisma.agent.create({
      data: {
        id: botUser.id,
        type: 'chat',
        enabled: true,
        providerId: provider.id,
        modelId: model.id,
        soul: 'You are a pirate',
        config: {
          provider: 'google',
          model: 'gemini-pro',
        },
      },
    })

    await prisma.teamMember.create({
      data: { teamId: team.id, userId: botUser.id, role: 'reviewer' },
    })

    const mockSession = {
      sendUserMessage: vi.fn().mockResolvedValue(undefined),
      getSessionStats: vi.fn().mockReturnValue({ tokens: { input: 10, output: 20 } }),
      getLastAssistantText: vi.fn().mockReturnValue('Arr matey!'),
      state: { tools: [], systemPrompt: '', messages: [] },
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(piAgent.createAgentSession as any).mockResolvedValue({ session: mockSession })

    const resp = await agentExecutor.chatWithAgent(
      team.id,
      agent.id,
      'hello',
      [],
      'Talk like a pirate',
    )
    expect(resp.text).toBe('Arr matey!')
    expect(resp.usage.inputTokens).toBe(10)
    expect(resp.usage.outputTokens).toBe(20)
  })
})
