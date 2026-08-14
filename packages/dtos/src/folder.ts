import { z } from 'zod'

export const createFolderRequestSchema = z.object({
  name: z.string(),
  parentId: z.string(),
})
export type CreateFolderRequest = z.infer<typeof createFolderRequestSchema>

export const updateFolderRequestSchema = z.object({
  name: z.string(),
})
export type UpdateFolderRequest = z.infer<typeof updateFolderRequestSchema>

export const deleteFoldersRequestSchema = z.object({
  ids: z.array(z.string()),
})
export type DeleteFoldersRequest = z.infer<typeof deleteFoldersRequestSchema>

export const restoreFoldersRequestSchema = z.object({
  ids: z.array(z.string()),
})
export type RestoreFoldersRequest = z.infer<typeof restoreFoldersRequestSchema>

export const getAgentsMdResponseSchema = z.object({
  content: z.string().nullable(),
})
export type GetAgentsMdResponse = z.infer<typeof getAgentsMdResponseSchema>

export const updateAgentsMdRequestSchema = z.object({
  content: z.string(),
})
export type UpdateAgentsMdRequest = z.infer<typeof updateAgentsMdRequestSchema>

export const updateAgentsMdResponseSchema = z.object({
  content: z.string(),
})
export type UpdateAgentsMdResponse = z.infer<typeof updateAgentsMdResponseSchema>
