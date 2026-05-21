import { describe, expect, test, vi, beforeEach } from 'vitest'
import { AgentService } from './agent'
import { prisma } from '@/db'
import { setupTestDbHooks } from '@/db-test-hooks'
import * as piAgent from '@/agent'
import { type AutofillField } from '@/agent'

vi.mock('@/agent', async () => {
  const actual = await vi.importActual('@/agent')
  return {
    ...actual,
    createAgentSession: vi.fn(),
  }
})

describe('AgentService', () => {
  setupTestDbHooks()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function setupTestData(db: any) {
    const team = await db.team.create({
      data: {
        name: 'Test Team',
      },
    })

    const provider = await db.provider.create({
      data: {
        name: 'Google',
        teamId: team.id,
        config: {
          api: 'openai-completions',
        },
      },
    })

    const model = await db.model.create({
      data: {
        modelId: 'gemini-pro',
        name: 'Gemini Pro',
        providerId: provider.id,
        config: {},
      },
    })

    const skill = await db.skill.create({
      data: {
        name: 'Test Skill',
        teamId: team.id,
        assetId: 'asset1',
        hash: 'hash1',
      },
    })

    const user = await db.user.create({
      data: {
        name: 'Bot 1',
        email: 'bot1@shumai.ai',
        type: 'agent',
      },
    })

    const agent = await db.agent.create({
      data: {
        id: user.id,
        teamId: team.id,
        type: 'chat',
        providerId: provider.id,
        modelId: model.id,
        soul: 'Test soul',
        config: {
          provider: provider.id,
          model: model.id,
        },
      },
    })

    await db.teamMember.create({
      data: {
        teamId: team.id,
        userId: user.id,
        role: 'owner',
      },
    })

    return { team, provider, model, skill, agent }
  }

  describe('create, update, delete agents', () => {
    test('Create Agent with Provider and Model', async () => {
      const db = prisma
      const svc = new AgentService()
      const { team, provider, model } = await setupTestData(db)

      const agent = await svc.createAgent({
        teamId: team.id,
        name: 'New Agent',
        type: 'chat',
        enabled: true,
        providerId: provider.id,
        modelId: model.id,
        thinkingLevel: 'medium',
        systemPrompt: 'You are helpful',
        soul: 'I am a soul',
      })

      expect(agent?.id).toBeDefined()
      expect(agent?.user.name).toBe('New Agent')
      expect(agent?.providerId).toBe(provider.id)
      expect(agent?.modelId).toBe(model.id)
      expect(agent?.soul).toBe('I am a soul')

      const teamMember = await db.teamMember.findFirst({
        where: { userId: agent?.id, teamId: team.id },
      })
      expect(teamMember).toBeDefined()
    })

    test('Create Agent with Skills', async () => {
      const db = prisma
      const svc = new AgentService()
      const { team, provider, model, skill } = await setupTestData(db)

      const agent = await svc.createAgent({
        teamId: team.id,
        name: 'Skill Agent',
        type: 'chat',
        enabled: true,
        providerId: provider.id,
        modelId: model.id,
        thinkingLevel: 'medium',
        skills: [skill.id],
      })

      expect(agent?.skills?.length).toBe(1)
      expect(agent?.skills?.[0].skillId).toBe(skill.id)
    })

    test('Create Agent validation fails if model mismatch', async () => {
      const db = prisma
      const svc = new AgentService()
      const { team, model } = await setupTestData(db)

      const otherProvider = await db.provider.create({
        data: {
          name: 'Other',
          teamId: team.id,
          config: {
            api: 'openai-completions',
          },
        },
      })

      await expect(
        svc.createAgent({
          teamId: team.id,
          name: 'Fail Agent',
          type: 'chat',
          enabled: true,
          providerId: otherProvider.id,
          modelId: model.id,
          thinkingLevel: 'medium',
        }),
      ).rejects.toThrow('model does not belong to provider')
    })

    test('Update Agent and Skills', async () => {
      const db = prisma
      const svc = new AgentService()
      const { agent, skill } = await setupTestData(db)

      const updated = await svc.updateAgent({
        agentId: agent.id,
        name: 'Updated Agent',
        type: 'autofill',
        enabled: true,
        providerId: agent.providerId!,
        modelId: agent.modelId!,
        thinkingLevel: 'high',
        soul: 'New soul',
        skills: [], // Disable all skills
      })

      expect(updated.user.name).toBe('Updated Agent')
      expect(updated.type).toBe('autofill')
      expect(updated.soul).toBe('New soul')
      expect(updated.skills?.length).toBe(0)

      const reUpdated = await svc.updateAgent({
        agentId: agent.id,
        name: 'Updated Agent',
        type: 'autofill',
        enabled: true,
        providerId: agent.providerId!,
        modelId: agent.modelId!,
        thinkingLevel: 'high',
        soul: 'New soul',
        skills: [skill.id], // Re-enable one
      })
      expect(reUpdated.skills?.length).toBe(1)
    })

    test('Delete Agent', async () => {
      const db = prisma
      const svc = new AgentService()
      const { agent } = await setupTestData(db)

      await svc.deleteAgent({ agentId: agent.id })

      const deletedAgent = await db.agent.findUnique({
        where: { id: agent.id },
      })
      expect(deletedAgent).toBeNull()

      const deletedUser = await db.user.findUnique({
        where: { id: agent.id },
      })
      expect(deletedUser).toBeNull()
    })

    test('List Agents', async () => {
      const db = prisma
      const svc = new AgentService()
      const { team } = await setupTestData(db)

      const agents = await svc.listAgents({ teamId: team.id })
      expect(agents.length).toBe(1)
      expect(agents[0].user.name).toBe('Bot 1')
      expect(agents[0].provider).toBeDefined()
      expect(agents[0].modelRef).toBeDefined()
    })
  })

  describe('agent execution', () => {
    const mockProviderConfig: PrismaJson.AiProviderSettings = {
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

    beforeEach(() => {
      vi.clearAllMocks()
    })

    test('autofill extracts metadata', async () => {
      const db = prisma
      const svc = new AgentService()

      const team = await db.team.create({
        data: {
          name: 'Autofill Team',
        },
      })

      const provider = await db.provider.create({
        data: {
          name: 'google',
          teamId: team.id,
          // Config is generic Json in Prisma
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          config: mockProviderConfig as any,
        },
      })

      const model = await db.model.create({
        data: {
          modelId: 'gemini',
          name: 'Gemini',
          providerId: provider.id,
          // Config is generic Json in Prisma
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          config: mockModelConfig as any,
        },
      })

      await db.user.create({
        data: {
          name: 'Autofiller',
          email: `autofiller-${Date.now()}@shumai.ai`,
          type: 'agent',
          agent: {
            create: {
              teamId: team.id,
              type: 'autofill',
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

      const mockHarness = {
        prompt: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Metadata captured successfully.' }],
          usage: { input: 5, output: 5 },
        }),
      }
      const mockSession = {
        getEntries: vi.fn().mockResolvedValue([]),
        getStorage: vi.fn().mockReturnValue({ sessionId: 'mock-session-id' }),
      }

      // Mocking createAgentSession which has complex internal types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(piAgent.createAgentSession as any).mockImplementation(async (config: unknown) => {
        const tool = (
          config as {
            customTools: Array<{ name: string; execute: (...args: unknown[]) => Promise<unknown> }>
          }
        ).customTools.find((t) => t.name === 'autofill_metadata')
        if (tool) {
          await tool.execute('1', { f1: 'data-val' }, undefined)
        }
        return { session: mockSession, harness: mockHarness }
      })

      const fields: AutofillField[] = [{ id: 'f1', config: { name: 'Field 1', type: 'text' } }]
      const resp = await svc.autofill(team.id, 'extract data', [], fields)
      expect(resp.text).toBe('{"f1":"data-val"}')
      expect(resp.usage.inputTokens).toBe(5)
    })

    test('chats with bot', async () => {
      const db = prisma
      const svc = new AgentService()

      const team = await db.team.create({
        data: {
          name: 'Chat Bot Team',
        },
      })

      const provider = await db.provider.create({
        data: {
          name: 'google',
          teamId: team.id,
          // Config is generic Json in Prisma
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          config: mockProviderConfig as any,
        },
      })

      const model = await db.model.create({
        data: {
          modelId: 'gemini',
          name: 'Gemini',
          providerId: provider.id,
          // Config is generic Json in Prisma
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          config: mockModelConfig as any,
        },
      })

      await db.user.create({
        data: {
          name: 'Chatter',
          email: `chatter-${Date.now()}@shumai.ai`,
          type: 'agent',
          agent: {
            create: {
              teamId: team.id,
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

      const mockHarness = {
        prompt: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'mock text' }],
          usage: { input: 5, output: 5 },
        }),
      }
      const mockSession = {
        getEntries: vi.fn().mockResolvedValue([]),
        getStorage: vi.fn().mockReturnValue({ sessionId: 'mock-session-id' }),
      }
      // Mocking createAgentSession
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(piAgent.createAgentSession as any).mockResolvedValue({
        session: mockSession,
        harness: mockHarness,
      })

      const resp = await svc.chat(team.id, 'hello')
      expect(resp.text).toBe('mock text')
    })

    test('chat with instruction', async () => {
      const db = prisma
      const svc = new AgentService()

      const team = await db.team.create({
        data: {
          name: 'Pirate Team',
        },
      })

      const provider = await db.provider.create({
        data: {
          name: 'google',
          teamId: team.id,
          // Config is generic Json in Prisma
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          config: mockProviderConfig as any,
        },
      })

      const model = await db.model.create({
        data: {
          modelId: 'gemini-pro',
          name: 'Gemini Pro',
          providerId: provider.id,
          // Config is generic Json in Prisma
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          config: mockModelConfig as any,
        },
      })

      const botUser = await db.user.create({
        data: { name: 'Pirate', email: 'pirate@shumai.ai', type: 'agent' },
      })

      const agent = await db.agent.create({
        data: {
          id: botUser.id,
          teamId: team.id,
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

      await db.teamMember.create({
        data: { teamId: team.id, userId: botUser.id, role: 'reviewer' },
      })

      const mockHarness = {
        prompt: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Arr matey!' }],
          usage: { input: 10, output: 20 },
        }),
      }
      const mockSession = {
        getEntries: vi.fn().mockResolvedValue([]),
        getStorage: vi.fn().mockReturnValue({ sessionId: 'mock-session-id' }),
      }
      // Mocking createAgentSession
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(piAgent.createAgentSession as any).mockResolvedValue({
        session: mockSession,
        harness: mockHarness,
      })

      const resp = await svc.chatWithAgent(team.id, agent.id, 'hello', [], 'Talk like a pirate')
      expect(resp.text).toBe('Arr matey!')
      expect(resp.usage.inputTokens).toBe(10)
      expect(resp.usage.outputTokens).toBe(20)
    })
  })
})
