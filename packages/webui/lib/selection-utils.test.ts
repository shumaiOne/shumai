import { describe, expect, it, vi } from 'vitest'
import {
  computeNextItemSelection,
  getSelectedRangeIds,
  handleCardClick,
  type ItemSelectionState,
} from './selection-utils'
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

describe('computeNextItemSelection', () => {
  const files = [
    { id: 'f1', name: 'File 1', type: 'file' },
    { id: 'f2', name: 'File 2', type: 'file' },
    { id: 'f3', name: 'File 3', type: 'file' },
    { id: 'f4', name: 'File 4', type: 'file' },
  ] as unknown as AssetInfo[]

  it('selects single item on plain click', () => {
    const initialState: ItemSelectionState = {
      selectedIds: new Set(),
      selectedItem: null,
      lastSelectedId: null,
    }

    const state = computeNextItemSelection({
      item: files[0],
      event: { metaKey: false, ctrlKey: false, shiftKey: false } as unknown as React.MouseEvent,
      folders: [],
      files,
      state: initialState,
    })

    expect(state.selectedIds).toEqual(new Set(['f1']))
    expect(state.selectedItem).toEqual(files[0])
    expect(state.lastSelectedId).toBe('f1')
  })

  it('independently toggles checkbox without deselecting other items', () => {
    const initialState: ItemSelectionState = {
      selectedIds: new Set(['f1', 'f2', 'f3']),
      selectedItem: files[2],
      lastSelectedId: 'f1',
    }

    // Toggle f2 off via checkbox
    const state = computeNextItemSelection({
      item: files[1],
      event: { metaKey: false, ctrlKey: false, shiftKey: false } as unknown as React.MouseEvent,
      meta: { isCheckbox: true },
      folders: [],
      files,
      state: initialState,
    })

    expect(state.selectedIds).toEqual(new Set(['f1', 'f3']))
    expect(state.lastSelectedId).toBe('f1')
  })

  it('resets range anchor when the range anchor is deselected (Finding 2 bug)', () => {
    // Repro steps:
    // 1. Click f1 (anchor = f1)
    const state1 = computeNextItemSelection({
      item: files[0],
      event: { metaKey: false, ctrlKey: false, shiftKey: false } as unknown as React.MouseEvent,
      folders: [],
      files,
      state: { selectedIds: new Set(), selectedItem: null, lastSelectedId: null },
    })
    expect(state1.lastSelectedId).toBe('f1')

    // 2. Shift-click f3 -> selects f1, f2, f3; selectedItem = f3; lastSelectedId remains f1
    const state2 = computeNextItemSelection({
      item: files[2],
      event: { metaKey: false, ctrlKey: false, shiftKey: true } as unknown as React.MouseEvent,
      folders: [],
      files,
      state: state1,
    })
    expect(state2.selectedIds).toEqual(new Set(['f1', 'f2', 'f3']))
    expect(state2.selectedItem).toEqual(files[2])
    expect(state2.lastSelectedId).toBe('f1')

    // 3. Ctrl-click f1 to deselect f1
    // The anchor f1 is now deselected! In the buggy version, lastSelectedId remained f1 because selectedItem was f3.
    const state3 = computeNextItemSelection({
      item: files[0],
      event: { metaKey: true, ctrlKey: false, shiftKey: false } as unknown as React.MouseEvent,
      folders: [],
      files,
      state: state2,
    })
    expect(state3.selectedIds).toEqual(new Set(['f2', 'f3']))
    // Anchor MUST NOT be the deselected f1! It must update to a remaining selected item or null
    expect(state3.lastSelectedId).not.toBe('f1')
    expect(state3.selectedIds.has(state3.lastSelectedId!)).toBe(true)

    // 4. Subsequent Shift-click on f4 must NOT re-select f1
    const state4 = computeNextItemSelection({
      item: files[3],
      event: { metaKey: false, ctrlKey: false, shiftKey: true } as unknown as React.MouseEvent,
      folders: [],
      files,
      state: state3,
    })
    expect(state4.selectedIds.has('f1')).toBe(false)
    expect(state4.selectedIds.has('f4')).toBe(true)
  })
})

describe('handleCardClick', () => {
  const mockItem = { id: 'item-1', name: 'File 1' } as unknown as AssetInfo

  it('in public mode, ignores click with detail > 1 (Finding 1 double-click fix)', () => {
    const onSelect = vi.fn()
    const onDoubleClick = vi.fn()

    // Rapid double-click event (detail = 2)
    handleCardClick({
      item: mockItem,
      event: {
        detail: 2,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
      } as unknown as React.MouseEvent,
      isPublic: true,
      onSelect,
      onDoubleClick,
    })

    expect(onDoubleClick).not.toHaveBeenCalled()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('in public mode, single click (detail = 1) calls onDoubleClick', () => {
    const onSelect = vi.fn()
    const onDoubleClick = vi.fn()

    handleCardClick({
      item: mockItem,
      event: {
        detail: 1,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
      } as unknown as React.MouseEvent,
      isPublic: true,
      onSelect,
      onDoubleClick,
    })

    expect(onDoubleClick).toHaveBeenCalledWith(mockItem)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('in internal mode, preserves multi-selection when clicking already selected card', () => {
    const onSelect = vi.fn()
    const onDoubleClick = vi.fn()

    handleCardClick({
      item: mockItem,
      event: {
        detail: 1,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
      } as unknown as React.MouseEvent,
      isPublic: false,
      selectedCount: 3,
      isChecked: true,
      onSelect,
      onDoubleClick,
    })

    expect(onSelect).not.toHaveBeenCalled()
    expect(onDoubleClick).not.toHaveBeenCalled()
  })
})
