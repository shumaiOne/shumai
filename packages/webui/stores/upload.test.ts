import { describe, it, expect, beforeEach } from 'vitest'
import { useUploadStore } from './upload'

describe('useUploadStore', () => {
  beforeEach(() => {
    useUploadStore.setState({
      uploading: 0,
      tasks: {},
      fileProgress: {},
    })
  })

  it('starts task and tracks initial progress', () => {
    useUploadStore.getState().startTask('task-1', 'My Task', [
      { fileId: 'f1', name: 'video1.mp4', size: 1000 },
      { fileId: 'f2', name: 'video2.mp4', size: 2000 },
    ])

    const state = useUploadStore.getState()
    expect(state.tasks['task-1']).toBeDefined()
    expect(state.tasks['task-1'].name).toBe('My Task')
    expect(state.tasks['task-1'].total).toBe(3000)
    expect(state.tasks['task-1'].loaded).toBe(0)
    expect(state.tasks['task-1'].files['f1'].status).toBe('uploading')
    expect(state.tasks['task-1'].files['f2'].status).toBe('uploading')
  })

  it('updates file progress and task loaded bytes', () => {
    useUploadStore.getState().startTask('task-1', 'My Task', [
      { fileId: 'f1', name: 'video1.mp4', size: 1000 },
      { fileId: 'f2', name: 'video2.mp4', size: 2000 },
    ])

    useUploadStore.getState().updateFileProgress('task-1', 'f1', 500, 250, 2)
    expect(useUploadStore.getState().tasks['task-1'].loaded).toBe(500)
    expect(useUploadStore.getState().fileProgress['f1'].loaded).toBe(500)
    expect(useUploadStore.getState().fileProgress['f1'].speed).toBe(250)
    expect(useUploadStore.getState().fileProgress['f1'].eta).toBe(2)

    useUploadStore.getState().completeFile('task-1', 'f1')
    expect(useUploadStore.getState().tasks['task-1'].files['f1'].status).toBe('completed')
    expect(useUploadStore.getState().tasks['task-1'].files['f1'].loaded).toBe(1000)
    expect(useUploadStore.getState().tasks['task-1'].loaded).toBe(1000)
  })

  it('cancelTask marks incomplete files as failed and decrements uploading count', () => {
    useUploadStore.setState({ uploading: 3 })
    useUploadStore.getState().startTask('task-1', 'My Task', [
      { fileId: 'f1', name: 'done.mp4', size: 1000 },
      { fileId: 'f2', name: 'stuck1.mp4', size: 2000 },
      { fileId: 'f3', name: 'stuck2.mp4', size: 3000 },
    ])

    // f1 completes (automatically decrements uploading from 3 to 2)
    useUploadStore.getState().completeFile('task-1', 'f1')
    expect(useUploadStore.getState().uploading).toBe(2)

    // cancelTask is called
    useUploadStore.getState().cancelTask('task-1')

    const task = useUploadStore.getState().tasks['task-1']
    expect(task.files['f1'].status).toBe('completed')
    expect(task.files['f2'].status).toBe('failed')
    expect(task.files['f3'].status).toBe('failed')
    expect(useUploadStore.getState().fileProgress['f2'].status).toBe('failed')
    expect(useUploadStore.getState().fileProgress['f3'].status).toBe('failed')
    expect(useUploadStore.getState().uploading).toBe(0)
  })

  it('does not decrement uploading count twice if completeFile or failFile is called after cancelTask', () => {
    useUploadStore.setState({ uploading: 2 })
    useUploadStore.getState().startTask('task-1', 'My Task', [
      { fileId: 'f1', name: 'in-flight.mp4', size: 1000 },
      { fileId: 'f2', name: 'waiting.mp4', size: 2000 },
    ])

    // Cancel task while f1 confirmation was in-flight
    useUploadStore.getState().cancelTask('task-1')
    expect(useUploadStore.getState().uploading).toBe(0)
    expect(useUploadStore.getState().tasks['task-1'].files['f1'].status).toBe('failed')

    // In-flight confirmation settles late
    useUploadStore.getState().completeFile('task-1', 'f1')
    expect(useUploadStore.getState().uploading).toBe(0)

    // Another late error settles
    useUploadStore.getState().failFile('task-1', 'f2')
    expect(useUploadStore.getState().uploading).toBe(0)
  })

  it('cancelTask gracefully handles non-existent task', () => {
    useUploadStore.setState({ uploading: 1 })
    useUploadStore.getState().cancelTask('non-existent')
    expect(useUploadStore.getState().uploading).toBe(1)
  })
})
