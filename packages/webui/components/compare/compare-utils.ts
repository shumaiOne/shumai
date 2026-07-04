import type { PaneKind } from './types'

/** Classify an asset's media type into a compare pane kind. */
export function kindOf(mediaType: string | null | undefined): PaneKind {
  if (!mediaType) return 'unsupported'
  if (mediaType.startsWith('image/')) return 'image'
  if (mediaType.startsWith('video/')) return 'video'
  return 'unsupported'
}

interface VersionLike {
  id: string
  version: number
}

/**
 * Given a version stack's versions, pick the default compare pair:
 * left = latest (highest version number), right = latest - 1.
 * Returns null if fewer than two versions exist.
 */
export function pickDefaultCompareVersions(
  versions: ReadonlyArray<VersionLike> | undefined | null,
): { left: VersionLike; right: VersionLike } | null {
  if (!versions || versions.length < 2) return null
  const sorted = [...versions].sort((a, b) => b.version - a.version)
  return { left: sorted[0], right: sorted[1] }
}

/** Clamp a frame index into the valid range [0, totalFrames - 1]. */
export function clampFrame(frame: number, totalFrames: number): number {
  return Math.max(0, Math.min(frame, Math.max(0, totalFrames - 1)))
}

/** True when both panes hold the same (non-unsupported) media kind. */
export function isSameType(left: PaneKind, right: PaneKind): boolean {
  return left === right && left !== 'unsupported'
}
