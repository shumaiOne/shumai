import { createWriteStream } from 'node:fs'
import { rm } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream as WebReadableStream } from 'node:stream/web'
import { CliError } from '../errors'

/** Streams a download link to `filePath` (large files never sit in memory). */
export async function saveUrlToFile(url: string, filePath: string, label: string): Promise<void> {
  let res: Response
  try {
    res = await fetch(url)
  } catch (err) {
    throw new CliError(
      `Failed to download "${label}": ${err instanceof Error ? err.message : String(err)}`,
    )
  }
  if (!res.ok || !res.body) {
    throw new CliError(`Failed to download "${label}" (status ${res.status}).`)
  }
  try {
    await pipeline(
      Readable.fromWeb(res.body as unknown as WebReadableStream<Uint8Array>),
      createWriteStream(filePath),
    )
  } catch (err) {
    await rm(filePath, { force: true })
    throw new CliError(
      `Failed to save "${label}" to ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}
