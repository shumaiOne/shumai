import type { AssetInfo } from '@shumai/dtos'

export const HEADER_MAX_WIDTH = 96
export const HEADER_MAX_HEIGHT = 54
export const FRAME_FIXED_WIDTH = 200
export const DEFAULT_FRAME_HEIGHT = 112
export const ERROR_MIN_HEIGHT = 112

export interface Dimensions {
  width: number
  height: number
}

function isValidDimensions(w?: number | null, h?: number | null): boolean {
  return (
    typeof w === 'number' &&
    typeof h === 'number' &&
    Number.isFinite(w) &&
    Number.isFinite(h) &&
    w > 0 &&
    h > 0
  )
}

/**
 * Resolves the asset's display dimensions from transcode/preview/metadata info so
 * thumbnail containers can size accurately before images finish loading.
 */
export function resolveAssetDisplayDimensions(asset: AssetInfo): Dimensions | null {
  const videoTranscode = asset.media?.videoTranscodes?.find((t) =>
    isValidDimensions(t.width, t.height),
  )
  if (videoTranscode) {
    return { width: videoTranscode.width, height: videoTranscode.height }
  }

  const imageTranscode = asset.media?.imageTranscodes?.find((t) =>
    isValidDimensions(t.width, t.height),
  )
  if (imageTranscode) {
    return { width: imageTranscode.width, height: imageTranscode.height }
  }

  const rawWidth = asset.preview?.originalWidth ?? asset.media?.metadata?.originalWidth
  const rawHeight = asset.preview?.originalHeight ?? asset.media?.metadata?.originalHeight
  if (isValidDimensions(rawWidth, rawHeight)) {
    const rotation = asset.preview?.rotation ?? asset.media?.metadata?.rotation ?? 0
    const isQuarterTurn = Math.abs(Math.round(rotation)) % 180 === 90
    return isQuarterTurn
      ? { width: rawHeight!, height: rawWidth! }
      : { width: rawWidth!, height: rawHeight! }
  }

  return null
}

/**
 * Fits the header thumbnail inside a 96x54 bounding box and shrink-wraps to the
 * media's exact aspect ratio so there is zero empty padding.
 */
export function fitHeaderThumbnailBox(dimensions: Dimensions | null): Dimensions {
  if (!dimensions || !isValidDimensions(dimensions.width, dimensions.height)) {
    return { width: HEADER_MAX_WIDTH, height: HEADER_MAX_HEIGHT }
  }
  const scale = Math.min(HEADER_MAX_WIDTH / dimensions.width, HEADER_MAX_HEIGHT / dimensions.height)
  return {
    width: Math.max(1, Math.round(dimensions.width * scale)),
    height: Math.max(1, Math.round(dimensions.height * scale)),
  }
}

/**
 * Computes the comment screenshot container with fixed 200px width and dynamic
 * height matching the media's exact aspect ratio (zero letterboxing/pillarboxing).
 */
export function computeCommentFrameBox(dimensions: Dimensions | null): Dimensions {
  if (!dimensions || !isValidDimensions(dimensions.width, dimensions.height)) {
    return { width: FRAME_FIXED_WIDTH, height: DEFAULT_FRAME_HEIGHT }
  }
  return {
    width: FRAME_FIXED_WIDTH,
    height: Math.max(1, Math.round(FRAME_FIXED_WIDTH * (dimensions.height / dimensions.width))),
  }
}
