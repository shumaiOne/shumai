import { prisma } from '@/db'
import { logger } from '@/logger'
import { Usage } from '@/services/ai/provider/provider'
import { s3Service } from '@/services/s3/s3'
import { SandboxManager } from '@anthropic-ai/sandbox-runtime'
import { getModel, type ImageContent, type TextContent } from '@mariozechner/pi-ai'
import {
    AuthStorage,
    createAgentSession,
    DefaultResourceLoader,
    defineTool,
    ModelRegistry,
    SessionManager,
    SettingsManager,
    type ToolDefinition,
} from '@mariozechner/pi-coding-agent'
import { Type, type TSchema } from '@sinclair/typebox'
import * as fs from 'fs'
import * as path from 'path'
import { DatabaseSessionManager } from './database-session-manager'
import { analyzeAssetMediaTool } from './tools/analyze-asset-media'
import { createReadSkillTool } from './tools/read-skill'
import { createSandboxedBashTool } from './tools/sandboxed-bash'

export interface AutofillField {
  id: string
  config: PrismaJson.FieldConfig
  description?: string | null
}

export class AgentExecutor {
  constructor(private readonly prismaClient: typeof prisma = prisma) {}

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

    const agentDir = path.join(process.cwd(), '.pi', 'agents', agent.id)
    if (!fs.existsSync(agentDir)) fs.mkdirSync(agentDir, { recursive: true })

    const authStorage = AuthStorage.create(path.join(agentDir, 'auth.json'))
    const modelRegistry = ModelRegistry.create(authStorage)
    modelRegistry.getAll()

    // Fetch and register the required provider from database
    const dbProviders = await this.prismaClient.provider.findMany({
      where: { teamId, name: providerName },
      include: { models: true },
    })
    for (const p of dbProviders) {
      // Ensure each model has a name (fallback to ID) to satisfy registerProvider's strict requirement
      const config = {
        ...p.config,
        models: p.models.map((m) => ({
          ...m.config,
          id: m.modelId,
          name: m.name || m.modelId,
        })),
      }
      modelRegistry.registerProvider(p.name, config)
    }

    // Setup credentials
    const dbProvider = dbProviders[0]
    if (dbProvider?.config.apiKey) {
      authStorage.set(providerName, { type: 'api_key', key: dbProvider.config.apiKey })
    }

    // Fetch team skills
    const teamSkills = await this.prismaClient.skill.findMany({
      where: { teamId },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = (getModel as any)(providerName, modelId)

    const settingsManager = SettingsManager.create(process.cwd(), agentDir)
    const resourceLoader = new DefaultResourceLoader({
      cwd: process.cwd(),
      agentDir,
      settingsManager,
      systemPromptOverride: () => {
        let systemPrompt = '你是shumai小助手。'
        if (agentsInstruction) {
          systemPrompt = `${systemPrompt}\n\nContext and Instructions:\n${agentsInstruction}`
        }

        const modelConfig = agent.modelRef?.config as unknown as PrismaJson.ModelConfig
        if (modelConfig?.input) {
          systemPrompt += `\n\nYour current model supports the following input types: ${modelConfig.input.join(', ')}.`
        }

        if (teamSkills.length > 0) {
          systemPrompt += '\n\nAvailable Skills:\n'
          for (const s of teamSkills) {
            systemPrompt += `- ${s.name} (ID: ${s.id}): ${s.description || 'No description'}\n`
          }
          systemPrompt +=
            '\nTo use a skill, first use the "read_skill" tool with the skill ID to read its instructions.'
        }

        return systemPrompt
      },
      noContextFiles: true,
    })
    await resourceLoader.reload()
    const sessionManager = await DatabaseSessionManager.create({
      agentId,
      userId,
      sessionId,
      cwd: process.cwd(),
    })

    const sandbox = await this.getSandbox(teamId)
    const allowedDomains = sandbox?.allowedDomains || []

    const piDir = path.join(process.cwd(), '.pi')
    if (!fs.existsSync(piDir)) fs.mkdirSync(piDir, { recursive: true })

    const allowWrite = [piDir, '/tmp']

    // NOTE: SandboxManager.initialize is a global operation that applies to the entire process.
    // anthropic-experimental/sandbox-runtime currently does not support separate managers per session/team.
    // Since this application is not designed for multi-tenancy at the process level (i.e. only one
    // team's chat happens at a time per worker instance), re-initializing here with current team's
    // settings is acceptable.
    await SandboxManager.initialize({
      network: {
        allowedDomains,
        deniedDomains: [],
      },
      filesystem: {
        allowWrite,
        denyWrite: ['.env', '.env.*', '*.pem', '*.key'],
        denyRead: ['~/.ssh', '~/.aws', '~/.gnupg'],
      },
    })

    const sandboxedBash = createSandboxedBashTool(process.cwd(), sessionManager)

    const { session } = await createAgentSession({
      cwd: process.cwd(),
      agentDir,
      authStorage,
      modelRegistry,
      model,
      resourceLoader,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sessionManager: sessionManager as any as SessionManager,
      customTools: [
        analyzeAssetMediaTool,
        createReadSkillTool(sessionManager),
        sandboxedBash,
        ...tools,
      ],
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
          // For tool results, log details (metadata) instead of content (which may have large images)
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

export const agentExecutor = new AgentExecutor()

export function fieldsToTypeBoxSchema(fields: AutofillField[]) {
  const properties: Record<string, TSchema> = {}
  for (const f of fields) {
    let schema: TSchema
    switch (f.config.type) {
      case 'text':
      case 'longText':
        schema = Type.String()
        break
      case 'number':
      case 'rating':
        schema = Type.Number()
        break
      case 'toggle':
        schema = Type.Boolean()
        break
      case 'select':
        schema = Type.String({
          enum: f.config.select?.options?.map((o) => o.id) || [],
        })
        break
      default:
        schema = Type.String()
    }

    if (f.description) {
      schema.description = f.description
    }
    properties[f.id] = schema
  }

  return Type.Object(properties)
}
