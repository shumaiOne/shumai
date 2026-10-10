import type { DuplicateAssetInfo, DuplicateGroup } from '@shumai/dtos'

export interface DuplicateRow {
  id: string
  name: string
  parentId: string | null
  sizeByte: bigint | number
  createdAt: Date
  contentHash: string
}

export interface FolderRef {
  id: string
  name: string
  parentId: string | null
  type: string
}

const MAX_PATH_DEPTH = 64

/**
 * Builds the folder path (without the file name) from the nearest folder up to the project root.
 * The project root folder is left out so paths read relative to the project.
 */
export function buildFolderPath(parentId: string | null, folders: Map<string, FolderRef>): string {
  const parts: string[] = []
  const seen = new Set<string>()
  let current = parentId
  while (current && parts.length < MAX_PATH_DEPTH && !seen.has(current)) {
    seen.add(current)
    const folder = folders.get(current)
    if (!folder) break
    if (folder.type !== 'root') parts.push(folder.name)
    current = folder.parentId
  }
  return parts.reverse().join('/')
}

export function toDuplicateAssetInfo(
  row: DuplicateRow,
  folders: Map<string, FolderRef>,
): DuplicateAssetInfo {
  return {
    id: row.id,
    name: row.name,
    path: buildFolderPath(row.parentId, folders),
    parentId: row.parentId,
    sizeByte: Number(row.sizeByte),
    createdAt: row.createdAt.toISOString(),
  }
}

/**
 * Groups rows by content hash, drops hashes seen only once, orders each group oldest first (the
 * oldest copy is the natural one to keep) and orders groups by the space they waste, largest first.
 */
export function groupDuplicateRows(
  rows: DuplicateRow[],
  folders: Map<string, FolderRef>,
): DuplicateGroup[] {
  const byHash = new Map<string, DuplicateRow[]>()
  for (const row of rows) {
    const list = byHash.get(row.contentHash)
    if (list) list.push(row)
    else byHash.set(row.contentHash, [row])
  }

  const groups: DuplicateGroup[] = []
  for (const [contentHash, list] of byHash) {
    if (list.length < 2) continue
    list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
    const sizes = list.map((r) => Number(r.sizeByte))
    const total = sizes.reduce((sum, s) => sum + s, 0)
    const largest = Math.max(...sizes)
    groups.push({
      contentHash,
      sizeByte: largest,
      count: list.length,
      wastedBytes: total - largest,
      assets: list.map((r) => toDuplicateAssetInfo(r, folders)),
    })
  }

  groups.sort((a, b) => b.wastedBytes - a.wastedBytes || a.contentHash.localeCompare(b.contentHash))
  return groups
}

export interface ResolveRow {
  id: string
  contentHash: string | null
  sizeByte: bigint | number
}

export type ResolvePlan = { ok: true; deleteIds: string[] } | { ok: false; message: string }

/**
 * Decides whether `deleteIds` may be deleted in favour of `keepId`. `rows` are the live files of the
 * project that were found for those ids. Every id to delete must be among them and have exactly the
 * keeper's content hash and size, and the keeper must itself be a hashed, live file. Nothing is
 * deleted unless all of them pass, so a stale or tampered request removes nothing.
 */
export function planDuplicateResolution(
  keepId: string,
  deleteIds: string[],
  rows: ResolveRow[],
): ResolvePlan {
  const unique = [...new Set(deleteIds)]
  if (unique.length === 0) return { ok: false, message: 'Nothing to delete' }
  if (unique.includes(keepId)) {
    return { ok: false, message: 'The file to keep cannot also be deleted' }
  }

  const byId = new Map(rows.map((r) => [r.id, r]))
  const keeper = byId.get(keepId)
  if (!keeper) {
    return { ok: false, message: 'The file to keep was not found in this project or is deleted' }
  }
  if (!keeper.contentHash) {
    return { ok: false, message: 'The file to keep has no content hash yet' }
  }

  const missing = unique.filter((id) => !byId.has(id))
  if (missing.length > 0) {
    return {
      ok: false,
      message: `Not found in this project or already deleted: ${missing.join(', ')}`,
    }
  }
  const different = unique.filter((id) => {
    const r = byId.get(id)!
    return r.contentHash !== keeper.contentHash || Number(r.sizeByte) !== Number(keeper.sizeByte)
  })
  if (different.length > 0) {
    return {
      ok: false,
      message: `Not an exact copy of the file to keep: ${different.join(', ')}`,
    }
  }
  return { ok: true, deleteIds: unique }
}
