// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  activeUploads,
  uploadFilesWithUppy,
  isNetworkIssue,
  isLocalhostStorageMismatch,
  calculateBackoffDelay,
  MAX_RETRY_DELAY_MS,
  BASE_RETRY_DELAY_MS,
} from './uploader'
import { acquireWakeLock, releaseWakeLock } from './wake-lock'
import { useUploadStore } from '@/ui/stores/upload'
import { m } from '@/ui/paraglide/messages.js'

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
  const initialLocation = window.location

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: initialLocation,
      configurable: true,
      writable: true,
    })
  })

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

  describe('isLocalhostStorageMismatch', () => {
    it('detects mismatch when upload URL is localhost and window location is remote', () => {
      // In happy-dom window.location defaults to localhost:3000
      Object.defineProperty(window, 'location', {
        value: {
          hostname: '192.168.1.100',
          origin: 'http://192.168.1.100:3000',
        },
        configurable: true,
        writable: true,
      })

      expect(isLocalhostStorageMismatch('http://localhost:3000/files/shumai/files/1.png')).toBe(
        true,
      )
      expect(isLocalhostStorageMismatch('http://127.0.0.1:3000/files/shumai/files/1.png')).toBe(
        true,
      )
      expect(isLocalhostStorageMismatch('http://[::1]:3000/files/shumai/files/1.png')).toBe(true)
      expect(isLocalhostStorageMismatch('http://0.0.0.0:3000/files/shumai/files/1.png')).toBe(true)

      // Remote upload URL with remote window -> no mismatch
      expect(isLocalhostStorageMismatch('http://192.168.1.100:3000/files/shumai/files/1.png')).toBe(
        false,
      )
      expect(isLocalhostStorageMismatch('https://s3.amazonaws.com/bucket/files/1.png')).toBe(false)
      expect(isLocalhostStorageMismatch('/files/shumai/files/1.png')).toBe(false)
      expect(isLocalhostStorageMismatch(undefined)).toBe(false)
      expect(isLocalhostStorageMismatch('')).toBe(false)
    })

    it('returns false when window location itself is localhost', () => {
      Object.defineProperty(window, 'location', {
        value: {
          hostname: 'localhost',
          origin: 'http://localhost:3000',
        },
        configurable: true,
        writable: true,
      })

      expect(isLocalhostStorageMismatch('http://localhost:3000/files/shumai/files/1.png')).toBe(
        false,
      )
      expect(isLocalhostStorageMismatch('http://127.0.0.1:3000/files/shumai/files/1.png')).toBe(
        false,
      )
    })
  })

  describe('calculateBackoffDelay', () => {
    it('increases delay with attempts and caps at MAX_RETRY_DELAY_MS (60s)', () => {
      const delay1 = calculateBackoffDelay(1)
      expect(delay1).toBeGreaterThanOrEqual(1700)
      expect(delay1).toBeLessThanOrEqual(2300)

      const delay2 = calculateBackoffDelay(2)
      expect(delay2).toBeGreaterThanOrEqual(3400)
      expect(delay2).toBeLessThanOrEqual(4600)

      const delay3 = calculateBackoffDelay(3)
      expect(delay3).toBeGreaterThanOrEqual(6800)
      expect(delay3).toBeLessThanOrEqual(9200)

      const delay10 = calculateBackoffDelay(10)
      expect(delay10).toBeGreaterThanOrEqual(Math.round(MAX_RETRY_DELAY_MS * 0.85))
      expect(delay10).toBeLessThanOrEqual(MAX_RETRY_DELAY_MS)
    })

    it('never returns less than baseDelayMs', () => {
      const delay0 = calculateBackoffDelay(0)
      expect(delay0).toBeGreaterThanOrEqual(BASE_RETRY_DELAY_MS)
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
    expect(toast.error).toHaveBeenCalledWith(m.failed_upload_file_with_name({ name: 'test.mp4' }))
    expect(useUploadStore.getState().tasks['task-1']?.files['file-1']?.status).toBe('failed')
    expect(activeUploads.size).toBe(0)

    addFileSpy.mockRestore()
  })

  it('shows S3 endpoint localhost error toast without retrying when remote user encounters localhost upload URL', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        hostname: '192.168.1.100',
        origin: 'http://192.168.1.100:3000',
      },
      configurable: true,
      writable: true,
    })
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })

    useUploadStore
      .getState()
      .startTask('task-1', 'task-1', [{ fileId: 'file-1', name: 'remote.mp4', size: 100 }])

    const addFileSpy = vi.spyOn(Uppy.prototype, 'addFile').mockReturnValue('f1')
    const retryAllSpy = vi.spyOn(Uppy.prototype, 'retryAll')

    const uploadPromise = uploadFilesWithUppy({
      files: [{ id: 'temp-1', file: new File(['content'], 'remote.mp4', { type: 'video/mp4' }) }],
      taskId: 'task-1',
      teamId: 'team-1',
      storageBackend: 'local',
      createdAssets: [{ tempId: 'temp-1', assetId: 'file-1', key: 'files/remote.mp4' }],
      presignedUrls: [
        {
          id: 'temp-1',
          fileId: 'file-1',
          url: 'http://localhost:3000/files/shumai/files/remote.mp4',
        },
      ],
    })

    await new Promise((r) => setTimeout(r, 10))
    const capturedUppy = addFileSpy.mock.contexts[0] as Uppy
    expect(capturedUppy).toBeDefined()

    const mockFile = {
      id: 'f1',
      name: 'remote.mp4',
      meta: {
        fileId: 'file-1',
        url: 'http://localhost:3000/files/shumai/files/remote.mp4',
      },
    } as unknown as UppyFile<Meta, Record<string, never>>

    const networkError = new Error('Failed to fetch')
    capturedUppy.emit('upload-error', mockFile, networkError)
    capturedUppy.emit('complete', {
      successful: [],
      failed: [{ ...mockFile, error: networkError.message }],
    })

    await uploadPromise

    // Should NOT retry when localhost mismatch is detected
    expect(retryAllSpy).not.toHaveBeenCalled()

    // Must show specific AWS_ENDPOINT_URL_S3 toast
    expect(toast.error).toHaveBeenCalledWith(m.upload_failed_s3_endpoint_localhost(), {
      id: 's3-endpoint-localhost-mismatch',
      duration: 10000,
    })

    expect(client.api.teams[':teamId'].upload.tasks[':taskId'].$patch).toHaveBeenCalledWith({
      param: { teamId: 'team-1', taskId: 'task-1' },
      json: { fileId: 'file-1', errorMessage: 'Failed to fetch' },
    })
    expect(useUploadStore.getState().tasks['task-1']?.files['file-1']?.status).toBe('failed')
    expect(activeUploads.size).toBe(0)

    addFileSpy.mockRestore()
    retryAllSpy.mockRestore()
  })

  it('retries continuously on transient network errors while online without capping at 3 attempts', async () => {
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

    const networkError = new Error('Failed to fetch')

    // Simulate 5 consecutive network errors while online (previously would have aborted after 3)
    for (let i = 1; i <= 5; i++) {
      capturedUppy.emit('upload-error', mockFile, networkError)
    }

    // Should still be active and uploading, NOT permanently failed
    expect(useUploadStore.getState().tasks['task-1']?.files['file-1']?.status).toBe('uploading')
    expect(activeUploads.has('file-1')).toBe(true)
    expect(client.api.teams[':teamId'].upload.tasks[':taskId'].$patch).not.toHaveBeenCalled()

    // Now succeed on retry
    capturedUppy.emit('upload-success', mockFile, { status: 200 })
    capturedUppy.emit('complete', { successful: [mockFile], failed: [] })

    await uploadPromise

    expect(useUploadStore.getState().tasks['task-1']?.files['file-1']?.status).toBe('completed')
    expect(activeUploads.size).toBe(0)

    addFileSpy.mockRestore()
    retryAllSpy.mockRestore()
  })

  it('halts retry loop and fails permanently when S3 returns 403 (presigned URL expired)', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    useUploadStore
      .getState()
      .startTask('task-1', 'task-1', [{ fileId: 'file-1', name: 'expired.mp4', size: 100 }])

    const addFileSpy = vi.spyOn(Uppy.prototype, 'addFile').mockReturnValue('f1')

    const uploadPromise = uploadFilesWithUppy({
      files: [{ id: 'temp-1', file: new File(['content'], 'expired.mp4', { type: 'video/mp4' }) }],
      taskId: 'task-1',
      teamId: 'team-1',
      storageBackend: 's3',
      createdAssets: [{ tempId: 'temp-1', assetId: 'file-1', key: 'files/expired.mp4' }],
    })

    await new Promise((r) => setTimeout(r, 10))
    const capturedUppy = addFileSpy.mock.contexts[0] as Uppy

    const mockFile = {
      id: 'f1',
      name: 'expired.mp4',
      meta: { fileId: 'file-1' },
    } as unknown as UppyFile<Meta, Record<string, never>>

    // S3 returns 403 when presigned URL expires after 12h
    const expiredError = Object.assign(new Error('Request has expired'), { status: 403 })
    capturedUppy.emit('upload-error', mockFile, expiredError)
    capturedUppy.emit('complete', {
      successful: [],
      failed: [{ ...mockFile, error: 'Request has expired' }],
    })

    await uploadPromise

    expect(client.api.teams[':teamId'].upload.tasks[':taskId'].$patch).toHaveBeenCalledWith({
      param: { teamId: 'team-1', taskId: 'task-1' },
      json: { fileId: 'file-1', errorMessage: 'Request has expired' },
    })
    expect(toast.error).toHaveBeenCalledWith(
      m.failed_upload_file_with_name({ name: 'expired.mp4' }),
    )
    expect(useUploadStore.getState().tasks['task-1']?.files['file-1']?.status).toBe('failed')
    expect(activeUploads.size).toBe(0)

    addFileSpy.mockRestore()
  })
})
