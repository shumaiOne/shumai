import { z } from 'zod'

export const duplicateAssetInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Folder path of the file inside the project, for example `Shoots/2026/Day 1`. */
  path: z.string(),
  parentId: z.string().nullable(),
  sizeByte: z.number(),
  createdAt: z.string(),
})
export type DuplicateAssetInfo = z.infer<typeof duplicateAssetInfoSchema>

export const duplicateGroupSchema = z.object({
  contentHash: z.string(),
  sizeByte: z.number(),
  count: z.number(),
  /** Bytes that would be freed by keeping a single copy. */
  wastedBytes: z.number(),
  assets: z.array(duplicateAssetInfoSchema),
})
export type DuplicateGroup = z.infer<typeof duplicateGroupSchema>

export const listDuplicatesRequestSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
})
export type ListDuplicatesRequest = z.infer<typeof listDuplicatesRequestSchema>

export const listDuplicatesResponseSchema = z.object({
  groups: z.array(duplicateGroupSchema),
  /** True when more duplicate groups exist than `limit`. */
  truncated: z.boolean(),
})
export type ListDuplicatesResponse = z.infer<typeof listDuplicatesResponseSchema>

export const MAX_RESOLVE_DELETE_IDS = 200

/**
 * Deletes extra copies of one duplicate group. The server checks that every id in `deleteIds` has the
 * same stored content hash as `keepId` before anything is moved to trash.
 */
export const resolveDuplicatesRequestSchema = z
  .object({
    keepId: z.string().min(1),
    deleteIds: z.array(z.string().min(1)).min(1).max(MAX_RESOLVE_DELETE_IDS),
  })
  .refine((v) => !v.deleteIds.includes(v.keepId), {
    message: 'keepId must not be one of deleteIds',
    path: ['deleteIds'],
  })
export type ResolveDuplicatesRequest = z.infer<typeof resolveDuplicatesRequestSchema>

export const resolveDuplicatesResponseSchema = z.object({
  /** Ids moved to trash. */
  deletedIds: z.array(z.string()),
})
export type ResolveDuplicatesResponse = z.infer<typeof resolveDuplicatesResponseSchema>
