import { describe, expect, it } from 'vitest'
import { getSelectedRangeIds } from './selection-utils'
import type { AssetInfo } from '@shumai/dtos'

describe('getSelectedRangeIds', () => {
  const folders = [
    { id: 'folder1', name: 'Folder 1', type: 'folder', status: 'processed' },
    { id: 'folder2', name: 'Folder 2', type: 'folder', status: 'processed' },
  ] as unknown as AssetInfo[]

  const files = [
    { id: 'stack1', name: 'Version Stack 1', type: 'version_stack', status: 'processed' },
    { id: 'file1', name: 'Image 1.png', type: 'file', status: 'processed' },
    { id: 'file2', name: 'Image 2.png', type: 'file', status: 'processed' },
  ] as unknown as AssetInfo[]

  it('selects range when starting with version_stack and ending with a regular file', () => {
    const lastSelectedItem = files[0] // version_stack
    const currentItem = files[2] // file2

    const result = getSelectedRangeIds(
      lastSelectedItem,
      currentItem,
      'stack1',
      folders,
      files,
      new Set(['stack1']),
    )

    expect(result).not.toBeNull()
    expect(result?.size).toBe(3)
    expect(result?.has('stack1')).toBe(true)
    expect(result?.has('file1')).toBe(true)
    expect(result?.has('file2')).toBe(true)
  })

  it('selects range when starting with a regular file and ending with version_stack', () => {
    const lastSelectedItem = files[2] // file2
    const currentItem = files[0] // stack1

    const result = getSelectedRangeIds(
      lastSelectedItem,
      currentItem,
      'file2',
      folders,
      files,
      new Set(['file2']),
    )

    expect(result).not.toBeNull()
    expect(result?.size).toBe(3)
    expect(result?.has('stack1')).toBe(true)
    expect(result?.has('file1')).toBe(true)
    expect(result?.has('file2')).toBe(true)
  })

  it('returns null when range selecting across folder and file', () => {
    const lastSelectedItem = folders[0] // folder1
    const currentItem = files[1] // file1

    const result = getSelectedRangeIds(
      lastSelectedItem,
      currentItem,
      'folder1',
      folders,
      files,
      new Set(['folder1']),
    )

    expect(result).toBeNull()
  })

  it('selects range between folders', () => {
    const lastSelectedItem = folders[0] // folder1
    const currentItem = folders[1] // folder2

    const result = getSelectedRangeIds(
      lastSelectedItem,
      currentItem,
      'folder1',
      folders,
      files,
      new Set(['folder1']),
    )

    expect(result).not.toBeNull()
    expect(result?.size).toBe(2)
    expect(result?.has('folder1')).toBe(true)
    expect(result?.has('folder2')).toBe(true)
  })
})
