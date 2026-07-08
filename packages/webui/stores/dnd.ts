import { create } from 'zustand'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/react'
import type { AssetInfo } from '@shumai/dtos'

interface DndListener {
  onDragStart?: (event: DragStartEvent) => void
  onDragEnd?: (event: DragEndEvent) => void
}

interface DndState {
  listeners: Set<DndListener>
  activeDragItems: AssetInfo[]
  registerListener: (listener: DndListener) => () => void
  triggerDragStart: (event: DragStartEvent) => void
  triggerDragEnd: (event: DragEndEvent) => void
  setActiveDragItems: (items: AssetInfo[]) => void
}

export const useDndStore = create<DndState>((set, get) => ({
  listeners: new Set(),
  activeDragItems: [],
  registerListener: (listener) => {
    set((state) => {
      const next = new Set(state.listeners)
      next.add(listener)
      return { listeners: next }
    })
    return () => {
      set((state) => {
        const next = new Set(state.listeners)
        next.delete(listener)
        return { listeners: next }
      })
    }
  },
  triggerDragStart: (event) => {
    get().listeners.forEach((l) => l.onDragStart?.(event))
  },
  triggerDragEnd: (event) => {
    get().listeners.forEach((l) => l.onDragEnd?.(event))
  },
  setActiveDragItems: (items) => set({ activeDragItems: items }),
}))
