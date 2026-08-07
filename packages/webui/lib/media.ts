import type { ImageTranscode, VideoTranscode } from '@shumai/dtos'

type Transcode = ImageTranscode | VideoTranscode

export function getBestTranscode(
  transcodes: Transcode[] | undefined,
  screenWidth: number,
): Transcode | null {
  if (!transcodes || transcodes.length === 0) {
    return null
  }

  // Only transcoded proxy versions are ever used for display; the raw
  // original file is never shown in the UI.
  const candidates = transcodes.filter((t) => !t.isRaw)
  if (candidates.length === 0) {
    return null
  }

  // Sort by width descending to easily find largest available
  const sorted = [...candidates].sort((a, b) => {
    const wA = a.width ?? 0
    const wB = b.width ?? 0
    return wB - wA // Descending width
  })

  // Find smallest width that is >= screenWidth
  const suitable = sorted.filter((t) => (t.width ?? 0) >= screenWidth)

  if (suitable.length > 0) {
    // Sort suitable by width ASCENDING to find "smallest fit".
    suitable.sort((a, b) => {
      const wA = a.width ?? 0
      const wB = b.width ?? 0
      return wA - wB // Ascending
    })
    return suitable[0]
  }

  // If no candidate >= screenWidth, simply return the largest available (first in original sorted)
  return sorted[0]
}
