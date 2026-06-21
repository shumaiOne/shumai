import { z } from 'zod'

export type FileNode = {
  name: string
  id: string
  size: number
  children: FileNode[]
  type: string
  mediaType?: string
}

export const fileNodeSchema: z.ZodType<FileNode> = z.lazy(() =>
  z.object({
    name: z.string(),
    id: z.string(),
    size: z.number(),
    children: z.array(fileNodeSchema),
    type: z.string(),
    mediaType: z.string().optional(),
  }),
)

export const createUploadTaskRequestSchema = z.object({
  parentId: z.string(),
  files: z.array(fileNodeSchema),
})
export type CreateUploadTaskRequest = z.infer<typeof createUploadTaskRequestSchema>

export const presignedUrlSchema = z.object({
  id: z.string(),
  fileId: z.string(),
  url: z.string(),
})
export type PresignedUrl = z.infer<typeof presignedUrlSchema>

export const createUploadTaskResponseSchema = z.object({
  taskId: z.string(),
  presignedUrls: z.array(presignedUrlSchema),
  createdAssets: z
    .array(
      z.object({
        tempId: z.string(),
        assetId: z.string(),
      }),
    )
    .optional(),
})
export type CreateUploadTaskResponse = z.infer<typeof createUploadTaskResponseSchema>

export const confirmFileUploadRequestSchema = z.object({
  fileId: z.string(),
  errorMessage: z.string().optional(),
})
export type ConfirmFileUploadRequest = z.infer<typeof confirmFileUploadRequestSchema>

export const taskInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  total: z.number(),
  uploaded: z.number(),
  createdAt: z.string(),
})
export type TaskInfo = z.infer<typeof taskInfoSchema>

export const localUploadQuerySchema = z.object({
  bucket: z.string(),
  key: z.string(),
  Signature: z.string(),
})
export type LocalUploadQuery = z.infer<typeof localUploadQuerySchema>

export const localUploadBodySchema = z.object({
  file: z.instanceof(File),
})
export type LocalUploadBody = z.infer<typeof localUploadBodySchema>
