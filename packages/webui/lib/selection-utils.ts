import type { AssetInfo } from '@shumai/dtos'

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
