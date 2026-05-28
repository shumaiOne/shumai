import { prisma } from '@/db'
import {
  CreateAgentParams,
  DeleteAgentParams,
  ListAgentsParams,
  UpdateAgentParams,
} from '@/dtos/agent'
import '@/prisma-json-types'

export class AgentService {
  constructor(private readonly prismaClient: typeof prisma = prisma) {}

  async createAgent(params: CreateAgentParams) {
    const {
      teamId,
      name,
      type,
      enabled,
      avatar,
      providerId,
      modelId,
      thinkingLevel,
      systemPrompt,
      soul,
      skills,
    } = params

    if (type === 'embedding' || type === 'autofill') {
      const existing = await this.prismaClient.agent.findFirst({
        where: {
          type,
          teamId,
        },
      })
      if (existing) {
        throw new Error(`Agent of type ${type} already exists for this team`)
      }
    }

    if (type === 'chat' || type === 'autofill') {
      if (!providerId || !modelId) {
        throw new Error('providerId and modelId are required for chat/autofill agents')
      }
      const model = await this.prismaClient.model.findUnique({
        where: { id: modelId },
      })
      if (!model) throw new Error('model not found')
      if (model.providerId !== providerId) {
        throw new Error('model does not belong to provider')
      }
    }

    return this.prismaClient.$transaction(async (tx) => {
      const team = await tx.team.findUnique({
        where: { id: teamId },
      })
      if (!team) throw new Error('team not found')

      const agentConfig: PrismaJson.AgentConfig = {
        provider: providerId || '',
        model: modelId || '',
        thinkingLevel,
        systemPrompt,
      }

      const user = await tx.user.create({
        data: {
          name,
          email: `agent-${Date.now()}-${Math.random().toString(36).substring(7)}@shumai.ai`,
          type: 'agent',
          image: avatar,
        },
      })

      const agent = await tx.agent.create({
        data: {
          id: user.id,
          teamId,
          type,
          enabled: enabled ?? true,
          providerId: providerId || null,
          modelId: modelId || null,
          soul,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          config: agentConfig as any,
          skills: {
            create:
              skills?.map((skillId) => ({
                skillId,
              })) || [],
          },
        },
      })

      await tx.teamMember.create({
        data: {
          teamId,
          userId: user.id,
          role: 'reviewer', // Default role for agents
        },
      })

      return tx.agent.findUnique({
        where: { id: agent.id },
        include: { user: true, skills: { include: { skill: true } } },
      })
    })
  }

  async updateAgent(params: UpdateAgentParams) {
    const {
      agentId,
      name,
      type,
      enabled,
      avatar,
      providerId,
      modelId,
      thinkingLevel,
      systemPrompt,
      soul,
      skills,
    } = params

    const agent = await this.prismaClient.agent.findUnique({
      where: { id: agentId },
      include: { user: { include: { teamMembers: true } } },
    })

    if (!agent) throw new Error('agent not found')

    if (type === 'embedding' || type === 'autofill') {
      const existing = await this.prismaClient.agent.findFirst({
        where: {
          type,
          id: { not: agentId },
          teamId: agent.teamId,
        },
      })
      if (existing) {
        throw new Error(`Agent of type ${type} already exists for this team`)
      }
    }

    if (type === 'chat' || type === 'autofill') {
      if (!providerId || !modelId) {
        throw new Error('providerId and modelId are required for chat/autofill agents')
      }
      const model = await this.prismaClient.model.findUnique({
        where: { id: modelId },
      })
      if (!model) throw new Error('model not found')
      if (model.providerId !== providerId) {
        throw new Error('model does not belong to provider')
      }
    }

    const agentConfig: PrismaJson.AgentConfig = {
      provider: providerId || '',
      model: modelId || '',
      thinkingLevel,
      systemPrompt,
    }

    return this.prismaClient.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: agentId },
        data: {
          name,
          image: avatar,
        },
      })

      // Update skills: easier to delete all and recreate
      await tx.agentSkill.deleteMany({
        where: { agentId },
      })

      return tx.agent.update({
        where: { id: agentId },
        data: {
          type,
          enabled: enabled ?? true,
          providerId: providerId || null,
          modelId: modelId || null,
          soul,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          config: agentConfig as any,
          skills: {
            create:
              skills?.map((skillId) => ({
                skillId,
              })) || [],
          },
        },
        include: { user: true, skills: { include: { skill: true } } },
      })
    })
  }

  async deleteAgent(params: DeleteAgentParams) {
    const { agentId } = params

    const agent = await this.prismaClient.agent.findUnique({
      where: { id: agentId },
    })

    if (!agent) throw new Error('agent not found')

    // Deleting user will cascade to agent and teamMember due to schema definition
    await this.prismaClient.user.delete({
      where: { id: agentId },
    })
  }

  async listAgents(params: ListAgentsParams) {
    return this.prismaClient.agent.findMany({
      where: {
        teamId: params.teamId,
      },
      orderBy: {
        id: 'desc',
      },
      include: {
        user: true,
        provider: true,
        modelRef: true,
        skills: {
          include: {
            skill: true,
          },
        },
      },
    })
  }

  async getSessionEntries(params: { sessionId: string }) {
    return this.prismaClient.agentSessionEntry.findMany({
      where: { sessionId: params.sessionId },
      orderBy: { id: 'asc' },
    })
  }
}

export const agentService = new AgentService()
