import { prisma } from '@/db'
import { ApplicationFailure } from '@temporalio/activity'
import type { AgentMessage, SessionTreeEntry } from '@earendil-works/pi-agent-core'
import { ulid } from 'ulid'
import { metadataService } from '@/services/metadata/metadata'
import { UpdateAssetMetadataRequest } from '@/dtos/metadata'
import { WorkflowTaskStatus, AssetStatus, Prisma } from '@/generated/prisma/client'
import type { AgentExecutionContext } from './agent'

export interface InitializeAgentSessionParams {
  teamId: string
  agentId: string
  userCommentId: string
  userId?: string
}

export async function initializeAgentSessionActivity(
  params: InitializeAgentSessionParams,
): Promise<string> {
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

  // Create a new AgentSession
  const newSession = await prisma.agentSession.create({
    data: {
      agentId,
      userId: params.userId || null,
      cwd: process.cwd(),
    },
  })
  const sessionId = newSession.id

  // Fetch existing comments as context
  let existingComments: Array<{
    id: string
    message: string | null
    createdAt: Date
    creatorId: string | null
    creator: { type: string; name: string } | null
    sessionId: string | null
  }> = []

  const userComment = await prisma.assetComment.findUnique({
    where: { id: params.userCommentId },
    include: { creator: true },
  })

  if (userComment) {
    if (!userComment.replyToId) {
      // Rule 1: outside of a reply, add all other comments on that asset
      existingComments = await prisma.assetComment.findMany({
        where: {
          assetId: userComment.assetId,
          id: { not: userComment.id },
        },
        orderBy: { id: 'asc' },
        include: { creator: true },
      })
    } else {
      // Rule 2: in a reply, add root comment + all other replies to it
      const rootComment = await prisma.assetComment.findUnique({
        where: { id: userComment.replyToId },
        include: { creator: true },
      })
      if (rootComment) {
        const replies = await prisma.assetComment.findMany({
          where: {
            replyToId: rootComment.id,
            id: { not: userComment.id },
          },
          orderBy: { id: 'asc' },
          include: { creator: true },
        })
        existingComments = [rootComment, ...replies]
      }
    }
  }

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

  // Save context as AgentSessionEntry records
  let prevId: string | null = null
  for (const c of existingComments) {
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
      messageContent = `[${c.creator.name}]: ${messageContent}`
    }

    const entryId = ulid()
    const message: AgentMessage = {
      role: 'user',
      content: [{ type: 'text', text: messageContent }],
      timestamp: c.createdAt.getTime(),
    }

    const entryJson: SessionTreeEntry = {
      type: 'message',
      id: entryId,
      parentId: prevId,
      timestamp: c.createdAt.toISOString(),
      message,
    }

    await prisma.agentSessionEntry.create({
      data: {
        id: entryId,
        sessionId,
        entry: entryJson,
      },
    })
    prevId = entryId
  }

  // Update leafId of the session
  if (prevId) {
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

export interface CreateCommentParams {
  assetId: string
  message: string
  sessionId?: string | null
  agentId?: string | null
  replyToId?: string | null
}

export async function createCommentActivity(params: CreateCommentParams) {
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

export interface UpdateCommentParams {
  commentId: string
  message: string
  sessionId?: string | null
}

export async function updateCommentActivity(params: UpdateCommentParams) {
  return prisma.assetComment.update({
    where: { id: params.commentId },
    data: {
      message: params.message,
      ...(params.sessionId !== undefined ? { sessionId: params.sessionId } : {}),
    },
  })
}

// ==========================================
// New Context-Fetching and Embedding DB Activities
// ==========================================

export interface GetAgentChatContextParams {
  teamId: string
  agentId: string
}

export async function getAgentChatContextActivity(
  params: GetAgentChatContextParams,
): Promise<AgentExecutionContext> {
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

export interface GetAgentAutofillContextParams {
  teamId: string
}

export async function getAgentAutofillContextActivity(
  params: GetAgentAutofillContextParams,
): Promise<AgentExecutionContext> {
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

export interface GetEmbeddingContextParams {
  teamId: string
  assetId: string
}

export async function getEmbeddingContextActivity(params: GetEmbeddingContextParams) {
  const team = await prisma.team.findUnique({
    where: { id: params.teamId },
  })
  if (!team) {
    throw ApplicationFailure.create({ message: 'failed to get team', nonRetryable: true })
  }

  const agent = await prisma.agent.findFirst({
    where: {
      type: 'embedding',
      enabled: true,
      user: { teamMembers: { some: { teamId: params.teamId } } },
    },
  })
  if (!agent) {
    throw ApplicationFailure.create({
      message: 'embedding feature is disabled or agent not found',
      nonRetryable: true,
    })
  }

  const asset = await prisma.asset.findUnique({
    where: { id: params.assetId },
    include: { storageKey: true },
  })
  if (!asset) {
    throw ApplicationFailure.create({ message: 'failed to get asset', nonRetryable: true })
  }
  if (!asset.mediaType) {
    throw ApplicationFailure.create({ message: 'asset has no media type', nonRetryable: true })
  }

  return {
    agent,
    asset,
  }
}

export interface SaveAssetEmbeddingsParams {
  assetId: string
  embeddings: Array<{
    embedding: number[]
    startTime?: number
    endTime?: number
  }>
}

export async function saveAssetEmbeddingsActivity(params: SaveAssetEmbeddingsParams) {
  for (const item of params.embeddings) {
    const embVec = JSON.stringify(item.embedding)
    if (item.startTime !== undefined && item.endTime !== undefined) {
      await prisma.$executeRaw`
        INSERT INTO asset_embeddings (id, asset_id, embedding, start_time, end_time, updated_at)
        VALUES (gen_random_uuid()::text, ${params.assetId}, ${embVec}::vector, ${item.startTime}, ${item.endTime}, NOW())
      `
    } else {
      await prisma.$executeRaw`
        INSERT INTO asset_embeddings (id, asset_id, embedding, updated_at)
        VALUES (gen_random_uuid()::text, ${params.assetId}, ${embVec}::vector, NOW())
      `
    }
  }
}

// ==========================================
// Moved Database Activities
// ==========================================

export async function getAssetActivity(assetId: string) {
  return prisma.asset.findUnique({
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

export interface UpdateAssetMetadataParams {
  assetId: string
  metadata: UpdateAssetMetadataRequest[]
}

export async function updateAssetMetadataActivity(params: UpdateAssetMetadataParams) {
  return metadataService.updateAssetMetadata(params.assetId, params.metadata)
}

export interface UpdateTaskStatusParams {
  taskId: string
  status: WorkflowTaskStatus
  output?: unknown
}

export async function updateTaskStatusActivity(params: UpdateTaskStatusParams): Promise<void> {
  await prisma.workflowTask.update({
    where: { id: params.taskId },
    data: {
      status: params.status,
      output: params.output,
    },
  })
}

export interface UpdateAssetStatusParams {
  assetId: string
  status: AssetStatus
}

export async function updateAssetStatusActivity(params: UpdateAssetStatusParams): Promise<void> {
  await prisma.asset.update({
    where: { id: params.assetId },
    data: { status: params.status },
  })
}

export interface UpdateTaskUsageParams {
  taskId: string
  inputTokens: number
  outputTokens: number
  model: string
}

export async function updateTaskUsageActivity(params: UpdateTaskUsageParams): Promise<void> {
  await prisma.workflowTask.update({
    where: { id: params.taskId },
    data: {
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      model: params.model,
    },
  })
}

export interface UpdateWorkflowTaskParams {
  taskId: string
  status?: WorkflowTaskStatus
  heartbeat?: boolean
  output?: unknown
  inputTokens?: number
  outputTokens?: number
  model?: string | null
}

export async function updateWorkflowTaskActivity(params: UpdateWorkflowTaskParams): Promise<void> {
  await prisma.workflowTask.update({
    where: { id: params.taskId },
    data: {
      ...(params.status !== undefined ? { status: params.status } : {}),
      ...(params.heartbeat ? { heartbeat: new Date() } : {}),
      ...(params.output !== undefined ? { output: params.output as Prisma.InputJsonValue } : {}),
      ...(params.inputTokens !== undefined ? { inputTokens: params.inputTokens } : {}),
      ...(params.outputTokens !== undefined ? { outputTokens: params.outputTokens } : {}),
      ...(params.model !== undefined ? { model: params.model } : {}),
    },
  })
}
