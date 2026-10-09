const MAX_MESSAGE_LENGTH = 300

/**
 * The message a failed API response carries, so the user sees why (for example "Too large to
 * upload (limit 20.0 GiB ...)" from a 413) instead of a generic failure. Reads a JSON `error` or
 * `message` field, else a short plain-text body (what Hono's HTTPException sends); HTML or empty
 * bodies fall back to `fallback`.
 */
export async function responseErrorMessage(
  res: { text(): Promise<string> },
  fallback: string,
): Promise<string> {
  let body: string
  try {
    body = (await res.text()).trim()
  } catch {
    return fallback
  }
  if (!body) return fallback
  if (body.startsWith('{')) {
    try {
      const json = JSON.parse(body) as { error?: unknown; message?: unknown }
      const message = [json.error, json.message].find(
        (value): value is string => typeof value === 'string' && value.trim() !== '',
      )
      return message ? message.trim().slice(0, MAX_MESSAGE_LENGTH) : fallback
    } catch {
      return fallback
    }
  }
  if (body.startsWith('<')) return fallback
  return body.slice(0, MAX_MESSAGE_LENGTH)
}
