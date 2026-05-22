import { agentService } from '@/services/agent/agent'
import type { AutofillField } from '@/agent'

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
  sessionId: string
  userId?: string
  explicitMention?: boolean
}

export async function aiChatActivity(params: AiChatParams) {
  const cleanMessage = params.message.replace(/<@[A-Z0-9]+>/g, '').trim()
  const sessionId = params.sessionId

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
