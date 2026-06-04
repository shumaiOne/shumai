import { describe, expect, test } from 'vitest'
import { AgentService } from './agent'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'

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

    test('Create Agent with presigned URL extracts S3 key', async () => {
      const db = prisma
      const svc = new AgentService()
      const { team, provider, model } = await setupTestData(db)

      const avatarPresigned =
        'https://shumai.s3.amazonaws.com/files/01JK23456789ABCDEF01234567?AWSAccessKeyId=foo'
      const agent = await svc.createAgent({
        teamId: team.id,
        name: 'Agent with URL',
        type: 'chat',
        enabled: true,
        avatar: avatarPresigned,
        providerId: provider.id,
        modelId: model.id,
        thinkingLevel: 'medium',
      })

      expect(agent?.id).toBeDefined()
      expect(agent?.user.image).toBe('files/01JK23456789ABCDEF01234567')
    })

    test('Update Agent with presigned URL extracts S3 key', async () => {
      const db = prisma
      const svc = new AgentService()
      const { agent } = await setupTestData(db)

      const avatarPresigned =
        'https://shumai.s3.amazonaws.com/files/01JK23456789ABCDEF01234567?AWSAccessKeyId=foo'
      const updated = await svc.updateAgent({
        agentId: agent.id,
        name: 'Updated with URL',
        type: 'chat',
        enabled: true,
        avatar: avatarPresigned,
        providerId: agent.providerId!,
        modelId: agent.modelId!,
        thinkingLevel: 'medium',
      })

      expect(updated.user.image).toBe('files/01JK23456789ABCDEF01234567')
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
})
