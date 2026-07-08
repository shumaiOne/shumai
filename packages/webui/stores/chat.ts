import { create } from 'zustand'

export interface ChatContextItem {
  id: string
  name: string
  type: 'file' | 'folder'
  path: string
}

interface ChatState {
  contextItems: ChatContextItem[]
  activeSessionId: string | null
  isChatOpen: boolean

  addContextItems: (items: ChatContextItem[]) => void
  removeContextItem: (id: string) => void
  clearContext: () => void
  setActiveSessionId: (id: string | null) => void
  setChatOpen: (open: boolean) => void
}

export const useChatStore = create<ChatState>((set) => ({
  contextItems: [],
  activeSessionId: null,
  isChatOpen: false,

  addContextItems: (items) =>
    set((state) => {
      const existingIds = new Set(state.contextItems.map((item) => item.id))
      const uniqueNewItems = items.filter((item) => !existingIds.has(item.id))
      return {
        contextItems: [...state.contextItems, ...uniqueNewItems],
      }
    }),

  removeContextItem: (id) =>
    set((state) => ({
      contextItems: state.contextItems.filter((item) => item.id !== id),
    })),

  clearContext: () => set({ contextItems: [] }),
  setActiveSessionId: (id) => set({ activeSessionId: id }),
  setChatOpen: (open) => set({ isChatOpen: open }),
}))
