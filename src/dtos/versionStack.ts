import { z } from 'zod'

export const createVersionStackRequestSchema = z.object({
  fileIds: z.array(z.string()),
})
export type CreateVersionStackRequest = z.infer<typeof createVersionStackRequestSchema>

export interface CreateVersionStackParams {
  fileIds: string[]
  projectId: string
  creatorId: string
}

export const changeStackFileVersionRequestSchema = z.object({
  fileId: z.string(),
  beforeId: z.string(),
})
export type ChangeStackFileVersionRequest = z.infer<typeof changeStackFileVersionRequestSchema>

export interface ChangeStackFileVersionParams {
  stackId: string
  fileId: string
  beforeId: string
}
