import { create } from 'zustand'
import type { Annotation } from '@/ui/types'

export type DrawingTool = 'select' | 'arrow' | 'line' | 'box' | 'freehand'

interface AnnotationState {
  isDrawing: boolean
  currentTool: DrawingTool
  currentColor: string
  annotations: Annotation[] // Completed annotations waiting to be sent
  history: Annotation[][] // For Undo/Redo (stacks of annotation arrays)
  historyIndex: number

  // Actions
  setIsDrawing: (isDrawing: boolean) => void
  setTool: (tool: DrawingTool) => void
  setColor: (color: string) => void
  addAnnotation: (annotation: Annotation) => void
  setAnnotations: (annotations: Annotation[]) => void // For clearing or loading
  undo: () => void
  redo: () => void
  reset: () => void
}

export const useAnnotationStore = create<AnnotationState>((set, get) => ({
  isDrawing: false,
  currentTool: 'arrow',
  currentColor: '#ef4444', // Default red
  annotations: [],
  history: [[]],
  historyIndex: 0,

  setIsDrawing: (isDrawing) => set({ isDrawing }),

  setTool: (tool) => set({ currentTool: tool }),

  setColor: (color) => set({ currentColor: color }),

  addAnnotation: (annotation) => {
    const { annotations, history, historyIndex } = get()
    const newAnnotations = [...annotations, annotation]

    // Slice history if we are in the middle of undo stack
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(newAnnotations)

    set({
      annotations: newAnnotations,
      history: newHistory,
      historyIndex: newHistory.length - 1,
    })
  },

  setAnnotations: (annotations) => {
    set({
      annotations,
      history: [annotations],
      historyIndex: 0,
    })
  },

  undo: () => {
    const { historyIndex, history } = get()
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      set({
        annotations: history[newIndex],
        historyIndex: newIndex,
      })
    }
  },

  redo: () => {
    const { historyIndex, history } = get()
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      set({
        annotations: history[newIndex],
        historyIndex: newIndex,
      })
    }
  },

  reset: () =>
    set({
      isDrawing: false,
      currentTool: 'arrow',
      annotations: [],
      history: [[]],
      historyIndex: 0,
    }),
}))
