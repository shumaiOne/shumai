import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { agentService } from '@/services/agent/agent'
import { authzService, Permission, ResourceType } from '@/services/authz/authz'
import {
  createAgentRequestSchema,
  updateAgentRequestSchema,
  AgentInfo,
  AgentType,
} from '@shumai/dtos'

import type { Prisma } from '@/generated/prisma/client'

type User = Prisma.UserGetPayload<Record<string, never>>

const route = new Hono<{ Variables: { user: User } }>()
  .get('/teams/:teamId/agents', async (c) => {
    const teamId = c.req.param('teamId')
    const userReq = c.get('user')

    await authzService.hasPermission({
      user: userReq,
      permission: Permission.Read,
      type: ResourceType.Team,
      id: teamId,
    })

    const agents = await agentService.listAgents({ teamId })

    const res: AgentInfo[] = agents.map((agent) => {
      const config = agent.config as unknown as PrismaJson.AgentConfig
      return {
        id: agent.id,
        name: agent.user.name,
        type: agent.type as AgentType,
        enabled: agent.enabled,
        avatar: agent.user.image || undefined,
        providerId: agent.providerId || undefined,
        modelId: agent.modelId || undefined,
        thinkingLevel: config.thinkingLevel || '',
        systemPrompt: config.systemPrompt,
        soul: agent.soul || undefined,
        skills: agent.skills.map((s) => ({
          id: s.id,
          skillId: s.skillId,
          skill: s.skill,
        })),
      }
    })

    return c.json(res, 200)
  })
  .post('/teams/:teamId/agents', zValidator('json', createAgentRequestSchema), async (c) => {
    const teamId = c.req.param('teamId')
    const userReq = c.get('user')
    const req = c.req.valid('json')

    await authzService.hasPermission({
      user: userReq,
      permission: Permission.Admin,
      type: ResourceType.Team,
      id: teamId,
    })

    const agent = await agentService.createAgent({
      teamId,
      ...req,
    })

    if (!agent) throw new Error('failed to create agent')

    const config = agent.config as unknown as PrismaJson.AgentConfig
    const info: AgentInfo = {
      id: agent.id,
      name: agent.user.name,
      type: agent.type as AgentType,
      enabled: agent.enabled,
      avatar: agent.user.image || undefined,
      providerId: agent.providerId || undefined,
      modelId: agent.modelId || undefined,
      thinkingLevel: config.thinkingLevel || '',
      systemPrompt: config.systemPrompt,
      soul: agent.soul || undefined,
      skills: agent.skills.map((s) => ({
        id: s.id,
        skillId: s.skillId,
        skill: s.skill,
      })),
    }

    return c.json(info, 200)
  })
  .put('/agents/:agentId', zValidator('json', updateAgentRequestSchema), async (c) => {
    const agentId = c.req.param('agentId')
    const userReq = c.get('user')
    const req = c.req.valid('json')

    await authzService.hasPermission({
      user: userReq,
      permission: Permission.Admin,
      type: ResourceType.Agent,
      id: agentId,
    })

    const agent = await agentService.updateAgent({
      agentId,
      ...req,
    })

    const config = agent.config as unknown as PrismaJson.AgentConfig
    const info: AgentInfo = {
      id: agent.id,
      name: agent.user.name,
      type: agent.type as AgentType,
      enabled: agent.enabled,
      avatar: agent.user.image || undefined,
      providerId: agent.providerId || undefined,
      modelId: agent.modelId || undefined,
      thinkingLevel: config.thinkingLevel || '',
      systemPrompt: config.systemPrompt,
      soul: agent.soul || undefined,
      skills: agent.skills.map((s) => ({
        id: s.id,
        skillId: s.skillId,
        skill: s.skill,
      })),
    }

    return c.json(info, 200)
  })
  .delete('/agents/:agentId', async (c) => {
    const agentId = c.req.param('agentId')
    const userReq = c.get('user')

    await authzService.hasPermission({
      user: userReq,
      permission: Permission.Admin,
      type: ResourceType.Agent,
      id: agentId,
    })

    await agentService.deleteAgent({
      agentId,
    })

    return new Response(null, { status: 204 })
  })
  .get('/agent-sessions/:sessionId/entries', async (c) => {
    const sessionId = c.req.param('sessionId')
    const userReq = c.get('user')

    await authzService.hasPermission({
      user: userReq,
      permission: Permission.Admin,
      type: ResourceType.AgentSession,
      id: sessionId,
    })

    const entries = await agentService.getSessionEntries({ sessionId })
    const infos = entries.map((entry) => ({
      id: entry.id,
      sessionId: entry.sessionId,
      entry: entry.entry,
    }))

    return c.json(infos, 200)
  })

export default route
