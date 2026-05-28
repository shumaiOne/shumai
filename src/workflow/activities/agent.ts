import { createAgentSession, fieldsToTypeBoxSchema, type AutofillField } from '@/agent'
import { logger } from '@/logger'
import { s3Service } from '@/services/s3/s3'
import { type AgentTool } from '@earendil-works/pi-agent-core'
import { type ImageContent } from '@earendil-works/pi-ai'
import { type Usage } from '@/services/ai/provider/provider'
import { ApplicationFailure } from '@temporalio/activity'

interface AgentExecutionContext {
  agent: unknown
  dbProviders: unknown[]
  teamSkills: unknown[]
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- context is a serialized JSON object from db activity
  const context = params.context as any
  const agent = context.agent
  const dbProviders = context.dbProviders
  const teamSkills = context.teamSkills
  const allowedDomains = context.allowedDomains

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

  let systemPrompt = '你是shumai小助手。'
  if (params.agentsInstruction) {
    systemPrompt = `${systemPrompt}\n\nContext and Instructions:\n${params.agentsInstruction}`
  }

  const modelConfig = agent.modelRef?.config as unknown as PrismaJson.ModelConfig
  if (modelConfig?.input) {
    systemPrompt += `\n\nYour current model supports the following input types: ${modelConfig.input.join(', ')}.`
  }

  const { session, harness } = await createAgentSession({
    agentId: params.agentId,
    providerName,
    modelId,
    systemPrompt,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- s is typed as any because teamSkills is dynamically deserialized JSON
    teamSkills: teamSkills.map((s: any) => ({
      id: s.id,
      name: s.name,
      description: s.description,
    })),
    allowedDomains,
    sessionId: params.sessionId,
    userId: params.userId,
    customTools: params.tools || [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- p is typed as any because dbProviders is dynamically deserialized JSON
    providers: dbProviders.map((p: any) => ({
      name: p.name,
      config: p.config,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- m is typed as any because p.models is a generic dynamic JSON array from the DB context
      models: p.models.map((m: any) => ({
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- text property exists on text content items
      .map((c) => (c as any).text)
      .join('\n')

    const usage: Usage = {
      model: modelId,
      inputTokens: assistantMessage.usage?.input || 0,
      outputTokens: assistantMessage.usage?.output || 0,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- sessionId property added to DatabaseSessionStorage
    return { text, usage, sessionId: (session.getStorage() as any).sessionId }
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let capturedData: any = null

  const autofillTool: AgentTool = {
    name: 'autofill_metadata',
    label: 'Autofill Metadata',
    description: 'Extract metadata from the images.',
    parameters: toolSchema,
    execute: async (_toolCallId, toolParams) => {
      capturedData = toolParams
      return {
        content: [{ type: 'text', text: 'Metadata captured successfully.' }],
        details: {},
      }
    },
  }

  const fullPrompt = `${prompt}\n\nPlease use the "autofill_metadata" tool to provide the extracted metadata.`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- context is a serialized JSON object from db activity
  const context = params.context as any
  const agent = context.agent

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
