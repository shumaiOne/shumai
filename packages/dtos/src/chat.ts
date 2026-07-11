import { z } from 'zod'
import type { AgentMessage } from '@earendil-works/pi-agent-core'

export const chatRequestSchema = z
  .object({
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

export const chatMessageSchema = z.intersection(
  z.object({
    id: z.string(),
  }),
  z.unknown(),
) as unknown as z.ZodType<AgentMessage & { id: string }>

export type ChatMessage = AgentMessage & { id: string }
