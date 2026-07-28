import {
  type AgentMessage,
  type AgentTool,
  type SessionTreeEntry,
} from '@earendil-works/pi-agent-core'
import { type ImageContent } from '@earendil-works/pi-ai'
import { assetService } from '@shumai/core/src/asset/asset'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { logger } from '@shumai/core/src/logger'
import { metadataService } from '@shumai/core/src/metadata/metadata'
import { encodeCursor, paginateQuery } from '@shumai/core/src/pagination'
import { s3Service } from '@shumai/core/src/s3/s3'
import { uploadService } from '@shumai/core/src/upload/upload'
import { VersionStackService } from '@shumai/core/src/versionStack/versionStack'
import { AssetType, prisma, Prisma, type Skill } from '@shumai/db'
import { ApplicationFailure, Context } from '@temporalio/activity'
import { registerLocalCancelHandler, unregisterLocalCancelHandler } from '@shumai/workflow-core'
import { generateKeyBetween } from 'jittered-fractional-indexing'
import { ulid } from 'ulid'
import { DatabaseSessionStorage } from '../database-session-storage'
import {
  createAgentSession,
  fieldsToTypeBoxSchema,
  type AutofillField,
  type DbProviderInfo,
} from '../index'

import { aiUsageService } from '@shumai/core/src/ai-usage/ai-usage'
import { UpdateAssetMetadataRequest } from '@shumai/dtos'

export interface Usage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  totalTokens: number
  cost: number
  model: string
}

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
  taskId?: string
  teamId: string
  agentId: string
  prompt: string
  images: string[]
  agentsInstruction: string
  sessionId?: string
  userId?: string
  userCommentId?: string | null
  tools?: AgentTool[]
  context: AgentExecutionContext
  attachedAssets?: Array<{ id: string; name: string; type: string }>
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

shumai has its own cloud file system. If a user asks you to perform file system operations (for example: creating a folder, creating a file, stacking a version, or listing assets), you MUST use the corresponding agent system tools (e.g., 'create_folder', 'create_file', 'create_version', 'list_assets'). Do NOT use local bash commands or the local bash tool to perform these operations locally on the host environment; all operations must be executed through the platform's cloud file system tools so they are correctly registered and visible within the platform.

If you need to create files in the local filesystem (for example, a temporary file for uploading), only the '.pi' folder in the current directory has write permissions. Do NOT attempt to create files in any other directories.`

  if (agent.soul) {
    systemPrompt = `${systemPrompt}\n\nAgent Personality and Core Instructions:\n${agent.soul}`
  }

  // Note: params.agentsInstruction is no longer appended to systemPrompt here.
  // Instead, it is persisted as a custom message session entry in the conversation history below.

  const modelConfig = agent.modelRef?.config
  if (modelConfig?.input) {
    systemPrompt += `\n\nYour current model supports the following input types: ${modelConfig.input.join(', ')}.`
  }

  const agentConfig = agent.config as PrismaJson.AgentConfig | null | undefined
  const thinkingLevel = agentConfig?.thinkingLevel || 'off'

  const { session, harness } = await createAgentSession({
    teamId: params.teamId,
    agentId: params.agentId,
    providerName,
    modelId,
    systemPrompt,
    thinkingLevel,
    teamSkills: teamSkills.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
    })),
    allowedDomains,
    sessionId: params.sessionId,
    userId: params.userId,
    userCommentId: params.userCommentId,
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

  let heartbeatInterval: ReturnType<typeof setInterval> | null = null

  const onAbort = () => {
    harness.abort()
  }

  let temporalSignal: EventTarget | undefined
  try {
    temporalSignal = Context.current().cancellationSignal
  } catch {
    // Ignore
  }

  if (temporalSignal) {
    temporalSignal.addEventListener('abort', onAbort, { once: true })

    heartbeatInterval = setInterval(() => {
      try {
        Context.current().heartbeat()
      } catch (err) {
        logger.debug({ err }, 'Failed to send activity heartbeat')
      }
    }, 2000)
  } else if (params.taskId) {
    registerLocalCancelHandler(params.taskId, () => {
      harness.abort()
    })
  }

  try {
    if (params.agentsInstruction && params.agentsInstruction.trim()) {
      const storage = session.getStorage()
      const parentId = await storage.getLeafId()
      await storage.appendEntry({
        id: ulid(),
        type: 'custom_message',
        parentId,
        timestamp: new Date().toISOString(),
        customType: 'context',
        content: params.agentsInstruction.trim(),
      } as unknown as SessionTreeEntry)
    }

    if (params.attachedAssets && params.attachedAssets.length > 0) {
      const storage = session.getStorage()
      const parentId = await storage.getLeafId()
      await storage.appendEntry({
        id: ulid(),
        type: 'custom',
        parentId,
        timestamp: new Date().toISOString(),
        customType: 'context_display_info',
        data: {
          assets: params.attachedAssets,
        },
      } as unknown as SessionTreeEntry)
    }

    let totalInputTokens = 0
    let totalOutputTokens = 0
    let totalCacheReadTokens = 0
    let grandTotalTokens = 0
    let totalCost = 0

    harness.subscribe(async (event) => {
      if (event.type === 'message_end' && event.message.role === 'assistant') {
        const assistantMsg = event.message
        const u = assistantMsg.usage
        if (u) {
          const inputTokens = u.input || 0
          const outputTokens = u.output || 0
          const cacheReadTokens = u.cacheRead || 0
          const totalTokens = u.totalTokens || inputTokens + outputTokens
          const cost = u.cost?.total || 0

          totalInputTokens += inputTokens
          totalOutputTokens += outputTokens
          totalCacheReadTokens += cacheReadTokens
          grandTotalTokens += totalTokens
          totalCost += cost

          try {
            await aiUsageService.recordUsage({
              teamId: params.teamId,
              userId: params.userId,
              inputTokens,
              outputTokens,
              cacheReadTokens,
              totalTokens,
              cost,
            })
          } catch (err) {
            logger.error({ err }, 'Failed to record AI usage')
          }
        }
      }
    })

    const assistantMessage = await harness.prompt(params.prompt, { images: imagesToPass })

    if (totalInputTokens === 0 && totalOutputTokens === 0 && assistantMessage.usage) {
      totalInputTokens = assistantMessage.usage.input || 0
      totalOutputTokens = assistantMessage.usage.output || 0
      totalCacheReadTokens = assistantMessage.usage.cacheRead || 0
      grandTotalTokens = assistantMessage.usage.totalTokens || totalInputTokens + totalOutputTokens
      totalCost = assistantMessage.usage.cost?.total || 0
    }

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

    let text = assistantMessage.content
      .filter((c) => c.type === 'text')
      .map((c) => {
        if ('text' in c && typeof c.text === 'string') {
          return c.text
        }
        return ''
      })
      .join('\n')

    if (assistantMessage.stopReason === 'error' && assistantMessage.errorMessage) {
      if (text) {
        text += '\n\n'
      }
      text += `Error: ${assistantMessage.errorMessage}`
    }

    const usage: Usage = {
      model: modelId,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      cacheReadTokens: totalCacheReadTokens,
      totalTokens: grandTotalTokens,
      cost: totalCost,
    }

    const storage = session.getStorage()
    let sessionId = ''
    if (storage instanceof DatabaseSessionStorage) {
      sessionId = storage.sessionId
    }
    return { text, usage, sessionId }
  } finally {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval)
    }
    if (temporalSignal) {
      temporalSignal.removeEventListener('abort', onAbort)
    }
    if (params.taskId) {
      unregisterLocalCancelHandler(params.taskId)
    }
  }
}

export interface AgentChatParams {
  taskId?: string
  teamId: string
  agentId: string
  message: string
  imageUrls: string[]
  projectId: string
  folderId: string
  agentsInstruction?: string
  sessionId: string
  userId?: string
  userCommentId?: string | null
  context: AgentExecutionContext
  attachedAssets?: Array<{ id: string; name: string; type: string }>
}

export async function getUserTeamInfoActivity(params: {
  userId?: string
  teamId: string
}): Promise<{ name: string; role: string } | null> {
  if (!params.userId) return null
  const [user, member] = await Promise.all([
    prisma.user.findUnique({
      where: { id: params.userId },
      select: { name: true },
    }),
    prisma.teamMember.findUnique({
      where: { teamIdUserId: { teamId: params.teamId, userId: params.userId } },
      select: { role: true },
    }),
  ])
  if (!user) return null
  return {
    name: user.name || 'Unknown User',
    role: member?.role || 'user',
  }
}

export async function agentChatActivity(params: AgentChatParams) {
  const cleanMessage = params.message.replace(/<@[A-Z0-9]+>/g, '').trim()
  const sessionId = params.sessionId

  let prompt = cleanMessage
  if (params.userCommentId) {
    let targetUserId = params.userId
    if (!targetUserId) {
      const comment = await prisma.assetComment.findUnique({
        where: { id: params.userCommentId },
        select: { creatorId: true },
      })
      targetUserId = comment?.creatorId || undefined
    }
    if (targetUserId) {
      const userInfo = await getUserTeamInfoActivity({
        userId: targetUserId,
        teamId: params.teamId,
      })
      if (userInfo) {
        prompt = `[${userInfo.name} (${userInfo.role})]: ${cleanMessage}`
      }
    }
  }

  return executeAgentPrompt({
    taskId: params.taskId,
    teamId: params.teamId,
    agentId: params.agentId,
    prompt,
    images: params.imageUrls,
    agentsInstruction: params.agentsInstruction || '',
    sessionId,
    userId: params.userId,
    userCommentId: params.userCommentId,
    context: params.context,
    attachedAssets: params.attachedAssets,
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

export async function initializeAgentSessionActivity(params: {
  teamId: string
  agentId: string
  userCommentId: string
  userId?: string
}): Promise<string> {
  const agentId = params.agentId === 'default' ? 'default' : params.agentId

  // Ensure user exists for agent
  const userExists = await prisma.user.findUnique({ where: { id: agentId } })
  if (!userExists) {
    await prisma.user.create({
      data: {
        id: agentId,
        name: 'Ai Agent',
        email: `${agentId}@shumai.ai`,
        type: 'agent',
      },
    })
  }

  // Ensure agent exists
  const agentExists = await prisma.agent.findUnique({ where: { id: agentId } })
  if (!agentExists) {
    await prisma.agent.create({
      data: {
        id: agentId,
        teamId: params.teamId,
        type: 'chat',
        config: {
          provider: 'openai',
          model: 'gpt-4',
        },
      },
    })
  }

  const userComment = await prisma.assetComment.findUnique({
    where: { id: params.userCommentId },
    include: { creator: true },
  })

  if (!userComment) {
    throw new Error(`User comment ${params.userCommentId} not found`)
  }

  const isThread = !!userComment.replyToId
  const rootCommentId = userComment.replyToId || userComment.id
  const targetUserCommentId = isThread ? rootCommentId : null

  let session = await prisma.agentSession.findFirst({
    where: {
      assetId: userComment.assetId,
      type: 'comment',
      userCommentId: targetUserCommentId,
    },
  })

  if (!session) {
    session = await prisma.agentSession.create({
      data: {
        agentId,
        userId: params.userId || null,
        cwd: process.cwd(),
        assetId: userComment.assetId,
        userCommentId: targetUserCommentId,
        type: 'comment',
      },
    })
  }
  const sessionId = session.id

  // If this is a Thread Session, ensure preceding top-level comments up to rootCommentId are synced in Main Session first
  if (isThread) {
    let mainSession = await prisma.agentSession.findFirst({
      where: {
        assetId: userComment.assetId,
        type: 'comment',
        userCommentId: null,
      },
    })
    if (!mainSession) {
      mainSession = await prisma.agentSession.create({
        data: {
          agentId,
          userId: params.userId || null,
          cwd: process.cwd(),
          assetId: userComment.assetId,
          userCommentId: null,
          type: 'comment',
        },
      })
    }

    const topLevelComments = await prisma.assetComment.findMany({
      where: {
        assetId: userComment.assetId,
        replyToId: null,
        createdAt: { lte: userComment.createdAt },
      },
      orderBy: { createdAt: 'asc' },
      include: { creator: true },
    })

    let mainPrevId: string | null = mainSession.leafId
    for (const c of topLevelComments) {
      const existingEntry = await prisma.agentSessionEntry.findUnique({
        where: { id: c.id },
        select: { id: true },
      })
      if (existingEntry) {
        mainPrevId = existingEntry.id
        continue
      }

      const isAgent = c.creator?.type === 'agent' || c.sessionId !== null
      let messageContent = c.message || ''
      if (isAgent) {
        const agentName = c.creator?.name || 'Ai Agent'
        messageContent = `[Agent Message][${agentName}]: ${messageContent}`
      } else if (c.creator?.name) {
        messageContent = `[${c.creator.name} (user)]: ${messageContent}`
      }

      const entryId = c.id
      const message: AgentMessage = {
        role: 'user',
        content: [{ type: 'text', text: messageContent }],
        timestamp: c.createdAt.getTime(),
      }
      await prisma.agentSessionEntry.create({
        data: {
          id: entryId,
          sessionId: mainSession.id,
          assetId: userComment.assetId,
          type: 'message',
          parentId: mainPrevId,
          createdAt: c.createdAt,
          data: { message },
        },
      })
      mainPrevId = entryId
    }

    if (mainPrevId && mainPrevId !== mainSession.leafId) {
      await prisma.agentSession.update({
        where: { id: mainSession.id },
        data: { leafId: mainPrevId },
      })
    }
  }

  // Fetch existing comments as context for current session
  let existingComments: Array<{
    id: string
    message: string | null
    createdAt: Date
    creatorId: string | null
    creator: { type: string; name: string } | null
    sessionId: string | null
    replyToId: string | null
  }> = []

  if (!isThread) {
    // Main Session: Only fetch top-level comments (replyToId: null)
    existingComments = await prisma.assetComment.findMany({
      where: {
        assetId: userComment.assetId,
        replyToId: null,
        id: { not: userComment.id },
      },
      orderBy: { createdAt: 'asc' },
      include: { creator: true },
    })
  } else {
    // Thread Session: Fetch root comment + replies in this specific thread (replyToId: rootCommentId)
    const rootComment = await prisma.assetComment.findUnique({
      where: { id: rootCommentId },
      include: { creator: true },
    })
    if (rootComment) {
      const replies = await prisma.assetComment.findMany({
        where: {
          replyToId: rootCommentId,
          id: { not: userComment.id },
        },
        orderBy: { createdAt: 'asc' },
        include: { creator: true },
      })
      existingComments = [rootComment, ...replies]
    }
  }

  // Check which top-level comments have reply threads (for prompt tagging)
  // Resolve user mentions from IDs to names
  const mentionRegex = /<@([^>]+)>/g
  const mentionedUserIds = new Set<string>()
  for (const c of existingComments) {
    if (c.message) {
      const matches = [...c.message.matchAll(mentionRegex)]
      for (const match of matches) {
        mentionedUserIds.add(match[1])
      }
    }
  }

  const userIdToNameMap = new Map<string, string>()
  if (mentionedUserIds.size > 0) {
    const resolvedUsers = await prisma.user.findMany({
      where: {
        id: { in: Array.from(mentionedUserIds) },
      },
      select: {
        id: true,
        name: true,
      },
    })
    for (const u of resolvedUsers) {
      if (u.name) {
        userIdToNameMap.set(u.id, u.name)
      }
    }
  }

  const userRoleMap = new Map<string, string>()
  const humanCreatorIds = Array.from(
    new Set(
      existingComments
        .filter((c) => c.creator?.type !== 'agent' && c.creatorId)
        .map((c) => c.creatorId!),
    ),
  )
  if (humanCreatorIds.length > 0) {
    const members = await prisma.teamMember.findMany({
      where: {
        teamId: params.teamId,
        userId: { in: humanCreatorIds },
      },
      select: { userId: true, role: true },
    })
    for (const m of members) {
      userRoleMap.set(m.userId, m.role)
    }
  }

  // Save context as AgentSessionEntry records (with parent pointers)
  let prevId: string | null = session.leafId
  for (const c of existingComments) {
    // Check if entry already exists for this comment
    const existingEntry = await prisma.agentSessionEntry.findUnique({
      where: { id: c.id },
      select: { id: true },
    })
    if (existingEntry) {
      prevId = existingEntry.id
      continue
    }

    const isAgent = c.creator?.type === 'agent' || c.sessionId !== null
    let messageContent = c.message || ''

    // Replace <@USER_ID> with <@USER_NAME>
    messageContent = messageContent.replace(mentionRegex, (match, userId) => {
      const resolvedName = userIdToNameMap.get(userId)
      return resolvedName ? `<@${resolvedName}>` : match
    })

    if (isAgent) {
      const agentName = c.creator?.name || 'Ai Agent'
      messageContent = `[Agent Message][${agentName}]: ${messageContent}`
    } else if (c.creator?.name) {
      const role = (c.creatorId ? userRoleMap.get(c.creatorId) : undefined) || 'user'
      messageContent = `[${c.creator.name} (${role})]: ${messageContent}`
    }

    const entryId = c.id
    const message: AgentMessage = {
      role: 'user',
      content: [{ type: 'text', text: messageContent }],
      timestamp: c.createdAt.getTime(),
    }

    await prisma.agentSessionEntry.create({
      data: {
        id: entryId,
        sessionId,
        assetId: userComment.assetId,
        type: 'message',
        parentId: prevId,
        createdAt: c.createdAt,
        data: { message },
      },
    })
    prevId = entryId
  }

  // Update leafId of the session
  if (prevId && prevId !== session.leafId) {
    await prisma.agentSession.update({
      where: { id: sessionId },
      data: { leafId: prevId },
    })
  }

  return sessionId
}

export async function deleteCommentActivity(commentId: string) {
  return prisma.assetComment.delete({
    where: { id: commentId },
  })
}

export async function createCommentActivity(params: {
  assetId: string
  message: string
  sessionId?: string | null
  agentId?: string | null
  replyToId?: string | null
}) {
  if (params.sessionId) {
    const agentId = params.agentId && params.agentId !== 'default' ? params.agentId : 'default'

    // Fetch teamId from asset
    const asset = await prisma.asset.findUnique({
      where: { id: params.assetId },
      include: { project: true },
    })
    if (!asset || !asset.project) {
      throw ApplicationFailure.create({ message: 'asset or project not found', nonRetryable: true })
    }
    const teamId = asset.project.teamId

    // Ensure user exists for agent
    const userExists = await prisma.user.findUnique({ where: { id: agentId } })
    if (!userExists) {
      await prisma.user.create({
        data: {
          id: agentId,
          name: 'Ai Agent',
          email: `${agentId}@shumai.ai`,
          type: 'agent',
        },
      })
    }

    // Ensure agent exists
    const agentExists = await prisma.agent.findUnique({ where: { id: agentId } })
    if (!agentExists) {
      await prisma.agent.create({
        data: {
          id: agentId,
          teamId,
          type: 'chat',
          config: {
            provider: 'openai',
            model: 'gpt-4',
          },
        },
      })
    }

    // Ensure agent session exists
    const sessionExists = await prisma.agentSession.findUnique({ where: { id: params.sessionId } })
    if (!sessionExists) {
      await prisma.agentSession.create({
        data: {
          id: params.sessionId,
          agentId: agentId,
          cwd: process.cwd(),
        },
      })
    }
  }

  return prisma.assetComment.create({
    data: {
      assetId: params.assetId,
      message: params.message,
      sessionId: params.sessionId ?? null,
      creatorId: params.agentId && params.agentId !== 'default' ? params.agentId : null,
      replyToId: params.replyToId,
    },
  })
}

export async function updateCommentActivity(params: {
  commentId: string
  message: string
  sessionId?: string | null
}) {
  return prisma.assetComment.update({
    where: { id: params.commentId },
    data: {
      message: params.message,
      ...(params.sessionId !== undefined ? { sessionId: params.sessionId } : {}),
    },
  })
}

export async function getAgentChatContextActivity(params: {
  teamId: string
  agentId: string
}): Promise<AgentExecutionContext> {
  const team = await prisma.team.findUnique({
    where: { id: params.teamId },
  })
  if (!team) {
    throw ApplicationFailure.create({ message: 'failed to get team', nonRetryable: true })
  }

  const agent = await prisma.agent.findUnique({
    where: { id: params.agentId },
    include: {
      provider: true,
      modelRef: true,
    },
  })
  if (!agent) {
    throw ApplicationFailure.create({
      message: `agent ${params.agentId} not found`,
      nonRetryable: true,
    })
  }

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

  // Fetch the required provider configuration from database
  const dbProviders = await prisma.provider.findMany({
    where: { teamId: params.teamId, name: providerName },
    include: { models: true },
  })

  // Fetch team skills
  const teamSkills = await prisma.skill.findMany({
    where: { teamId: params.teamId },
  })

  const sandbox = await prisma.sandbox.findUnique({
    where: { teamId: params.teamId },
  })
  const allowedDomains = sandbox?.allowedDomains || []

  return {
    agent,
    dbProviders,
    teamSkills,
    allowedDomains,
  }
}

export async function getAgentAutofillContextActivity(params: {
  teamId: string
}): Promise<AgentExecutionContext> {
  const agent = await prisma.agent.findFirst({
    where: {
      type: 'autofill',
      enabled: true,
      teamId: params.teamId,
    },
  })
  if (!agent) {
    throw ApplicationFailure.create({
      message: 'no autofill agent found for team',
      nonRetryable: true,
    })
  }

  const team = await prisma.team.findUnique({
    where: { id: params.teamId },
  })
  if (!team) {
    throw ApplicationFailure.create({ message: 'failed to get team', nonRetryable: true })
  }

  // Find provider/model configuration
  const agentWithDetails = await prisma.agent.findUnique({
    where: { id: agent.id },
    include: {
      provider: true,
      modelRef: true,
    },
  })
  if (!agentWithDetails) {
    throw ApplicationFailure.create({ message: `agent ${agent.id} not found`, nonRetryable: true })
  }
  if (!agentWithDetails.provider) {
    throw ApplicationFailure.create({
      message: 'agent has no provider configured',
      nonRetryable: true,
    })
  }
  if (!agentWithDetails.modelRef) {
    throw ApplicationFailure.create({
      message: 'agent has no model configured',
      nonRetryable: true,
    })
  }

  const providerName = agentWithDetails.provider.name

  // Fetch the required provider configuration from database
  const dbProviders = await prisma.provider.findMany({
    where: { teamId: params.teamId, name: providerName },
    include: { models: true },
  })

  // Fetch team skills
  const teamSkills = await prisma.skill.findMany({
    where: { teamId: params.teamId },
  })

  const sandbox = await prisma.sandbox.findUnique({
    where: { teamId: params.teamId },
  })
  const allowedDomains = sandbox?.allowedDomains || []

  return {
    agent: agentWithDetails,
    dbProviders,
    teamSkills,
    allowedDomains,
  }
}

export async function getAssetActivity(assetId: string) {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: {
      storageKey: true,
      project: {
        include: {
          team: true,
        },
      },
    },
  })

  if (asset && asset.type === AssetType.version_stack) {
    const latestVersion = await prisma.asset.findFirst({
      where: { parentId: asset.id, isDeleted: false },
      orderBy: { sortIndex: 'asc' },
      include: {
        storageKey: true,
        project: {
          include: {
            team: true,
          },
        },
      },
    })

    if (latestVersion) {
      return {
        ...latestVersion,
        project: latestVersion.project ?? asset.project,
      }
    }
  }

  return asset
}

export async function getCommentActivity(commentId: string) {
  return prisma.assetComment.findUnique({
    where: { id: commentId },
    include: { attachments: { include: { asset: { include: { storageKey: true } } } } },
  })
}

export async function getProjectAutofillFieldsActivity(projectId: string) {
  const fields = await metadataService.listProjectFields('', projectId)
  return fields.filter((f) => f.field.aiAutofill).map((f) => f.field)
}

export async function updateAssetMetadataActivity(params: {
  assetId: string
  metadata: UpdateAssetMetadataRequest[]
}) {
  return metadataService.updateAssetMetadata(params.assetId, params.metadata)
}

export async function getAssetPathContextActivity(assetId: string): Promise<string> {
  const parts: { name: string; id: string }[] = []
  let currentId: string | null = assetId

  while (currentId) {
    /* prettier-ignore */
    const assetNode = (await prisma.asset.findUnique({
      where: { id: currentId },
      select: { id: true, name: true, parentId: true, type: true },
    })) as { id: string; name: string; parentId: string | null; type: AssetType } | null
    if (!assetNode) break

    if (assetNode.name) {
      parts.unshift({ name: assetNode.name, id: assetNode.id })
    }

    currentId = assetNode.parentId
  }

  if (parts.length === 0) return ''

  const pathStr = parts.map((p) => p.name).join('/')
  let contextStr = `Path: ${pathStr}\n\n`
  for (const part of parts) {
    contextStr += `name: ${part.name}, id: ${part.id}\n`
  }

  return contextStr
}

export interface ExecuteAgentToolParams {
  taskId: string
  toolName: string
  // args are dynamic JSON arguments passed from the agent harness at runtime
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any
  userId?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function executeAgentToolActivity(params: ExecuteAgentToolParams): Promise<any> {
  const { toolName, args, userId } = params
  if (!userId) {
    throw ApplicationFailure.create({
      message: 'User ID is required for tool authz',
      nonRetryable: true,
    })
  }

  // 1. Fetch User
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw ApplicationFailure.create({
      message: `User not found: ${userId}`,
      nonRetryable: true,
    })
  }

  // 2. Perform Authz and Action based on toolName
  switch (toolName) {
    case 'list_assets': {
      const parent = args.parent
      if (!parent) {
        throw ApplicationFailure.create({
          message: 'parent parameter is required',
          nonRetryable: true,
        })
      }

      // Authz check
      await authzService.hasPermission({
        user,
        permission: Permission.Read,
        type: ResourceType.Asset,
        id: parent,
      })

      const page = args.page || 1
      const pageSize = args.pageSize || 20
      const type = args.type || 'all'

      // We need to list files and folders of parent dir
      const where: Prisma.AssetWhereInput = {
        parentId: parent,
        isDeleted: false,
      }
      if (type === 'file') {
        where.type = { in: ['file', 'version_stack'] }
      } else if (type === 'folder') {
        where.type = 'folder'
      } else {
        where.type = { in: ['file', 'folder', 'version_stack'] }
      }

      const limit = pageSize
      const offset = (page - 1) * limit
      const after = offset > 0 ? encodeCursor(offset) : undefined

      const { data: assets, pageInfo } = await paginateQuery<
        Prisma.AssetGetPayload<Record<string, never>>
      >(
        async (skip, take) => {
          return prisma.asset.findMany({
            where,
            orderBy: { id: 'desc' }, // sort desc per ULID default in sorting guidelines!
            skip,
            take,
          })
        },
        async () => prisma.asset.count({ where }),
        { first: limit, after },
      )

      // return asset id, asset name, asset type, asset size (sizeByte or size)
      const results = assets.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        size: a.sizeByte,
      }))

      return {
        assets: results,
        pageInfo,
      }
    }

    case 'create_folder': {
      const parent = args.parent
      const name = args.name
      if (!parent || !name) {
        throw ApplicationFailure.create({
          message: 'parent and name parameters are required',
          nonRetryable: true,
        })
      }

      // Authz check
      await authzService.hasPermission({
        user,
        permission: Permission.Edit,
        type: ResourceType.Asset,
        id: parent,
      })

      const newFolder = await assetService.createAsset({
        name,
        parentId: parent,
        type: 'folder',
        creatorId: userId,
      })

      return {
        id: newFolder.id,
        name: newFolder.name,
        type: newFolder.type,
        size: newFolder.sizeByte,
      }
    }

    case 'create_file': {
      const parent = args.parent
      const s3Key = args.s3Key as string
      const name = args.name as string
      const fileSize = args.size as number
      const mimeType = args.contentType as string
      if (!parent || !s3Key || !name || fileSize === undefined || !mimeType) {
        throw ApplicationFailure.create({
          message: 'parent, s3Key, name, size, and contentType parameters are required',
          nonRetryable: true,
        })
      }

      // Authz check
      await authzService.hasPermission({
        user,
        permission: Permission.Edit,
        type: ResourceType.Asset,
        id: parent,
      })

      // Fetch parent folder to resolve projectId and teamId
      const parentAsset = await prisma.asset.findUnique({
        where: { id: parent },
        include: { project: true },
      })
      if (!parentAsset) {
        throw ApplicationFailure.create({
          message: `Parent folder not found with ID: ${parent}`,
          nonRetryable: true,
        })
      }
      if (!parentAsset.projectId || !parentAsset.project?.teamId) {
        throw ApplicationFailure.create({
          message: `Parent folder ${parent} has no project or team associated`,
          nonRetryable: true,
        })
      }

      // Create asset via assetService
      const newFile = await assetService.createAsset({
        name,
        type: 'file',
        parentId: parent,
        key: s3Key,
        sizeByte: fileSize,
        contentType: mimeType,
        creatorId: userId,
      })

      // Increment update ancestor size
      await prisma.$transaction(async (tx) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await assetService.updateAncestorsSize(tx as any, parent, fileSize)

        // Trigger post-upload transcode and AI workflows
        await uploadService.triggerPostUploadWorkflows(
          tx,
          newFile.id,
          parentAsset.project!.teamId,
          parentAsset.projectId!,
        )
      })

      return {
        id: newFile.id,
        name: newFile.name,
        type: newFile.type,
        size: newFile.sizeByte,
      }
    }

    case 'create_version': {
      const parent = args.parent // parent file id
      const s3Key = args.s3Key as string
      const name = args.name as string
      const fileSize = args.size as number
      const mimeType = args.contentType as string
      if (!parent || !s3Key || !name || fileSize === undefined || !mimeType) {
        throw ApplicationFailure.create({
          message: 'parent, s3Key, name, size, and contentType parameters are required',
          nonRetryable: true,
        })
      }

      // Fetch parent file and cast to any due to Prisma type resolution limits
      /* prettier-ignore */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parentFile = (await prisma.asset.findUnique({ where: { id: parent }, include: { parent: true, project: true } })) as any
      if (!parentFile) {
        throw ApplicationFailure.create({
          message: `Parent file not found with ID: ${parent}`,
          nonRetryable: true,
        })
      }

      if (!parentFile.projectId || !parentFile.project?.teamId) {
        throw ApplicationFailure.create({
          message: `Parent file ${parent} has no project or team associated`,
          nonRetryable: true,
        })
      }

      // Authz check: verify Edit permission on the parent file (resource ID is parent file id)
      await authzService.hasPermission({
        user,
        permission: Permission.Edit,
        type: ResourceType.Asset,
        id: parent,
      })

      // If already in a version stack
      if (parentFile.parentId && parentFile.parent?.type === AssetType.version_stack) {
        const stackId = parentFile.parentId

        // Create the new file asset
        const newFile = await assetService.createAsset({
          name,
          type: 'file',
          parentId: stackId,
          key: s3Key,
          sizeByte: fileSize,
          contentType: mimeType,
          creatorId: userId,
        })

        // Generate sort index for new version inside the stack (newest gets the lowest sortIndex)
        const firstChild = await prisma.asset.findFirst({
          where: {
            parentId: stackId,
            NOT: { id: newFile.id },
          },
          orderBy: { sortIndex: 'asc' },
        })
        const newSortIndex = generateKeyBetween(null, firstChild?.sortIndex || null)

        await prisma.$transaction(async (tx) => {
          // Assign sort index
          await tx.asset.update({
            where: { id: newFile.id },
            data: { sortIndex: newSortIndex },
          })
          // Increment stack's size (fileCount is incremented by createAsset already)
          const updatedStack = await tx.asset.update({
            where: { id: stackId },
            data: {
              sizeByte: { increment: fileSize },
            },
          })
          // Update ancestors' size of stack's parent
          if (updatedStack.parentId) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await assetService.updateAncestorsSize(tx as any, updatedStack.parentId, fileSize)
          }

          // Trigger post-upload transcode and AI workflows
          await uploadService.triggerPostUploadWorkflows(
            tx,
            newFile.id,
            parentFile.project.teamId,
            parentFile.projectId,
          )
        })

        return {
          id: newFile.id,
          name: newFile.name,
          type: newFile.type,
          size: newFile.sizeByte,
        }
      } else {
        // Parent is a regular file. We must create a new version stack.
        const folderParentId = parentFile.parentId
        if (!folderParentId) {
          throw ApplicationFailure.create({
            message: `Parent file ${parent} has no parent folder`,
            nonRetryable: true,
          })
        }

        // Create the new file asset under parent folder first (so that createVersionStack can run on them,
        // which enforces both files must have same parent initially)
        const newFile = await assetService.createAsset({
          name,
          type: 'file',
          parentId: folderParentId,
          key: s3Key,
          sizeByte: fileSize,
          contentType: mimeType,
          creatorId: userId,
        })

        await prisma.$transaction(async (tx) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const txVersionStackService = new VersionStackService(tx as any)
          await txVersionStackService.createVersionStack({
            fileIds: [newFile.id, parentFile.id],
            projectId: parentFile.projectId!,
            creatorId: userId,
          })
          // Update ancestors' size (add size of the new file version)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await assetService.updateAncestorsSize(tx as any, folderParentId!, fileSize)

          // Trigger post-upload transcode and AI workflows
          await uploadService.triggerPostUploadWorkflows(
            tx,
            newFile.id,
            parentFile.project.teamId,
            parentFile.projectId!,
          )
        })

        return {
          id: newFile.id,
          name: newFile.name,
          type: newFile.type,
          size: newFile.sizeByte,
        }
      }
    }

    default:
      throw ApplicationFailure.create({
        message: `Unsupported tool name: ${toolName}`,
        nonRetryable: true,
      })
  }
}

export interface GenerateSessionNameParams {
  teamId: string
  agentId: string
  prompt: string
  sessionId: string
  context: {
    agent: Prisma.AgentGetPayload<{ include: { modelRef: true; provider: true } }>
    dbProviders: DbProviderInfo[]
  }
}

export async function generateSessionNameActivity(
  params: GenerateSessionNameParams,
): Promise<void> {
  const { sessionId, prompt, teamId, agentId } = params
  const { agent, dbProviders } = params.context

  // 1. Fetch current session and verify it is a chatbot session and unnamed
  const sessionRecord = await prisma.agentSession.findUnique({
    where: { id: sessionId },
  })

  if (!sessionRecord || sessionRecord.type !== 'chat' || sessionRecord.name !== null) {
    logger.info({ sessionId }, 'Skipping session name generation: not an unnamed chatbot session')
    return
  }

  if (!agent || !agent.modelRef || !agent.provider) {
    logger.warn(
      { sessionId },
      'Skipping session name generation: Agent, model, or provider configuration not found',
    )
    return
  }

  const providerName = agent.provider.name
  const modelId = agent.modelRef.modelId

  let namingSessionId: string | undefined

  try {
    // 2. Create transient naming session in database
    const namingSession = await prisma.agentSession.create({
      data: {
        agentId,
        userId: sessionRecord.userId,
        cwd: process.cwd(),
        assetId: sessionRecord.assetId,
        type: 'naming',
      },
    })
    namingSessionId = namingSession.id

    const systemInstruction =
      "You are a helpful assistant. Generate a short 2 to 4 words title/name for a chat session based on the user's first message. " +
      'Do NOT include quotation marks, markdown formatting, or any extra conversational text. Return only the title.'

    // 3. Create agent session and harness using the naming session
    const { harness } = await createAgentSession({
      teamId,
      agentId,
      providerName,
      modelId,
      systemPrompt: systemInstruction,
      teamSkills: [],
      allowedDomains: [],
      sessionId: namingSessionId,
      userId: sessionRecord.userId || undefined,
      providers: dbProviders,
    })

    const result = await harness.prompt(prompt)
    const resultText = result.content
      .filter((c) => c.type === 'text')
      .map((c) => {
        if ('text' in c && typeof c.text === 'string') {
          return c.text
        }
        return ''
      })
      .join('\n')

    let chatName = resultText.trim()

    // Clean up quotes if returned
    if (
      (chatName.startsWith('"') && chatName.endsWith('"')) ||
      (chatName.startsWith("'") && chatName.endsWith("'"))
    ) {
      chatName = chatName.slice(1, -1).trim()
    }

    if (chatName) {
      await prisma.agentSession.update({
        where: { id: sessionId },
        data: { name: chatName },
      })
      logger.info({ sessionId, chatName }, 'Session name generated successfully')
    }
  } catch (err) {
    logger.error({ sessionId, err }, 'Failed to generate session name')
  } finally {
    if (namingSessionId) {
      await prisma.agentSession
        .delete({
          where: { id: namingSessionId },
        })
        .catch((deleteErr) => {
          logger.error({ namingSessionId, deleteErr }, 'Failed to delete naming session')
        })
    }
  }
}
