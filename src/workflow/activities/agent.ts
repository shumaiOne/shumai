import { createAgentSession, fieldsToTypeBoxSchema, type AutofillField } from '@/agent'
import { DatabaseSessionStorage } from '@/agent/database-session-storage'
import { logger } from '@/logger'
import { s3Service } from '@/services/s3/s3'
import { type AgentTool } from '@earendil-works/pi-agent-core'
import { type ImageContent } from '@earendil-works/pi-ai'
import { ApplicationFailure } from '@temporalio/activity'

export interface Usage {
  inputTokens: number
  outputTokens: number
  model: string
}
import type { Prisma, Skill } from '@/generated/prisma/client'

export type AgentWithProviderAndModel = Prisma.AgentGetPayload<{
  include: {
    provider: true
    modelRef: true
  }
}>

export type DbProviderWithModels = Prisma.ProviderGetPayload<{
  include: {
    models: true
  }
}>

export interface AgentExecutionContext {
  agent: AgentWithProviderAndModel
  dbProviders: DbProviderWithModels[]
  teamSkills: Skill[]
  allowedDomains: string[]
}

async function executeAgentPrompt(params: {
  teamId: string
  agentId: string
  prompt: string
  images: string[]
  agentsInstruction: string
  sessionId?: string
  userId?: string
  tools?: AgentTool[]
  context: AgentExecutionContext
}): Promise<{ text: string; usage: Usage; sessionId: string }> {
  const { agent, dbProviders, teamSkills, allowedDomains } = params.context

  if (!agent.provider) {
    throw ApplicationFailure.create({
      message: 'agent has no provider configured',
      nonRetryable: true,
    })
  }
  if (!agent.modelRef) {
    throw ApplicationFailure.create({
      message: 'agent has no model configured',
      nonRetryable: true,
    })
  }

  const providerName = agent.provider.name
  const modelId = agent.modelRef.modelId

  let systemPrompt = `You are the AI assistant for shumai.
shumai is a professional creative collaboration platform similar to frame.io, where users can upload creative files, manage projects, assign tasks, get precise feedback, and share their work. As the agent, your role is to help users use and manage this platform.

shumai has its own cloud file system. If a user asks you to perform file system operations (for example: creating a folder, creating a file, stacking a version, or listing assets), you MUST use the corresponding agent system tools (e.g., 'create_folder', 'create_file', 'create_version', 'list_assets'). Do NOT use local bash commands or the local bash tool to perform these operations locally on the host environment; all operations must be executed through the platform's cloud file system tools so they are correctly registered and visible within the platform.`

  if (agent.soul) {
    systemPrompt = `${systemPrompt}\n\nAgent Personality and Core Instructions:\n${agent.soul}`
  }

  if (params.agentsInstruction) {
    systemPrompt = `${systemPrompt}\n\nContext and Instructions:\n${params.agentsInstruction}`
  }

  const modelConfig = agent.modelRef?.config
  if (modelConfig?.input) {
    systemPrompt += `\n\nYour current model supports the following input types: ${modelConfig.input.join(', ')}.`
  }

  const { session, harness } = await createAgentSession({
    agentId: params.agentId,
    providerName,
    modelId,
    systemPrompt,
    teamSkills: teamSkills.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
    })),
    allowedDomains,
    sessionId: params.sessionId,
    userId: params.userId,
    customTools: params.tools || [],
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

  const imagesToPass: ImageContent[] = []

  if (params.images && params.images.length > 0) {
    for (const key of params.images) {
      const { buffer, contentType } = await s3Service.getObject(
        process.env.S3_BUCKET || 'shumai',
        key,
      )
      imagesToPass.push({
        type: 'image',
        data: buffer.toString('base64'),
        mimeType: contentType,
      })
    }
  }

  try {
    const assistantMessage = await harness.prompt(params.prompt, { images: imagesToPass })

    const sessionEntries = await session.getEntries()
    sessionEntries.forEach((entry) => {
      if (entry.type === 'message') {
        const msg = entry.message
        if (msg.role === 'toolResult') {
          const logMsg = { ...msg, content: undefined }
          logger.debug(logMsg, 'agent message')
        } else {
          logger.debug(msg, 'agent message')
        }
      }
    })

    const text = assistantMessage.content
      .filter((c) => c.type === 'text')
      .map((c) => {
        if ('text' in c && typeof c.text === 'string') {
          return c.text
        }
        return ''
      })
      .join('\n')

    const usage: Usage = {
      model: modelId,
      inputTokens: assistantMessage.usage?.input || 0,
      outputTokens: assistantMessage.usage?.output || 0,
    }

    const storage = session.getStorage()
    let sessionId = ''
    if (storage instanceof DatabaseSessionStorage) {
      sessionId = storage.sessionId
    }
    return { text, usage, sessionId }
  } finally {
    // Cleanup handled by agent session if needed
  }
}

export interface AgentChatParams {
  teamId: string
  agentId: string
  message: string
  imageUrls: string[]
  projectId: string
  folderId: string
  agentsInstruction?: string
  sessionId: string
  userId?: string
  explicitMention?: boolean
  context: AgentExecutionContext
}

export async function agentChatActivity(params: AgentChatParams) {
  const cleanMessage = params.message.replace(/<@[A-Z0-9]+>/g, '').trim()
  const sessionId = params.sessionId

  return executeAgentPrompt({
    teamId: params.teamId,
    agentId: params.agentId,
    prompt: cleanMessage,
    images: params.imageUrls,
    agentsInstruction: params.agentsInstruction || '',
    sessionId,
    userId: params.userId,
    context: params.context,
  })
}

export interface AutofillAiParams {
  teamId: string
  images: string[]
  fields: AutofillField[]
  context: AgentExecutionContext
}

export async function autofillAiActivity(params: AutofillAiParams) {
  const prompt = 'Analyze the provided images and extract metadata.'
  const toolSchema = fieldsToTypeBoxSchema(params.fields)
  let capturedData: Record<string, unknown> | null = null

  const autofillTool: AgentTool = {
    name: 'autofill_metadata',
    label: 'Autofill Metadata',
    description: 'Extract metadata from the images.',
    parameters: toolSchema,
    execute: async (_toolCallId, toolParams) => {
      capturedData = toolParams as Record<string, unknown>
      return {
        content: [{ type: 'text', text: 'Metadata captured successfully.' }],
        details: {},
      }
    },
  }

  const fullPrompt = `${prompt}\n\nPlease use the "autofill_metadata" tool to provide the extracted metadata.`

  const { agent } = params.context

  const { usage, sessionId } = await executeAgentPrompt({
    teamId: params.teamId,
    agentId: agent.id,
    prompt: fullPrompt,
    images: params.images,
    agentsInstruction: '',
    sessionId: undefined,
    userId: undefined,
    tools: [autofillTool],
    context: params.context,
  })

  return {
    text: capturedData ? JSON.stringify(capturedData) : '{}',
    usage,
    sessionId,
  }
}
