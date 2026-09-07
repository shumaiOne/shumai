import { Uppy } from '@uppy/core'
import AwsS3 from '@uppy/aws-s3'
import XHRUpload from '@uppy/xhr-upload'
import type { PresignedUrl } from '@shumai/dtos'
import { client } from '@/ui/api/client'
import { useUploadStore } from '@/ui/stores/upload'
import { toast } from 'sonner'
import { acquireWakeLock, releaseWakeLock } from './wake-lock'

export type FileWithId = {
  id: string
  file: File
}

export interface ActiveUploadFile {
  teamId: string
  taskId: string
  fileId: string
  key?: string
  uploadId?: string
}

export const activeUploads = new Map<string, ActiveUploadFile>()

// Setup beforeunload and pagehide listeners once
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (e) => {
    if (useUploadStore.getState().uploading > 0 || activeUploads.size > 0) {
      e.preventDefault()
      e.returnValue = ''
    }
  })

  window.addEventListener('pagehide', () => {
    if (activeUploads.size === 0) return

    for (const item of activeUploads.values()) {
      const url = `/api/teams/${item.teamId}/upload/tasks/${item.taskId}/abort`
      const payload = JSON.stringify({
        fileId: item.fileId,
        uploadId: item.uploadId,
        key: item.key,
      })

      try {
        if ('sendBeacon' in navigator) {
          const blob = new Blob([payload], { type: 'application/json' })
          navigator.sendBeacon(url, blob)
        } else {
          fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true,
            credentials: 'include',
          })
        }
      } catch (err) {
        console.warn('Failed to send abort beacon:', err)
      }
    }
    activeUploads.clear()
  })
}

export function isNetworkIssue(error?: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return true
  }
  if (!error) return false
  const err = error as Record<string, unknown>
  if (err.isNetworkError === true) return true
  if (err.name === 'S3NetworkError' || err.name === 'NetworkError') return true
  const msg = (typeof err.message === 'string' ? err.message : '').toLowerCase()
  if (
    msg.includes('network error') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed') ||
    msg.includes('err_internet_disconnected')
  ) {
    return true
  }
  const req = err.request as Record<string, unknown> | undefined
  if (req && req.status === 0) return true
  return false
}

export interface StartUploadOptions {
  files: FileWithId[]
  taskId: string
  teamId: string
  storageBackend: 's3' | 'local'
  createdAssets?: Array<{ tempId: string; assetId: string; key?: string }>
  presignedUrls?: PresignedUrl[]
  onFileFinished?: (fileId: string) => void | Promise<void>
}

export async function uploadFilesWithUppy({
  files,
  taskId,
  teamId,
  storageBackend,
  createdAssets = [],
  presignedUrls = [],
  onFileFinished,
}: StartUploadOptions): Promise<void> {
  if (!files.length) return

  await acquireWakeLock()

  const store = useUploadStore.getState()
  const { increment, decrement, updateFileProgress, completeFile, failFile } = store

  // Build lookup maps
  const assetByTempId = new Map<string, { assetId: string; key?: string }>()
  for (const a of createdAssets) {
    assetByTempId.set(a.tempId, { assetId: a.assetId, key: a.key })
  }

  const urlByTempId = new Map<string, { url: string; fileId: string }>()
  for (const p of presignedUrls) {
    if (p.id) {
      urlByTempId.set(p.id, { url: p.url || '', fileId: p.fileId || '' })
    }
  }

  const fileIdByKey = new Map<string, string>()

  const uppy = new Uppy({
    autoProceed: true,
    allowMultipleUploadBatches: false,
  })

  if (storageBackend === 's3') {
    uppy.use(AwsS3, {
      shouldUseMultipart: (file) => (file.size || 0) > 100 * 1024 * 1024,
      getChunkSize: ({ size }) => {
        if (size > 5 * 1024 * 1024 * 1024) return 32 * 1024 * 1024 // 32MB
        if (size > 1 * 1024 * 1024 * 1024) return 16 * 1024 * 1024 // 16MB
        return 8 * 1024 * 1024 // 8MB
      },
      generateObjectKey: (file) => (file.meta.key as string) || file.name,
      signRequest: async (req) => {
        const uploadId = 'uploadId' in req ? req.uploadId : undefined
        const partNumber = 'partNumber' in req ? req.partNumber : undefined
        const fileId = fileIdByKey.get(req.key)

        if (fileId && uploadId) {
          const active = activeUploads.get(fileId)
          if (active) {
            active.uploadId = uploadId
          }
        }

        const res = await fetch(`/api/teams/${teamId}/upload/sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: req.key,
            method: req.method,
            uploadId,
            partNumber,
            fileId,
          }),
          credentials: 'include',
        })

        if (!res.ok) {
          throw new Error(`Failed to sign request: ${res.statusText}`)
        }

        const data = (await res.json()) as { url: string }
        return { url: data.url }
      },
    })
  } else {
    uppy.use(XHRUpload, {
      endpoint: (fileOrBundle) => {
        const file = Array.isArray(fileOrBundle) ? fileOrBundle[0] : fileOrBundle
        return (file?.meta?.url as string) || ''
      },
      method: 'PUT',
      formData: false,
      headers: (file) => ({
        'Content-Type': file.type || 'application/octet-stream',
      }),
      getResponseData: (xhr) => {
        try {
          return xhr.responseText ? JSON.parse(xhr.responseText) : {}
        } catch {
          return {}
        }
      },
      shouldRetry: () => false,
      limit: 5,
    })
  }

  const confirmationPromises = new Map<string, Promise<void>>()
  const retryCounts = new Map<string, number>()
  const MAX_ONLINE_RETRIES = 3
  let retryTimeout: ReturnType<typeof setTimeout> | null = null

  const triggerRetry = () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.log('[Uploader] Delaying retry because browser is currently offline.')
      return
    }
    console.log('[Uploader] Calling uppy.retryAll() to resume paused/failed uploads...')
    uppy.retryAll().catch((err: unknown) => {
      console.error('[Uploader] Error during retryAll:', err)
    })
  }

  const scheduleRetry = (delayMs = 2000) => {
    if (retryTimeout) return
    retryTimeout = setTimeout(() => {
      retryTimeout = null
      triggerRetry()
    }, delayMs)
  }

  // Network recovery: native back-online event and browser online/offline events
  const handleBackOnline = () => {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
    console.log(`[Uploader] Network 'online' event received! navigator.onLine = ${isOnline}`)
    toast.dismiss?.('upload-network-offline')
    toast.info?.('Network connection restored. Resuming upload...', { duration: 3000 })
    triggerRetry()
  }

  const handleOffline = () => {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : false
    console.warn(`[Uploader] Network 'offline' event received! navigator.onLine = ${isOnline}`)
    toast.warning?.('Network connection lost. Upload paused until connection is restored.', {
      id: 'upload-network-offline',
      duration: Infinity,
    })
  }

  uppy.on('back-online', handleBackOnline)
  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleBackOnline)
    window.addEventListener('offline', handleOffline)
  }

  uppy.on('upload-progress', (file, progress) => {
    if (!file) return
    const fileId = file.meta.fileId as string
    if (fileId && progress.bytesUploaded != null) {
      updateFileProgress(taskId, fileId, progress.bytesUploaded)
    }
  })

  uppy.on('upload-success', (file) => {
    if (!file) return
    const fileId = file.meta.fileId as string
    activeUploads.delete(fileId)

    const confirmPromise = (async () => {
      try {
        const res = await client.api.teams[':teamId'].upload.tasks[':taskId'].$patch({
          param: { teamId, taskId },
          json: { fileId },
        })
        if (!res.ok) {
          throw new Error(`Failed to confirm upload: ${res.statusText}`)
        }
        completeFile(taskId, fileId)
        decrement()
        await onFileFinished?.(fileId)
      } catch (err) {
        console.error('Failed to confirm upload:', err)
        failFile(taskId, fileId)
        decrement()
        toast.error(`Failed to confirm upload: ${file.name}`)
        await onFileFinished?.(fileId)
        throw err
      }
    })()

    confirmationPromises.set(fileId, confirmPromise)
  })

  const handlePermanentError = (
    file: { name: string; meta: Record<string, unknown> },
    error: unknown,
  ) => {
    const fileId = file.meta.fileId as string
    if (!activeUploads.has(fileId)) return
    activeUploads.delete(fileId)
    failFile(taskId, fileId)
    decrement()

    toast.error(`Failed to upload file: ${file.name}`)

    const errorPromise = (async () => {
      try {
        await client.api.teams[':teamId'].upload.tasks[':taskId'].$patch({
          param: { teamId, taskId },
          json: {
            fileId,
            errorMessage: (error as Error)?.message || 'Upload failed',
          },
        })
      } catch (err) {
        console.error('Failed to report upload failure:', err)
      }
      await onFileFinished?.(fileId)
    })()

    confirmationPromises.set(fileId, errorPromise)
  }

  uppy.on('upload-error', (file, error) => {
    if (!file) return
    console.error(`[Uploader] upload-error for ${file.name}:`, error)

    if (isNetworkIssue(error)) {
      console.warn(
        `[Uploader] Network error detected for ${file.name}. Keeping upload active to resume when connection is restored.`,
      )
      toast.warning?.('Network connection lost. Upload will resume when connection is restored.', {
        id: 'upload-network-offline',
        duration: Infinity,
      })

      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const fileId = file.meta.fileId as string
        const attempts = (retryCounts.get(fileId) || 0) + 1
        retryCounts.set(fileId, attempts)

        if (attempts > MAX_ONLINE_RETRIES) {
          console.error(
            `[Uploader] Exceeded max online retries (${MAX_ONLINE_RETRIES}) for ${file.name}. Failing permanently.`,
          )
          handlePermanentError(file, error)
          return
        }

        console.log(
          `[Uploader] Scheduling retry for ${file.name} (attempt ${attempts}/${MAX_ONLINE_RETRIES})...`,
        )
        scheduleRetry(2000)
      }
      return
    }

    handlePermanentError(file, error)
  })

  // Add files to Uppy
  for (const item of files) {
    const assetInfo = assetByTempId.get(item.id)
    const urlInfo = urlByTempId.get(item.id)
    const fileId = assetInfo?.assetId || urlInfo?.fileId || item.id
    const key = assetInfo?.key
    const url = urlInfo?.url

    if (key) {
      fileIdByKey.set(key, fileId)
    }

    activeUploads.set(fileId, {
      teamId,
      taskId,
      fileId,
      key,
    })

    increment()

    uppy.addFile({
      name: item.file.name,
      type: item.file.type,
      data: item.file,
      meta: {
        fileId,
        key,
        url,
      },
    })
  }

  // Wait until Uppy completes all files and all confirmations settle
  try {
    await new Promise<void>((resolve) => {
      const checkCompletion = (result?: { failed?: unknown[] }) => {
        if (activeUploads.size === 0) {
          resolve()
          return
        }

        const failedFiles = result?.failed || []
        const isOffline = typeof navigator !== 'undefined' && !navigator.onLine
        const hasNetworkFailures =
          isOffline || failedFiles.some((f) => isNetworkIssue((f as { error?: unknown })?.error))

        if (hasNetworkFailures) {
          console.log(
            '[Uploader] Batch completed with network issues; waiting for reconnection to resume...',
          )
          return
        }

        for (const f of failedFiles) {
          const file = f as { name: string; meta: Record<string, unknown> }
          handlePermanentError(file, (f as { error?: unknown })?.error)
        }

        if (activeUploads.size === 0) {
          resolve()
        }
      }

      uppy.on('complete', checkCompletion)
      uppy.on('cancel-all', () => {
        resolve()
      })
    })

    await Promise.allSettled(Array.from(confirmationPromises.values()))
  } finally {
    if (retryTimeout) {
      clearTimeout(retryTimeout)
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleBackOnline)
      window.removeEventListener('offline', handleOffline)
      toast.dismiss?.('upload-network-offline')
    }
    await releaseWakeLock()
    uppy.destroy()
  }
}
