import { agentExecutor, AutofillField } from '../executor'
import { prisma } from '@/db'

export interface AutofillAiParams {
  teamId: string
  images: string[]
  fields: AutofillField[]
}

export async function autofillAiActivity(params: AutofillAiParams) {
  const prompt = 'Analyze the provided images and extract metadata.'
  return agentExecutor.autofill(params.teamId, prompt, params.images, params.fields)
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
  return agentExecutor.chatWithAgent(
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
  isAi?: boolean
  agentId?: string | null
  replyToId?: string | null
}

export async function createCommentActivity(params: CreateCommentParams) {
  return prisma.assetComment.create({
    data: {
      assetId: params.assetId,
      message: params.message,
      isAi: params.isAi ?? false,
      creatorId: params.agentId && params.agentId !== 'default' ? params.agentId : null,
      replyToId: params.replyToId,
    },
  })
}

export interface UpdateCommentParams {
  commentId: string
  message: string
}

export async function updateCommentActivity(params: UpdateCommentParams) {
  return prisma.assetComment.update({
    where: { id: params.commentId },
    data: { message: params.message },
  })
}
