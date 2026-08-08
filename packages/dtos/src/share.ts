import { z } from 'zod'
import { paginationParamsSchema } from './pagination'
import type { WatermarkConfigSpec } from './watermark'

export interface ShareLinkInfo {
  id: string
  name: string
  expireAt?: string
  isDisabled: boolean
  allowDownload: boolean
  hasPassword: boolean
  password?: string | null
  defaultSortOrder?: string
  viewMode?: string
  fieldVisibility?: Record<string, boolean>
  rootFolderId: string
  projectId: string
  isExpired: boolean
  watermarkConfigId?: string | null
  watermarkStatus?: 'disabled' | 'processing' | 'ready' | 'failed'
  watermarkConfig?: {
    id: string
    config: WatermarkConfigSpec
    hash: string
  } | null
  createdAt: string
  updatedAt: string
  creator?: { id: string; name: string; image?: string | null } | null
}

export const createShareLinkRequestSchema = z.object({
  name: z.string().min(1),
  expireAt: z.string().datetime().optional(),
  password: z.string().optional(),
  isDisabled: z.boolean().optional(),
  allowDownload: z.boolean().optional(),
  defaultSortOrder: z.string().optional(),
  viewMode: z.string().optional(),
})

export type CreateShareLinkRequest = z.infer<typeof createShareLinkRequestSchema>

export const updateShareLinkRequestSchema = z.object({
  name: z.string().min(1).optional(),
  expireAt: z.string().datetime().optional().nullable(),
  password: z.string().optional().nullable(),
  isDisabled: z.boolean().optional(),
  allowDownload: z.boolean().optional(),
  defaultSortOrder: z.string().optional().nullable(),
  viewMode: z.string().optional().nullable(),
  fieldVisibility: z.record(z.string(), z.boolean()).optional().nullable(),
})

export type UpdateShareLinkRequest = z.infer<typeof updateShareLinkRequestSchema>

export const listShareLinksRequestSchema = paginationParamsSchema.extend({
  projectId: z.string().optional(), // projectId can come from param
})

export type ListShareLinksRequest = z.infer<typeof listShareLinksRequestSchema> & {
  projectId: string
}

export const addAssetToShareRequestSchema = z.object({
  assetIds: z.array(z.string().min(1)).min(1),
})

export type AddAssetToShareRequest = z.infer<typeof addAssetToShareRequestSchema>
