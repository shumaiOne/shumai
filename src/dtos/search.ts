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

export const searchModeSchema = z.enum(['name', 'content', 'all']).optional().default('name')
export type SearchMode = z.infer<typeof searchModeSchema>

export const searchFilterSchema = z.object({
  operator: searchOperatorSchema.optional().default('AND'),
  conditions: z.array(searchConditionSchema).optional().default([]),
  sort: searchSortSchema.optional(),

  assetType: searchAssetTypeSchema.optional(),
  showSymlink: z.boolean().optional(),
  recursively: z.boolean().optional().default(true),
  query: z.string().optional(),
  searchMode: searchModeSchema.default('name'),
})
export type SearchFilter = z.infer<typeof searchFilterSchema>

export const searchRequestSchema = searchFilterSchema.extend(paginationParamsSchema.shape)
export type SearchRequest = z.infer<typeof searchRequestSchema>
