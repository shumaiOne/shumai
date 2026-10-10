import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalStorageService } from '@shumai/core/src/s3/s3'
import type { CatalogAssetRecord } from './catalog'
import { storedFiles, summarizeReport, verifyRecords } from './verify'

const BUCKET = 'shumai'
const sha256 = (content: string) => crypto.createHash('sha256').update(content).digest('hex')

describe('content hashes and verify-catalog (local storage)', () => {
  let dir: string
  let storage: LocalStorageService

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shumai-verify-'))
    storage = new LocalStorageService('http://localhost:3000', dir)
  })

  afterEach(() => {
    // Windows holds file handles briefly after a stream closes, so retry the removal.
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
  })

  const put = (key: string, content: string) =>
    storage.putObject(BUCKET, key, Buffer.from(content), content.length)

  /** A catalog record for an object that was stored with `content`. */
  const record = (
    key: string,
    content: string,
    extra: Partial<CatalogAssetRecord> = {},
  ): CatalogAssetRecord => ({
    v: 1,
    ref: key,
    kind: 'asset',
    id: `id-${key}`,
    type: 'file',
    name: path.posix.basename(key),
    status: 'processed',
    parentId: null,
    projectId: null,
    targetId: null,
    sortIndex: null,
    storageKey: key,
    mediaType: null,
    sizeByte: String(content.length),
    contentHash: sha256(content),
    fileCount: 0,
    hasJpegPreview: false,
    isDeleted: false,
    deletedAt: null,
    creatorId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {},
    ...extra,
  })

  describe('hashObject', () => {
    it('returns the SHA-256 of the stored content, streamed', async () => {
      const content = 'raw bytes '.repeat(100_000) // about 1 MB, several read chunks
      await put('files/a/DSCF0001.RAF', content)
      expect(await storage.hashObject(BUCKET, 'files/a/DSCF0001.RAF')).toBe(sha256(content))
    })

    it('hashes an empty object and rejects a missing one', async () => {
      await put('files/empty', '')
      expect(await storage.hashObject(BUCKET, 'files/empty')).toBe(sha256(''))
      await expect(storage.hashObject(BUCKET, 'files/nope')).rejects.toThrow(/NoSuchKey/)
    })
  })

  describe('verifyRecords', () => {
    it('passes on a clean set, with and without --deep', async () => {
      await put('files/a/one.RAF', 'first original')
      await put('files/b/two.JPG', 'second original')
      const records = [
        record('files/a/one.RAF', 'first original'),
        record('files/b/two.JPG', 'second original'),
      ]

      const shallow = await verifyRecords(records, storage, BUCKET)
      expect(shallow).toMatchObject({ ok: true, deep: false, files: 2, checked: 2, passed: 2 })

      const deep = await verifyRecords(records, storage, BUCKET, { deep: true })
      expect(deep).toMatchObject({ ok: true, deep: true, files: 2, checked: 2, passed: 2 })
      expect(deep.bytesHashed).toBe('first original'.length + 'second original'.length)
      expect(summarizeReport(deep).at(-1)).toBe('OK: storage matches the catalog')
    })

    it('detects an object missing from storage', async () => {
      await put('files/a/one.RAF', 'first original')
      const report = await verifyRecords(
        [record('files/a/one.RAF', 'first original'), record('files/a/gone.RAF', 'lost')],
        storage,
        BUCKET,
      )
      expect(report.ok).toBe(false)
      expect(report.missing.map((p) => p.key)).toEqual(['files/a/gone.RAF'])
      expect(report.passed).toBe(1)
    })

    it('detects a size mismatch without reading the content', async () => {
      await put('files/a/one.RAF', 'truncated')
      const hashObject = vi.spyOn(storage, 'hashObject')
      const report = await verifyRecords(
        [record('files/a/one.RAF', 'the full original')],
        storage,
        BUCKET,
        { deep: true },
      )
      expect(report.ok).toBe(false)
      expect(report.sizeMismatch).toEqual([
        expect.objectContaining({
          key: 'files/a/one.RAF',
          expected: String('the full original'.length),
          actual: String('truncated'.length),
        }),
      ])
      expect(hashObject).not.toHaveBeenCalled()
    })

    it('detects a hash mismatch only with --deep', async () => {
      // Same length, different bytes: silent corruption.
      await put('files/a/one.RAF', 'abcdefgh')
      const records = [record('files/a/one.RAF', 'ABCDEFGH')]

      expect((await verifyRecords(records, storage, BUCKET)).ok).toBe(true)

      const deep = await verifyRecords(records, storage, BUCKET, { deep: true })
      expect(deep.ok).toBe(false)
      expect(deep.hashMismatch).toEqual([
        expect.objectContaining({
          key: 'files/a/one.RAF',
          expected: sha256('ABCDEFGH'),
          actual: sha256('abcdefgh'),
        }),
      ])
    })

    it('treats a file without a recorded hash as unhashed, and records it when asked', async () => {
      await put('files/a/old.RAF', 'uploaded before hashes')
      const records = [record('files/a/old.RAF', 'uploaded before hashes', { contentHash: null })]

      const plain = await verifyRecords(records, storage, BUCKET, { deep: true })
      expect(plain).toMatchObject({ ok: true, unhashed: 1, hashesBackfilled: 0 })

      const saved = new Map<string, string>()
      const backfill = await verifyRecords(records, storage, BUCKET, {
        deep: true,
        saveHash: async (id, hash) => void saved.set(id, hash),
      })
      expect(backfill).toMatchObject({ ok: true, unhashed: 1, hashesBackfilled: 1 })
      expect(saved.get('id-files/a/old.RAF')).toBe(sha256('uploaded before hashes'))
    })

    it('skips folders, symlinks and uploads still in progress, and never changes storage', async () => {
      await put('files/a/one.RAF', 'first original')
      const records = [
        record('files/a/one.RAF', 'first original'),
        record('files/a/folder', '', { type: 'folder', storageKey: null }),
        record('files/a/link', '', { storageKey: null, targetId: 'x' }),
        record('files/a/partial', 'x', { status: 'uploading' }),
      ]
      expect(storedFiles(records)).toHaveLength(1)

      const before = fs.readdirSync(path.join(dir, BUCKET, 'files', 'a'))
      const report = await verifyRecords(records, storage, BUCKET, { deep: true })
      expect(report).toMatchObject({ ok: true, files: 1, checked: 1 })
      expect(fs.readdirSync(path.join(dir, BUCKET, 'files', 'a'))).toEqual(before)
    })

    it('never runs more checks at once than the concurrency limit', async () => {
      const records: CatalogAssetRecord[] = []
      for (let i = 0; i < 12; i++) {
        await put(`files/c/${i}.RAF`, `content ${i}`)
        records.push(record(`files/c/${i}.RAF`, `content ${i}`))
      }
      let active = 0
      let peak = 0
      const slow = {
        headObject: async (bucket: string, key: string) => {
          active++
          peak = Math.max(peak, active)
          await new Promise((r) => setTimeout(r, 5))
          try {
            return await storage.headObject(bucket, key)
          } finally {
            active--
          }
        },
        hashObject: storage.hashObject.bind(storage),
      }
      const report = await verifyRecords(records, slow, BUCKET, { concurrency: 3 })
      expect(report.ok).toBe(true)
      expect(peak).toBeLessThanOrEqual(3)
      expect(peak).toBeGreaterThan(1)
    })

    it('reports unexpected storage errors instead of calling the file missing', async () => {
      const broken = {
        headObject: async () => {
          throw new Error('connection reset')
        },
        hashObject: storage.hashObject.bind(storage),
      }
      const report = await verifyRecords([record('files/a/one.RAF', 'x')], broken, BUCKET)
      expect(report.ok).toBe(false)
      expect(report.missing).toEqual([])
      expect(report.errors[0]).toMatchObject({ error: 'connection reset' })
    })

    it('classifies only 404-style errors as missing, everything else as an error', async () => {
      const failing = (make: () => unknown) => ({
        headObject: async () => {
          throw make()
        },
        hashObject: storage.hashObject.bind(storage),
      })
      const withStatus = (name: string, status: number) =>
        Object.assign(new Error(name), { name, $metadata: { httpStatusCode: status } })
      const records = [record('files/a/one.RAF', 'x')]

      for (const make of [
        () => withStatus('NoSuchKey', 404),
        () => withStatus('NotFound', 404),
        () => Object.assign(new Error('odd'), { $metadata: { httpStatusCode: 404 } }),
      ]) {
        const report = await verifyRecords(records, failing(make), BUCKET)
        expect(report.missing).toHaveLength(1)
        expect(report.errors).toEqual([])
      }

      for (const make of [
        () => withStatus('AccessDenied', 403),
        () => withStatus('InternalError', 500),
        () => withStatus('SlowDown', 503),
        () => Object.assign(new Error('timed out'), { name: 'TimeoutError' }),
        // A message that merely mentions NoSuchKey is not a 404.
        () => new Error('NoSuchKey appears in this unrelated failure'),
      ]) {
        const report = await verifyRecords(records, failing(make), BUCKET)
        expect(report.missing).toEqual([])
        expect(report.errors).toHaveLength(1)
        expect(report.ok).toBe(false)
      }
    })
  })

  describe('LocalStorageService errors', () => {
    it('reports a missing object as NoSuchKey so verify classifies it as missing', async () => {
      const err = await storage.headObject(BUCKET, 'files/nope').catch((e: unknown) => e)
      expect(err).toMatchObject({ name: 'NoSuchKey' })
    })
  })
})
