import { z } from 'zod'
import { paginationParamsSchema } from './pagination'
import { photoFilterSchema } from './photo'

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
  /** Camera EXIF filter (camera, lens), applied to files only. */
  photo: photoFilterSchema.optional(),
})
export type SearchFilter = z.infer<typeof searchFilterSchema>

/**
 * Which files the camera filter's choices are counted over: a folder, optionally with its
 * subfolders, narrowed by the same conditions as the search or collection being viewed.
 */
export const photoFacetsRequestSchema = z.object({
  recursively: z.boolean().optional().default(false),
  operator: searchOperatorSchema.optional().default('AND'),
  conditions: z.array(searchConditionSchema).optional().default([]),
  /** Count symlinked files too, as the listing does when it shows symlinks. */
  showSymlink: z.boolean().optional(),
})
export type PhotoFacetsRequest = z.infer<typeof photoFacetsRequestSchema>

export const searchRequestSchema = searchFilterSchema.extend(paginationParamsSchema.shape)
export type SearchRequest = z.infer<typeof searchRequestSchema>
