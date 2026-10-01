import type { ImageTranscode, VideoTranscode } from '@shumai/dtos'

type Transcode = ImageTranscode | VideoTranscode

const WEB_IMAGE_EXTENSION_REGEX = /\.(png|jpe?g|webp|gif|svg|avif|bmp|ico)$/i

export function isImageFileName(filename?: string | null): boolean {
  if (!filename) return false
  return WEB_IMAGE_EXTENSION_REGEX.test(filename)
}

export function getBestTranscode(
  transcodes: Transcode[] | undefined,
  screenWidth: number,
): Transcode | null {
  if (!transcodes || transcodes.length === 0) {
    return null
  }

  // Sort by width descending to easily find largest available
  const sorted = [...transcodes].sort((a, b) => {
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

export function getVideoResolutionLabel(
  transcode?: {
    width?: number
    height?: number
    resolution?: string
  } | null,
): string {
  if (!transcode) return ''

  if (transcode.resolution) {
    return transcode.resolution
  }

  const width = transcode.width ?? 0
  const height = transcode.height ?? 0

  if (width > 0 && height > 0) {
    const longSide = Math.max(width, height)
    if (longSide >= 3840) return '2160p'
    if (longSide >= 2560) return '1440p'
    if (longSide >= 1920) return '1080p'
    if (longSide >= 1280) return '720p'
    if (longSide >= 854) return '480p'
    if (longSide >= 640) return '360p'
    if (longSide >= 320) return '180p'

    const shortSide = Math.min(width, height)
    return `${shortSide}p`
  }

  if (height > 0) {
    return `${height}p`
  }
  if (width > 0) {
    return `${width}p`
  }

  return ''
}
