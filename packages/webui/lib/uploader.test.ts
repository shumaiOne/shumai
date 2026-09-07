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
})
