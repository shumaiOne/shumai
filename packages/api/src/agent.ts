import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { agentService } from '@shumai/core/src/agent/agent'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { getAvatarUrl } from '@shumai/core/src/user/avatar'
import {
  createAgentRequestSchema,
  updateAgentRequestSchema,
  paginationParamsSchema,
  AgentInfo,
  AgentType,
  AuditAction,
} from '@shumai/dtos'

import type { Prisma } from '@shumai/db'
import { auditLogService } from '@shumai/core/src/auditLog/auditLog'

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

    const res: AgentInfo[] = await Promise.all(
      agents.map(async (agent) => {
        const config = agent.config as unknown as PrismaJson.AgentConfig
        return {
          id: agent.id,
          name: agent.user.name,
          type: agent.type as AgentType,
          enabled: agent.enabled,
          avatar: (await getAvatarUrl(agent.user.image)) || undefined,
          providerId: agent.providerId || undefined,
          modelId: agent.modelId || undefined,
          thinkingLevel: config.thinkingLevel || 'off',
          systemPrompt: config.systemPrompt,
          soul: agent.soul || undefined,
          skills: agent.skills.map((s) => ({
            id: s.id,
            skillId: s.skillId,
            skill: s.skill,
          })),
          deniedTools: config.deniedTools || [],
        }
      }),
    )

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
      avatar: (await getAvatarUrl(agent.user.image)) || undefined,
      providerId: agent.providerId || undefined,
      modelId: agent.modelId || undefined,
      thinkingLevel: config.thinkingLevel || 'off',
      systemPrompt: config.systemPrompt,
      soul: agent.soul || undefined,
      skills: agent.skills.map((s) => ({
        id: s.id,
        skillId: s.skillId,
        skill: s.skill,
      })),
      deniedTools: config.deniedTools || [],
    }

    await auditLogService.logAction({
      action: AuditAction.agent_create,
      teamId,
      userId: userReq?.id,
      itemId: agent.id,
    })

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

    await auditLogService.logAction({
      action: AuditAction.agent_update,
      teamId: agent.teamId,
      userId: userReq?.id,
      itemId: agent.id,
    })

    const config = agent.config as unknown as PrismaJson.AgentConfig
    const info: AgentInfo = {
      id: agent.id,
      name: agent.user.name,
      type: agent.type as AgentType,
      enabled: agent.enabled,
      avatar: (await getAvatarUrl(agent.user.image)) || undefined,
      providerId: agent.providerId || undefined,
      modelId: agent.modelId || undefined,
      thinkingLevel: config.thinkingLevel || 'off',
      systemPrompt: config.systemPrompt,
      soul: agent.soul || undefined,
      skills: agent.skills.map((s) => ({
        id: s.id,
        skillId: s.skillId,
        skill: s.skill,
      })),
      deniedTools: config.deniedTools || [],
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

    const existingAgent = await agentService.getAgent({ agentId })

    await agentService.deleteAgent({
      agentId,
    })

    if (existingAgent) {
      await auditLogService.logAction({
        action: AuditAction.agent_delete,
        teamId: existingAgent.teamId,
        userId: userReq?.id,
        itemId: agentId,
      })
    }

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
  .get('/teams/:teamId/agent-sessions', zValidator('query', paginationParamsSchema), async (c) => {
    const teamId = c.req.param('teamId')
    const userReq = c.get('user')
    const query = c.req.valid('query')

    await authzService.hasPermission({
      user: userReq,
      permission: Permission.Admin,
      type: ResourceType.Team,
      id: teamId,
    })

    const res = await agentService.listSessions(teamId, query)
    return c.json(res, 200)
  })

export default route
