import { z } from 'zod'
import { paginationParamsSchema } from './pagination'

export const searchConditionOperatorSchema = z.enum([
  'is',
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'notContains',
  'isEmpty',
  'isNotEmpty',
  'in',
  'notIn',
  'hasAny',
  'hasAll',
  'hasNone',
  'isWithin',
])
export type SearchConditionOperator = z.infer<typeof searchConditionOperatorSchema>

export const searchConditionSchema = z.object({
  field: z.string(),
  operator: searchConditionOperatorSchema,
  value: z.any(),
})
export type SearchCondition = z.infer<typeof searchConditionSchema>

export const searchSortOrderSchema = z.enum(['asc', 'desc'])
export type SearchSortOrder = z.infer<typeof searchSortOrderSchema>

export const searchSortSchema = z.object({
  field: z.string(),
  order: searchSortOrderSchema,
})
export type SearchSort = z.infer<typeof searchSortSchema>

export const searchOperatorSchema = z.enum(['AND', 'OR'])
export type SearchOperator = z.infer<typeof searchOperatorSchema>

export const searchAssetTypeSchema = z.enum(['file', 'folder'])
export type SearchAssetType = z.infer<typeof searchAssetTypeSchema>

export const previewFormatSchema = z.enum(['jpeg', 'webp'])
export type PreviewFormat = z.infer<typeof previewFormatSchema>

export const searchFilterSchema = z.object({
  operator: searchOperatorSchema.optional().default('AND'),
  conditions: z.array(searchConditionSchema).optional().default([]),
  sort: searchSortSchema.optional(),

  assetType: searchAssetTypeSchema.optional(),
  showSymlink: z.boolean().optional(),
  recursively: z.boolean().optional().default(true),
  query: z.string().optional(),
  isSemantic: z.boolean().optional().default(false),
  previewFormat: previewFormatSchema.optional(),
})
export type SearchFilter = z.infer<typeof searchFilterSchema>

export const searchRequestSchema = searchFilterSchema.extend(paginationParamsSchema.shape)
export type SearchRequest = z.infer<typeof searchRequestSchema>

export const MAX_SEARCH_IMAGE_BASE64_LENGTH = 1_500_000
export const imageSearchMediaTypeSchema = z.enum(['image', 'video'])
export type ImageSearchMediaType = z.infer<typeof imageSearchMediaTypeSchema>

export const imageSearchRequestSchema = searchFilterSchema
  .pick({ conditions: true, operator: true, previewFormat: true })
  .extend({
    ...paginationParamsSchema.shape,
    mediaType: imageSearchMediaTypeSchema.optional(),
    image: z.base64().min(1).max(MAX_SEARCH_IMAGE_BASE64_LENGTH).optional(),
    sourceAssetId: z.string().min(1).optional(),
  })
  .refine(({ image, sourceAssetId }) => Boolean(image) !== Boolean(sourceAssetId), {
    message: 'Provide one search image or source asset.',
  })

export type ImageSearchRequest = z.infer<typeof imageSearchRequestSchema>
