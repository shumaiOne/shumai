import { describe, expect, it } from 'vitest'
import {
  buildFolderPath,
  groupDuplicateRows,
  planDuplicateResolution,
  type DuplicateRow,
  type FolderRef,
} from './duplicates-group'

const folders = new Map<string, FolderRef>([
  ['root', { id: 'root', name: '', parentId: null, type: 'root' }],
  ['shoots', { id: 'shoots', name: 'Shoots', parentId: 'root', type: 'folder' }],
  ['day1', { id: 'day1', name: 'Day 1', parentId: 'shoots', type: 'folder' }],
])

const row = (over: Partial<DuplicateRow> & { id: string }): DuplicateRow => ({
  name: `${over.id}.jpg`,
  parentId: 'day1',
  sizeByte: 100,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  contentHash: 'a'.repeat(64),
  ...over,
})

describe('buildFolderPath', () => {
  it('joins folder names from the project root down and skips the root', () => {
    expect(buildFolderPath('day1', folders)).toBe('Shoots/Day 1')
  })

  it('returns an empty string for a file directly under the root or with no parent', () => {
    expect(buildFolderPath('root', folders)).toBe('')
    expect(buildFolderPath(null, folders)).toBe('')
  })

  it('stops on a missing ancestor and on cycles', () => {
    expect(buildFolderPath('ghost', folders)).toBe('')
    const loop = new Map<string, FolderRef>([
      ['a', { id: 'a', name: 'A', parentId: 'b', type: 'folder' }],
      ['b', { id: 'b', name: 'B', parentId: 'a', type: 'folder' }],
    ])
    expect(buildFolderPath('a', loop)).toBe('B/A')
  })
})

describe('groupDuplicateRows', () => {
  it('drops hashes that appear only once', () => {
    const rows = [row({ id: '1', contentHash: 'b'.repeat(64) }), row({ id: '2' })]
    expect(groupDuplicateRows(rows, folders)).toEqual([])
  })

  it('groups by hash, oldest copy first, with wasted bytes of all but the largest', () => {
    const rows = [
      row({ id: 'new', createdAt: new Date('2026-03-01T00:00:00Z'), sizeByte: 100n }),
      row({ id: 'old', createdAt: new Date('2026-01-01T00:00:00Z'), sizeByte: 100n }),
      row({ id: 'mid', createdAt: new Date('2026-02-01T00:00:00Z'), sizeByte: 100n }),
    ]
    const [group] = groupDuplicateRows(rows, folders)
    expect(group.assets.map((a) => a.id)).toEqual(['old', 'mid', 'new'])
    expect(group.count).toBe(3)
    expect(group.sizeByte).toBe(100)
    expect(group.wastedBytes).toBe(200)
    expect(group.assets[0].path).toBe('Shoots/Day 1')
  })

  it('orders groups by wasted bytes descending, then by hash', () => {
    const big = 'c'.repeat(64)
    const small = 'a'.repeat(64)
    const rows = [
      row({ id: '1', contentHash: small, sizeByte: 10 }),
      row({ id: '2', contentHash: small, sizeByte: 10 }),
      row({ id: '3', contentHash: big, sizeByte: 5000 }),
      row({ id: '4', contentHash: big, sizeByte: 5000 }),
    ]
    expect(groupDuplicateRows(rows, folders).map((g) => g.contentHash)).toEqual([big, small])
  })

  it('serialises createdAt as ISO and sizes as numbers', () => {
    const rows = [row({ id: '1', sizeByte: 7n }), row({ id: '2', sizeByte: 7n })]
    const [group] = groupDuplicateRows(rows, folders)
    expect(group.assets[0].sizeByte).toBe(7)
    expect(group.assets[0].createdAt).toBe('2026-01-01T00:00:00.000Z')
  })
})

describe('planDuplicateResolution', () => {
  const HASH = 'a'.repeat(64)
  const r = (id: string, over: { contentHash?: string | null; sizeByte?: number } = {}) => ({
    id,
    contentHash: HASH,
    sizeByte: 100,
    ...over,
  })

  it('accepts exact copies of a hashed keeper and returns each id once', () => {
    const plan = planDuplicateResolution('k', ['b', 'c', 'b'], [r('k'), r('b'), r('c')])
    expect(plan).toEqual({ ok: true, deleteIds: ['b', 'c'] })
  })

  it('rejects a copy with a different hash and names it', () => {
    const plan = planDuplicateResolution(
      'k',
      ['b', 'c'],
      [r('k'), r('b'), r('c', { contentHash: 'b'.repeat(64) })],
    )
    expect(plan).toMatchObject({ ok: false })
    expect(!plan.ok && plan.message).toContain('c')
    expect(!plan.ok && plan.message).not.toContain('b,')
  })

  it('rejects a copy with the same hash but a different size', () => {
    const plan = planDuplicateResolution('k', ['b'], [r('k'), r('b', { sizeByte: 101 })])
    expect(plan.ok).toBe(false)
  })

  it('rejects ids that are not live files of the project (not in the rows)', () => {
    const plan = planDuplicateResolution('k', ['b', 'ghost'], [r('k'), r('b')])
    expect(plan).toMatchObject({ ok: false })
    expect(!plan.ok && plan.message).toContain('ghost')
  })

  it('rejects a missing keeper and a keeper without a hash', () => {
    expect(planDuplicateResolution('k', ['b'], [r('b')]).ok).toBe(false)
    expect(planDuplicateResolution('k', ['b'], [r('k', { contentHash: null }), r('b')]).ok).toBe(
      false,
    )
  })

  it('never lets a copy with no hash match a keeper with no hash', () => {
    const plan = planDuplicateResolution(
      'k',
      ['b'],
      [r('k', { contentHash: null }), r('b', { contentHash: null })],
    )
    expect(plan.ok).toBe(false)
  })

  it('rejects deleting the keeper itself and an empty delete list', () => {
    expect(planDuplicateResolution('k', ['k'], [r('k')]).ok).toBe(false)
    expect(planDuplicateResolution('k', [], [r('k')]).ok).toBe(false)
  })
})
