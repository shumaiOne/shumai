export interface DragState {
  isActive: boolean
  draggedIds: Set<string>
  hasFolders: boolean
  hasVersionStacks: boolean
  isSingleFile: boolean
  itemCount: number
}
