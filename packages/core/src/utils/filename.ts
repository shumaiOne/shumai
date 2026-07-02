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
