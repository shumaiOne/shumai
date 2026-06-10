import { z } from 'zod'
import { paginationPageInfoSchema, paginationParamsSchema } from './pagination'

export const createTeamRequestSchema = z.object({
  name: z.string(),
})
export type CreateTeamRequest = z.infer<typeof createTeamRequestSchema>

export const teamInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  rootFolder: z.string().optional(),
  updatedAt: z.union([z.string(), z.date()]),
})
export type TeamInfo = z.infer<typeof teamInfoSchema>

export const getUserTeamsRequestSchema = paginationParamsSchema
export type GetUserTeamsRequest = z.infer<typeof getUserTeamsRequestSchema>

export const getUserTeamsResponseSchema = z.object({
  data: z.array(teamInfoSchema),
  pageInfo: paginationPageInfoSchema,
})
export type GetUserTeamsResponse = z.infer<typeof getUserTeamsResponseSchema>

export const joinTeamRequestSchema = z.object({
  teamId: z.string(),
  userId: z.string(),
})
export type JoinTeamRequest = z.infer<typeof joinTeamRequestSchema>

export const getMeResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().optional(),
  role: z.enum(['owner', 'editor', 'reviewer', 'bot', 'unknown']),
  image: z.string().optional(),
  unreadNotificationCount: z.number().optional(),
})
export type GetMeResponse = z.infer<typeof getMeResponseSchema>

export const updateMeRequestSchema = z.object({
  name: z.string().optional(),
  imageKey: z.string().nullable().optional(),
})
export type UpdateMeRequest = z.infer<typeof updateMeRequestSchema>

export const userInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(['owner', 'editor', 'reviewer', 'bot', 'unknown']),
  email: z.string().optional(),
  type: z.enum(['human', 'agent']).optional(),
  image: z.string().optional(),
  scope: z.enum(['team', 'project']).optional(),
})
export type UserInfo = z.infer<typeof userInfoSchema>

export const listMembersQuerySchema = z.object({
  includeAgents: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
})

export const updateTeamSettingsRequestSchema = z.object({
  key: z.string(),
  value: z.any(),
})
export type UpdateTeamSettingsRequest = z.infer<typeof updateTeamSettingsRequestSchema>

export const VideoTranscodeStrategy = {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  best_match: 'best_match',
  all: 'all',
} as const
export type VideoTranscodeStrategy =
  (typeof VideoTranscodeStrategy)[keyof typeof VideoTranscodeStrategy]

export const sandboxSettingsSchema = z.object({
  allowedDomains: z.array(z.string()),
})
export type SandboxSettings = z.infer<typeof sandboxSettingsSchema>

export const updateSandboxSettingsRequestSchema = sandboxSettingsSchema
export type UpdateSandboxSettingsRequest = z.infer<typeof updateSandboxSettingsRequestSchema>

export const updateTeamMemberRoleRequestSchema = z.object({
  role: z.enum(['editor', 'reviewer']),
})
export type UpdateTeamMemberRoleRequest = z.infer<typeof updateTeamMemberRoleRequestSchema>

// Service Layer Interfaces
export interface ServiceCreateTeamRequest {
  name: string
}

export interface ServiceGetUserTeamsRequest {
  userId: string
  pagination: z.infer<typeof paginationParamsSchema>
}

export interface ServiceJoinTeamRequest {
  teamId: string
  userId: string
}

export interface ServiceGetMeRequest {
  teamId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any
}

export interface ServiceGetTeamMembersRequest {
  teamId: string
  userId: string
  includeAgents?: boolean
}

export interface ServiceUpdateTeamMemberRoleRequest {
  teamId: string
  userId: string
  role: 'editor' | 'reviewer'
}
