// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { activeUploads, uploadFilesWithUppy } from './uploader'
import { acquireWakeLock, releaseWakeLock } from './wake-lock'
import { useUploadStore } from '@/ui/stores/upload'

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
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
})
