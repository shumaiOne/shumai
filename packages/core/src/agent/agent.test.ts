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

    test('Create and Update Agent with Preset Avatars', async () => {
      const db = prisma
      const svc = new AgentService()
      const { team, provider, model } = await setupTestData(db)

      // 1. Create with specific preset avatar
      const agent2 = await svc.createAgent({
        teamId: team.id,
        name: 'Agent Preset 2',
        type: 'chat',
        enabled: true,
        thinkingLevel: 'off',
        avatar: 'avatar-2',
        providerId: provider.id,
        modelId: model.id,
      })
      expect(agent2!.user.image).toMatch(/^files\/[A-Z0-9]{26}\.webp$/)
      const initialKey = agent2!.user.image

      // 2. Create without avatar (should default to avatar-1)
      const agentDefault = await svc.createAgent({
        teamId: team.id,
        name: 'Agent Default',
        type: 'chat',
        enabled: true,
        thinkingLevel: 'off',
        providerId: provider.id,
        modelId: model.id,
      })
      expect(agentDefault!.user.image).toMatch(/^files\/[A-Z0-9]{26}\.webp$/)

      // 3. Update agent with a different preset avatar
      const updatedPreset = await svc.updateAgent({
        agentId: agent2!.id,
        name: 'Agent Preset 3',
        type: 'chat',
        enabled: true,
        thinkingLevel: 'off',
        avatar: 'avatar-3',
        providerId: provider.id,
        modelId: model.id,
      })
      expect(updatedPreset.user.image).toMatch(/^files\/[A-Z0-9]{26}\.webp$/)
      expect(updatedPreset.user.image).not.toBe(initialKey)

      // 4. Update with presigned URL containing .webp extension
      const updatedPresigned = await svc.updateAgent({
        agentId: agent2!.id,
        name: 'Agent Presigned',
        type: 'chat',
        enabled: true,
        thinkingLevel: 'off',
        avatar: 'https://shumai.s3.amazonaws.com/files/01JK23456789ABCDEF01234567.webp?foo=bar',
        providerId: provider.id,
        modelId: model.id,
      })
      expect(updatedPresigned.user.image).toBe('files/01JK23456789ABCDEF01234567.webp')

      // 5. Update without avatar specified (avatar undefined) - preserves image
      const updatedWithoutAvatar = await svc.updateAgent({
        agentId: agent2!.id,
        name: 'Agent Without Avatar Change',
        type: 'chat',
        enabled: true,
        thinkingLevel: 'off',
        providerId: provider.id,
        modelId: model.id,
      })
      expect(updatedWithoutAvatar.user.image).toBe('files/01JK23456789ABCDEF01234567.webp')
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

    test('getSessionEntries dynamically attaches details.thread on custom_message entries with replies', async () => {
      const db = prisma
      const svc = new AgentService()
      const { agent, team } = await setupTestData(db)

      const project = await db.project.create({
        data: { name: 'Test Project', teamId: team.id },
      })
      const asset = await db.asset.create({
        data: {
          name: 'video.mp4',
          type: 'file',
          status: 'uploaded',
          projectId: project.id,
        },
      })
      const user = await db.user.create({
        data: { name: 'Alice', email: `alice-${Date.now()}@example.com` },
      })

      const rootComment = await db.assetComment.create({
        data: {
          id: 'comment-root-entries',
          assetId: asset.id,
          message: 'Top-level comment',
          creatorId: user.id,
        },
      })

      // Add a reply
      await db.assetComment.create({
        data: {
          id: 'comment-reply-entries',
          assetId: asset.id,
          message: 'Reply to root',
          creatorId: user.id,
          replyToId: rootComment.id,
        },
      })

      const session = await db.agentSession.create({
        data: {
          agentId: agent.id,
          type: 'comment',
          cwd: '/tmp',
        },
      })

      const entry = await db.agentSessionEntry.create({
        data: {
          id: rootComment.id,
          sessionId: session.id,
          type: 'custom_message',
          parentId: null,
          data: {
            customType: 'shumai_message',
            content: 'Top-level comment',
            display: true,
            details: { user: { id: user.id, name: user.name } },
          },
        },
      })

      await db.agentSession.update({
        where: { id: session.id },
        data: { leafId: entry.id },
      })

      const entries = await svc.getSessionEntries({ sessionId: session.id })
      expect(entries).toHaveLength(1)
      expect(entries[0].id).toBe(rootComment.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entryDetails = (entries[0].entry as any).details
      expect(entryDetails?.thread).toEqual({
        id: rootComment.id,
        replyCount: 1,
      })
    })
  })

  describe('listSessions', () => {
    test('lists sessions for team, includes chat sessions and leaf comment sessions, hides main comment sessions and excludes pending id', async () => {
      const db = prisma
      const svc = new AgentService()
      const { team, agent } = await setupTestData(db)

      const user = await db.user.create({
        data: {
          name: 'Regular User',
          email: 'user@shumai.ai',
        },
      })

      // 1. Chat session (userCommentId is null) - should be included!
      const chatSession = await db.agentSession.create({
        data: {
          name: 'Chat Session',
          agentId: agent.id,
          userId: user.id,
          type: 'chat',
          cwd: '/tmp',
          userCommentId: null,
        },
      })

      // 2. Main comment session (userCommentId is null) - should be HIDDEN / EXCLUDED!
      const mainCommentSession = await db.agentSession.create({
        data: {
          name: 'Main Comment Session',
          agentId: agent.id,
          userId: user.id,
          type: 'comment',
          cwd: '/tmp',
          userCommentId: null,
        },
      })

      // 3. Leaf comment session (userCommentId is not null) - should be included!
      const leafCommentSession = await db.agentSession.create({
        data: {
          name: 'Leaf Comment Session',
          agentId: agent.id,
          userId: user.id,
          type: 'comment',
          cwd: '/tmp',
          userCommentId: 'comment-123',
        },
      })

      // 4. Pending session - should be excluded!
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
      const sessionIds = res.data.map((s) => s.id)
      expect(sessionIds).not.toContain('pending')
      expect(sessionIds).not.toContain(mainCommentSession.id)
      expect(sessionIds).toContain(chatSession.id)
      expect(sessionIds).toContain(leafCommentSession.id)

      const foundChat = res.data.find((s) => s.id === chatSession.id)
      expect(foundChat?.name).toBe('Chat Session')
      expect(foundChat?.type).toBe('chat')
      expect(foundChat?.creator?.name).toBe('Regular User')

      const foundLeafComment = res.data.find((s) => s.id === leafCommentSession.id)
      expect(foundLeafComment?.name).toBe('Leaf Comment Session')
      expect(foundLeafComment?.type).toBe('comment')
      expect(foundLeafComment?.creator?.name).toBe('Regular User')
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

  describe('agent permissions', () => {
    test('createAgent with custom permission and updateAgentPermission', async () => {
      const db = prisma
      const svc = new AgentService()
      const { team, provider, model } = await setupTestData(db)

      const agent = await svc.createAgent({
        teamId: team.id,
        name: 'Owner Only Agent',
        type: 'chat',
        enabled: true,
        thinkingLevel: 'off',
        permission: 'owner',
        providerId: provider.id,
        modelId: model.id,
      })

      expect(agent?.permission).toBe('owner')

      const updated = await svc.updateAgentPermission(agent!.id, 'editor')
      expect(updated.permission).toBe('editor')

      const updatedViaUpdateAgent = await svc.updateAgent({
        agentId: agent!.id,
        name: 'Owner Only Agent Updated',
        type: 'chat',
        enabled: true,
        thinkingLevel: 'off',
        permission: 'reviewer',
        providerId: provider.id,
        modelId: model.id,
      })
      expect(updatedViaUpdateAgent.permission).toBe('reviewer')
    })

    test('listAgents filters chat agents by requester role when userId is provided', async () => {
      const db = prisma
      const svc = new AgentService()
      const { team, provider, model } = await setupTestData(db)

      // Create 3 chat agents with different permissions
      const reviewerAgent = await svc.createAgent({
        teamId: team.id,
        name: 'All Users Agent',
        type: 'chat',
        enabled: true,
        thinkingLevel: 'off',
        permission: 'reviewer',
        providerId: provider.id,
        modelId: model.id,
      })

      const editorAgent = await svc.createAgent({
        teamId: team.id,
        name: 'Editor Agent',
        type: 'chat',
        enabled: true,
        thinkingLevel: 'off',
        permission: 'editor',
        providerId: provider.id,
        modelId: model.id,
      })

      const ownerAgent = await svc.createAgent({
        teamId: team.id,
        name: 'Owner Agent',
        type: 'chat',
        enabled: true,
        thinkingLevel: 'off',
        permission: 'owner',
        providerId: provider.id,
        modelId: model.id,
      })

      // Create 3 test users with different roles in the team
      const reviewerUser = await db.user.create({
        data: { name: 'Reviewer User', email: 'rev@shumai.ai' },
      })
      await db.teamMember.create({
        data: { teamId: team.id, userId: reviewerUser.id, role: 'reviewer' },
      })

      const editorUser = await db.user.create({
        data: { name: 'Editor User', email: 'ed@shumai.ai' },
      })
      await db.teamMember.create({
        data: { teamId: team.id, userId: editorUser.id, role: 'editor' },
      })

      const ownerUser = await db.user.create({
        data: { name: 'Owner User', email: 'own@shumai.ai' },
      })
      await db.teamMember.create({
        data: { teamId: team.id, userId: ownerUser.id, role: 'owner' },
      })

      // Reviewer should only see reviewerAgent
      const reviewerList = await svc.listAgents({ teamId: team.id, userId: reviewerUser.id })
      const reviewerAgentIds = reviewerList.map((a) => a.id)
      expect(reviewerAgentIds).toContain(reviewerAgent!.id)
      expect(reviewerAgentIds).not.toContain(editorAgent!.id)
      expect(reviewerAgentIds).not.toContain(ownerAgent!.id)

      // Editor should see reviewerAgent and editorAgent
      const editorList = await svc.listAgents({ teamId: team.id, userId: editorUser.id })
      const editorAgentIds = editorList.map((a) => a.id)
      expect(editorAgentIds).toContain(reviewerAgent!.id)
      expect(editorAgentIds).toContain(editorAgent!.id)
      expect(editorAgentIds).not.toContain(ownerAgent!.id)

      // Owner should see all agents
      const ownerList = await svc.listAgents({ teamId: team.id, userId: ownerUser.id })
      const ownerAgentIds = ownerList.map((a) => a.id)
      expect(ownerAgentIds).toContain(reviewerAgent!.id)
      expect(ownerAgentIds).toContain(editorAgent!.id)
      expect(ownerAgentIds).toContain(ownerAgent!.id)
    })

    test('listProjectChatAgents filters by effective project role and chat/enabled only', async () => {
      const db = prisma
      const svc = new AgentService()
      const { team, provider, model } = await setupTestData(db)

      const project = await db.project.create({
        data: { name: 'Proj Agents', teamId: team.id },
      })

      // Two chat agents + one disabled chat agent + one embedding agent
      const reviewerAgent = await svc.createAgent({
        teamId: team.id,
        name: 'Reviewer Chat',
        type: 'chat',
        enabled: true,
        thinkingLevel: 'off',
        permission: 'reviewer',
        providerId: provider.id,
        modelId: model.id,
      })
      const editorAgent = await svc.createAgent({
        teamId: team.id,
        name: 'Editor Chat',
        type: 'chat',
        enabled: true,
        thinkingLevel: 'off',
        permission: 'editor',
        providerId: provider.id,
        modelId: model.id,
      })
      const disabledAgent = await svc.createAgent({
        teamId: team.id,
        name: 'Disabled Chat',
        type: 'chat',
        enabled: false,
        thinkingLevel: 'off',
        permission: 'reviewer',
        providerId: provider.id,
        modelId: model.id,
      })

      // Team reviewer, promoted to project owner in this project
      const projectOwner = await db.user.create({
        data: { name: 'Proj Owner', email: 'projowner@shumai.ai' },
      })
      const projectOwnerTm = await db.teamMember.create({
        data: { teamId: team.id, userId: projectOwner.id, role: 'reviewer', scope: 'team' },
      })
      await db.projectMember.create({
        data: { projectId: project.id, teamMemberId: projectOwnerTm.id, role: 'owner' },
      })

      const list = await svc.listProjectChatAgents(project.id, projectOwner.id)
      const ids = list.map((a) => a.id)
      expect(ids).toContain(reviewerAgent!.id)
      expect(ids).toContain(editorAgent!.id)
      expect(ids).not.toContain(disabledAgent!.id)
      expect(list.every((a) => a.type === 'chat')).toBe(true)
      expect(list.every((a) => a.enabled)).toBe(true)
    })

    test('listProjectChatAgents restricts project-scoped members to their project role', async () => {
      const db = prisma
      const svc = new AgentService()
      const { team, provider, model } = await setupTestData(db)

      const project = await db.project.create({
        data: { name: 'Proj Guest', teamId: team.id },
      })

      const reviewerAgent = await svc.createAgent({
        teamId: team.id,
        name: 'Reviewer Chat',
        type: 'chat',
        enabled: true,
        thinkingLevel: 'off',
        permission: 'reviewer',
        providerId: provider.id,
        modelId: model.id,
      })
      const editorAgent = await svc.createAgent({
        teamId: team.id,
        name: 'Editor Chat',
        type: 'chat',
        enabled: true,
        thinkingLevel: 'off',
        permission: 'editor',
        providerId: provider.id,
        modelId: model.id,
      })

      // Project-scoped member invited as reviewer in this project
      const guest = await db.user.create({
        data: { name: 'Guest', email: 'guest@shumai.ai' },
      })
      const guestTm = await db.teamMember.create({
        data: { teamId: team.id, userId: guest.id, role: 'reviewer', scope: 'project' },
      })
      await db.projectMember.create({
        data: { projectId: project.id, teamMemberId: guestTm.id, role: 'reviewer' },
      })

      const ids = (await svc.listProjectChatAgents(project.id, guest.id)).map((a) => a.id)
      expect(ids).toContain(reviewerAgent!.id)
      expect(ids).not.toContain(editorAgent!.id)
    })

    test('listProjectChatAgents returns empty for users outside the project', async () => {
      const db = prisma
      const svc = new AgentService()
      const { team, provider, model } = await setupTestData(db)

      const project = await db.project.create({
        data: { name: 'Proj Closed', teamId: team.id },
      })
      const projectB = await db.project.create({
        data: { name: 'Proj Other', teamId: team.id },
      })

      await svc.createAgent({
        teamId: team.id,
        name: 'Reviewer Chat',
        type: 'chat',
        enabled: true,
        thinkingLevel: 'off',
        permission: 'reviewer',
        providerId: provider.id,
        modelId: model.id,
      })

      // Project-scoped member of projectB only
      const guest = await db.user.create({
        data: { name: 'Guest B', email: 'guestb@shumai.ai' },
      })
      const guestTm = await db.teamMember.create({
        data: { teamId: team.id, userId: guest.id, role: 'reviewer', scope: 'project' },
      })
      await db.projectMember.create({
        data: { projectId: projectB.id, teamMemberId: guestTm.id, role: 'reviewer' },
      })

      const ids = (await svc.listProjectChatAgents(project.id, guest.id)).map((a) => a.id)
      expect(ids).toHaveLength(0)
    })
  })
})
