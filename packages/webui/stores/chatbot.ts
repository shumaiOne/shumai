import { create } from 'zustand'

export interface ChatAsset {
  id: string
  name: string
  type: 'file' | 'folder'
}

interface ChatbotState {
  isChatbotOpen: boolean
  setIsChatbotOpen: (open: boolean) => void
  chatAssets: ChatAsset[]
  addAssets: (assets: ChatAsset[]) => void
  removeAsset: (id: string) => void
  clearAssets: () => void
}

export const useChatbotStore = create<ChatbotState>((set) => ({
  isChatbotOpen: false,
  setIsChatbotOpen: (open) => set({ isChatbotOpen: open }),
  chatAssets: [],
  addAssets: (assets) =>
    set((state) => {
      const existingIds = new Set(state.chatAssets.map((a) => a.id))
      const uniqueNewAssets = assets.filter((a) => !existingIds.has(a.id))
      return { chatAssets: [...state.chatAssets, ...uniqueNewAssets] }
    }),
  removeAsset: (id) =>
    set((state) => ({
      chatAssets: state.chatAssets.filter((a) => a.id !== id),
    })),
  clearAssets: () => set({ chatAssets: [] }),
}))
