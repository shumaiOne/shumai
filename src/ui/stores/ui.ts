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

  viewModes: { [projectId: string]: 'card' | 'list' }
  setViewMode: (projectId: string, mode: 'card' | 'list') => void
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

      fileListRightSidebarCollapsed: false,
      setFileListRightSidebarCollapsed: (collapsed) =>
        set({ fileListRightSidebarCollapsed: collapsed }),

      viewModes: {},
      setViewMode: (projectId, mode) =>
        set((state) => ({
          viewModes: { ...state.viewModes, [projectId]: mode },
        })),
    }),
    {
      name: 'ui-storage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
