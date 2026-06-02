import { createAgentSession, fieldsToTypeBoxSchema, type AutofillField } from '../index'
import { DatabaseSessionStorage } from '../database-session-storage'
import { prisma, AssetType, Prisma, type Skill } from '@shumai/db'
import { logger } from '@shumai/core/src/logger'
import { s3Service } from '@shumai/core/src/s3/s3'
import { type AgentTool, type AgentMessage, type SessionTreeEntry } from '@earendil-works/pi-agent-core'
import { type ImageContent } from '@earendil-works/pi-ai'
import { ApplicationFailure } from '@temporalio/activity'
import { assetService } from '@shumai/core/src/asset/asset'
import { VersionStackService } from '@shumai/core/src/versionStack/versionStack'
import { uploadService } from '@shumai/core/src/upload/upload'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { generateKeyBetween } from 'jittered-fractional-indexing'
import { paginateQuery, encodeCursor } from '@shumai/core/src/pagination'
import { ulid } from 'ulid'
import { metadataService } from '@shumai/core/src/metadata/metadata'

import { UpdateAssetMetadataRequest } from '@shumai/dtos'

export interface Usage {
  inputTokens: number
  outputTokens: number
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

shumai has its own cloud file system. If a user asks you to perform file system operations (for example: creating a folder, creating a file, stacking a version, or listing assets), you MUST use the corresponding agent system tools (e.g., 'create_folder', 'create_file', 'create_version', 'list_assets'). Do NOT use local bash commands or the local bash tool to perform these operations locally on the host environment; all operations must be executed through the platform's cloud file system tools so they are correctly registered and visible within the platform.

If you need to create files in the local filesystem (for example, a temporary file for uploading), only the '.pi' folder in the current directory has write permissions. Do NOT attempt to create files in any other directories.`

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
        entry: entryJson as unknown as PrismaJson.PiSessionEntry,
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
        { first: limit, after, includeCount: true },
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

      // Increment fileCount of parent folder
      await prisma.asset.update({
        where: { id: parent },
        data: { fileCount: { increment: 1 } },
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

      // Increment fileCount of parent and update ancestor size
      await prisma.$transaction(async (tx) => {
        await tx.asset.update({
          where: { id: parent },
          data: { fileCount: { increment: 1 } },
        })
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
          // Increment stack's fileCount and size
          const updatedStack = await tx.asset.update({
            where: { id: stackId },
            data: {
              fileCount: { increment: 1 },
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
