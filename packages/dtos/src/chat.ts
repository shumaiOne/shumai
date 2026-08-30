import { z } from 'zod'
import type { AgentMessage } from '@earendil-works/pi-agent-core'

export const chatRequestSchema = z
  .object({
    agentId: z.string(),
    textPrompt: z.string().optional(),
    attachedFiles: z.array(z.string()).optional(), // Uploaded file asset IDs
    assetIds: z.array(z.string()).optional(), // Workspace file/folder IDs referenced
    sessionId: z.string().optional(), // ID of existing session (to continue)
    contextAssetId: z.string().optional(), // Active page context asset ID
    projectId: z.string().optional(), // Target project ID
  })
  .superRefine((data, ctx) => {
    const hasPrompt = data.textPrompt && data.textPrompt.trim().length > 0
    const hasFiles = data.attachedFiles && data.attachedFiles.length > 0
    const hasAssets = data.assetIds && data.assetIds.length > 0
    if (!hasPrompt && !hasFiles && !hasAssets) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one of textPrompt, attachedFiles, or assetIds must be provided.',
        path: ['textPrompt'],
      })
    }
  })

export type ChatRequest = z.infer<typeof chatRequestSchema>

export const chatSessionInfoSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  userId: z.string().nullable(),
  assetId: z.string().nullable(),
  userCommentId: z.string().nullable(),
  name: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type ChatSessionInfo = z.infer<typeof chatSessionInfoSchema>

export const shumaiAssetContextSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['file', 'folder', 'version_stack']),
  mediaType: z.enum(['image', 'video', 'pdf', 'audio', 'other']).optional(),
  mimeType: z.string().optional(),
  parentId: z.string().optional(),
  path: z.string().optional(),
  durationSeconds: z.number().optional(),
  totalPages: z.number().optional(),
  navigated: z.boolean().optional(),
  ancestors: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
})

export type ShumaiAssetContext = z.infer<typeof shumaiAssetContextSchema>

export const shumaiAttachedFileContextSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  mediaType: z.string().optional(),
  path: z.string().optional(),
})

export type ShumaiAttachedFileContext = z.infer<typeof shumaiAttachedFileContextSchema>

export const shumaiMediaPositionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('time'), seconds: z.number() }),
  z.object({ type: z.literal('page'), page: z.number() }),
])

export type ShumaiMediaPosition = z.infer<typeof shumaiMediaPositionSchema>

export const shumaiMessageContextSchema = z.object({
  user: z
    .object({
      id: z.string(),
      name: z.string(),
      role: z.string(),
    })
    .optional(),
  currentAsset: shumaiAssetContextSchema.optional(),
  position: shumaiMediaPositionSchema.optional(),
  annotation: z.boolean().optional(),
  attachedFiles: z.array(shumaiAttachedFileContextSchema).optional(),
  referencedAssets: z.array(shumaiAttachedFileContextSchema).optional(),
})

export type ShumaiMessageContext = z.infer<typeof shumaiMessageContextSchema>

export const chatMessageSchema = z.intersection(
  z.object({
    id: z.string(),
  }),
  z.unknown(),
) as unknown as z.ZodType<ChatMessage>

export type ChatMessage = (
  | AgentMessage
  | {
      role: 'custom'
      customType: string
      content?: unknown
      display?: boolean
      details?: unknown
      timestamp?: number
    }
  | {
      role: 'thinking_level_change'
      content: string
      timestamp?: number
    }
) & { id: string }
