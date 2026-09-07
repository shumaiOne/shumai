// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { activeUploads, uploadFilesWithUppy, isNetworkIssue } from './uploader'
import { acquireWakeLock, releaseWakeLock } from './wake-lock'
import { useUploadStore } from '@/ui/stores/upload'

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
  },
}))

vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      teams: {
        ':teamId': {
          upload: {
            tasks: {
              ':taskId': {
                $patch: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
              },
            },
          },
        },
      },
    },
  },
}))

import { Uppy, type Meta, type UppyFile } from '@uppy/core'
import { client } from '@/ui/api/client'
import { toast } from 'sonner'

describe('Uploader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    activeUploads.clear()
    useUploadStore.setState({ uploading: 0, tasks: {}, fileProgress: {} })
  })

  it('manages activeUploads and sends beacon on pagehide', () => {
    activeUploads.set('file-1', {
      teamId: 'team-1',
      taskId: 'task-1',
      fileId: 'file-1',
      key: 'files/test.mp4',
      uploadId: 'up-123',
    })

    const sendBeaconSpy = vi.fn().mockReturnValue(true)
    Object.defineProperty(navigator, 'sendBeacon', {
      value: sendBeaconSpy,
      configurable: true,
      writable: true,
    })

    window.dispatchEvent(new Event('pagehide'))

    expect(sendBeaconSpy).toHaveBeenCalledWith(
      '/api/teams/team-1/upload/tasks/task-1/abort',
      expect.any(Blob),
    )
    expect(activeUploads.size).toBe(0)
  })

  it('acquires and releases wake lock', async () => {
    const releaseSpy = vi.fn().mockResolvedValue(undefined)
    const requestSpy = vi.fn().mockResolvedValue({
      release: releaseSpy,
      addEventListener: vi.fn(),
    })

    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: requestSpy },
      configurable: true,
      writable: true,
    })

    await acquireWakeLock()
    expect(requestSpy).toHaveBeenCalledWith('screen')

    await releaseWakeLock()
    expect(releaseSpy).toHaveBeenCalled()
  })

  it('runs uploadFilesWithUppy with empty files without error', async () => {
    await expect(
      uploadFilesWithUppy({
        files: [],
        taskId: 'task-1',
        teamId: 'team-1',
        storageBackend: 's3',
      }),
    ).resolves.toBeUndefined()
  })

  it('awaits confirmation patch before uploadFilesWithUppy resolves', async () => {
    useUploadStore
      .getState()
      .startTask('task-1', 'task-1', [{ fileId: 'file-1', name: 'test.mp4', size: 100 }])

    let patchResolved = false
    vi.mocked(client.api.teams[':teamId'].upload.tasks[':taskId'].$patch).mockImplementationOnce(
      async () => {
        await new Promise((r) => setTimeout(r, 30))
        patchResolved = true
        return { ok: true, json: async () => ({}) } as unknown as Awaited<
          ReturnType<(typeof client.api.teams)[':teamId']['upload']['tasks'][':taskId']['$patch']>
        >
      },
    )

    const addFileSpy = vi.spyOn(Uppy.prototype, 'addFile').mockReturnValue('f1')

    const uploadPromise = uploadFilesWithUppy({
      files: [{ id: 'temp-1', file: new File(['content'], 'test.mp4', { type: 'video/mp4' }) }],
      taskId: 'task-1',
      teamId: 'team-1',
      storageBackend: 's3',
      createdAssets: [{ tempId: 'temp-1', assetId: 'file-1', key: 'files/test.mp4' }],
    })

    await new Promise((r) => setTimeout(r, 10))
    const capturedUppy = addFileSpy.mock.contexts[0] as Uppy
    expect(capturedUppy).toBeDefined()
    const mockFile = {
      name: 'test.mp4',
      meta: { fileId: 'file-1' },
    } as unknown as UppyFile<Meta, Record<string, never>>
    capturedUppy.emit('upload-success', mockFile, { status: 200 })
    capturedUppy.emit('complete', { successful: [mockFile], failed: [] })

    // At this point, patch is still in-flight
    expect(patchResolved).toBe(false)

    await uploadPromise
    expect(patchResolved).toBe(true)
    expect(useUploadStore.getState().tasks['task-1']?.files['file-1']?.status).toBe('completed')
    addFileSpy.mockRestore()
  })

  it('marks file as failed and shows toast when confirmation patch fails', async () => {
    useUploadStore
      .getState()
      .startTask('task-1', 'task-1', [{ fileId: 'file-1', name: 'test.mp4', size: 100 }])

    vi.mocked(client.api.teams[':teamId'].upload.tasks[':taskId'].$patch).mockResolvedValueOnce({
      ok: false,
      statusText: 'Server Error',
    } as unknown as Awaited<
      ReturnType<(typeof client.api.teams)[':teamId']['upload']['tasks'][':taskId']['$patch']>
    >)

    const addFileSpy = vi.spyOn(Uppy.prototype, 'addFile').mockReturnValue('f1')

    const uploadPromise = uploadFilesWithUppy({
      files: [{ id: 'temp-1', file: new File(['content'], 'test.mp4', { type: 'video/mp4' }) }],
      taskId: 'task-1',
      teamId: 'team-1',
      storageBackend: 's3',
      createdAssets: [{ tempId: 'temp-1', assetId: 'file-1', key: 'files/test.mp4' }],
    })

    await new Promise((r) => setTimeout(r, 10))
    const capturedUppy = addFileSpy.mock.contexts[0] as Uppy
    expect(capturedUppy).toBeDefined()
    const mockFile = {
      name: 'test.mp4',
      meta: { fileId: 'file-1' },
    } as unknown as UppyFile<Meta, Record<string, never>>
    capturedUppy.emit('upload-success', mockFile, { status: 200 })
    capturedUppy.emit('complete', { successful: [mockFile], failed: [] })

    await uploadPromise
    expect(useUploadStore.getState().tasks['task-1']?.files['file-1']?.status).toBe('failed')
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Failed to confirm upload'))
    addFileSpy.mockRestore()
  })

  describe('isNetworkIssue', () => {
    it('detects offline state and various network error indicators', () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      expect(isNetworkIssue(new Error('Any error'))).toBe(true)
      expect(isNetworkIssue()).toBe(true)

      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
      expect(isNetworkIssue(new Error('Failed to fetch'))).toBe(true)
      expect(isNetworkIssue(new Error('NetworkError when attempting to fetch resource.'))).toBe(
        true,
      )
      expect(isNetworkIssue(new Error('net::ERR_INTERNET_DISCONNECTED'))).toBe(true)
      expect(isNetworkIssue({ name: 'S3NetworkError', message: 'S3 request failed' })).toBe(true)
      expect(isNetworkIssue({ name: 'NetworkError', message: 'Network failed' })).toBe(true)
      expect(isNetworkIssue({ isNetworkError: true })).toBe(true)
      expect(isNetworkIssue({ request: { readyState: 4, status: 0 } })).toBe(true)

      expect(isNetworkIssue(new Error('403 Forbidden'))).toBe(false)
      expect(isNetworkIssue(new Error('400 Bad Request'))).toBe(false)
      expect(isNetworkIssue(null)).toBe(false)
      expect(isNetworkIssue(undefined)).toBe(false)
    })
  })

  it('pauses on network disconnect, does not report terminal failure, and resumes on back-online', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    useUploadStore
      .getState()
      .startTask('task-1', 'task-1', [{ fileId: 'file-1', name: 'test.mp4', size: 100 }])

    const addFileSpy = vi.spyOn(Uppy.prototype, 'addFile').mockReturnValue('f1')
    const retryAllSpy = vi.spyOn(Uppy.prototype, 'retryAll').mockResolvedValue(undefined as never)

    const uploadPromise = uploadFilesWithUppy({
      files: [{ id: 'temp-1', file: new File(['content'], 'test.mp4', { type: 'video/mp4' }) }],
      taskId: 'task-1',
      teamId: 'team-1',
      storageBackend: 's3',
      createdAssets: [{ tempId: 'temp-1', assetId: 'file-1', key: 'files/test.mp4' }],
    })

    await new Promise((r) => setTimeout(r, 10))
    const capturedUppy = addFileSpy.mock.contexts[0] as Uppy
    expect(capturedUppy).toBeDefined()

    const mockFile = {
      id: 'f1',
      name: 'test.mp4',
      meta: { fileId: 'file-1' },
    } as unknown as UppyFile<Meta, Record<string, never>>

    // 1. Simulate turning off Wi-Fi
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    window.dispatchEvent(new Event('offline'))

    const networkError = new Error('Failed to fetch')
    capturedUppy.emit('upload-error', mockFile, networkError)
    capturedUppy.emit('complete', {
      successful: [],
      failed: [{ ...mockFile, error: 'Failed to fetch' }],
    })

    // Wait a tick to verify nothing aborted or marked failed
    await new Promise((r) => setTimeout(r, 20))

    // File must NOT be marked failed in store, activeUploads must retain file, no PATCH with error
    expect(useUploadStore.getState().tasks['task-1']?.files['file-1']?.status).toBe('uploading')
    expect(activeUploads.has('file-1')).toBe(true)
    expect(client.api.teams[':teamId'].upload.tasks[':taskId'].$patch).not.toHaveBeenCalled()

    // 2. Simulate turning Wi-Fi back on
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    window.dispatchEvent(new Event('online'))

    expect(retryAllSpy).toHaveBeenCalled()

    // 3. Simulate successful upload on retry
    capturedUppy.emit('upload-success', mockFile, { status: 200 })
    capturedUppy.emit('complete', { successful: [mockFile], failed: [] })

    await uploadPromise

    // Confirm that confirmation patch was called without errorMessage
    expect(client.api.teams[':teamId'].upload.tasks[':taskId'].$patch).toHaveBeenCalledWith({
      param: { teamId: 'team-1', taskId: 'task-1' },
      json: { fileId: 'file-1' },
    })
    expect(useUploadStore.getState().tasks['task-1']?.files['file-1']?.status).toBe('completed')
    expect(activeUploads.size).toBe(0)

    addFileSpy.mockRestore()
    retryAllSpy.mockRestore()
  })

  it('fails permanently on non-network error and reports error to server', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    useUploadStore
      .getState()
      .startTask('task-1', 'task-1', [{ fileId: 'file-1', name: 'test.mp4', size: 100 }])

    const addFileSpy = vi.spyOn(Uppy.prototype, 'addFile').mockReturnValue('f1')

    const uploadPromise = uploadFilesWithUppy({
      files: [{ id: 'temp-1', file: new File(['content'], 'test.mp4', { type: 'video/mp4' }) }],
      taskId: 'task-1',
      teamId: 'team-1',
      storageBackend: 's3',
      createdAssets: [{ tempId: 'temp-1', assetId: 'file-1', key: 'files/test.mp4' }],
    })

    await new Promise((r) => setTimeout(r, 10))
    const capturedUppy = addFileSpy.mock.contexts[0] as Uppy
    expect(capturedUppy).toBeDefined()

    const mockFile = {
      id: 'f1',
      name: 'test.mp4',
      meta: { fileId: 'file-1' },
    } as unknown as UppyFile<Meta, Record<string, never>>

    const permanentError = new Error('403 Forbidden')
    capturedUppy.emit('upload-error', mockFile, permanentError)
    capturedUppy.emit('complete', {
      successful: [],
      failed: [{ ...mockFile, error: '403 Forbidden' }],
    })

    await uploadPromise

    expect(client.api.teams[':teamId'].upload.tasks[':taskId'].$patch).toHaveBeenCalledWith({
      param: { teamId: 'team-1', taskId: 'task-1' },
      json: { fileId: 'file-1', errorMessage: '403 Forbidden' },
    })
    expect(useUploadStore.getState().tasks['task-1']?.files['file-1']?.status).toBe('failed')
    expect(activeUploads.size).toBe(0)

    addFileSpy.mockRestore()
  })
})
