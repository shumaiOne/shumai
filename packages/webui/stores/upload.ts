import { create } from 'zustand'

type UploadStore = {
  uploading: number
  increment: () => void
  decrement: () => void
}

export const useUploadStore = create<UploadStore>((set) => ({
  uploading: 0,
  increment: () => set((state) => ({ uploading: state.uploading + 1 })),
  decrement: () => set((state) => ({ uploading: state.uploading - 1 })),
}))
