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
}

export async function aiChatActivity(params: AiChatParams) {
  const cleanMessage = params.message.replace(/<@[A-Z0-9]+>/g, '').trim()
  return agentService.chatWithAgent(
    params.teamId,
    params.agentId,
    cleanMessage,
    params.imageUrls,
    params.agentsInstruction || '',
    params.sessionId,
    params.userId,
  )
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
