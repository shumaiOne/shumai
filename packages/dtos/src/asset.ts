import { z } from 'zod'
import { paginationPageInfoSchema, paginationParamsSchema } from './pagination'

export const assetInfoPaginatedListSchema = z.object({
  data: z.array(z.lazy(() => assetInfoSchema)),
  pageInfo: paginationPageInfoSchema,
})
export type AssetInfoPaginatedList = z.infer<typeof assetInfoPaginatedListSchema>

export const previewInfoSchema = z.object({
  proxyType: z.enum(['image', 'video', 'audio', 'pdf']).nullable().optional(),
  thumbnailUrl: z.string().optional(),
  originalHeight: z.number().optional(),
  originalWidth: z.number().optional(),
  spriteUrl: z.string().optional(),
  duration: z.number().optional(),
  pageCount: z.number().optional(),
})
export type PreviewInfo = z.infer<typeof previewInfoSchema>

export const childPreviewSchema = z.object({
  type: z.string().nullable(),
  preview: previewInfoSchema.nullable(),
})
export type ChildPreview = z.infer<typeof childPreviewSchema>

export const assetUserInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().optional(),
})
export type AssetUserInfo = z.infer<typeof assetUserInfoSchema>

export const fieldValueInfoSchema = z.object({
  fieldId: z.string(),

  value: z.any(),
})
export type FieldValueInfo = z.infer<typeof fieldValueInfoSchema>

export const ancestorFolderSchema = z.object({
  id: z.string(),
  name: z.string(),
})
export type AncestorFolder = z.infer<typeof ancestorFolderSchema>

export const mediaMetadataSchema = z.object({
  duration: z.number().optional(),
  originalWidth: z.number().optional(),
  originalHeight: z.number().optional(),
  frameRate: z.number().optional(),
  totalFrames: z.number().optional(),
  startTimecode: z.string().optional(),
})
export type MediaMetadata = z.infer<typeof mediaMetadataSchema>

export const assetInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  sizeByte: z.number(),
  fileCount: z.number(),
  type: z.string(),
  targetType: z.string().optional().nullable(),
  status: z.string(),
  proxyType: z.enum(['image', 'video', 'audio', 'pdf']).nullable().optional(),
  latestChildren: z.array(childPreviewSchema).optional(),
  preview: previewInfoSchema.nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable().optional(),
  projectId: z.string().optional().nullable(),
  creator: assetUserInfoSchema.nullable().optional(),
  fieldValues: z.array(fieldValueInfoSchema).optional(),
  sortIndex: z.string().optional().nullable(),
  startTime: z.number().optional().nullable(),
  endTime: z.number().optional().nullable(),
  hasAgentsMd: z.boolean().optional(),

  media: z
    .object({
      original: z.object({ key: z.string().optional() }).optional(),
      videoTranscodes: z
        .array(
          z.object({
            id: z.string(),
            url: z.string(),
            key: z.string(),
            width: z.number(),
            height: z.number(),
            size: z.number(),
          }),
        )
        .optional(),
      imageTranscodes: z
        .array(
          z.object({
            id: z.string(),
            url: z.string(),
            key: z.string(),
            width: z.number(),
            height: z.number(),
            size: z.number(),
          }),
        )
        .optional(),
      videoPreview: z.object({ url: z.string(), key: z.string().optional() }).optional(),
      pdfTranscode: z.object({ url: z.string(), key: z.string().optional() }).optional(),
      proxyType: z.enum(['image', 'video', 'audio', 'pdf']).nullable().optional(),
      metadata: mediaMetadataSchema.optional(),
    })
    .optional(),
  ancestorFolders: z.array(ancestorFolderSchema).optional(),
  versionStack: z
    .object({
      id: z.string(),
      versions: z.array(
        z.object({
          version: z.number(),
          current: z.boolean(),
          id: z.string(),
          name: z.string().optional().nullable(),
          previewUrl: z.string().optional().nullable(),
          creator: z
            .object({
              id: z.string(),
              name: z.string().nullable(),
            })
            .nullable()
            .optional(),
        }),
      ),
    })
    .optional()
    .nullable(),
})
export type AssetInfo = z.infer<typeof assetInfoSchema>

export const createAssetRequestSchema = z.object({
  name: z.string(),
  type: z.string(),
  projectId: z.string().optional(),
  parentId: z.string().optional(),
  key: z.string().optional(),
  sizeByte: z.number().optional(),
  contentType: z.string().optional(),
  creatorId: z.string().optional(),
})
export type CreateAssetRequest = z.infer<typeof createAssetRequestSchema>

export const getAssetRequestSchema = z.object({
  assetId: z.string(),
})
export type GetAssetRequest = z.infer<typeof getAssetRequestSchema>

export const updateAssetNameRequestSchema = z.object({
  id: z.string(),
  name: z.string(),
})
export type UpdateAssetNameRequest = z.infer<typeof updateAssetNameRequestSchema>

export const listChildrenRequestSchema = z.object({
  assetId: z.string().optional(),
  assetType: z.string(),
  projectId: z.string().optional(),
  showDeleted: z.boolean().optional(),
  prefix: z.string().optional(),
  sort: z.string().optional(),
  order: z.string().optional(),
  // pagination props mixed in via merge
  ...paginationParamsSchema.shape,
})
export type ListChildrenRequest = z.infer<typeof listChildrenRequestSchema>

export const createCommentRequestSchema = z.object({
  assetId: z.string(),
  userId: z.string(),
  replyToId: z.string().optional(),
  message: z.string(),

  annotations: z.any().optional(),
  second: z.number().optional(),
  attachmentIds: z.array(z.string()),
})
export type CreateCommentRequest = z.infer<typeof createCommentRequestSchema>

export const attachmentInfoSchema = z.object({
  id: z.string(),
  assetId: z.string(),
  url: z.string(),
  proxyType: z.enum(['image', 'video', 'audio', 'pdf']).nullable().optional(),
})
export type AttachmentInfo = z.infer<typeof attachmentInfoSchema>

export type CommentInfo = {
  id: string
  assetId: string
  message: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  annotations: any
  second: number | null
  creator: AssetUserInfo
  replies: CommentInfo[]
  attachments: AttachmentInfo[]
  mentions: AssetUserInfo[]
  createdAt: string
  updatedAt: string
  sessionId: string | null
  isCompleted: boolean
  completionLastChangedBy: AssetUserInfo | null
}

export const commentInfoSchema: z.ZodType<CommentInfo> = z.object({
  id: z.string(),
  assetId: z.string(),
  message: z.string().nullable(),

  annotations: z.any(),
  second: z.number().nullable(),
  creator: assetUserInfoSchema,
  replies: z.array(z.lazy(() => commentInfoSchema)),
  attachments: z.array(attachmentInfoSchema),
  mentions: z.array(assetUserInfoSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
  sessionId: z.string().nullable(),
  isCompleted: z.boolean(),
  completionLastChangedBy: assetUserInfoSchema.nullable(),
})

export const completeCommentRequestSchema = z.object({
  isCompleted: z.boolean(),
})
export type CompleteCommentRequest = z.infer<typeof completeCommentRequestSchema>

export const reparentAssetsRequestSchema = z.object({
  newParentId: z.string(),
  assetIds: z.array(z.string()),
  creatorId: z.string().optional(),
})
export type ReparentAssetsRequest = z.infer<typeof reparentAssetsRequestSchema>

export const copyAssetsRequestSchema = z.object({
  newParentId: z.string(),
  assetIds: z.array(z.string()),
  withComments: z.boolean().default(false),
  creatorId: z.string().optional(),
})
export type CopyAssetsRequest = z.infer<typeof copyAssetsRequestSchema>

export const updateFileRequestSchema = z.object({
  name: z.string(),
})
export type UpdateFileRequest = z.infer<typeof updateFileRequestSchema>

export const updateAssetOrderRequestSchema = z.object({
  beforeIndex: z.string().optional(),
  afterIndex: z.string().optional(),
})
export type UpdateAssetOrderRequest = z.infer<typeof updateAssetOrderRequestSchema>

export const deleteFilesRequestSchema = z.object({
  ids: z.array(z.string()),
})
export type DeleteFilesRequest = z.infer<typeof deleteFilesRequestSchema>

export const restoreFilesRequestSchema = z.object({
  ids: z.array(z.string()),
})
export type RestoreFilesRequest = z.infer<typeof restoreFilesRequestSchema>

export const uploadFileRequestSchema = z.object({
  file: z.instanceof(File),
})
export type UploadFileRequest = z.infer<typeof uploadFileRequestSchema>

export const uploadTeamFileResponseSchema = z.object({
  key: z.string(),
})
export type UploadTeamFileResponse = z.infer<typeof uploadTeamFileResponseSchema>

export interface ImageTranscode {
  id: string
  url: string
  width: number
  height: number
  size: number
}

export interface VideoTranscode {
  id: string
  url: string
  key: string
  width: number
  height: number
  size: number
}

export const postAttachmentRequestSchema = z.object({
  fileName: z.string(),
  contentType: z.string(),
  size: z.number(),
})
export type PostAttachmentRequest = z.infer<typeof postAttachmentRequestSchema>

export const postAttachmentResponseSchema = z.object({
  id: z.string(),
  uploadUrl: z.string(),
})
export type PostAttachmentResponse = z.infer<typeof postAttachmentResponseSchema>

export const getDownloadLinksRequestSchema = z.object({
  ids: z.array(z.string()),
})
export type GetDownloadLinksRequest = z.infer<typeof getDownloadLinksRequestSchema>

export const downloadLinkItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
})
export type DownloadLinkItem = z.infer<typeof downloadLinkItemSchema>

export const getDownloadLinksResponseSchema = z.object({
  files: z.array(downloadLinkItemSchema),
})
export type GetDownloadLinksResponse = z.infer<typeof getDownloadLinksResponseSchema>
