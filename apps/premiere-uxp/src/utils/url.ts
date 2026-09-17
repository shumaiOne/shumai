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
