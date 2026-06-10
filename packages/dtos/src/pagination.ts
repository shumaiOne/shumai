import { z } from 'zod'

export const paginationPageInfoSchema = z.object({
  cursor: z.string().optional(),
  total: z.number().optional(),
  totalSize: z.number().optional(),
})

export type PaginationPageInfo = z.infer<typeof paginationPageInfoSchema>

export const paginationParamsSchema = z.object({
  first: z.coerce.number().optional(),
  after: z.string().optional(),
})

export type PaginationParams = z.infer<typeof paginationParamsSchema>
