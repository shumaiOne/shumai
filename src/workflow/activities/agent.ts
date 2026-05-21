import { agentService } from '@/services/agent/agent'
import type { AutofillField } from '@/agent'
import { prisma } from '@/db'

export interface AutofillAiParams {
  teamId: string
  images: string[]
  fields: AutofillField[]
}

export async function autofillAiActivity(params: AutofillAiParams) {
  const prompt = 'Analyze the provided images and extract metadata.'
  return agentService.autofill(params.teamId, prompt, params.images, params.fields)
}

export interface AiChatParams {
  teamId: string
  agentId: string
  message: string
  imageUrls: string[]
  projectId: string
  folderId: string
  agentsInstruction?: string
  sessionId?: string
  userId?: string
  userCommentId?: string
  explicitMention?: boolean
}

export async function aiChatActivity(params: AiChatParams) {
  const cleanMessage = params.message.replace(/<@[A-Z0-9]+>/g, '').trim()
  let sessionId = params.sessionId

  if (!sessionId) {
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
    sessionId = newSession.id

    // Fetch existing comments as context
    let existingComments: Array<{
      id: string
      message: string | null
      createdAt: Date
      creatorId: string | null
      creator: { type: string; name: string } | null
      sessionId: string | null
    }> = []

    if (params.userCommentId) {
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
    }

    // Save context as AgentSessionEntry records
    let prevId: string | null = null
    for (const c of existingComments) {
      const isAgent = c.creator?.type === 'agent' || c.sessionId !== null
      const role = isAgent ? 'assistant' : 'user'
      let messageContent = c.message || ''

      // Prepend user name to user messages to ensure agent knows who sent what
      if (!isAgent && c.creator?.name) {
        messageContent = `[${c.creator.name}]: ${messageContent}`
      }

      const entryId = c.id
      const entryJson = {
        type: 'message',
        id: entryId,
        parentId: prevId,
        timestamp: c.createdAt.toISOString(),
        message: {
          role,
          content: [{ type: 'text', text: messageContent }],
          timestamp: c.createdAt.getTime(),
        },
      }

      await prisma.agentSessionEntry.create({
        data: {
          id: entryId,
          sessionId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- entryJson conforms to the internal PiSessionEntry/SessionTreeEntry JSON schema which uses generic json types
          entry: entryJson as any,
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
  }

  return agentService.chatWithAgent(
    params.teamId,
    params.agentId,
    cleanMessage,
    params.imageUrls,
    params.agentsInstruction || '',
    sessionId,
    params.userId,
  )
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
    if (!asset || !asset.project) throw new Error('asset or project not found')
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
