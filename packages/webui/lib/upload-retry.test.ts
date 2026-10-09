// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUploadStore } from '@/ui/stores/upload'

const post = vi.fn()
vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      teams: { ':teamId': { upload: { tasks: { $post: (...a: unknown[]) => post(...a) } } } },
    },
  },
}))

const uploadFilesWithUppy = vi.fn().mockResolvedValue(undefined)
vi.mock('./uploader', () => {
  const retryableUploads = new Map()
  return {
    retryableUploads,
    uploadFilesWithUppy: (...a: unknown[]) => uploadFilesWithUppy(...a),
  }
})

import { retryableUploads } from './uploader'
import {
  buildRetryTree,
  dismissUploadTask,
  retryFailedUploads,
  retryableFileIds,
  taskDisplayState,
} from './upload-retry'

const file = (name: string, size = 10, relativePath = '') => {
  const f = new File([new Uint8Array(size)], name)
  if (relativePath) Object.defineProperty(f, 'webkitRelativePath', { value: relativePath })
  return f
}

const startTwoFileTask = () =>
  useUploadStore.getState().startTask('t1', '2 Items', [
    { fileId: 'a', name: 'a.jpg', size: 10 },
    { fileId: 'b', name: 'b.jpg', size: 20 },
  ])

beforeEach(() => {
  vi.clearAllMocks()
  retryableUploads.clear()
  localStorage.clear()
  useUploadStore.setState({ uploading: 0, tasks: {}, fileProgress: {}, dismissedTaskIds: {} })
})

describe('taskDisplayState', () => {
  const task = { total: 2, uploaded: 2 }

  it('is done when server and client agree everything arrived', () => {
    startTwoFileTask()
    const s = useUploadStore.getState()
    s.completeFile('t1', 'a')
    s.completeFile('t1', 'b')
    expect(taskDisplayState(task, useUploadStore.getState().tasks.t1)).toBe('done')
    expect(taskDisplayState(task)).toBe('done')
  })

  it('stays uploading while any file is in flight, even if another already failed', () => {
    startTwoFileTask()
    useUploadStore.getState().failFile('t1', 'a')
    expect(taskDisplayState({ total: 2, uploaded: 0 }, useUploadStore.getState().tasks.t1)).toBe(
      'uploading',
    )
  })

  it('is failed once everything settled and a file failed', () => {
    startTwoFileTask()
    const s = useUploadStore.getState()
    s.failFile('t1', 'a')
    s.completeFile('t1', 'b')
    expect(taskDisplayState({ total: 2, uploaded: 1 }, useUploadStore.getState().tasks.t1)).toBe(
      'failed',
    )
  })

  it('is failed when the server marked the task failed (stale sweep)', () => {
    expect(taskDisplayState({ total: 3, uploaded: 1, status: 'failed' })).toBe('failed')
  })

  it('is uploading when partial and not failed', () => {
    expect(taskDisplayState({ total: 3, uploaded: 1, status: 'uploading' })).toBe('uploading')
  })
})

describe('store transitions for failed files', () => {
  it('failFile records whether the file can be retried', () => {
    startTwoFileTask()
    const s = useUploadStore.getState()
    s.failFile('t1', 'a', { retryable: true })
    s.failFile('t1', 'b')
    const files = useUploadStore.getState().tasks.t1.files
    expect(files.a).toMatchObject({ status: 'failed', retryable: true })
    expect(files.b).toMatchObject({ status: 'failed', retryable: false })
    expect(retryableFileIds(useUploadStore.getState().tasks.t1)).toEqual(['a'])
  })

  it('removeFile drops one file, recomputes totals and drops an emptied task', () => {
    startTwoFileTask()
    useUploadStore.getState().removeFile('t1', 'a')
    const task = useUploadStore.getState().tasks.t1
    expect(Object.keys(task.files)).toEqual(['b'])
    expect(task.total).toBe(20)
    useUploadStore.getState().removeFile('t1', 'b')
    expect(useUploadStore.getState().tasks.t1).toBeUndefined()
    expect(useUploadStore.getState().fileProgress).toEqual({})
  })

  it('dismissTask hides the task and remembers it across reloads', () => {
    startTwoFileTask()
    useUploadStore.getState().dismissTask('t1')
    expect(useUploadStore.getState().tasks.t1).toBeUndefined()
    expect(useUploadStore.getState().dismissedTaskIds).toEqual({ t1: true })
    expect(JSON.parse(localStorage.getItem('shumai:dismissed-upload-tasks')!)).toEqual(['t1'])
  })

  it('dismissUploadTask also forgets retry data', () => {
    startTwoFileTask()
    retryableUploads.set('a', { file: file('a.jpg'), teamId: 'team', parentId: 'p' })
    dismissUploadTask('t1')
    expect(retryableUploads.size).toBe(0)
    expect(useUploadStore.getState().dismissedTaskIds.t1).toBe(true)
  })
})

describe('buildRetryTree', () => {
  it('rebuilds nested folders from relative paths and shares common folders', () => {
    const tree = buildRetryTree([
      { id: '1', file: file('a.jpg', 5, 'trip/day1/a.jpg') },
      { id: '2', file: file('b.jpg', 6, 'trip/day1/b.jpg') },
      { id: '3', file: file('c.jpg', 7) },
    ])
    expect(tree).toHaveLength(2)
    const trip = tree[0]
    expect(trip).toMatchObject({ name: 'trip', type: 'folder' })
    expect(trip.children).toHaveLength(1)
    const day1 = trip.children[0]
    expect(day1.children.map((c) => c.name)).toEqual(['a.jpg', 'b.jpg'])
    expect(tree[1]).toMatchObject({ name: 'c.jpg', type: 'file', id: '3', size: 7 })
  })
})

describe('retryFailedUploads', () => {
  const setupFailedTask = () => {
    startTwoFileTask()
    const s = useUploadStore.getState()
    s.failFile('t1', 'a', { retryable: true })
    s.completeFile('t1', 'b')
    retryableUploads.set('a', { file: file('a.jpg'), teamId: 'team', parentId: 'folder-1' })
  }

  it('does nothing when no failed file can be retried', async () => {
    startTwoFileTask()
    expect(await retryFailedUploads('team', 't1')).toBe(0)
    expect(post).not.toHaveBeenCalled()
  })

  it('creates a fresh task for the failed file and moves it out of the old one', async () => {
    setupFailedTask()
    post.mockResolvedValue({
      ok: true,
      json: async () => ({
        taskId: 't2',
        storageBackend: 'local',
        presignedUrls: [],
        createdAssets: undefined,
      }),
    })
    const restarted = await retryFailedUploads('team', 't1')
    expect(restarted).toBe(1)

    const body = post.mock.calls[0][0]
    expect(body.param).toEqual({ teamId: 'team' })
    expect(body.json.parentId).toBe('folder-1')
    expect(body.json.files[0]).toMatchObject({ name: 'a.jpg', type: 'file' })

    const { tasks } = useUploadStore.getState()
    expect(Object.keys(tasks.t1.files)).toEqual(['b'])
    expect(tasks.t2.files).toBeDefined()
    expect(Object.values(tasks.t2.files)[0]).toMatchObject({ name: 'a.jpg', status: 'uploading' })
    expect(retryableUploads.has('a')).toBe(false)
    expect(uploadFilesWithUppy).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 't2', teamId: 'team', parentId: 'folder-1' }),
    )
  })

  it('keeps the failed state when the new task cannot be created', async () => {
    setupFailedTask()
    post.mockResolvedValue({ ok: false })
    await expect(retryFailedUploads('team', 't1')).rejects.toThrow()
    expect(useUploadStore.getState().tasks.t1.files.a.status).toBe('failed')
    expect(retryableUploads.has('a')).toBe(true)
    expect(uploadFilesWithUppy).not.toHaveBeenCalled()
  })
})
