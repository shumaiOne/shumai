import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface UiState {
  fileViewLeftSidebarCollapsed: boolean
  setFileViewLeftSidebarCollapsed: (collapsed: boolean) => void

  fileViewRightSidebarCollapsed: boolean
  setFileViewRightSidebarCollapsed: (collapsed: boolean) => void

  fileListLeftSidebarCollapsed: boolean
  setFileListLeftSidebarCollapsed: (collapsed: boolean) => void

  fileListRightSidebarCollapsed: boolean
  setFileListRightSidebarCollapsed: (collapsed: boolean) => void

  shareConfigLeftSidebarCollapsed: boolean
  setShareConfigLeftSidebarCollapsed: (collapsed: boolean) => void

  shareConfigRightSidebarCollapsed: boolean
  setShareConfigRightSidebarCollapsed: (collapsed: boolean) => void

  viewModes: { [projectId: string]: 'card' | 'list' }
  setViewMode: (projectId: string, mode: 'card' | 'list') => void

  videoTimeDisplayMode: 'standard' | 'frames' | 'timecode'
  setVideoTimeDisplayMode: (mode: 'standard' | 'frames' | 'timecode') => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      fileViewLeftSidebarCollapsed: true,
      setFileViewLeftSidebarCollapsed: (collapsed) =>
        set({ fileViewLeftSidebarCollapsed: collapsed }),

      fileViewRightSidebarCollapsed: true,
      setFileViewRightSidebarCollapsed: (collapsed) =>
        set({ fileViewRightSidebarCollapsed: collapsed }),

      fileListLeftSidebarCollapsed: false,
      setFileListLeftSidebarCollapsed: (collapsed) =>
        set({ fileListLeftSidebarCollapsed: collapsed }),

      fileListRightSidebarCollapsed: true,
      setFileListRightSidebarCollapsed: (collapsed) =>
        set({ fileListRightSidebarCollapsed: collapsed }),

      shareConfigLeftSidebarCollapsed: false,
      setShareConfigLeftSidebarCollapsed: (collapsed) =>
        set({ shareConfigLeftSidebarCollapsed: collapsed }),

      shareConfigRightSidebarCollapsed: false,
      setShareConfigRightSidebarCollapsed: (collapsed) =>
        set({ shareConfigRightSidebarCollapsed: collapsed }),

      viewModes: {},
      setViewMode: (projectId, mode) =>
        set((state) => ({
          viewModes: { ...state.viewModes, [projectId]: mode },
        })),

      videoTimeDisplayMode: 'standard',
      setVideoTimeDisplayMode: (mode) => set({ videoTimeDisplayMode: mode }),
    }),
    {
      name: 'ui-storage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
