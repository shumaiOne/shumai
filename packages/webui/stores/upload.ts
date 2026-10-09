import { create } from 'zustand'

export interface FileUploadState {
  fileId: string
  name: string
  loaded: number
  total: number
  status: 'uploading' | 'completed' | 'failed'
  /** A failed file whose bytes are still in this tab, so Retry can upload it again. */
  retryable?: boolean
}

export interface TaskUploadState {
  taskId: string
  name: string
  loaded: number
  total: number
  files: Record<string, FileUploadState>
}

const DISMISSED_KEY = 'shumai:dismissed-upload-tasks'
const MAX_DISMISSED = 500

/** Dismissed task ids survive a reload (a stale task stays on the server). Storage may be blocked. */
function loadDismissed(): Record<string, true> {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(DISMISSED_KEY)
    const ids = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(ids)
      ? Object.fromEntries(
          ids.filter((i): i is string => typeof i === 'string').map((i) => [i, true]),
        )
      : {}
  } catch {
    return {}
  }
}

function saveDismissed(dismissed: Record<string, true>) {
  try {
    const ids = Object.keys(dismissed).slice(-MAX_DISMISSED)
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids))
  } catch {
    // Private mode or blocked storage: dismissal then lasts until the page reloads.
  }
}

type UploadStore = {
  uploading: number
  /** Tasks the user dismissed from the Uploads panel. */
  dismissedTaskIds: Record<string, true>
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
  failFile: (taskId: string, fileId: string, opts?: { retryable?: boolean }) => void
  /** Drop one file from a task (after a retry replaced it); an emptied task is dropped too. */
  removeFile: (taskId: string, fileId: string) => void
  /** Hide a task from the Uploads panel for good. */
  dismissTask: (taskId: string) => void
}

export const useUploadStore = create<UploadStore>((set) => ({
  uploading: 0,
  dismissedTaskIds: loadDismissed(),
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

  failFile: (taskId, fileId, opts) =>
    set((state) => {
      const task = state.tasks[taskId]
      if (!task) return {}

      const file = task.files[fileId]
      if (!file) return {}

      const updatedFile: FileUploadState = {
        ...file,
        status: 'failed',
        retryable: opts?.retryable === true,
      }
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

  removeFile: (taskId, fileId) =>
    set((state) => {
      const task = state.tasks[taskId]
      if (!task || !task.files[fileId]) return {}

      const { [fileId]: _removed, ...restFiles } = task.files
      void _removed
      const { [fileId]: _progress, ...restProgress } = state.fileProgress
      void _progress

      if (Object.keys(restFiles).length === 0) {
        const { [taskId]: _task, ...restTasks } = state.tasks
        void _task
        return { tasks: restTasks, fileProgress: restProgress }
      }

      const files = Object.values(restFiles)
      return {
        tasks: {
          ...state.tasks,
          [taskId]: {
            ...task,
            files: restFiles,
            loaded: files.reduce((sum, f) => sum + f.loaded, 0),
            total: files.reduce((sum, f) => sum + f.total, 0),
          },
        },
        fileProgress: restProgress,
      }
    }),

  dismissTask: (taskId) =>
    set((state) => {
      const task = state.tasks[taskId]
      const fileProgress = { ...state.fileProgress }
      for (const id of Object.keys(task?.files ?? {})) delete fileProgress[id]
      const { [taskId]: _task, ...restTasks } = state.tasks
      void _task
      const dismissedTaskIds = { ...state.dismissedTaskIds, [taskId]: true as const }
      saveDismissed(dismissedTaskIds)
      return { tasks: restTasks, fileProgress, dismissedTaskIds }
    }),
}))
