import { isNotFoundError, type S3Service } from '@shumai/core/src/s3/s3'
import type { CatalogAssetRecord, CatalogRecord } from './catalog'

/**
 * `shumai verify-catalog`: checks the library the storage catalog describes against the files in storage.
 *
 * For every stored original in the catalog (latest snapshot + log) it checks that the object exists and has the
 * recorded size; with `deep` it also reads the object and compares its SHA-256 with the recorded one. It only
 * reads: nothing in storage is deleted or repaired, and the database is touched only when `saveHash` is given
 * (`--backfill-hashes`) to record the hash of files that never had one.
 */

export interface VerifyOptions {
  /** Read every object and compare its SHA-256 with the catalog. */
  deep?: boolean
  /** Objects checked at the same time. Low by default so a verify does not saturate the server. */
  concurrency?: number
  /** With `deep`: called with the computed hash of files whose catalog record has none. */
  saveHash?: (assetId: string, hash: string) => Promise<void>
  log?: (line: string) => void
}

export interface VerifyProblem {
  id: string
  name: string
  key: string
  expected?: string
  actual?: string
  error?: string
}

export interface VerifyReport {
  ok: boolean
  deep: boolean
  snapshotSeq: string | null
  logSegments: number
  /** Catalog objects that could not be read; the catalog may be incomplete. */
  unreadable: string[]
  /** Stored originals listed by the catalog. */
  files: number
  /** Files whose object, size (and with deep, hash) were checked. */
  checked: number
  /** Files that passed every check that was run. */
  passed: number
  missing: VerifyProblem[]
  sizeMismatch: VerifyProblem[]
  hashMismatch: VerifyProblem[]
  /** Objects that could not be checked because storage returned an unexpected error. */
  errors: VerifyProblem[]
  /** Deep only: files the catalog has no hash for (not a problem; see `hashesBackfilled`). */
  unhashed: number
  hashesBackfilled: number
  bytesHashed: number
}

export const DEFAULT_VERIFY_CONCURRENCY = 2

async function runLimited<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
      while (next < items.length) await fn(items[next++])
    }),
  )
}

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err))
/**
 * An object is "missing" only when storage says it is not there (NoSuchKey, NotFound or HTTP 404). Anything
 * else (AccessDenied, throttling, 5xx, timeouts) is an error, not a missing file, so a storage outage or a
 * bad credential never reads as "your files are gone".
 */
export const isMissing = isNotFoundError

/** Stored originals: files with a storage key whose upload finished. */
export function storedFiles(records: CatalogRecord[]): CatalogAssetRecord[] {
  return records.filter(
    (r): r is CatalogAssetRecord =>
      r.kind === 'asset' && r.type === 'file' && !!r.storageKey && r.status !== 'uploading',
  )
}

/** Checks the given catalog records against storage. */
export async function verifyRecords(
  records: CatalogRecord[],
  storage: Pick<S3Service, 'headObject' | 'hashObject'>,
  bucket: string,
  options: VerifyOptions = {},
): Promise<VerifyReport> {
  const files = storedFiles(records)
  const deep = options.deep === true
  const report: VerifyReport = {
    ok: true,
    deep,
    snapshotSeq: null,
    logSegments: 0,
    unreadable: [],
    files: files.length,
    checked: 0,
    passed: 0,
    missing: [],
    sizeMismatch: [],
    hashMismatch: [],
    errors: [],
    unhashed: 0,
    hashesBackfilled: 0,
    bytesHashed: 0,
  }

  let done = 0
  await runLimited(files, options.concurrency ?? DEFAULT_VERIFY_CONCURRENCY, async (file) => {
    const key = file.storageKey!
    const base = { id: file.id, name: file.name, key }
    let clean = true
    try {
      const info = await storage.headObject(bucket, key)
      if (BigInt(info.size) !== BigInt(file.sizeByte)) {
        clean = false
        report.sizeMismatch.push({ ...base, expected: file.sizeByte, actual: String(info.size) })
      } else if (deep) {
        const hash = await storage.hashObject(bucket, key)
        report.bytesHashed += info.size
        if (file.contentHash) {
          if (hash !== file.contentHash) {
            clean = false
            report.hashMismatch.push({ ...base, expected: file.contentHash, actual: hash })
          }
        } else {
          report.unhashed++
          if (options.saveHash) {
            await options.saveHash(file.id, hash)
            report.hashesBackfilled++
          }
        }
      }
      report.checked++
    } catch (err) {
      clean = false
      if (isMissing(err)) {
        report.checked++
        report.missing.push(base)
      } else {
        report.errors.push({ ...base, error: errorMessage(err) })
      }
    }
    if (clean) report.passed++
    done++
    if (done % 500 === 0) options.log?.(`Checked ${done} of ${files.length} files`)
  })

  report.ok = isClean(report)
  return report
}

export const isClean = (r: VerifyReport) =>
  r.unreadable.length === 0 &&
  r.missing.length === 0 &&
  r.sizeMismatch.length === 0 &&
  r.hashMismatch.length === 0 &&
  r.errors.length === 0

/**
 * Reads the catalog from storage and verifies it. Needs only storage, so it works with the database gone;
 * `backfillHashes` is the one option that writes to the database.
 */
export async function verifyCatalog(
  options: VerifyOptions & { backfillHashes?: boolean } = {},
): Promise<VerifyReport> {
  const { catalogBucket, readCatalog } = await import('./catalog')
  const { s3Service } = await import('@shumai/core/src/s3/s3')
  const log = options.log ?? (() => {})

  const catalog = await readCatalog()
  log(
    `Read ${catalog.records.length} catalog records from snapshot ${catalog.snapshotSeq ?? 'none'} and ` +
      `${catalog.logSegments} log segments (${catalog.unreadable.length} unreadable)`,
  )

  let saveHash = options.saveHash
  if (options.backfillHashes && options.deep && !saveHash) {
    const { prisma } = await import('@shumai/db')
    saveHash = async (assetId, contentHash) => {
      await prisma.asset.updateMany({
        where: { id: assetId, contentHash: null },
        data: { contentHash },
      })
    }
  }

  const report = await verifyRecords(catalog.records, s3Service, catalogBucket(), {
    ...options,
    saveHash,
  })
  report.snapshotSeq = catalog.snapshotSeq === null ? null : catalog.snapshotSeq.toString()
  report.logSegments = catalog.logSegments
  report.unreadable = catalog.unreadable
  // No snapshot at all means there is no catalog to trust, which is a problem in itself.
  report.ok = isClean(report) && catalog.snapshotSeq !== null
  return report
}

/** Human-readable summary lines (the JSON report carries the full lists). */
export function summarizeReport(r: VerifyReport, listLimit = 20): string[] {
  const lines = [
    `Catalog: snapshot ${r.snapshotSeq ?? 'none'} + ${r.logSegments} log segments, ${r.files} stored files`,
    `Checked ${r.checked} (${r.deep ? 'size and hash' : 'existence and size'}), ${r.passed} passed`,
  ]
  if (r.deep) {
    lines.push(`Read ${r.bytesHashed} bytes; ${r.unhashed} files had no recorded hash`)
    if (r.hashesBackfilled > 0) lines.push(`Recorded ${r.hashesBackfilled} missing hashes`)
  }
  const section = (title: string, list: VerifyProblem[], detail: (p: VerifyProblem) => string) => {
    if (list.length === 0) return
    lines.push(`${title}: ${list.length}`)
    for (const p of list.slice(0, listLimit))
      lines.push(`  ${p.key} (${p.name}) ${detail(p)}`.trimEnd())
    if (list.length > listLimit)
      lines.push(`  ... and ${list.length - listLimit} more (see --json)`)
  }
  section('Missing from storage', r.missing, () => '')
  section('Size differs', r.sizeMismatch, (p) => `expected ${p.expected}, found ${p.actual}`)
  section('Hash differs', r.hashMismatch, (p) => `expected ${p.expected}, found ${p.actual}`)
  section('Could not check', r.errors, (p) => p.error ?? '')
  if (r.unreadable.length > 0) lines.push(`Unreadable catalog objects: ${r.unreadable.join(', ')}`)
  if (r.snapshotSeq === null) lines.push('No catalog snapshot found in storage')
  lines.push(r.ok ? 'OK: storage matches the catalog' : 'PROBLEMS FOUND')
  return lines
}
