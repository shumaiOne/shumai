import { prisma } from '@/db'
import { ApplicationFailure } from '@temporalio/activity'
import type { AgentMessage, SessionTreeEntry } from '@earendil-works/pi-agent-core'
import { ulid } from 'ulid'
import { metadataService } from '@/services/metadata/metadata'
import { UpdateAssetMetadataRequest } from '@/dtos/metadata'
import { WorkflowTaskStatus, AssetStatus, Prisma, AssetType } from '@/generated/prisma/client'
import type { AgentExecutionContext } from './agent'
import { s3Service } from '@/services/s3/s3'
import { assetService } from '@/services/asset/asset'
import { VersionStackService } from '@/services/versionStack/versionStack'
import { authzService, Permission, ResourceType } from '@/services/authz/authz'
import { generateKeyBetween } from 'jittered-fractional-indexing'
import { detectSupportedMimeType } from '@/utils/mime'
import { paginateQuery, encodeCursor } from '@/services/pagination'
import * as fs from 'fs'
import * as path from 'path'

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

// ==========================================
// Agent System Tools & Context Activities
// ==========================================

function getMimeType(filePath: string): string {
  try {
    const buffer = fs.readFileSync(filePath)
    const detected = detectSupportedMimeType(new Uint8Array(buffer))
    if (detected) return detected
  } catch {
    /* Ignore S3 detection errors and fallback to extension mapping */
  }

  const ext = path.extname(filePath).toLowerCase()
  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.json': 'application/json',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.ts': 'application/typescript',
    '.zip': 'application/zip',
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

function generateSortIndex(previous?: string | null): string {
  if (!previous) return generateKeyBetween(null, null)
  return generateKeyBetween(previous, null)
}

export async function getAssetPathContextActivity(assetId: string): Promise<string> {
  const parts: { name: string; id: string }[] = []
  let currentId: string | null = assetId

  while (currentId) {
    /* prettier-ignore */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assetNode: { id: string; name: string; parentId: string | null; type: AssetType } | null = (await prisma.asset.findUnique({ where: { id: currentId }, select: { id: true, name: true, parentId: true, type: true } })) as any
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
      const filePath = args.path
      if (!parent || !filePath) {
        throw ApplicationFailure.create({
          message: 'parent and path parameters are required',
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

      if (!fs.existsSync(filePath)) {
        throw ApplicationFailure.create({
          message: `Local file not found at path: ${filePath}`,
          nonRetryable: true,
        })
      }

      const fileSize = fs.statSync(filePath).size
      const mimeType = getMimeType(filePath)

      // Upload file to S3
      const key = await s3Service.uploadFile(filePath, mimeType)

      // Create asset via assetService
      const newFile = await assetService.createAsset({
        name: path.basename(filePath),
        type: 'file',
        parentId: parent,
        key,
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
      const filePath = args.path
      if (!parent || !filePath) {
        throw ApplicationFailure.create({
          message: 'parent and path parameters are required',
          nonRetryable: true,
        })
      }

      // Fetch parent file and cast to any due to Prisma type resolution limits
      /* prettier-ignore */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parentFile = (await prisma.asset.findUnique({ where: { id: parent }, include: { parent: true } })) as any
      if (!parentFile) {
        throw ApplicationFailure.create({
          message: `Parent file not found with ID: ${parent}`,
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

      if (!fs.existsSync(filePath)) {
        throw ApplicationFailure.create({
          message: `Local file not found at path: ${filePath}`,
          nonRetryable: true,
        })
      }

      const fileSize = fs.statSync(filePath).size
      const mimeType = getMimeType(filePath)

      // Upload file to S3
      const key = await s3Service.uploadFile(filePath, mimeType)

      // If already in a version stack
      if (parentFile.parentId && parentFile.parent?.type === AssetType.version_stack) {
        const stackId = parentFile.parentId

        // Create the new file asset
        const newFile = await assetService.createAsset({
          name: path.basename(filePath),
          type: 'file',
          parentId: stackId,
          key,
          sizeByte: fileSize,
          contentType: mimeType,
          creatorId: userId,
        })

        // Generate sort index for new version inside the stack
        const lastChild = await prisma.asset.findFirst({
          where: { parentId: stackId },
          orderBy: { sortIndex: 'desc' },
        })
        const newSortIndex = generateSortIndex(lastChild?.sortIndex)

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
          name: path.basename(filePath),
          type: 'file',
          parentId: folderParentId,
          key,
          sizeByte: fileSize,
          contentType: mimeType,
          creatorId: userId,
        })

        await prisma.$transaction(async (tx) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const txVersionStackService = new VersionStackService(tx as any)
          await txVersionStackService.createVersionStack({
            fileIds: [parentFile.id, newFile.id],
            projectId: parentFile.projectId!,
            creatorId: userId,
          })
          // Update ancestors' size (add size of the new file version)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await assetService.updateAncestorsSize(tx as any, folderParentId!, fileSize)
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
