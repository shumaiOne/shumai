import fs from 'node:fs'
import os from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AssetStatus, AssetType, prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { s3Service } from '@shumai/core/src/s3/s3'
import {
  CATALOG_LOG_PREFIX,
  CATALOG_SNAPSHOT_PREFIX,
  CatalogAssetRecord,
  catalogSnapshotKey,
  decodeCatalogObject,
  readCatalog,
  StorageCatalogService,
} from './catalog'
import { restoreFromCatalog } from './restore'

// In-memory storage so the catalog can be written and read back.
const store = new Map<string, Buffer>()
vi.mock('@shumai/core/src/s3/s3', () => ({
  s3Service: {
    putObject: vi.fn(async (_bucket: string, key: string, body: Buffer) => {
      store.set(key, Buffer.from(body))
    }),
    // Snapshots are streamed to a temp file and uploaded from it.
    uploadFileToKey: vi.fn(async (filePath: string, key: string) => {
      store.set(key, fs.readFileSync(filePath))
    }),
    deleteObject: vi.fn(async (_bucket: string, key: string) => (store.delete(key) ? 1 : 0)),
    getObject: vi.fn(async (_bucket: string, key: string) => {
      const buffer = store.get(key)
      if (!buffer) throw new Error('NoSuchKey')
      return { buffer, contentType: 'application/octet-stream' }
    }),
    headObject: vi.fn(async (_bucket: string, key: string) => {
      if (!store.has(key)) throw new Error('NoSuchKey')
      return { key, size: store.get(key)!.length }
    }),
    listObjects: vi.fn(async (_bucket: string, prefix: string) =>
      [...store.keys()].filter((k) => k.startsWith(prefix)),
    ),
  },
}))

const queued = async () =>
  (await prisma.storageCatalogQueue.findMany({ select: { id: true } })).map((r) => r.id).sort()

const keys = (prefix: string) => [...store.keys()].filter((k) => k.startsWith(prefix)).sort()

/** The library as the catalog in storage describes it, by ref. */
const catalog = async () => new Map((await readCatalog()).records.map((r) => [r.ref, r]))
const assetRecord = async (id: string) =>
  (await catalog()).get(id) as CatalogAssetRecord | undefined

describe('storage catalog', () => {
  setupTestDbHooks()

  let service: StorageCatalogService
  let teamId: string
  let projectId: string
  let rootId: string

  const folder = async (name: string, parentId: string) =>
    (
      await prisma.asset.create({
        data: { name, type: AssetType.folder, status: AssetStatus.uploaded, projectId, parentId },
      })
    ).id

  const file = async (name: string, parentId: string) => {
    const storageKeyId = (
      await prisma.storageKey.create({ data: { key: `files/${name}-key/${name}` } })
    ).id
    return (
      await prisma.asset.create({
        data: {
          name,
          type: AssetType.file,
          status: AssetStatus.processed,
          projectId,
          parentId,
          storageKeyId,
        },
      })
    ).id
  }

  const drain = async () => {
    while ((await service.syncOnce()) > 0) {
      /* keep syncing until the queue is empty */
    }
  }

  beforeEach(async () => {
    vi.stubEnv('STORAGE_CATALOG_ENABLED', 'true')
    store.clear()
    service = new StorageCatalogService({ compactAfterSegments: 1000 })
    teamId = (await prisma.team.create({ data: { name: 'catalog-team' } })).id
    projectId = (await prisma.project.create({ data: { name: 'Trip', teamId } })).id
    rootId = (
      await prisma.asset.create({
        data: { name: 'root', type: AssetType.folder, status: AssetStatus.uploaded, projectId },
      })
    ).id
    await prisma.project.update({ where: { id: projectId }, data: { rootFolderId: rootId } })
    await drain()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  describe('change capture (database triggers)', () => {
    it('queues created, renamed, moved and deleted assets', async () => {
      const a = await folder('A', rootId)
      const b = await folder('B', rootId)
      const f = await file('DSCF0001.JPG', a)
      expect(await queued()).toEqual([a, b, f].sort())

      await drain()
      await prisma.asset.update({ where: { id: f }, data: { name: 'renamed.JPG' } })
      await prisma.asset.update({ where: { id: a }, data: { parentId: b } })
      expect(await queued()).toEqual([a, f].sort())

      await drain()
      await prisma.asset.delete({ where: { id: f } })
      expect(await queued()).toEqual([f])
    })

    it('queues bulk trash and raw SQL changes that bypass the services', async () => {
      const a = await folder('A', rootId)
      const f1 = await file('1.JPG', a)
      const f2 = await file('2.JPG', a)
      await drain()

      await prisma.asset.updateMany({
        where: { parentId: a },
        data: { isDeleted: true, status: AssetStatus.trashed, deletedAt: new Date() },
      })
      expect(await queued()).toEqual([f1, f2].sort())

      await drain()
      await prisma.$executeRaw`UPDATE assets SET status = 'pending_purge' WHERE id = ${a}`
      expect(await queued()).toEqual([a])
    })

    it('ignores updates that do not change what the catalog records', async () => {
      const f = await file('size.JPG', rootId)
      await drain()
      await prisma.asset.update({ where: { id: f }, data: { sizeByte: 12345n, fileCount: 3 } })
      await prisma.asset.update({ where: { id: f }, data: { name: 'size.JPG' } })
      expect(await queued()).toEqual([])
    })

    it('queues metadata value, project and field changes', async () => {
      const f = await file('tagged.JPG', rootId)
      await drain()

      await prisma.assetMetadataValue.create({
        data: { assetId: f, fieldKey: 'camera', stringValue: 'X100VI' },
      })
      await prisma.project.update({ where: { id: projectId }, data: { name: 'Trip 2026' } })
      await prisma.metadataField.create({
        data: {
          key: 'photographer',
          scope: 'PROJECT',
          projectId,
          config: { name: 'Photographer', type: 'text' },
        },
      })
      expect(await queued()).toEqual([f, `project:${projectId}`, 'field:photographer'].sort())
    })
  })

  describe('writer', () => {
    it('starts with a snapshot of the existing library', async () => {
      expect(keys(CATALOG_SNAPSHOT_PREFIX)).toHaveLength(1)
      expect(keys(CATALOG_LOG_PREFIX)).toEqual([])
      const c = await catalog()
      expect(c.get(rootId)).toMatchObject({ kind: 'asset', name: 'root', projectId })
      expect(c.get(`project:${projectId}`)).toMatchObject({ name: 'Trip', rootFolderId: rootId })
    })

    it('writes each batch of changes as one log segment', async () => {
      const a = await folder('Hari', rootId)
      const files: string[] = []
      for (let i = 0; i < 20; i++) files.push(await file(`DSCF${1000 + i}.RAF`, a))
      await prisma.assetMetadataValue.createMany({
        data: files.map((assetId) => ({ assetId, fieldKey: 'camera', stringValue: 'X-S20' })),
      })
      vi.mocked(s3Service.putObject).mockClear()
      await drain()

      expect(s3Service.putObject).toHaveBeenCalledTimes(1)
      const [segment] = keys(CATALOG_LOG_PREFIX)
      expect(decodeCatalogObject(store.get(segment)!)).toHaveLength(21)
      expect(await assetRecord(files[0])).toMatchObject({
        name: 'DSCF1000.RAF',
        parentId: a,
        storageKey: 'files/DSCF1000.RAF-key/DSCF1000.RAF',
        metadata: { camera: { stringValue: 'X-S20' } },
      })
    })

    it('records one object when a folder with files moves', async () => {
      const a = await folder('A', rootId)
      const b = await folder('B', rootId)
      await file('1.JPG', a)
      await file('2.JPG', a)
      await drain()
      const before = keys(CATALOG_LOG_PREFIX)

      await prisma.asset.update({ where: { id: a }, data: { parentId: b } })
      await drain()

      const added = keys(CATALOG_LOG_PREFIX).filter((k) => !before.includes(k))
      expect(added).toHaveLength(1)
      expect(decodeCatalogObject(store.get(added[0])!).map((e) => e.ref)).toEqual([a])
      expect((await assetRecord(a))!.parentId).toBe(b)
    })

    it('records a deletion so the object drops out of the catalog', async () => {
      const f = await file('gone.JPG', rootId)
      await drain()
      expect(await assetRecord(f)).toBeDefined()

      await prisma.asset.delete({ where: { id: f } })
      await drain()
      expect(await assetRecord(f)).toBeUndefined()
    })

    it('records the content hash of a file, and queues the file when it is set', async () => {
      const f = await file('DSCF0002.RAF', rootId)
      await drain()
      expect((await assetRecord(f))?.contentHash).toBeNull()

      const contentHash = 'a'.repeat(64)
      await prisma.asset.update({ where: { id: f }, data: { contentHash } })
      expect(await queued()).toEqual([f])
      await drain()
      expect((await assetRecord(f))?.contentHash).toBe(contentHash)
    })

    it('keeps changes queued when storage fails, and writes them on the next pass', async () => {
      const f = await file('retry.JPG', rootId)
      vi.mocked(s3Service.putObject).mockRejectedValueOnce(new Error('storage down'))
      await expect(service.syncOnce()).rejects.toThrow('storage down')
      expect(await queued()).toEqual([f])

      await drain()
      expect(await assetRecord(f)).toBeDefined()
    })

    // If a transaction were held across the storage write, this update would block on the queue row and hang.
    it('keeps an object that changed again while its segment was being written', async () => {
      const f = await file('busy.JPG', rootId)
      vi.mocked(s3Service.putObject).mockImplementationOnce(async (_bucket, key, body) => {
        store.set(key, Buffer.from(body as Buffer))
        await prisma.asset.update({ where: { id: f }, data: { name: 'busy-renamed.JPG' } })
      })
      await service.syncOnce()
      // the rename happened after the segment was read, so it is still queued
      expect(await queued()).toEqual([f])
      await drain()
      expect((await assetRecord(f))?.name).toBe('busy-renamed.JPG')
    })

    it('writes the snapshot from a temp file and cleans the temp file up', async () => {
      const before = fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith('shumai-catalog-'))
      await service.compact()
      expect(s3Service.uploadFileToKey).toHaveBeenCalled()
      const after = fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith('shumai-catalog-'))
      expect(after).toEqual(before)
    })

    it('compacts the log into a new snapshot and removes what it replaces', async () => {
      service = new StorageCatalogService({ compactAfterSegments: 3 })
      const ids: string[] = []
      for (let i = 0; i < 4; i++) {
        ids.push(await file(`${i}.JPG`, rootId))
        await drain()
      }
      // three segments were written, then the fourth pass compacted first
      expect(keys(CATALOG_SNAPSHOT_PREFIX)).toHaveLength(1)
      expect(keys(CATALOG_SNAPSHOT_PREFIX)[0]).not.toBe(catalogSnapshotKey(1n))
      expect(keys(CATALOG_LOG_PREFIX).length).toBeLessThanOrEqual(1)
      const c = await catalog()
      for (const id of ids) expect(c.get(id)).toBeDefined()
    })

    it('when switched off, empties the queue without writing, and starts over when switched on', async () => {
      const f = await file('offline.JPG', rootId)
      vi.stubEnv('STORAGE_CATALOG_ENABLED', 'false')
      vi.mocked(s3Service.putObject).mockClear()
      await drain()
      expect(s3Service.putObject).not.toHaveBeenCalled()
      expect(await queued()).toEqual([])
      const oldSnapshot = keys(CATALOG_SNAPSHOT_PREFIX)[0]

      vi.stubEnv('STORAGE_CATALOG_ENABLED', 'true')
      await drain()
      expect(keys(CATALOG_SNAPSHOT_PREFIX)).toHaveLength(1)
      expect(keys(CATALOG_SNAPSHOT_PREFIX)[0] > oldSnapshot).toBe(true)
      expect(await assetRecord(f)).toBeDefined()
    })
  })

  describe('restore', () => {
    it('rebuilds folders, files, tags and trash state in an empty library', async () => {
      const hari = await folder('Hari Babaria', rootId)
      const shot = await file('DSCF1153.RAF', hari)
      const trashed = await file('old.JPG', hari)
      await prisma.metadataField.create({
        data: {
          key: 'photographer-field',
          scope: 'PROJECT',
          projectId,
          config: {
            name: 'Photographer',
            type: 'select',
            select: { options: [{ id: 'hari', displayName: 'Hari Babaria', color: 'orange' }] },
          },
        },
      })
      await prisma.assetMetadataValue.create({
        data: { assetId: shot, fieldKey: 'photographer-field', stringValue: 'hari' },
      })
      await prisma.asset.update({
        where: { id: trashed },
        data: { isDeleted: true, status: AssetStatus.trashed, deletedAt: new Date() },
      })
      await drain()

      // Lose the library (the files and the catalog stay in storage).
      await prisma.project.update({ where: { id: projectId }, data: { rootFolderId: null } })
      await prisma.asset.deleteMany({ where: { projectId } })
      await prisma.metadataField.deleteMany({ where: { projectId } })
      await prisma.project.delete({ where: { id: projectId } })
      store.set('files/DSCF1153.RAF-key/DSCF1153.RAF', Buffer.from('raw'))
      store.set('files/old.JPG-key/old.JPG', Buffer.from('jpg'))

      const dry = await restoreFromCatalog({ dryRun: true })
      expect(dry.assets.created).toBe(4)
      expect(await prisma.asset.count({ where: { projectId } })).toBe(0)

      const report = await restoreFromCatalog()
      expect(report.missingFiles).toEqual([])
      expect(report.orphans).toEqual([])

      const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
      expect(project).toMatchObject({ name: 'Trip', teamId, rootFolderId: rootId })
      expect(await prisma.asset.findUniqueOrThrow({ where: { id: shot } })).toMatchObject({
        name: 'DSCF1153.RAF',
        parentId: hari,
        isDeleted: false,
      })
      expect(await prisma.asset.findUniqueOrThrow({ where: { id: trashed } })).toMatchObject({
        isDeleted: true,
        status: AssetStatus.trashed,
      })
      const value = await prisma.assetMetadataValue.findFirstOrThrow({ where: { assetId: shot } })
      expect(value).toMatchObject({ fieldKey: 'photographer-field', stringValue: 'hari' })

      // Running it again changes nothing.
      const again = await restoreFromCatalog()
      expect(again.assets).toEqual({ created: 0, skipped: 4 })
    })

    it('skips uploads that never finished instead of restoring them as uploading', async () => {
      const done = await file('done.JPG', rootId)
      const pending = await file('half.RAF', rootId)
      await prisma.asset.update({ where: { id: pending }, data: { status: AssetStatus.uploading } })
      await drain()

      // Lose the library (the catalog stays in storage).
      await prisma.project.update({ where: { id: projectId }, data: { rootFolderId: null } })
      await prisma.asset.deleteMany({ where: { projectId } })
      await prisma.project.delete({ where: { id: projectId } })
      store.set('files/done.JPG-key/done.JPG', Buffer.from('jpg'))

      const report = await restoreFromCatalog()
      expect(report.unfinishedUploads).toEqual([pending])
      expect(report.assets.created).toBe(2) // root folder and done.JPG
      expect(await prisma.asset.findUnique({ where: { id: pending } })).toBeNull()
      expect(await prisma.asset.findUnique({ where: { id: done } })).not.toBeNull()
      expect(await prisma.asset.count({ where: { status: AssetStatus.uploading } })).toBe(0)
    })

    it('refuses to guess a team that does not exist', async () => {
      await prisma.project.create({ data: { id: 'elsewhere', name: 'X', teamId } })
      await drain()
      // the catalog now refers to a team this database does not have
      await prisma.project.delete({ where: { id: 'elsewhere' } })
      await prisma.project.update({ where: { id: projectId }, data: { rootFolderId: null } })
      await prisma.asset.deleteMany({ where: { projectId } })
      await prisma.project.delete({ where: { id: projectId } })
      await prisma.team.delete({ where: { id: teamId } })
      await expect(restoreFromCatalog({ dryRun: true })).rejects.toThrow(/team/)
    })
  })
})
