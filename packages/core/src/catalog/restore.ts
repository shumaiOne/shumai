import path from 'node:path'
import { AssetStatus, AssetType, MetadataFieldScope, prisma, Prisma } from '@shumai/db'
import { s3Service } from '@shumai/core/src/s3/s3'
import {
  catalogBucket,
  CatalogAssetRecord,
  CatalogFieldRecord,
  CatalogProjectRecord,
  readCatalog,
} from './catalog'

export interface RestoreOptions {
  /** Team that receives projects whose original team does not exist in this database. */
  teamId?: string
  /** User recorded as creator when the original creator does not exist in this database. */
  creatorId?: string
  /** Only report what would be restored. */
  dryRun?: boolean
  log?: (line: string) => void
}

export interface RestoreReport {
  records: number
  unreadable: string[]
  fields: { created: number; skipped: number }
  projects: { created: number; skipped: number }
  assets: { created: number; skipped: number }
  metadataValues: number
  /** Files whose original is not in storage (restored anyway, so the gap is visible in the app). */
  missingFiles: string[]
  /**
   * Files whose upload had not finished when the catalog last saw them. They have no complete original to
   * restore, so they are skipped (restoring them as `uploading` would leave rows that never finish).
   */
  unfinishedUploads: string[]
  /** Assets whose parent is in neither the catalog nor the database; restored without a parent. */
  orphans: string[]
}

const READ_CONCURRENCY = 16

const bucket = catalogBucket

async function runLimited<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await fn(items[next++])
    }),
  )
}

/**
 * Rebuilds projects, metadata fields, folders, files, tags and trash state in this database from the
 * storage catalog (snapshot + log written by StorageCatalogService). Objects that already exist are left
 * alone, so the restore can be run again after fixing a problem.
 */
export async function restoreFromCatalog(options: RestoreOptions = {}): Promise<RestoreReport> {
  const log = options.log ?? (() => {})
  const report: RestoreReport = {
    records: 0,
    unreadable: [],
    fields: { created: 0, skipped: 0 },
    projects: { created: 0, skipped: 0 },
    assets: { created: 0, skipped: 0 },
    metadataValues: 0,
    missingFiles: [],
    unfinishedUploads: [],
    orphans: [],
  }

  const catalog = await readCatalog()
  const records = catalog.records
  report.records = records.length
  report.unreadable = catalog.unreadable
  log(
    `Read ${records.length} catalog records from snapshot ${catalog.snapshotSeq ?? 'none'} and ` +
      `${catalog.logSegments} log segments (${catalog.unreadable.length} unreadable)`,
  )

  const fields = records.filter((r): r is CatalogFieldRecord => r.kind === 'metadataField')
  const projects = records.filter((r): r is CatalogProjectRecord => r.kind === 'project')
  const catalogAssets = records.filter((r): r is CatalogAssetRecord => r.kind === 'asset')
  const assets = catalogAssets.filter((a) => a.status !== AssetStatus.uploading)
  report.unfinishedUploads = catalogAssets
    .filter((a) => a.status === AssetStatus.uploading)
    .map((a) => a.id)

  // Map teams and creators that do not exist here.
  const teamIds = new Set(
    [...projects.map((p) => p.teamId), ...fields.map((f) => f.teamId)].filter(
      (t): t is string => !!t,
    ),
  )
  const existingTeams = new Set(
    (await prisma.team.findMany({ where: { id: { in: [...teamIds] } }, select: { id: true } })).map(
      (t) => t.id,
    ),
  )
  const missingTeams = [...teamIds].filter((t) => !existingTeams.has(t))
  if (missingTeams.length > 0 && !options.teamId) {
    throw new Error(
      `The catalog refers to ${missingTeams.length} team(s) that do not exist here; pass a team id to restore into`,
    )
  }
  const team = (id: string | null) => (id && !existingTeams.has(id) ? options.teamId! : id)

  const creatorIds = new Set(assets.map((a) => a.creatorId).filter((c): c is string => !!c))
  const existingUsers = new Set(
    (
      await prisma.user.findMany({ where: { id: { in: [...creatorIds] } }, select: { id: true } })
    ).map((u) => u.id),
  )
  const creator = (id: string | null) =>
    id && existingUsers.has(id) ? id : (options.creatorId ?? null)

  const existingProjectIds = new Set(
    (
      await prisma.project.findMany({
        where: { id: { in: projects.map((p) => p.id) } },
        select: { id: true },
      })
    ).map((p) => p.id),
  )
  const existingFieldKeys = new Set(
    (
      await prisma.metadataField.findMany({
        where: { key: { in: fields.map((f) => f.key) } },
        select: { key: true },
      })
    ).map((f) => f.key),
  )
  const existingAssetIds = new Set(
    (
      await prisma.asset.findMany({
        where: { id: { in: assets.map((a) => a.id) } },
        select: { id: true },
      })
    ).map((a) => a.id),
  )

  // A project that is in neither the catalog nor this database cannot be referenced.
  const knownProjects = new Set([...existingProjectIds, ...projects.map((p) => p.id)])
  const project = (id: string | null) => (id && knownProjects.has(id) ? id : null)

  const newProjects = projects.filter((p) => !existingProjectIds.has(p.id))
  const newFields = fields.filter((f) => !existingFieldKeys.has(f.key))
  const newAssets = assets.filter((a) => !existingAssetIds.has(a.id))
  report.projects = { created: newProjects.length, skipped: projects.length - newProjects.length }
  report.fields = { created: newFields.length, skipped: fields.length - newFields.length }
  report.assets = { created: newAssets.length, skipped: assets.length - newAssets.length }

  // Parents first: order by depth within the catalog.
  const byId = new Map(assets.map((a) => [a.id, a]))
  const depthCache = new Map<string, number>()
  const depth = (a: CatalogAssetRecord, seen = new Set<string>()): number => {
    const cached = depthCache.get(a.id)
    if (cached !== undefined) return cached
    const parent = a.parentId ? byId.get(a.parentId) : undefined
    const d = parent && !seen.has(parent.id) ? depth(parent, seen.add(a.id)) + 1 : 0
    depthCache.set(a.id, d)
    return d
  }
  newAssets.sort((x, y) => depth(x) - depth(y))
  for (const a of newAssets) {
    if (a.parentId && !byId.has(a.parentId) && !existingAssetIds.has(a.parentId))
      report.orphans.push(a.id)
  }

  const fileKeys = newAssets
    .filter((a) => a.storageKey && a.type === 'file')
    .map((a) => a.storageKey!)
  const media = new Map<string, unknown>()
  await runLimited(fileKeys, READ_CONCURRENCY, async (key) => {
    try {
      await s3Service.headObject(bucket(), key)
    } catch {
      report.missingFiles.push(key)
      return
    }
    try {
      const { buffer } = await s3Service.getObject(
        bucket(),
        path.posix.join(path.posix.dirname(key), 'info.json'),
      )
      media.set(key, JSON.parse(buffer.toString('utf8')))
    } catch {
      // No previews recorded yet; the file still restores and can be re-processed from the app.
    }
  })

  const valueCount = newAssets.reduce((n, a) => n + Object.keys(a.metadata ?? {}).length, 0)
  report.metadataValues = valueCount
  log(
    `Restore plan: ${newProjects.length} projects, ${newFields.length} fields, ${newAssets.length} assets, ` +
      `${valueCount} metadata values; ${report.missingFiles.length} files missing in storage, ` +
      `${report.orphans.length} without a parent; ${report.unfinishedUploads.length} unfinished uploads skipped`,
  )
  if (options.dryRun) return report

  // 1. Projects, without their root folders (those are assets and come next).
  for (const p of newProjects) {
    await prisma.project.create({
      data: {
        id: p.id,
        name: p.name,
        teamId: team(p.teamId)!,
        metadataOverrides:
          (p.metadataOverrides as PrismaJson.MetadataOverrides | null) ?? Prisma.JsonNull,
        createdAt: new Date(p.createdAt),
      },
    })
  }

  // 2. Metadata fields, with their select options (option ids are what the values point at).
  for (const f of newFields) {
    await prisma.metadataField.create({
      data: {
        id: f.id,
        key: f.key,
        scope: f.scope as MetadataFieldScope | null,
        config: (f.config as PrismaJson.FieldConfig | null) ?? Prisma.JsonNull,
        readOnly: f.readOnly,
        description: f.description,
        teamId: team(f.teamId),
        projectId: project(f.projectId),
      },
    })
  }

  // 3. Storage keys, then assets parent-first. Symlink targets are linked afterwards.
  const allKeys = [...new Set(newAssets.map((a) => a.storageKey).filter((k): k is string => !!k))]
  if (allKeys.length > 0) {
    await prisma.storageKey.createMany({
      data: allKeys.map((key) => ({ key })),
      skipDuplicates: true,
    })
  }
  const keyIds = new Map(
    (
      await prisma.storageKey.findMany({
        where: { key: { in: allKeys } },
        select: { id: true, key: true },
      })
    ).map((k) => [k.key, k.id]),
  )
  const orphans = new Set(report.orphans)
  for (const a of newAssets) {
    await prisma.asset.create({
      data: {
        id: a.id,
        name: a.name,
        type: a.type as AssetType,
        status: a.status as AssetStatus,
        parentId: orphans.has(a.id) ? null : a.parentId,
        projectId: project(a.projectId),
        sortIndex: a.sortIndex,
        storageKeyId: a.storageKey ? (keyIds.get(a.storageKey) ?? null) : null,
        mediaType: a.mediaType,
        sizeByte: BigInt(a.sizeByte),
        contentHash: a.contentHash ?? null,
        fileCount: a.fileCount,
        hasJpegPreview: a.hasJpegPreview,
        media:
          (a.storageKey && (media.get(a.storageKey) as PrismaJson.MediaInfo)) || Prisma.JsonNull,
        isDeleted: a.isDeleted,
        deletedAt: a.deletedAt ? new Date(a.deletedAt) : null,
        creatorId: creator(a.creatorId),
        createdAt: new Date(a.createdAt),
      },
    })
  }
  const unfinished = new Set(report.unfinishedUploads)
  for (const a of newAssets.filter((x) => x.targetId && !unfinished.has(x.targetId))) {
    await prisma.asset.update({ where: { id: a.id }, data: { targetId: a.targetId } })
  }

  // 4. Metadata values.
  const values = newAssets.flatMap((a) =>
    Object.entries(a.metadata ?? {}).map(([fieldKey, v]) => ({
      assetId: a.id,
      fieldKey,
      stringValue: v.stringValue ?? null,
      numberValue: v.numberValue ?? null,
      booleanValue: v.booleanValue ?? null,
      jsonValue: v.jsonValue === undefined ? Prisma.JsonNull : (v.jsonValue as object),
      dateValue: v.dateValue ? new Date(v.dateValue) : null,
    })),
  )
  if (values.length > 0)
    await prisma.assetMetadataValue.createMany({ data: values, skipDuplicates: true })

  // 5. Point projects at their root and share folders.
  for (const p of newProjects) {
    await prisma.project.update({
      where: { id: p.id },
      data: { rootFolderId: p.rootFolderId, shareRootId: p.shareRootId },
    })
  }

  log('Restore finished')
  return report
}
