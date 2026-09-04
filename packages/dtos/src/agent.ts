import { z } from 'zod'
import { AgentType } from '@shumai/db/enums'

export { AgentType }
export const agentTypeSchema = z.nativeEnum(AgentType)

export const thinkingLevelSchema = z.enum(['off', 'minimal', 'low', 'medium', 'high', 'xhigh'])
export type ThinkingLevel = z.infer<typeof thinkingLevelSchema>

export const agentPermissionSchema = z.enum(['owner', 'editor', 'reviewer'])
export type AgentPermission = z.infer<typeof agentPermissionSchema>

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
  permission: agentPermissionSchema.optional().default('reviewer'),
  avatar: z.string().optional(),
  avatarPreset: z.string().optional(),
  providerId: z.string().optional(),
  modelId: z.string().optional(),
  thinkingLevel: thinkingLevelSchema.optional().default('off'),
  systemPrompt: z.string().optional(),
  soul: z.string().optional(),
  skills: z.array(agentSkillSchema).optional(),
  mcpServerIds: z.array(z.string()).optional(),
  deniedTools: z.array(z.string()).optional(),
})
export type AgentInfo = z.infer<typeof agentInfoSchema>

const baseAgentRequest = z.object({
  name: z.string().min(1),
  type: agentTypeSchema,
  enabled: z.boolean().optional().default(true),
  permission: agentPermissionSchema.optional(),
  avatar: z.string().optional(),
  providerId: z.string().optional(),
  modelId: z.string().optional(),
  thinkingLevel: thinkingLevelSchema.optional().default('off'),
  systemPrompt: z.string().optional(),
  soul: z.string().optional(),
  skills: z.array(z.string()).optional(),
  mcpServerIds: z.array(z.string()).optional(),
  deniedTools: z.array(z.string()).optional(),
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

export const updateAgentPermissionRequestSchema = z.object({
  permission: agentPermissionSchema,
})
export type UpdateAgentPermissionRequest = z.infer<typeof updateAgentPermissionRequestSchema>

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
  userId?: string
}

export const agentSessionEntrySchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  entry: z.unknown(),
})
export type AgentSessionEntryInfo = z.infer<typeof agentSessionEntrySchema>

export const agentSessionSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  type: z.string(),
  createdAt: z.string(),
  creator: z
    .object({
      id: z.string(),
      name: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
      image: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  agentId: z.string().optional(),
})
export type AgentSessionInfo = z.infer<typeof agentSessionSchema>
