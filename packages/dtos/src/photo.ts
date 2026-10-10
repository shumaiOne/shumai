import { z } from 'zod'

/**
 * Photo browsing: sorting by the date a photo was taken and filtering by the camera and lens that
 * transcoding reads from its EXIF and stores as system metadata fields (`capture_date`, `camera`,
 * `lens`).
 */

/** Filterable EXIF facets, keyed by request property, valued by metadata field key. */
export const PHOTO_FACETS = {
  camera: 'camera',
  lens: 'lens',
} as const
export type PhotoFacet = keyof typeof PHOTO_FACETS

const facetValuesSchema = z.array(z.string().trim().min(1).max(200)).max(50).optional()

export const photoFilterSchema = z.object({
  camera: facetValuesSchema,
  lens: facetValuesSchema,
})
export type PhotoFilter = z.infer<typeof photoFilterSchema>

/** True when the filter would change the listing. */
export function isPhotoFilterActive(filter: PhotoFilter | undefined): boolean {
  if (!filter) return false
  return (Object.keys(PHOTO_FACETS) as PhotoFacet[]).some((k) => (filter[k]?.length ?? 0) > 0)
}

export const photoFacetValueSchema = z.object({
  value: z.string(),
  /** Files with this value. */
  count: z.number(),
})
export type PhotoFacetValue = z.infer<typeof photoFacetValueSchema>

export const photoFacetsSchema = z.object({
  camera: z.array(photoFacetValueSchema),
  lens: z.array(photoFacetValueSchema),
})
export type PhotoFacets = z.infer<typeof photoFacetsSchema>

/** Sort field for "date taken" (EXIF DateTimeOriginal, or a video's creation time). */
export const CAPTURE_DATE_SORT_FIELD = 'captureDate'
