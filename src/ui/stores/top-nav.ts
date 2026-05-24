import { create } from 'zustand'
import type { AncestorFolder } from '@/dtos/asset'

export interface TopNavProjectState {
  teamId: string
  projectId: string
  projectName: string
  ancestorFolders: AncestorFolder[]
  currentAsset: {
    name?: string
    type: 'file' | 'folder'
    version?: number
  }
  isRootFolder: boolean
  fileId?: string
  versions?: Array<{
    id: string
    version: number
    name?: string | null
    previewUrl?: string | null
    creator?: { id: string; name: string | null } | null
  }>
  isPublic?: boolean
  shareId?: string
  onFolderClick?: (folderId: string) => void
}

interface TopNavStore {
  projectState: TopNavProjectState | null
  setProjectState: (state: TopNavProjectState | null) => void
  clearProjectState: () => void
}

let timeoutId: ReturnType<typeof setTimeout> | null = null

export const useTopNavStore = create<TopNavStore>((set) => ({
  projectState: null,
  setProjectState: (state) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    set({ projectState: state })
  },
  clearProjectState: () => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => {
      set({ projectState: null })
      timeoutId = null
    }, 10) // Small debounce to prevent flicker during transitions
  },
}))
