import { describe, it, expect, vi, beforeEach } from 'vitest'
import { agentService } from '@shumai/core/src/agent/agent'
import { authzService } from '@shumai/core/src/authz/authz'
import { auditLogService } from '@shumai/core/src/auditLog/auditLog'
import app from './agent'

vi.mock('@shumai/core/src/agent/agent')
vi.mock('@shumai/core/src/authz/authz')
vi.mock('@shumai/core/src/auditLog/auditLog', () => ({
  auditLogService: {
    logAction: vi.fn().mockResolvedValue({}),
  },
}))
vi.mock('@shumai/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shumai/db')>()
  return {
    ...actual,
    prisma: {
      agent: {
        findUnique: vi.fn().mockResolvedValue({ teamId: 'team1' }),
      },
    },
  }
})

describe('Agent API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(authzService.hasPermission).mockResolvedValue(undefined)
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
})
