import { z } from 'zod'
import { paginationParamsSchema } from './pagination'

export const recordRecentViewRequestSchema = z.object({
  assetId: z.string(),
})
export type RecordRecentViewRequest = z.infer<typeof recordRecentViewRequestSchema>

export const listRecentsRequestSchema = paginationParamsSchema
export type ListRecentsRequest = z.infer<typeof listRecentsRequestSchema>
