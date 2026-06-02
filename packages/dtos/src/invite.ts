import { z } from 'zod'

export const inviteInfoSchema = z.object({
  code: z.string(),
  role: z.enum(['editor', 'reviewer', 'owner']),
  teamId: z.string(),
  teamName: z.string(),
  projectId: z.string().optional(),
  projectName: z.string().optional(),
  inviterName: z.string(),
  isUsed: z.boolean(),
})

export type InviteInfo = z.infer<typeof inviteInfoSchema>

export const createTeamInviteRequestSchema = z.object({
  role: z.enum(['editor', 'reviewer']),
})

export type CreateTeamInviteRequest = z.infer<typeof createTeamInviteRequestSchema>

export const createProjectInviteRequestSchema = z.object({
  role: z.enum(['editor', 'reviewer']),
})

export type CreateProjectInviteRequest = z.infer<typeof createProjectInviteRequestSchema>

export const joinRequestSchema = z.object({
  code: z.string(),
})

export type JoinRequest = z.infer<typeof joinRequestSchema>
