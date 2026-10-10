import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'

/**
 * Computes the SHA-256 of a byte stream (lowercase hex). The stream is consumed once and never
 * buffered whole, so memory use stays flat regardless of file size.
 */
export async function sha256OfStream(stream: AsyncIterable<string | Uint8Array>): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of stream) {
    hash.update(chunk)
  }
  return hash.digest('hex')
}

/** Computes the SHA-256 (lowercase hex) of a local file by streaming it once. */
export function sha256OfFile(filePath: string): Promise<string> {
  return sha256OfStream(createReadStream(filePath))
}
