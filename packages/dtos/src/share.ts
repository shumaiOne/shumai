import { z } from 'zod'
import { paginationParamsSchema } from './pagination'

export interface ShareLinkInfo {
  id: string
  name: string
  expireAt?: string
  isDisabled: boolean
  hasPassword: boolean
  defaultSortOrder?: string
  fieldVisibility?: Record<string, boolean>
  rootFolderId: string
  projectId: string
  isExpired: boolean
  createdAt: string
  updatedAt: string
}

export const createShareLinkRequestSchema = z.object({
  name: z.string().min(1),
  expireAt: z.string().datetime().optional(),
  password: z.string().optional(),
  isDisabled: z.boolean().optional(),
  defaultSortOrder: z.string().optional(),
})

export type CreateShareLinkRequest = z.infer<typeof createShareLinkRequestSchema>

export const updateShareLinkRequestSchema = z.object({
  name: z.string().min(1).optional(),
  expireAt: z.string().datetime().optional().nullable(),
  password: z.string().optional().nullable(),
  isDisabled: z.boolean().optional(),
  defaultSortOrder: z.string().optional().nullable(),
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
