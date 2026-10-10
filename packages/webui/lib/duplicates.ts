import type { DuplicateGroup, ResolveDuplicatesRequest } from '@shumai/dtos'

/** Ids of every copy except the oldest one in each group (groups arrive oldest first). */
export function selectExtraCopies(groups: DuplicateGroup[]): Set<string> {
  const ids = new Set<string>()
  for (const group of groups) {
    for (const asset of group.assets.slice(1)) ids.add(asset.id)
  }
  return ids
}

/** True when every copy of at least one group is selected, which would delete the file entirely. */
export function selectionRemovesAllCopies(
  groups: DuplicateGroup[],
  selected: Set<string>,
): boolean {
  return groups.some((g) => g.assets.length > 0 && g.assets.every((a) => selected.has(a.id)))
}

/** Total size of the selected copies. */
export function selectedBytes(groups: DuplicateGroup[], selected: Set<string>): number {
  let total = 0
  for (const group of groups) {
    for (const asset of group.assets) {
      if (selected.has(asset.id)) total += asset.sizeByte
    }
  }
  return total
}

/**
 * One server request per group that has selected copies. The first copy that is not selected is the
 * one kept (groups arrive oldest first); the server re-checks that every id to delete really is an
 * exact copy of it. A group with every copy selected is skipped: it would remove the file entirely.
 */
export function buildResolveRequests(
  groups: DuplicateGroup[],
  selected: Set<string>,
): ResolveDuplicatesRequest[] {
  const requests: ResolveDuplicatesRequest[] = []
  for (const group of groups) {
    const keeper = group.assets.find((a) => !selected.has(a.id))
    const deleteIds = group.assets.filter((a) => selected.has(a.id)).map((a) => a.id)
    if (keeper && deleteIds.length > 0) requests.push({ keepId: keeper.id, deleteIds })
  }
  return requests
}

/** Drops ids that are no longer listed, for example after a refetch following a delete. */
export function pruneSelection(groups: DuplicateGroup[], selected: Set<string>): Set<string> {
  const live = new Set(groups.flatMap((g) => g.assets.map((a) => a.id)))
  return new Set([...selected].filter((id) => live.has(id)))
}
