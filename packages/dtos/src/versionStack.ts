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

export interface RemoveStackVersionParams {
  stackId: string
  fileId: string
}

export const stackVersionInfoSchema = z.object({
  id: z.string(),
  version: z.number(),
  name: z.string().optional().nullable(),
  previewUrl: z.string().optional().nullable(),
  createdAt: z.string().optional().nullable(),
  creator: z
    .object({
      id: z.string(),
      name: z.string().nullable(),
      image: z.string().optional().nullable(),
    })
    .nullable()
    .optional(),
})
export type StackVersionInfo = z.infer<typeof stackVersionInfoSchema>
