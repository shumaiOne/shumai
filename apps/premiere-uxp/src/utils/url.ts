/**
 * Utility functions for URL manipulation and resolution in UXP plugins.
 */

/**
 * Resolves an asset URL (such as a thumbnail or file download) against
 * the user-configured Shumai endpoint.
 *
 * Handles:
 * - Relative paths (/files/..., /api/...) by prepending the endpoint.
 * - Absolute URLs (http://, https://) are preserved as-is.
 */
export function resolveAssetUrl(url?: string | null, endpoint?: string): string | undefined {
  if (!url) return undefined
  if (!endpoint) return url

  const cleanEndpoint = endpoint.replace(/\/+$/, '')

  // Handle relative URLs (e.g. /files/..., /api/...)
  if (url.startsWith('/') && !url.startsWith('//')) {
    return `${cleanEndpoint}${url}`
  }

  return url
}

/**
 * Normalizes an endpoint URL by trimming whitespace, stripping trailing slashes,
 * and converting to lower case for reliable comparison.
 */
export function normalizeEndpoint(endpoint?: string | null): string {
  if (!endpoint) return ''
  return endpoint.trim().replace(/\/+$/, '').toLowerCase()
}

/**
 * Checks if two endpoints refer to the same server URL.
 */
export function isSameEndpoint(ep1?: string | null, ep2?: string | null): boolean {
  const n1 = normalizeEndpoint(ep1)
  const n2 = normalizeEndpoint(ep2)
  return Boolean(n1 && n2 && n1 === n2)
}
