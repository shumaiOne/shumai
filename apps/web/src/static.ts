/**
 * Helpers for serving static production assets with caching headers and ETag revalidation.
 */

/**
 * Checks whether an incoming `If-None-Match` header matches the asset's ETag.
 * Supports weak ETags (`W/"..."`), exact matches, and comma-separated lists.
 */
export function isEtagMatching(etag: string | undefined, ifNoneMatch: string | null): boolean {
  if (!etag || !ifNoneMatch) {
    return false
  }

  const cleanTarget = etag.trim().replace(/^W\//, '').replace(/^"|"$/g, '')
  if (!cleanTarget) {
    return false
  }

  const candidates = ifNoneMatch
    .split(',')
    .map((candidate) => candidate.trim().replace(/^W\//, '').replace(/^"|"$/g, ''))

  return candidates.includes(cleanTarget) || candidates.includes('*')
}

/**
 * Normalizes an ETag to ensure it is enclosed in quotes according to RFC 9110.
 * Preserves weak validators (`W/"..."`).
 */
export function normalizeEtag(etag: string | undefined): string | undefined {
  if (!etag) {
    return undefined
  }
  const trimmed = etag.trim()
  if (!trimmed) {
    return undefined
  }
  if (trimmed.startsWith('W/"') && trimmed.endsWith('"')) {
    return trimmed
  }
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed
  }
  return `"${trimmed.replace(/^"|"$/g, '')}"`
}

/**
 * Creates a route handler for a static file on disk.
 * Content-hashed assets (e.g. `chunk-*.js`, `chunk-*.css`) should be marked `isImmutable: true`
 * to be aggressively cached locally by browsers across page reloads.
 */
export function createStaticFileHandler(
  filePath: string,
  baseHeaders: Record<string, string>,
  isImmutable: boolean,
): (req: Request) => Response {
  const bunFile = Bun.file(filePath)
  const rawEtag = baseHeaders.etag || baseHeaders.ETag
  const normalizedEtag = normalizeEtag(rawEtag)
  const headers: Record<string, string> = {
    ...baseHeaders,
    ...(normalizedEtag ? { etag: normalizedEtag } : {}),
    'cache-control': isImmutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  }
  const etag = headers.etag

  return (req: Request): Response => {
    const ifNoneMatch = req.headers.get('if-none-match')
    if (etag && isEtagMatching(etag, ifNoneMatch)) {
      return new Response(null, {
        status: 304,
        headers,
      })
    }
    return new Response(bunFile, { headers })
  }
}

/**
 * Creates a route handler for in-memory transformed HTML entry points.
 * Sets `cache-control: no-cache` with a deterministic ETag, allowing browsers to cache locally
 * while always revalidating to ensure new chunk hashes are picked up immediately after deployment.
 */
export function createHtmlHandler(
  htmlText: string,
  baseHeaders: Record<string, string>,
): (req: Request) => Response {
  const rawEtag = baseHeaders.etag || baseHeaders.ETag
  const etag = normalizeEtag(rawEtag) || `"${Bun.hash(htmlText).toString(16)}"`
  const headers: Record<string, string> = {
    ...baseHeaders,
    etag,
    'cache-control': 'no-cache',
  }

  return (req: Request): Response => {
    const ifNoneMatch = req.headers.get('if-none-match')
    if (isEtagMatching(etag, ifNoneMatch)) {
      return new Response(null, {
        status: 304,
        headers,
      })
    }
    return new Response(htmlText, { headers })
  }
}
