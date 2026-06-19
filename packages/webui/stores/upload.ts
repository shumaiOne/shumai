import { create } from 'zustand'

export interface FileUploadState {
  fileId: string
  name: string
  loaded: number
  total: number
  status: 'uploading' | 'completed' | 'failed'
}

export interface TaskUploadState {
  taskId: string
  name: string
  loaded: number
  total: number
  files: Record<string, FileUploadState>
}

type UploadStore = {
  uploading: number
  tasks: Record<string, TaskUploadState>
  fileProgress: Record<string, FileUploadState>
  increment: () => void
  decrement: () => void
  startTask: (
    taskId: string,
    taskName: string,
    files: Array<{ fileId: string; name: string; size: number }>,
  ) => void
  updateFileProgress: (taskId: string, fileId: string, loaded: number) => void
  completeFile: (taskId: string, fileId: string) => void
  failFile: (taskId: string, fileId: string) => void
}

export const useUploadStore = create<UploadStore>((set) => ({
  uploading: 0,
  tasks: {},
  fileProgress: {},
  increment: () => set((state) => ({ uploading: state.uploading + 1 })),
  decrement: () => set((state) => ({ uploading: state.uploading - 1 })),

  startTask: (taskId, taskName, files) =>
    set((state) => {
      const taskFiles: Record<string, FileUploadState> = {}
      let totalBytes = 0

      files.forEach((f) => {
        taskFiles[f.fileId] = {
          fileId: f.fileId,
          name: f.name,
          loaded: 0,
          total: f.size,
          status: 'uploading',
        }
        totalBytes += f.size
      })

      const newTasks = {
        ...state.tasks,
        [taskId]: {
          taskId,
          name: taskName,
          loaded: 0,
          total: totalBytes,
          files: taskFiles,
        },
      }

      const newFileProgress = { ...state.fileProgress }
      files.forEach((f) => {
        newFileProgress[f.fileId] = taskFiles[f.fileId]
      })

      return {
        tasks: newTasks,
        fileProgress: newFileProgress,
      }
    }),

  updateFileProgress: (taskId, fileId, loaded) =>
    set((state) => {
      const task = state.tasks[taskId]
      if (!task) return {}

      const file = task.files[fileId]
      if (!file) return {}

      const updatedFile = { ...file, loaded }
      const updatedFiles = { ...task.files, [fileId]: updatedFile }

      const loadedBytes = Object.values(updatedFiles).reduce((sum, f) => sum + f.loaded, 0)

      return {
        tasks: {
          ...state.tasks,
          [taskId]: {
            ...task,
            loaded: loadedBytes,
            files: updatedFiles,
          },
        },
        fileProgress: {
          ...state.fileProgress,
          [fileId]: updatedFile,
        },
      }
    }),

  completeFile: (taskId, fileId) =>
    set((state) => {
      const task = state.tasks[taskId]
      if (!task) return {}

      const file = task.files[fileId]
      if (!file) return {}

      const updatedFile: FileUploadState = { ...file, status: 'completed', loaded: file.total }
      const updatedFiles = { ...task.files, [fileId]: updatedFile }

      const loadedBytes = Object.values(updatedFiles).reduce((sum, f) => sum + f.loaded, 0)

      return {
        tasks: {
          ...state.tasks,
          [taskId]: {
            ...task,
            loaded: loadedBytes,
            files: updatedFiles,
          },
        },
        fileProgress: {
          ...state.fileProgress,
          [fileId]: updatedFile,
        },
      }
    }),

  failFile: (taskId, fileId) =>
    set((state) => {
      const task = state.tasks[taskId]
      if (!task) return {}

      const file = task.files[fileId]
      if (!file) return {}

      const updatedFile: FileUploadState = { ...file, status: 'failed' }
      const updatedFiles = { ...task.files, [fileId]: updatedFile }

      const loadedBytes = Object.values(updatedFiles).reduce((sum, f) => sum + f.loaded, 0)

      return {
        tasks: {
          ...state.tasks,
          [taskId]: {
            ...task,
            loaded: loadedBytes,
            files: updatedFiles,
          },
        },
        fileProgress: {
          ...state.fileProgress,
          [fileId]: updatedFile,
        },
      }
    }),
}))
