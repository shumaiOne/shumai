import { z } from 'zod'
import { paginationPageInfoSchema, paginationParamsSchema } from './pagination'

export const createProjectRequestSchema = z.object({
  name: z.string(),
  coverImageKey: z.string().optional(),
  enableNotification: z.boolean().default(true),
})
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>

export const updateProjectRequestSchema = z.object({
  name: z.string().optional(),
  coverImageKey: z.string().optional(),
  enableNotification: z.boolean().optional(),
})
export type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>

export const projectInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  rootFolder: z.string().optional(),
  coverImage: z.string().optional(),
  coverImageKey: z.string().optional(),
  enableNotification: z.boolean(),
  updatedAt: z.union([z.string(), z.date()]),
})
export type ProjectInfo = z.infer<typeof projectInfoSchema>

export const listProjectsRequestSchema = z
  .object({
    sortBy: z.string().optional(),
    sortDirection: z.enum(['asc', 'desc']).optional(),
  })
  .merge(paginationParamsSchema)

export const listProjectsResponseSchema = z.object({
  data: z.array(projectInfoSchema),
  pageInfo: paginationPageInfoSchema,
})

export const getProjectTeamResponseSchema = z.object({
  teamId: z.string(),
})
export type GetProjectTeamResponse = z.infer<typeof getProjectTeamResponseSchema>

export const projectUserInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  image: z.string().optional(),
})
export type ProjectUserInfo = z.infer<typeof projectUserInfoSchema>

export const botInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
})
export type BotInfo = z.infer<typeof botInfoSchema>

export const recentlyDeletedRequestSchema = z
  .object({
    assetType: z.string(),
    sort: z.enum(['createdAt', 'name', 'size']).optional(),
    order: z.enum(['asc', 'desc']).optional(),
  })
  .merge(paginationParamsSchema)

// Service Layer Interfaces
export interface ServiceCreateProjectRequest {
  teamId: string
  name: string
  coverImageKey?: string
  enableNotification?: boolean
}

export interface ServiceUpdateProjectRequest {
  projectId: string
  name?: string
  coverImageKey?: string
  enableNotification?: boolean
}

export interface ServiceListProjectsRequest {
  teamId: string
  userId: string
  sortBy?: string
  sortDirection?: 'asc' | 'desc'
  pagination: z.infer<typeof paginationParamsSchema>
}

export interface ServiceAddProjectMemberRequest {
  projectId: string
  userId: string
  role: string
}

export interface ServiceListProjectMembersRequest {
  projectId: string
  includeAgents?: boolean
}
