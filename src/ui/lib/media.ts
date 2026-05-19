import type { ImageTranscode, VideoTranscode } from '@/dtos/asset'

type Transcode = ImageTranscode | VideoTranscode

export function getBestTranscode(
  transcodes: Transcode[] | undefined,
  screenWidth: number,
): Transcode | null {
  if (!transcodes || transcodes.length === 0) {
    return null
  }

  // Filter out raw versions unless they are the only option
  const nonRaw = transcodes.filter((t) => !t.isRaw)
  const candidates = nonRaw.length > 0 ? nonRaw : transcodes

  // Sort by width descending to easily find largest available
  // If widths are equal, prefer the one that is NOT raw (transcoded optimized version)
  const sorted = [...candidates].sort((a, b) => {
    const wA = a.width ?? 0
    const wB = b.width ?? 0
    if (wA !== wB) {
      return wB - wA // Descending width
    }
    // If widths equal, prefer non-raw (optimized)
    return (a.isRaw ? 1 : 0) - (b.isRaw ? 1 : 0)
  })

  // Find smallest width that is >= screenWidth
  const suitable = sorted.filter((t) => (t.width ?? 0) >= screenWidth)

  if (suitable.length > 0) {
    // Sort suitable by width ASCENDING to find "smallest fit".
    suitable.sort((a, b) => {
      const wA = a.width ?? 0
      const wB = b.width ?? 0
      if (wA !== wB) return wA - wB // Ascending
      return (a.isRaw ? 1 : 0) - (b.isRaw ? 1 : 0) // Non-raw first
    })
    return suitable[0]
  }

  // If no candidate >= screenWidth, simply return the largest available (first in original sorted)
  return sorted[0]
}
