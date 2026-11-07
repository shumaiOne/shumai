import type { AssetInfo } from '@shumai/dtos'
import type React from 'react'

export interface ItemSelectionState {
  selectedIds: Set<string>
  selectedItem: AssetInfo | null
  lastSelectedId: string | null
}

export interface ComputeItemSelectionOptions {
  item: AssetInfo
  event: React.MouseEvent
  meta?: { isCheckbox?: boolean }
  folders: AssetInfo[]
  files: AssetInfo[]
  state: ItemSelectionState
}

export function computeNextItemSelection({
  item,
  event,
  meta,
  folders,
  files,
  state,
}: ComputeItemSelectionOptions): ItemSelectionState {
  const isCtrlOrCmd = event.metaKey || event.ctrlKey
  const isShift = event.shiftKey

  if (isShift && state.lastSelectedId) {
    const allItems = [...folders, ...files]
    const lastSelectedItem = allItems.find((i) => i.id === state.lastSelectedId)

    if (lastSelectedItem) {
      const newSelectedIds = getSelectedRangeIds(
        lastSelectedItem,
        item,
        state.lastSelectedId,
        folders,
        files,
        state.selectedIds,
      )

      if (newSelectedIds) {
        return {
          selectedIds: newSelectedIds,
          selectedItem: item,
          lastSelectedId: state.lastSelectedId,
        }
      }
    }
  }

  if (isCtrlOrCmd || meta?.isCheckbox) {
    const next = new Set(state.selectedIds)
    if (next.has(item.id!)) {
      next.delete(item.id!)
      const allItems = [...folders, ...files]
      const remaining = allItems.find((i) => next.has(i.id!)) || null
      return {
        selectedIds: next,
        selectedItem: state.selectedItem?.id === item.id ? remaining : state.selectedItem,
        lastSelectedId:
          state.lastSelectedId === item.id
            ? remaining
              ? remaining.id!
              : null
            : state.lastSelectedId,
      }
    }

    next.add(item.id!)
    return {
      selectedIds: next,
      selectedItem: item,
      lastSelectedId: item.id!,
    }
  }

  return {
    selectedIds: new Set([item.id!]),
    selectedItem: item,
    lastSelectedId: item.id!,
  }
}

export interface HandleCardClickOptions {
  item: AssetInfo
  event: React.MouseEvent
  isPublic?: boolean
  selectedCount?: number
  isSelected?: boolean
  isChecked?: boolean
  onSelect: (item: AssetInfo, event: React.MouseEvent) => void
  onDoubleClick: (item: AssetInfo) => void
}

export function handleCardClick({
  item,
  event,
  isPublic = false,
  selectedCount = 0,
  isSelected = false,
  isChecked = false,
  onSelect,
  onDoubleClick,
}: HandleCardClickOptions): void {
  if (isPublic) {
    // Ignore subsequent clicks of a rapid double-click in public mode to prevent duplicate navigations
    if (event.detail > 1) {
      return
    }
    if (event.metaKey || event.ctrlKey || event.shiftKey) {
      onSelect(item, event)
    } else {
      onDoubleClick(item)
    }
    return
  }

  if (
    selectedCount > 1 &&
    (isChecked || isSelected) &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey
  ) {
    // Frame.io behavior: clicking an already selected card when multiple items are selected preserves the selection
    return
  }

  onSelect(item, event)
}

export function getSelectedRangeIds(
  lastSelectedItem: AssetInfo,
  currentItem: AssetInfo,
  lastSelectedId: string,
  folders: AssetInfo[],
  files: AssetInfo[],
  currentSelectedIds: Set<string>,
): Set<string> | null {
  const isLastFolder = lastSelectedItem.type === 'folder'
  const isCurrentFolder = currentItem.type === 'folder'

  if (isLastFolder !== isCurrentFolder) {
    return null
  }

  const typeItems = isCurrentFolder ? folders : files
  const lastIndex = typeItems.findIndex((i) => i.id === lastSelectedId)
  const currentIndex = typeItems.findIndex((i) => i.id === currentItem.id)

  if (lastIndex === -1 || currentIndex === -1) {
    return null
  }

  const start = Math.min(lastIndex, currentIndex)
  const end = Math.max(lastIndex, currentIndex)
  const rangeItems = typeItems.slice(start, end + 1)

  const newSelectedIds = new Set(currentSelectedIds)
  rangeItems.forEach((rangeItem) => {
    if (rangeItem.id) {
      newSelectedIds.add(rangeItem.id)
    }
  })

  return newSelectedIds
}
