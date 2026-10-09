import type { CreateUploadTaskRequest, TaskInfo } from '@shumai/dtos'
import { ulid } from 'ulid'
import { client } from '@/ui/api/client'
import { useUploadStore, type TaskUploadState } from '@/ui/stores/upload'
import { retryableUploads, uploadFilesWithUppy, type FileWithId } from './uploader'

export type TaskDisplayState = 'uploading' | 'done' | 'failed'

/**
 * What the Uploads panel shows for a task. Files still in flight win (the task is not settled),
 * then any failed file or a server-side "failed" status (including the stale sweep) gives
 * "failed"; otherwise the task is done once every byte and the server's count agree.
 */
export function taskDisplayState(
  task: Pick<TaskInfo, 'total' | 'uploaded' | 'status'>,
  client?: Pick<TaskUploadState, 'loaded' | 'total' | 'files'>,
): TaskDisplayState {
  const files = client ? Object.values(client.files) : []
  if (files.some((f) => f.status === 'uploading')) return 'uploading'
  if (files.some((f) => f.status === 'failed')) return 'failed'
  if (task.status === 'failed') return 'failed'
  const done = client
    ? client.loaded === client.total && task.uploaded === task.total
    : task.uploaded === task.total
  return done ? 'done' : 'uploading'
}

/** Failed files of a task that Retry can upload again from this tab. */
export function retryableFileIds(client: Pick<TaskUploadState, 'files'> | undefined): string[] {
  return Object.values(client?.files ?? {})
    .filter((f) => f.status === 'failed' && f.retryable)
    .map((f) => f.fileId)
}

/** The folder tree an upload task expects, rebuilt from each file's relative path. */
export function buildRetryTree(items: FileWithId[]): CreateUploadTaskRequest['files'] {
  const root: CreateUploadTaskRequest['files'] = []
  const directories = new Map<string, CreateUploadTaskRequest['files']>()
  for (const item of items) {
    const path = (item.file.webkitRelativePath || item.file.name).split('/')
    const fileName = path.pop()!
    let level = root
    let currentPath = ''
    for (const dir of path) {
      currentPath = `${currentPath}/${dir}`
      let children = directories.get(currentPath)
      if (!children) {
        children = []
        level.push({ name: dir, type: 'folder', id: ulid(), children, size: 0 })
        directories.set(currentPath, children)
      }
      level = children
    }
    level.push({
      name: fileName,
      size: item.file.size,
      type: 'file',
      id: item.id,
      children: [],
      mediaType: item.file.type,
    })
  }
  return root
}

/**
 * Upload a task's failed files again. The failed placeholders were removed by the server, so each
 * file goes up as a fresh task under its original folder; the failed entries leave the old task.
 * Resolves once the new uploads settle. Rejects (leaving the failed state untouched) if the new
 * task cannot be created.
 */
export async function retryFailedUploads(
  teamId: string,
  taskId: string,
  onFileFinished?: (fileId: string) => void | Promise<void>,
): Promise<number> {
  const store = useUploadStore.getState()
  const failedIds = retryableFileIds(store.tasks[taskId]).filter((id) => retryableUploads.has(id))
  if (failedIds.length === 0) return 0

  // A task normally targets one folder; group defensively so each retry lands where it started.
  const byParent = new Map<string, Array<{ oldId: string; item: FileWithId }>>()
  for (const oldId of failedIds) {
    const entry = retryableUploads.get(oldId)!
    const group = byParent.get(entry.parentId) ?? []
    group.push({ oldId, item: { id: ulid(), file: entry.file } })
    byParent.set(entry.parentId, group)
  }

  let restarted = 0
  const uploads: Promise<void>[] = []
  for (const [parentId, group] of byParent) {
    const res = await client.api.teams[':teamId'].upload.tasks.$post({
      param: { teamId },
      json: { parentId, files: buildRetryTree(group.map((g) => g.item)) },
    })
    if (!res.ok) throw new Error('Failed to create upload task')
    const data = await res.json()

    const progressInfo = group.map(({ item }) => {
      const asset = data.createdAssets?.find((a) => a.tempId === item.id)
      const url = data.presignedUrls?.find((p) => p.id === item.id)
      return {
        fileId: asset?.assetId || url?.fileId || item.id,
        name: item.file.name,
        size: item.file.size,
      }
    })
    const name = group.length === 1 ? group[0].item.file.name : `${group.length} Items`
    useUploadStore.getState().startTask(data.taskId, name, progressInfo)

    for (const { oldId } of group) {
      useUploadStore.getState().removeFile(taskId, oldId)
      retryableUploads.delete(oldId)
    }
    restarted += group.length

    uploads.push(
      uploadFilesWithUppy({
        files: group.map((g) => g.item),
        taskId: data.taskId,
        teamId,
        storageBackend: data.storageBackend,
        createdAssets: data.createdAssets,
        presignedUrls: data.presignedUrls,
        parentId,
        onFileFinished,
      }),
    )
  }

  await Promise.allSettled(uploads)
  return restarted
}

/** Dismiss a task: forget its retry data and hide it from the panel. */
export function dismissUploadTask(taskId: string) {
  const store = useUploadStore.getState()
  for (const id of Object.keys(store.tasks[taskId]?.files ?? {})) retryableUploads.delete(id)
  store.dismissTask(taskId)
}
