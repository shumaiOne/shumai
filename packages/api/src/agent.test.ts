import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HTTPException } from 'hono/http-exception'
import { agentService } from '@shumai/core/src/agent/agent'
import { authzService } from '@shumai/core/src/authz/authz'
import { auditLogService } from '@shumai/core/src/auditLog/auditLog'
import type { AgentInfo } from '@shumai/dtos'
import app from './agent'

vi.mock('@shumai/core/src/agent/agent')
vi.mock('@shumai/core/src/authz/authz')
vi.mock('@shumai/core/src/auditLog/auditLog', () => ({
  auditLogService: {
    logAction: vi.fn().mockResolvedValue({}),
  },
}))

/**
 * Shape of the agent rows returned by the (mocked) service methods. Mirrors
 * the real AgentInfoSource consumed by AgentService.toAgentInfo.
 */
interface MockAgentRow {
  id: string
  user: { name: string; image?: string | null }
  type: string
  enabled?: boolean
  permission?: string
  providerId?: string | null
  modelId?: string | null
  soul?: string | null
  config?: { thinkingLevel?: string; systemPrompt?: string; deniedTools?: string[] }
  skills?: Array<{ id: string; skillId: string; skill?: { id: string; name: string } }>
  mcpServers?: Array<{ mcpServerId: string }>
}

describe('Agent API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(authzService.hasPermission).mockResolvedValue(undefined)
    vi.mocked(agentService.getAgent).mockResolvedValue({
      id: 'agent1',
      teamId: 'team1',
    } as unknown as Awaited<ReturnType<typeof agentService.getAgent>>)

    // The route delegates AgentInfo mapping to the service; replicate the real
    // mapping so response assertions keep working.
    vi.mocked(agentService.toAgentInfo).mockImplementation(async (agent) => {
      const config = agent.config as MockAgentRow['config']
      return {
        id: agent.id,
        name: agent.user.name,
        type: agent.type,
        enabled: agent.enabled ?? true,
        permission: agent.permission ?? 'reviewer',
        avatar: agent.user.image || undefined,
        providerId: agent.providerId || undefined,
        modelId: agent.modelId || undefined,
        thinkingLevel: config?.thinkingLevel || 'off',
        systemPrompt: config?.systemPrompt,
        soul: agent.soul || undefined,
        skills: (agent.skills || []).map((s) => ({
          id: s.id,
          skillId: s.skillId,
          skill: s.skill,
        })),
        mcpServerIds: (agent.mcpServers || []).map((m) => m.mcpServerId),
        deniedTools: config?.deniedTools || [],
      } as unknown as AgentInfo
    })
  })

  describe('GET /teams/:teamId/agents', () => {
    it('returns list of agents', async () => {
      const mockAgents = [
        {
          id: 'agent1',
          user: { name: 'Bot 1', image: 'avatar1' },
          type: 'chat',
          providerId: 'prov1',
          modelId: 'model1',
          soul: 'Soul',
          config: {
            provider: 'prov1',
            model: 'model1',
            thinkingLevel: 'high',
            systemPrompt: 'prompt',
            deniedTools: ['bash'],
          },
          skills: [],
        },
      ]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(agentService.listAgents).mockResolvedValue(mockAgents as any)

      const res = await app.request('/teams/team1/agents', {
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toHaveLength(1)
      expect(data[0].name).toBe('Bot 1')
      expect(data[0].providerId).toBe('prov1')
      expect(data[0].deniedTools).toEqual(['bash'])
    })
  })

  describe('POST /teams/:teamId/agents', () => {
    it('creates an agent', async () => {
      const mockAgent = {
        id: 'agent2',
        user: { name: 'New Agent', image: 'avatar2' },
        type: 'chat',
        providerId: 'prov1',
        modelId: 'model1',
        soul: 'New Soul',
        config: {
          provider: 'prov1',
          model: 'model1',
          thinkingLevel: 'low',
          systemPrompt: 'p',
          deniedTools: ['bash'],
        },
        skills: [],
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(agentService.createAgent).mockResolvedValue(mockAgent as any)

      const res = await app.request('/teams/team1/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New Agent',
          type: 'chat',
          providerId: 'prov1',
          modelId: 'model1',
          thinkingLevel: 'low',
          systemPrompt: 'p',
          soul: 'New Soul',
          skills: ['skill1'],
          deniedTools: ['bash'],
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.name).toBe('New Agent')
      expect(data.soul).toBe('New Soul')
      expect(data.deniedTools).toEqual(['bash'])
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        action: 'agent_create',
        teamId: 'team1',
        userId: undefined,
        itemId: 'agent2',
      })
    })

    it('validates request', async () => {
      const res = await app.request('/teams/team1/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '',
          type: 'chat',
        }),
      })

      expect(res.status).toBe(400)
    })
  })

  describe('PUT /agents/:agentId', () => {
    it('updates an agent', async () => {
      const mockAgent = {
        id: 'agent1',
        teamId: 'team1',
        user: { name: 'Updated Agent', image: 'avatar1' },
        type: 'autofill',
        providerId: 'prov1',
        modelId: 'model1',
        soul: 'Updated Soul',
        config: { provider: 'prov1', model: 'model1', deniedTools: ['bash'] },
        skills: [],
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(agentService.updateAgent).mockResolvedValue(mockAgent as any)

      const res = await app.request('/agents/agent1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Updated Agent',
          type: 'autofill',
          providerId: 'prov1',
          modelId: 'model1',
          soul: 'Updated Soul',
          skills: [],
          deniedTools: ['bash'],
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.name).toBe('Updated Agent')
      expect(data.soul).toBe('Updated Soul')
      expect(data.deniedTools).toEqual(['bash'])
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        action: 'agent_update',
        teamId: 'team1',
        userId: undefined,
        itemId: 'agent1',
      })
    })
  })

  describe('DELETE /agents/:agentId', () => {
    it('deletes an agent', async () => {
      const res = await app.request('/agents/agent1', {
        method: 'DELETE',
      })

      expect(res.status).toBe(204)
      expect(agentService.deleteAgent).toHaveBeenCalledWith({ agentId: 'agent1' })
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        action: 'agent_delete',
        teamId: 'team1',
        userId: undefined,
        itemId: 'agent1',
      })
    })
  })

  describe('PATCH /agents/:agentId/permission', () => {
    it('updates agent permission when user is admin', async () => {
      const mockAgent = {
        id: 'agent1',
        teamId: 'team1',
        user: { name: 'Bot 1', image: 'avatar1' },
        type: 'chat',
        enabled: true,
        permission: 'owner',
        config: {
          provider: 'prov1',
          model: 'model1',
        },
        skills: [],
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(agentService.updateAgentPermission).mockResolvedValue(mockAgent as any)

      const res = await app.request('/agents/agent1/permission', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permission: 'owner' }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.permission).toBe('owner')
      expect(authzService.hasPermission).toHaveBeenCalledWith({
        user: undefined,
        permission: 'Admin',
        type: 'agent',
        id: 'agent1',
      })
      expect(agentService.updateAgentPermission).toHaveBeenCalledWith('agent1', 'owner')
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        action: 'agent_update',
        teamId: 'team1',
        userId: undefined,
        itemId: 'agent1',
      })
    })

    it('denies access when user is not admin', async () => {
      vi.mocked(authzService.hasPermission).mockRejectedValue(
        new HTTPException(403, { message: 'Forbidden' }),
      )

      const res = await app.request('/agents/agent1/permission', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permission: 'owner' }),
      })

      expect(res.status).toBe(403)
    })
  })

  describe('GET /agent-sessions/:sessionId/entries', () => {
    it('returns entries of agent session if user is admin', async () => {
      const mockEntries = [
        {
          id: 'entry1',
          sessionId: 'session1',
          entry: { step: 1, message: 'Step 1' },
        },
      ]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(agentService.getSessionEntries).mockResolvedValue(mockEntries as any)

      const res = await app.request('/agent-sessions/session1/entries', {
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toHaveLength(1)
      expect(data[0].id).toBe('entry1')
      expect(data[0].entry.step).toBe(1)
      expect(authzService.hasPermission).toHaveBeenCalledWith({
        user: undefined,
        permission: 'Admin',
        type: 'agentSession',
        id: 'session1',
      })
    })

    it('denies access if user is not admin', async () => {
      vi.mocked(authzService.hasPermission).mockRejectedValue(new Error('Forbidden'))

      const res = await app.request('/agent-sessions/session1/entries', {
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(500)
    })
  })

  describe('GET /teams/:teamId/agent-sessions', () => {
    it('returns paginated agent sessions for team', async () => {
      const mockSessionsData = {
        data: [
          {
            id: 'session1',
            name: 'Session 1',
            type: 'chat',
            createdAt: new Date().toISOString(),
            creator: { id: 'u1', name: 'User 1', email: 'u1@shumai.ai', image: null },
            agentId: 'agent1',
          },
        ],
        pageInfo: { total: 1 },
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(agentService.listSessions).mockResolvedValue(mockSessionsData as any)

      const res = await app.request('/teams/team1/agent-sessions?first=20', {
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(200)
      const data = (await res.json()) as typeof mockSessionsData
      expect(data.data).toHaveLength(1)
      expect(data.data[0].id).toBe('session1')
      expect(data.pageInfo.total).toBe(1)
      expect(authzService.hasPermission).toHaveBeenCalledWith({
        user: undefined,
        permission: 'Admin',
        type: 'team',
        id: 'team1',
      })
    })
  })

  describe('GET /projects/:projectId/chat-agents', () => {
    it('returns project-scoped chat agents for the user', async () => {
      const mockAgents = [
        {
          id: 'agent1',
          name: 'Chat Bot',
          type: 'chat',
          enabled: true,
          permission: 'reviewer',
          skills: [],
          mcpServerIds: [],
          deniedTools: [],
        },
      ]
      vi.mocked(agentService.listProjectChatAgents).mockResolvedValue(
        mockAgents as unknown as Awaited<ReturnType<typeof agentService.listProjectChatAgents>>,
      )

      const res = await app.request('/projects/project1/chat-agents', {
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toHaveLength(1)
      expect(data[0].name).toBe('Chat Bot')
      expect(authzService.hasPermission).toHaveBeenCalledWith({
        user: undefined,
        permission: 'Read',
        type: 'project',
        id: 'project1',
      })
      expect(agentService.listProjectChatAgents).toHaveBeenCalledWith('project1', undefined)
    })

    it('denies access when the user has no project access', async () => {
      vi.mocked(authzService.hasPermission).mockRejectedValue(
        new HTTPException(403, { message: 'Forbidden' }),
      )

      const res = await app.request('/projects/project1/chat-agents', {
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(403)
      expect(agentService.listProjectChatAgents).not.toHaveBeenCalled()
    })
  })
})
