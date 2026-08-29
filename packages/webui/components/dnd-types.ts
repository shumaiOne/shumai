export interface DragState {
  isActive: boolean
  draggedIds: Set<string>
  hasFolders: boolean
  isSingleFile: boolean
  itemCount: number
}
