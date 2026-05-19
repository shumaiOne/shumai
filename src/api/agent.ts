import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { agentService } from '@/services/agent/agent'
import { authzService, Permission } from '@/services/authz/authz'
import {
  createAgentRequestSchema,
  updateAgentRequestSchema,
  AgentInfo,
  AgentType,
} from '@/dtos/agent'

import type { Prisma } from '@/generated/prisma/client'

type User = Prisma.UserGetPayload<Record<string, never>>

const route = new Hono<{ Variables: { user: User } }>()
  .get('/teams/:teamId/agents', async (c) => {
    const teamId = c.req.param('teamId')
    const userReq = c.get('user')

    await authzService.hasPermission({
      teamId,
      user: userReq,
      permission: Permission.Read,
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
      teamId,
      user: userReq,
      permission: Permission.Admin,
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
  .put(
    '/teams/:teamId/agents/:agentId',
    zValidator('json', updateAgentRequestSchema),
    async (c) => {
      const teamId = c.req.param('teamId')
      const agentId = c.req.param('agentId')
      const userReq = c.get('user')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        teamId,
        user: userReq,
        permission: Permission.Admin,
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
    },
  )
  .delete('/teams/:teamId/agents/:agentId', async (c) => {
    const teamId = c.req.param('teamId')
    const agentId = c.req.param('agentId')
    const userReq = c.get('user')

    await authzService.hasPermission({
      teamId,
      user: userReq,
      permission: Permission.Admin,
    })

    await agentService.deleteAgent({
      agentId,
    })

    return new Response(null, { status: 204 })
  })

export default route
