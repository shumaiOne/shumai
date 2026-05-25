import { z } from 'zod'
import { searchFilterSchema } from './search'
import { paginationParamsSchema } from './pagination'

export const collectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  filter: searchFilterSchema,
  projectId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type CollectionInfo = z.infer<typeof collectionSchema>

export const createCollectionRequestSchema = z.object({
  name: z.string(),
  filter: searchFilterSchema,
})

export type CreateCollectionRequest = z.infer<typeof createCollectionRequestSchema>

export const updateCollectionRequestSchema = z.object({
  name: z.string().optional(),
  filter: searchFilterSchema.optional(),
})

export type UpdateCollectionRequest = z.infer<typeof updateCollectionRequestSchema>

export const listCollectionsRequestSchema = paginationParamsSchema

export type ListCollectionsRequest = z.infer<typeof listCollectionsRequestSchema>

export const collectionListSchema = z.object({
  data: z.array(collectionSchema),
  pageInfo: z.object({
    cursor: z.string().optional(),
    total: z.number().optional(),
  }),
})

export type CollectionList = z.infer<typeof collectionListSchema>
