import type { DuplicateGroup } from '@shumai/dtos'
import { describe, expect, it } from 'vitest'
import {
  buildResolveRequests,
  pruneSelection,
  selectedBytes,
  selectExtraCopies,
  selectionRemovesAllCopies,
} from './duplicates'

const asset = (id: string, sizeByte = 10) => ({
  id,
  name: `${id}.jpg`,
  path: '',
  parentId: null,
  sizeByte,
  createdAt: '2026-01-01T00:00:00.000Z',
})
const group = (hash: string, ids: string[]): DuplicateGroup => ({
  contentHash: hash,
  sizeByte: 10,
  count: ids.length,
  wastedBytes: 10 * (ids.length - 1),
  assets: ids.map((id) => asset(id)),
})

const groups = [group('h1', ['a', 'b', 'c']), group('h2', ['d', 'e'])]

describe('duplicate selection helpers', () => {
  it('selects every copy except the first of each group', () => {
    expect([...selectExtraCopies(groups)].sort()).toEqual(['b', 'c', 'e'])
  })

  it('flags a selection that would remove all copies of a group', () => {
    expect(selectionRemovesAllCopies(groups, new Set(['b', 'c', 'e']))).toBe(false)
    expect(selectionRemovesAllCopies(groups, new Set(['d', 'e']))).toBe(true)
    expect(selectionRemovesAllCopies(groups, new Set())).toBe(false)
  })

  it('builds one resolve request per group, keeping the first unselected copy', () => {
    expect(buildResolveRequests(groups, new Set(['b', 'c', 'e']))).toEqual([
      { keepId: 'a', deleteIds: ['b', 'c'] },
      { keepId: 'd', deleteIds: ['e'] },
    ])
    // the oldest copy may be the one deleted; the next unselected copy is kept instead
    expect(buildResolveRequests(groups, new Set(['a']))).toEqual([
      { keepId: 'b', deleteIds: ['a'] },
    ])
  })

  it('builds no request for untouched groups or a group with every copy selected', () => {
    expect(buildResolveRequests(groups, new Set())).toEqual([])
    expect(buildResolveRequests(groups, new Set(['d', 'e']))).toEqual([])
  })

  it('sums selected sizes and prunes ids that are gone', () => {
    expect(selectedBytes(groups, new Set(['a', 'd', 'zzz']))).toBe(20)
    expect([...pruneSelection(groups, new Set(['a', 'zzz']))]).toEqual(['a'])
  })
})
