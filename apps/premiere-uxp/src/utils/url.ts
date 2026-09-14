/**
 * Utility functions for URL manipulation and resolution in UXP plugins.
 */

/**
 * Resolves an asset URL (such as a thumbnail or file download) against
 * the user-configured Shumai endpoint.
 *
 * Handles:
 * 1. Relative paths (/files/..., /api/...)
 * 2. Host/Port mismatch when the backend defaulted S3 URL to localhost:3000
 *    while the client connected via 127.0.0.1 or a remote IP/domain.
 */
export function resolveAssetUrl(url?: string | null, endpoint?: string): string | undefined {
  if (!url) return undefined
  if (!endpoint) return url

  const cleanEndpoint = endpoint.replace(/\/+$/, '')

  let resolved = url

  // Handle relative URLs
  if (url.startsWith('/')) {
    resolved = `${cleanEndpoint}${url}`
  } else {
    // Handle absolute URLs with host mismatch
    try {
      const parsedUrl = new URL(url)
      const parsedEndpoint = new URL(cleanEndpoint)

      // If host differs (e.g. localhost vs 127.0.0.1 or remote server address)
      if (parsedUrl.host !== parsedEndpoint.host) {
        parsedUrl.protocol = parsedEndpoint.protocol
        parsedUrl.hostname = parsedEndpoint.hostname
        parsedUrl.port = parsedEndpoint.port
        resolved = parsedUrl.toString()
      }
    } catch {
      // If URL parsing fails, fallback to raw url
    }
  }

  return resolved
}
