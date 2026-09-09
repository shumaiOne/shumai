import path from 'path'

/**
 * Sanitize a filename for safe use as an S3 key segment.
 * - Replaces characters unsafe for S3/filesystems with '_'
 * - Trims leading/trailing whitespace and dots
 * - Falls back to 'file' if the result is empty
 */
export function sanitizeFilename(filename: string): string {
  // Replace NUL bytes, slashes, backslashes, and control characters
  // eslint-disable-next-line no-control-regex
  let safe = filename.replace(/[\x00-\x1f\x7f/\\]/g, '_')

  // Trim leading/trailing whitespace and dots
  safe = safe.replace(/^[\s.]+|[\s.]+$/g, '')

  // Collapse multiple underscores
  safe = safe.replace(/_+/g, '_')

  if (!safe) {
    return 'file'
  }

  return safe
}

/**
 * Extract the filename stem (without extension) from a storage key.
 * e.g. 'files/01ABC.../foo.mp4' → 'foo'
 *      'files/01ABC.../raw' → 'raw'
 */
export function stemFromKey(key: string): string {
  const basename = path.basename(key)
  const ext = path.extname(basename)
  return ext ? basename.slice(0, -ext.length) : basename
}

/**
 * Resolves the parent directory for derived artifacts (e.g. screenshots, proxies, annotations).
 * Prefers the directory of the asset's storage key, falling back to `files/<assetId>` if the key
 * has no directory prefix.
 *
 * e.g. 'files/01ABC.../video.mp4' → 'files/01ABC...'
 *      'video.mp4' (with assetId '01XYZ...') → 'files/01XYZ...'
 */
export function getDerivedArtifactDirectory(assetKey: string, assetId?: string | null): string {
  const dir = path.posix.dirname(assetKey)
  if (dir === '.' || !dir) {
    return assetId ? `files/${assetId}` : ''
  }
  return dir
}
