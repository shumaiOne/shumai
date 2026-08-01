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

    test('Create Agent with Denied Tools', async () => {
      const db = prisma
      const svc = new AgentService()
      const { team, provider, model } = await setupTestData(db)

      const agent = await svc.createAgent({
        teamId: team.id,
        name: 'Denied Tools Agent',
        type: 'chat',
        enabled: true,
        providerId: provider.id,
        modelId: model.id,
        thinkingLevel: 'medium',
        deniedTools: ['bash', 'screenshot'],
      })

      expect(agent?.id).toBeDefined()
      const config = agent?.config as unknown as PrismaJson.AgentConfig
      expect(config.deniedTools).toEqual(['bash', 'screenshot'])
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
        deniedTools: ['list_assets'],
      })
      expect(reUpdated.skills?.length).toBe(1)
      const config = reUpdated.config as unknown as PrismaJson.AgentConfig
      expect(config.deniedTools).toEqual(['list_assets'])
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

    test('getSessionEntries follows parentId across shared sessions', async () => {
      const db = prisma
      const svc = new AgentService()
      const { agent } = await setupTestData(db)

      const mainSession = await db.agentSession.create({
        data: {
          agentId: agent.id,
          type: 'comment',
          cwd: '/tmp',
        },
      })

      const threadSession = await db.agentSession.create({
        data: {
          agentId: agent.id,
          type: 'comment',
          cwd: '/tmp',
        },
      })

      const entry1 = await db.agentSessionEntry.create({
        data: {
          id: '01ENTRY0000000000000000001',
          sessionId: mainSession.id,
          type: 'message',
          parentId: null,
          data: { text: 'Main Entry 1' },
        },
      })

      const entry2 = await db.agentSessionEntry.create({
        data: {
          id: '01ENTRY0000000000000000002',
          sessionId: threadSession.id,
          type: 'message',
          parentId: entry1.id,
          data: { text: 'Thread Entry 2' },
        },
      })

      await db.agentSession.update({
        where: { id: threadSession.id },
        data: { leafId: entry2.id },
      })

      const entries = await svc.getSessionEntries({ sessionId: threadSession.id })
      expect(entries).toHaveLength(2)
      expect(entries[0].id).toBe(entry1.id)
      expect(entries[1].id).toBe(entry2.id)
    })
  })

  describe('listSessions', () => {
    test('lists sessions for team and excludes pending id', async () => {
      const db = prisma
      const svc = new AgentService()
      const { team, agent } = await setupTestData(db)

      const user = await db.user.create({
        data: {
          name: 'Regular User',
          email: 'user@shumai.ai',
        },
      })

      const session1 = await db.agentSession.create({
        data: {
          name: 'Session One',
          agentId: agent.id,
          userId: user.id,
          type: 'chat',
          cwd: '/tmp',
        },
      })

      const session2 = await db.agentSession.create({
        data: {
          name: 'Session Two',
          agentId: agent.id,
          userId: user.id,
          type: 'comment',
          cwd: '/tmp',
        },
      })

      // Pending session - should be excluded!
      await db.agentSession.create({
        data: {
          id: 'pending',
          name: 'Pending Session',
          agentId: agent.id,
          userId: user.id,
          type: 'chat',
          cwd: '/tmp',
        },
      })

      const res = await svc.listSessions(team.id, { first: 10 })

      expect(res.data).toHaveLength(2)
      expect(res.data.map((s) => s.id)).not.toContain('pending')
      const sessionIds = res.data.map((s) => s.id)
      expect(sessionIds).toContain(session1.id)
      expect(sessionIds).toContain(session2.id)

      const found = res.data.find((s) => s.id === session1.id)
      expect(found?.name).toBe('Session One')
      expect(found?.type).toBe('chat')
      expect(found?.creator?.name).toBe('Regular User')
    })
  })

  describe('getAgent', () => {
    test('returns agent when it exists', async () => {
      const db = prisma
      const svc = new AgentService()
      const { agent } = await setupTestData(db)

      const result = await svc.getAgent({ agentId: agent.id })

      expect(result).not.toBeNull()
      expect(result?.id).toBe(agent.id)
      expect(result?.type).toBe('chat')
    })

    test('returns null for non-existent ID', async () => {
      const svc = new AgentService()

      const result = await svc.getAgent({ agentId: 'nonexistent-id' })

      expect(result).toBeNull()
    })
  })
})
