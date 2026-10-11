import { fileTypeFilterSchema } from './file-types'
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
  /** File-type filter (extensions and groups), applied to files only, ANDed with conditions. */
  fileTypes: fileTypeFilterSchema.optional(),
})
export type SearchFilter = z.infer<typeof searchFilterSchema>

export const searchRequestSchema = searchFilterSchema.extend(paginationParamsSchema.shape)
export type SearchRequest = z.infer<typeof searchRequestSchema>

/**
 * Request for the per-extension counts behind the file-type filter. It carries the same scope
 * and conditions as a search so the numbers match the listing, but never the file-type filter
 * itself (a group would otherwise count only what it already shows).
 */
export const fileTypeCountsRequestSchema = searchFilterSchema
  .pick({ operator: true, conditions: true, showSymlink: true })
  .extend({ recursively: z.boolean().optional().default(false) })
export type FileTypeCountsRequest = z.infer<typeof fileTypeCountsRequestSchema>
