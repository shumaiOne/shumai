import { describe, it, expect, vi, beforeEach } from 'vitest'
import { agentService } from '@/services/agent/agent'
import { authzService } from '@/services/authz/authz'
import app from './agent'

vi.mock('@/services/agent/agent')
vi.mock('@/services/authz/authz')

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
        config: { provider: 'prov1', model: 'model1', thinkingLevel: 'low', systemPrompt: 'p' },
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
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.name).toBe('New Agent')
      expect(data.soul).toBe('New Soul')
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

  describe('PUT /teams/:teamId/agents/:agentId', () => {
    it('updates an agent', async () => {
      const mockAgent = {
        id: 'agent1',
        user: { name: 'Updated Agent', image: 'avatar1' },
        type: 'autofill',
        providerId: 'prov1',
        modelId: 'model1',
        soul: 'Updated Soul',
        config: { provider: 'prov1', model: 'model1' },
        skills: [],
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(agentService.updateAgent).mockResolvedValue(mockAgent as any)

      const res = await app.request('/teams/team1/agents/agent1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Updated Agent',
          type: 'autofill',
          providerId: 'prov1',
          modelId: 'model1',
          soul: 'Updated Soul',
          skills: [],
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.name).toBe('Updated Agent')
      expect(data.soul).toBe('Updated Soul')
    })
  })

  describe('DELETE /teams/:teamId/agents/:agentId', () => {
    it('deletes an agent', async () => {
      const res = await app.request('/teams/team1/agents/agent1', {
        method: 'DELETE',
      })

      expect(res.status).toBe(204)
      expect(agentService.deleteAgent).toHaveBeenCalledWith({ agentId: 'agent1' })
    })
  })
})
