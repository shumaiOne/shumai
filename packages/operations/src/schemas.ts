import { z } from 'zod'

/** Compact asset representation returned by asset Operations. */
export const assetSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  /** `file`, `folder`, `version_stack`, or `symlink`. */
  type: z.string(),
  /** Size in bytes. */
  size: z.number(),
  projectId: z.string().nullable(),
})
export type AssetSummary = z.infer<typeof assetSummarySchema>

/** Cursor pagination metadata. Pass `endCursor` as `after` to fetch the next page. */
export const pageInfoSchema = z.object({
  hasNextPage: z.boolean(),
  endCursor: z.string().nullable(),
})
export type PageInfo = z.infer<typeof pageInfoSchema>

export const projectSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  teamId: z.string(),
  /** The project's root folder; use it as the parent for asset Operations. */
  rootFolderId: z.string().nullable(),
})
export type ProjectSummary = z.infer<typeof projectSummarySchema>

/** Page size bounds shared by list Operations (matches `paginateQuery`). */
export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 200
