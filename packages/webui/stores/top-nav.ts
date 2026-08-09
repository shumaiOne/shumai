import { create } from 'zustand'
import type { AncestorFolder } from '@shumai/dtos'

export interface TopNavProjectState {
  teamId: string
  projectId: string
  projectName: string
  ancestorFolders: AncestorFolder[]
  currentAsset: {
    name?: string
    type: 'file' | 'folder'
    version?: number
    proxyType?: 'image' | 'video' | 'audio' | 'pdf' | null
  }
  isRootFolder: boolean
  fileId?: string
  downloadInfo?: {
    originalKey?: string
    videoTranscodes?: Array<{
      key: string
      width: number
      height: number
    }>
  }
  versions?: Array<{
    id: string
    version: number
    name?: string | null
    previewUrl?: string | null
    creator?: { id: string; name: string | null } | null
  }>
  isPublic?: boolean
  shareId?: string
  /** When false, the public share hides download affordances. Defaults to true. */
  allowDownload?: boolean
  onFolderClick?: (folderId: string) => void
  onRename?: () => void
  onDelete?: () => void
  isRightSidebarCollapsed?: boolean
  onRightSidebarToggle?: () => void
  // Compare Versions
  compareMode?: boolean
  canCompareVersions?: boolean
  onCompareVersions?: () => void
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
