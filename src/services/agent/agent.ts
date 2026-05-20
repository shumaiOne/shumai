import { prisma } from '@/db'
import {
  CreateAgentParams,
  DeleteAgentParams,
  ListAgentsParams,
  UpdateAgentParams,
} from '@/dtos/agent'
import '@/prisma-json-types'
import { createAgentSession, fieldsToTypeBoxSchema, type AutofillField } from '@/agent'
import { DatabaseSessionManager } from '@/agent/database-session-manager'
import { logger } from '@/logger'
import { Usage } from '@/services/ai/provider/provider'
import { s3Service } from '@/services/s3/s3'
import { defineTool, type ToolDefinition } from '@mariozechner/pi-coding-agent'
import { type TextContent, type ImageContent } from '@mariozechner/pi-ai'

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

    if (type === 'embedding' || type === 'transcription' || type === 'autofill') {
      const existing = await this.prismaClient.agent.findFirst({
        where: {
          type,
          user: {
            teamMembers: {
              some: { teamId },
            },
          },
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

    if (type === 'embedding' || type === 'transcription' || type === 'autofill') {
      const teamId = agent.user.teamMembers[0]?.teamId
      if (teamId) {
        const existing = await this.prismaClient.agent.findFirst({
          where: {
            type,
            id: { not: agentId },
            user: {
              teamMembers: {
                some: { teamId },
              },
            },
          },
        })
        if (existing) {
          throw new Error(`Agent of type ${type} already exists for this team`)
        }
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
        user: {
          teamMembers: {
            some: { teamId: params.teamId },
          },
        },
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

  private async getTeam(teamId: string) {
    return this.prismaClient.team.findUnique({
      where: { id: teamId },
    })
  }

  private async getSandbox(teamId: string) {
    return this.prismaClient.sandbox.findUnique({
      where: { teamId },
    })
  }

  async chat(teamId: string, prompt: string): Promise<{ text: string; usage: Usage }> {
    const agent = await this.prismaClient.agent.findFirst({
      where: {
        type: 'chat',
        enabled: true,
        user: {
          teamMembers: {
            some: { teamId },
          },
        },
      },
    })
    if (!agent) {
      throw new Error('no chat agent found for team')
    }
    const { text, usage } = await this.chatWithAgent(teamId, agent.id, prompt, [], '')
    return { text, usage }
  }

  async chatWithAgent(
    teamId: string,
    agentId: string,
    prompt: string,
    images: string[],
    agentsInstruction: string,
    sessionId?: string,
    userId?: string,
    tools: ToolDefinition[] = [],
  ): Promise<{ text: string; usage: Usage; sessionId: string }> {
    const t = await this.getTeam(teamId)
    if (!t) throw new Error('failed to get team')

    const agent = await this.prismaClient.agent.findUnique({
      where: { id: agentId },
      include: {
        provider: true,
        modelRef: true,
      },
    })

    if (!agent) {
      throw new Error(`agent ${agentId} not found`)
    }

    if (!agent.provider) throw new Error('agent has no provider configured')
    if (!agent.modelRef) throw new Error('agent has no model configured')

    const providerName = agent.provider.name
    const modelId = agent.modelRef.modelId

    // Fetch the required provider configuration from database
    const dbProviders = await this.prismaClient.provider.findMany({
      where: { teamId, name: providerName },
      include: { models: true },
    })

    // Setup credentials
    const dbProvider = dbProviders[0]
    const apiKey = dbProvider?.config.apiKey as string | undefined

    // Fetch team skills
    const teamSkills = await this.prismaClient.skill.findMany({
      where: { teamId },
    })

    const sandbox = await this.getSandbox(teamId)
    const allowedDomains = sandbox?.allowedDomains || []

    const sessionManager = await DatabaseSessionManager.create({
      agentId,
      userId,
      sessionId,
      cwd: process.cwd(),
    })

    let systemPrompt = '你是shumai小助手。'
    if (agentsInstruction) {
      systemPrompt = `${systemPrompt}\n\nContext and Instructions:\n${agentsInstruction}`
    }

    const modelConfig = agent.modelRef?.config as unknown as PrismaJson.ModelConfig
    if (modelConfig?.input) {
      systemPrompt += `\n\nYour current model supports the following input types: ${modelConfig.input.join(', ')}.`
    }

    const session = await createAgentSession({
      agentId,
      providerName,
      modelId,
      apiKey,
      systemPrompt,
      teamSkills: teamSkills.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
      })),
      allowedDomains,
      sessionManager,
      customTools: tools,
      providers: dbProviders.map((p) => ({
        name: p.name,
        config: p.config,
        models: p.models.map((m) => ({
          modelId: m.modelId,
          name: m.name,
          config: m.config,
        })),
      })),
    })

    const content: (TextContent | ImageContent)[] = []

    if (agentsInstruction) {
      session.state.systemPrompt = `${session.state.systemPrompt}\n\nContext and Instructions:\n${agentsInstruction}`
    }
    content.push({ type: 'text', text: prompt })

    if (images && images.length > 0) {
      for (const key of images) {
        const { buffer, contentType } = await s3Service.getObject(
          process.env.S3_BUCKET || 'shumai',
          key,
        )
        content.push({
          type: 'image',
          data: buffer.toString('base64'),
          mimeType: contentType,
        })
      }
    }

    try {
      await session.sendUserMessage(content)

      session.state.messages.forEach((msg) => {
        if (msg.role === 'toolResult') {
          const logMsg = { ...msg, content: undefined }
          logger.debug(logMsg, 'agent message')
        } else {
          logger.debug(msg, 'agent message')
        }
      })

      const stats = session.getSessionStats()
      const text = session.getLastAssistantText() || ''

      if (!text) {
        const lastMessage = session.messages[session.messages.length - 1]
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.errorMessage) {
          throw new Error(`AI error: ${lastMessage.errorMessage}`)
        }
      }

      const usage: Usage = {
        model: modelId,
        inputTokens: stats.tokens.input || 0,
        outputTokens: stats.tokens.output || 0,
      }

      await sessionManager.waitForSync()

      return { text, usage, sessionId: sessionManager.getDbSessionId() }
    } finally {
      // Cleanup handled by agent session if needed
    }
  }

  async autofill(
    teamId: string,
    prompt: string,
    images: string[],
    fields: AutofillField[],
  ): Promise<{ text: string; usage: Usage }> {
    const agent = await this.prismaClient.agent.findFirst({
      where: {
        type: 'autofill',
        enabled: true,
        user: {
          teamMembers: {
            some: { teamId },
          },
        },
      },
    })
    if (!agent) {
      throw new Error('no autofill agent found for team')
    }

    const toolSchema = fieldsToTypeBoxSchema(fields)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let capturedData: any = null

    const autofillTool = defineTool({
      name: 'autofill_metadata',
      label: 'Autofill Metadata',
      description: 'Extract metadata from the images.',
      parameters: toolSchema,
      execute: async (_toolCallId, params) => {
        capturedData = params
        return {
          content: [{ type: 'text', text: 'Metadata captured successfully.' }],
          details: {},
        }
      },
    })

    const fullPrompt = `${prompt}\n\nPlease use the "autofill_metadata" tool to provide the extracted metadata.`

    const { usage } = await this.chatWithAgent(
      teamId,
      agent.id,
      fullPrompt,
      images,
      '',
      undefined,
      undefined,
      [autofillTool],
    )

    return {
      text: capturedData ? JSON.stringify(capturedData) : '{}',
      usage,
    }
  }
}

export const agentService = new AgentService()
