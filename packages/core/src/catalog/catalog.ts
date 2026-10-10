import { createWriteStream } from 'node:fs'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createGzip, gunzipSync, gzipSync } from 'node:zlib'
import { prisma, Prisma } from '@shumai/db'
import { logger } from '@shumai/core/src/logger'
import { s3Service } from '@shumai/core/src/s3/s3'

/**
 * Storage catalog: a self-describing copy of the library kept in storage next to the files.
 *
 * Database triggers (migration add_storage_catalog) put the id of every changed asset, project and metadata
 * field into storage_catalog_queue. Every few seconds this service takes everything queued and appends it
 * to the catalog as ONE gzipped JSON-lines log segment (catalog/log/<seq>.jsonl.gz), holding the current
 * state of each changed object or a tombstone for one that is gone. When the log grows, it writes a
 * snapshot of the whole library (catalog/snapshot/<seq>.jsonl.gz) and removes the log segments the snapshot
 * replaces. Reading the catalog = latest snapshot + the log segments after it, applied in order.
 *
 * Records point at their parent by id rather than holding a path, so moving a folder records one object.
 * If the database is ever lost, `shumai restore-catalog` rebuilds the library from the catalog and the
 * files already in storage.
 */

export const CATALOG_PREFIX = 'catalog/'
export const CATALOG_LOG_PREFIX = `${CATALOG_PREFIX}log/`
export const CATALOG_SNAPSHOT_PREFIX = `${CATALOG_PREFIX}snapshot/`
export const CATALOG_RECORD_VERSION = 1

const SYNC_INTERVAL_MS = 5000
const DEFAULT_BATCH_SIZE = 5000
/** Compact once the log has this many segments, or holds more bytes than the snapshot. */
const DEFAULT_COMPACT_AFTER_SEGMENTS = 500
const MIN_COMPACT_LOG_BYTES = 1024 * 1024
const SNAPSHOT_PAGE_SIZE = 2000
const DELETE_CONCURRENCY = 16
/** Advisory lock that serialises log appends and snapshots across server instances. */
const CATALOG_LOCK_KEY = 7310342512001n

const PROJECT_PREFIX = 'project:'
const FIELD_PREFIX = 'field:'

export function storageCatalogEnabled(): boolean {
  return process.env.STORAGE_CATALOG_ENABLED === 'true'
}

export function catalogBucket(): string {
  return process.env.S3_BUCKET || 'shumai'
}

const seqName = (seq: bigint) => `${seq.toString().padStart(12, '0')}.jsonl.gz`
export const catalogLogKey = (seq: bigint) => CATALOG_LOG_PREFIX + seqName(seq)
export const catalogSnapshotKey = (seq: bigint) => CATALOG_SNAPSHOT_PREFIX + seqName(seq)

/** Sequence number of a catalog object key, or null for anything else under catalog/. */
export function catalogKeySeq(key: string): bigint | null {
  const match = /^catalog\/(?:log|snapshot)\/(\d+)\.jsonl\.gz$/.exec(key)
  return match ? BigInt(match[1]) : null
}

export interface CatalogMetadataValue {
  stringValue?: string
  numberValue?: number
  booleanValue?: boolean
  jsonValue?: unknown
  dateValue?: string
}

interface CatalogEntryBase {
  v: number
  /** Queue id of the object: an asset id, 'project:<id>' or 'field:<key>'. */
  ref: string
}

export interface CatalogAssetRecord extends CatalogEntryBase {
  kind: 'asset'
  id: string
  type: string
  name: string
  status: string
  parentId: string | null
  projectId: string | null
  targetId: string | null
  sortIndex: string | null
  storageKey: string | null
  mediaType: string | null
  sizeByte: string
  /** SHA-256 (hex) of the stored original; null or absent when it was never recorded. */
  contentHash?: string | null
  fileCount: number
  hasJpegPreview: boolean
  isDeleted: boolean
  deletedAt: string | null
  creatorId: string | null
  createdAt: string
  updatedAt: string
  metadata: Record<string, CatalogMetadataValue>
}

export interface CatalogProjectRecord extends CatalogEntryBase {
  kind: 'project'
  id: string
  name: string
  teamId: string
  rootFolderId: string | null
  shareRootId: string | null
  metadataOverrides: unknown
  createdAt: string
}

export interface CatalogFieldRecord extends CatalogEntryBase {
  kind: 'metadataField'
  id: string
  key: string
  scope: string | null
  config: unknown
  readOnly: boolean
  description: string
  teamId: string | null
  projectId: string | null
}

export interface CatalogTombstone extends CatalogEntryBase {
  deleted: true
}

export type CatalogRecord = CatalogAssetRecord | CatalogProjectRecord | CatalogFieldRecord
export type CatalogEntry = CatalogRecord | CatalogTombstone

export const isTombstone = (e: CatalogEntry): e is CatalogTombstone => 'deleted' in e && e.deleted

export interface StorageCatalogOptions {
  batchSize?: number
  compactAfterSegments?: number
}

const encode = (entries: CatalogEntry[]) =>
  gzipSync(entries.map((e) => JSON.stringify(e)).join('\n') + (entries.length ? '\n' : ''))

export function decodeCatalogObject(buffer: Buffer): CatalogEntry[] {
  return gunzipSync(buffer)
    .toString('utf8')
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as CatalogEntry)
}

async function runLimited<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await fn(items[next++])
    }),
  )
}

type Tx = Prisma.TransactionClient

export class StorageCatalogService {
  private syncTimer: ReturnType<typeof setTimeout> | null = null
  private syncRunning = false
  private disabledStateCleared = false
  private readonly batchSize: number
  private readonly compactAfterSegments: number

  constructor(options: StorageCatalogOptions = {}) {
    this.batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE
    this.compactAfterSegments = options.compactAfterSegments ?? DEFAULT_COMPACT_AFTER_SEGMENTS
  }

  startCatalogSync(intervalMs = SYNC_INTERVAL_MS) {
    if (this.syncRunning) return
    this.syncRunning = true
    const run = async () => {
      if (!this.syncRunning) return
      try {
        while ((await this.syncOnce()) === this.batchSize && this.syncRunning) {
          // a full batch means more is waiting: keep going
        }
      } catch (err) {
        logger.error({ err }, 'Storage catalog sync failed, will retry')
      }
      if (this.syncRunning) this.syncTimer = setTimeout(run, intervalMs)
    }
    this.syncTimer = setTimeout(run, 0)
  }

  stopCatalogSync() {
    this.syncRunning = false
    if (this.syncTimer) clearTimeout(this.syncTimer)
    this.syncTimer = null
  }

  /**
   * One pass. With the catalog on: write a snapshot first if there is none yet or the log has grown, then
   * append everything queued as one log segment. With it off: discard the queue (so it never grows) and
   * forget the catalog state, so switching it on again starts from a fresh snapshot.
   * Returns the number of queued changes handled.
   */
  async syncOnce(): Promise<number> {
    if (!storageCatalogEnabled()) {
      if (!this.disabledStateCleared) {
        await prisma.storageCatalogState.deleteMany({})
        this.disabledStateCleared = true
      }
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        DELETE FROM storage_catalog_queue
        WHERE id IN (SELECT id FROM storage_catalog_queue LIMIT ${this.batchSize} FOR UPDATE SKIP LOCKED)
        RETURNING id`
      return rows.length
    }
    this.disabledStateCleared = false

    const state = await prisma.storageCatalogState.findUnique({ where: { id: 1 } })
    if (!state || this.shouldCompact(state)) await this.compact()
    return this.appendLogSegment()
  }

  private shouldCompact(state: { logSegments: number; logBytes: bigint; snapshotBytes: bigint }) {
    if (state.logSegments >= this.compactAfterSegments) return true
    const floor =
      state.snapshotBytes > BigInt(MIN_COMPACT_LOG_BYTES)
        ? state.snapshotBytes
        : BigInt(MIN_COMPACT_LOG_BYTES)
    return state.logBytes > floor
  }

  private async lock(tx: Tx): Promise<boolean> {
    const [row] = await tx.$queryRaw<{ ok: boolean }[]>`
      SELECT pg_try_advisory_xact_lock(${CATALOG_LOCK_KEY}::bigint) AS ok`
    return row?.ok === true
  }

  /**
   * Writes one batch of queued changes as one log segment, without holding a transaction open across storage:
   *  1. a short transaction (under the advisory lock) reads the batch, builds the segment and reserves its
   *     sequence number, so segments are numbered in the order their contents were read;
   *  2. the segment is written to storage, outside any transaction;
   *  3. a second short transaction removes the queue rows that were written.
   * Step 3 only removes a row that is unchanged since step 1 (same queued_at; the triggers refresh queued_at
   * when an already-queued object changes again), so a change made while the segment was uploading stays
   * queued for the next pass. A failure or crash before step 3 leaves the rows queued and the retry writes
   * the same current state under a new sequence number: appending is idempotent, a sequence number may be
   * skipped.
   */
  async appendLogSegment(): Promise<number> {
    const batch = await prisma.$transaction(
      async (tx) => {
        if (!(await this.lock(tx))) return null
        const rows = await tx.$queryRaw<{ id: string; stamp: string }[]>`
          SELECT id, queued_at::text AS stamp FROM storage_catalog_queue
          ORDER BY queued_at, id LIMIT ${this.batchSize}`
        if (rows.length === 0) return null

        const entries = await loadEntries(
          tx,
          rows.map((r) => r.id),
        )
        const body = encode(entries)
        const [next] = await tx.$queryRaw<{ seq: bigint }[]>`
          UPDATE storage_catalog_state
          SET last_seq = last_seq + 1, log_segments = log_segments + 1,
              log_bytes = log_bytes + ${body.length}, updated_at = now()
          WHERE id = 1
          RETURNING last_seq AS seq`
        if (!next) throw new Error('Storage catalog has no snapshot yet')
        return { rows, body, seq: next.seq }
      },
      { timeout: 120_000 },
    )
    if (!batch) return 0

    await s3Service.putObject(
      catalogBucket(),
      catalogLogKey(batch.seq),
      batch.body,
      batch.body.length,
      'application/gzip',
    )

    const ids = batch.rows.map((r) => r.id)
    const stamps = batch.rows.map((r) => r.stamp)
    await prisma.$executeRaw`
      DELETE FROM storage_catalog_queue q
      USING unnest(${ids}::text[], ${stamps}::text[]) AS written(id, stamp)
      WHERE q.id = written.id AND q.queued_at::text = written.stamp`
    return batch.rows.length
  }

  /**
   * Writes a snapshot of the whole library and drops the log segments it replaces. Runs in a repeatable-read
   * transaction: the snapshot and the queue rows it clears are read at the same moment, so a change that
   * commits while the snapshot is being written stays queued and lands in the next log segment.
   */
  async compact(): Promise<void> {
    const replaced = await prisma.$transaction(
      async (tx) => {
        if (!(await this.lock(tx))) return null
        const prev = await tx.storageCatalogState.findUnique({ where: { id: 1 } })
        await tx.$executeRaw`DELETE FROM storage_catalog_queue`

        // The snapshot is streamed through gzip into a temp file and uploaded from there, so memory stays flat
        // however big the library is (one page of assets at a time, never the whole library).
        const dir = await mkdtemp(path.join(os.tmpdir(), 'shumai-catalog-'))
        const snapshotFile = path.join(dir, 'snapshot.jsonl.gz')
        try {
          await pipeline(
            Readable.from(snapshotLines(tx)),
            createGzip(),
            createWriteStream(snapshotFile),
          )
          const snapshotBytes = BigInt((await stat(snapshotFile)).size)
          // Never reuse a sequence number: after the catalog was switched off the state is gone, so continue
          // after whatever is already in storage and clear it out once the new snapshot is written.
          let old: string[]
          let seq: bigint
          if (prev) {
            seq = prev.lastSeq + 1n
            old = [catalogSnapshotKey(prev.snapshotSeq)]
            for (let s = prev.snapshotSeq + 1n; s < seq; s++) old.push(catalogLogKey(s))
          } else {
            old = (await s3Service.listObjects(catalogBucket(), CATALOG_PREFIX)).filter(
              (k) => catalogKeySeq(k) !== null,
            )
            seq =
              old.reduce((max, k) => (catalogKeySeq(k)! > max ? catalogKeySeq(k)! : max), 0n) + 1n
          }

          const state = {
            lastSeq: seq,
            snapshotSeq: seq,
            snapshotBytes,
            logSegments: 0,
            logBytes: 0n,
            updatedAt: new Date(),
          }
          await tx.storageCatalogState.upsert({
            where: { id: 1 },
            create: { id: 1, ...state },
            update: state,
          })
          await s3Service.uploadFileToKey(snapshotFile, catalogSnapshotKey(seq), 'application/gzip')
          logger.info(
            { seq, bytes: Number(snapshotBytes), replaced: old.length },
            'Storage catalog: wrote a snapshot',
          )
          return old
        } finally {
          await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 600_000 },
    )

    // Readers ignore anything older than the newest snapshot, so leftovers here are harmless.
    if (replaced) {
      await runLimited(replaced, DELETE_CONCURRENCY, async (key) => {
        await s3Service.deleteObject(catalogBucket(), key).catch((err: unknown) => {
          logger.warn({ err, key }, 'Could not remove a replaced storage catalog object')
        })
      })
    }
  }
}

const assetInclude = { storageKey: { select: { key: true } }, metadataValues: true } as const
type AssetWithCatalogData = Prisma.AssetGetPayload<{ include: typeof assetInclude }>

/** Current state of each queued object, or a tombstone for one that no longer exists. */
async function loadEntries(tx: Tx, ids: string[]): Promise<CatalogEntry[]> {
  const assetIds: string[] = []
  const projectIds: string[] = []
  const fieldKeys: string[] = []
  for (const id of ids) {
    if (id.startsWith(PROJECT_PREFIX)) projectIds.push(id.slice(PROJECT_PREFIX.length))
    else if (id.startsWith(FIELD_PREFIX)) fieldKeys.push(id.slice(FIELD_PREFIX.length))
    else assetIds.push(id)
  }
  const [assets, projects, fields] = await Promise.all([
    assetIds.length
      ? tx.asset.findMany({ where: { id: { in: assetIds } }, include: assetInclude })
      : [],
    projectIds.length ? tx.project.findMany({ where: { id: { in: projectIds } } }) : [],
    fieldKeys.length ? tx.metadataField.findMany({ where: { key: { in: fieldKeys } } }) : [],
  ])
  const found = new Map<string, CatalogEntry>()
  for (const a of assets) found.set(a.id, toAssetRecord(a))
  for (const p of projects) found.set(PROJECT_PREFIX + p.id, toProjectRecord(p))
  for (const f of fields) found.set(FIELD_PREFIX + f.key, toFieldRecord(f))
  return ids.map((ref) => found.get(ref) ?? { v: CATALOG_RECORD_VERSION, ref, deleted: true })
}

/** The whole library as JSON lines (metadata fields, projects, then assets a page at a time). */
async function* snapshotLines(tx: Tx): AsyncGenerator<string> {
  const line = (e: CatalogEntry) => JSON.stringify(e) + '\n'
  for (const f of await tx.metadataField.findMany({ orderBy: { key: 'asc' } }))
    yield line(toFieldRecord(f))
  for (const p of await tx.project.findMany({ orderBy: { id: 'asc' } }))
    yield line(toProjectRecord(p))
  let cursor: string | undefined
  for (;;) {
    const page: AssetWithCatalogData[] = await tx.asset.findMany({
      include: assetInclude,
      orderBy: { id: 'asc' },
      take: SNAPSHOT_PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    })
    for (const a of page) yield line(toAssetRecord(a))
    if (page.length < SNAPSHOT_PAGE_SIZE) break
    cursor = page[page.length - 1].id
  }
}

export function toAssetRecord(a: AssetWithCatalogData): CatalogAssetRecord {
  const metadata: Record<string, CatalogMetadataValue> = {}
  for (const m of a.metadataValues) {
    const value: CatalogMetadataValue = {}
    if (m.stringValue !== null) value.stringValue = m.stringValue
    if (m.numberValue !== null) value.numberValue = m.numberValue
    if (m.booleanValue !== null) value.booleanValue = m.booleanValue
    if (m.jsonValue !== null) value.jsonValue = m.jsonValue
    if (m.dateValue !== null) value.dateValue = m.dateValue.toISOString()
    metadata[m.fieldKey] = value
  }
  return {
    v: CATALOG_RECORD_VERSION,
    ref: a.id,
    kind: 'asset',
    id: a.id,
    type: a.type,
    name: a.name,
    status: a.status,
    parentId: a.parentId,
    projectId: a.projectId,
    targetId: a.targetId,
    sortIndex: a.sortIndex,
    storageKey: a.storageKey?.key ?? null,
    mediaType: a.mediaType,
    sizeByte: a.sizeByte.toString(),
    contentHash: a.contentHash,
    fileCount: a.fileCount,
    hasJpegPreview: a.hasJpegPreview,
    isDeleted: a.isDeleted,
    deletedAt: a.deletedAt?.toISOString() ?? null,
    creatorId: a.creatorId,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    metadata,
  }
}

export function toProjectRecord(p: Prisma.ProjectGetPayload<object>): CatalogProjectRecord {
  return {
    v: CATALOG_RECORD_VERSION,
    ref: PROJECT_PREFIX + p.id,
    kind: 'project',
    id: p.id,
    name: p.name,
    teamId: p.teamId,
    rootFolderId: p.rootFolderId,
    shareRootId: p.shareRootId,
    metadataOverrides: p.metadataOverrides,
    createdAt: p.createdAt.toISOString(),
  }
}

export function toFieldRecord(f: Prisma.MetadataFieldGetPayload<object>): CatalogFieldRecord {
  return {
    v: CATALOG_RECORD_VERSION,
    ref: FIELD_PREFIX + f.key,
    kind: 'metadataField',
    id: f.id,
    key: f.key,
    scope: f.scope,
    config: f.config,
    readOnly: f.readOnly,
    description: f.description,
    teamId: f.teamId,
    projectId: f.projectId,
  }
}

export interface CatalogContents {
  records: CatalogRecord[]
  snapshotSeq: bigint | null
  logSegments: number
  unreadable: string[]
}

/** Reads the catalog from storage: the newest snapshot plus the log segments after it, applied in order. */
export async function readCatalog(): Promise<CatalogContents> {
  const keys = (await s3Service.listObjects(catalogBucket(), CATALOG_PREFIX)).filter(
    (k) => catalogKeySeq(k) !== null,
  )
  const snapshots = keys.filter((k) => k.startsWith(CATALOG_SNAPSHOT_PREFIX))
  const bySeq = (x: string, y: string) => (catalogKeySeq(x)! < catalogKeySeq(y)! ? -1 : 1)
  snapshots.sort(bySeq)
  const unreadable: string[] = []
  const state = new Map<string, CatalogRecord>()

  // Newest snapshot that can actually be read; an unreadable one falls back to the one before it.
  let snapshotSeq: bigint | null = null
  for (let i = snapshots.length - 1; i >= 0 && snapshotSeq === null; i--) {
    try {
      const { buffer } = await s3Service.getObject(catalogBucket(), snapshots[i])
      for (const e of decodeCatalogObject(buffer)) if (!isTombstone(e)) state.set(e.ref, e)
      snapshotSeq = catalogKeySeq(snapshots[i])
    } catch {
      unreadable.push(snapshots[i])
    }
  }

  const logs = keys
    .filter(
      (k) =>
        k.startsWith(CATALOG_LOG_PREFIX) &&
        (snapshotSeq === null || catalogKeySeq(k)! > snapshotSeq),
    )
    .sort(bySeq)
  for (const key of logs) {
    try {
      const { buffer } = await s3Service.getObject(catalogBucket(), key)
      for (const e of decodeCatalogObject(buffer)) {
        if (isTombstone(e)) state.delete(e.ref)
        else state.set(e.ref, e)
      }
    } catch {
      unreadable.push(key)
    }
  }
  return { records: [...state.values()], snapshotSeq, logSegments: logs.length, unreadable }
}

export const storageCatalogService = new StorageCatalogService()
