import { z } from 'zod'

export const agentTypeSchema = z.enum(['chat', 'autofill', 'embedding'])
export type AgentType = z.infer<typeof agentTypeSchema>

export const agentSkillSchema = z.object({
  id: z.string().optional(),
  skillId: z.string(),
  skill: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
})
export type AgentSkill = z.infer<typeof agentSkillSchema>

export const agentInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: agentTypeSchema,
  enabled: z.boolean(),
  avatar: z.string().optional(),
  providerId: z.string().optional(),
  modelId: z.string().optional(),
  thinkingLevel: z.string().optional().default(''),
  systemPrompt: z.string().optional(),
  soul: z.string().optional(),
  skills: z.array(agentSkillSchema).optional(),
})
export type AgentInfo = z.infer<typeof agentInfoSchema>

const baseAgentRequest = z.object({
  name: z.string().min(1),
  type: agentTypeSchema,
  enabled: z.boolean().optional().default(true),
  avatar: z.string().optional(),
  providerId: z.string().optional(),
  modelId: z.string().optional(),
  thinkingLevel: z.string().optional().default(''),
  systemPrompt: z.string().optional(),
  soul: z.string().optional(),
  skills: z.array(z.string()).optional(),
})

export const createAgentRequestSchema = baseAgentRequest.superRefine((data, ctx) => {
  if (data.type === 'chat' || data.type === 'autofill') {
    if (!data.providerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'providerId is required for chat/autofill agents',
        path: ['providerId'],
      })
    }
    if (!data.modelId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'modelId is required for chat/autofill agents',
        path: ['modelId'],
      })
    }
  }
})
export type CreateAgentRequest = z.infer<typeof createAgentRequestSchema>

export const updateAgentRequestSchema = baseAgentRequest.superRefine((data, ctx) => {
  if (data.type === 'chat' || data.type === 'autofill') {
    if (!data.providerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'providerId is required for chat/autofill agents',
        path: ['providerId'],
      })
    }
    if (!data.modelId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'modelId is required for chat/autofill agents',
        path: ['modelId'],
      })
    }
  }
})
export type UpdateAgentRequest = z.infer<typeof updateAgentRequestSchema>

export interface CreateAgentParams extends CreateAgentRequest {
  teamId: string
}

export interface UpdateAgentParams extends UpdateAgentRequest {
  agentId: string
}

export interface DeleteAgentParams {
  agentId: string
}

export interface ListAgentsParams {
  teamId: string
}

export const agentSessionEntrySchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  entry: z.unknown(),
})
export type AgentSessionEntryInfo = z.infer<typeof agentSessionEntrySchema>
