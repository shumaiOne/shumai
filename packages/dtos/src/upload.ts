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
  storageBackend: z.enum(['s3', 'local']).default('local'),
  createdAssets: z
    .array(
      z.object({
        tempId: z.string(),
        assetId: z.string(),
        key: z.string().optional(),
      }),
    )
    .optional(),
})
export type CreateUploadTaskResponse = z.infer<typeof createUploadTaskResponseSchema>

export const s3SignRequestSchema = z.object({
  key: z.string(),
  method: z.enum(['PUT', 'POST', 'GET', 'DELETE']),
  uploadId: z.string().optional(),
  partNumber: z.number().int().positive().optional(),
  fileId: z.string().optional(),
})
export type S3SignRequest = z.infer<typeof s3SignRequestSchema>

export const s3SignResponseSchema = z.object({
  url: z.string(),
})
export type S3SignResponse = z.infer<typeof s3SignResponseSchema>

export const abortUploadRequestSchema = z.object({
  fileId: z.string(),
  uploadId: z.string().optional(),
  key: z.string().optional(),
})
export type AbortUploadRequest = z.infer<typeof abortUploadRequestSchema>

export const abortUploadResponseSchema = z.object({
  success: z.boolean(),
})
export type AbortUploadResponse = z.infer<typeof abortUploadResponseSchema>

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
