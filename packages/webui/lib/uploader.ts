import { Uppy } from '@uppy/core'
import AwsS3 from '@uppy/aws-s3'
import XHRUpload from '@uppy/xhr-upload'
import type { PresignedUrl } from '@shumai/dtos'
import { client } from '@/ui/api/client'
import { useUploadStore } from '@/ui/stores/upload'
import { toast } from 'sonner'
import { m } from '@/ui/paraglide/messages.js'
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
  url?: string
}

export const activeUploads = new Map<string, ActiveUploadFile>()
export const activeUppyByTaskId = new Map<string, Uppy>()

export function cancelActiveUploadTask(taskId: string): void {
  const uppy = activeUppyByTaskId.get(taskId)
  if (uppy) {
    try {
      uppy.cancelAll()
    } catch (err) {
      console.warn('Failed to cancel uppy uploads:', err)
    }
  }

  for (const [fileId, item] of activeUploads.entries()) {
    if (item.taskId === taskId) {
      activeUploads.delete(fileId)
    }
  }
}

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

const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0'])

export const MAX_RETRY_DELAY_MS = 60000
export const BASE_RETRY_DELAY_MS = 1000

export class UploadNetworkError extends Error {
  readonly code = 'NETWORK_ERROR' as const
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'UploadNetworkError'
  }
}

export class UploadHttpError extends Error {
  readonly code = 'HTTP_ERROR' as const
  readonly status: number
  readonly isTransient: boolean
  constructor(message: string, options: { status: number; isTransient: boolean; cause?: unknown }) {
    super(message, { cause: options.cause })
    this.name = 'UploadHttpError'
    this.status = options.status
    this.isTransient = options.isTransient
  }
}

export function calculateBackoffDelay(
  attempts: number,
  maxDelayMs = MAX_RETRY_DELAY_MS,
  baseDelayMs = BASE_RETRY_DELAY_MS,
): number {
  const effectiveBaseDelay =
    (typeof window !== 'undefined' &&
      (window as unknown as Record<string, number | undefined>)['__SHUMAI_UPLOAD_BASE_DELAY__']) ||
    baseDelayMs
  const exponentialDelay = Math.min(Math.pow(2, attempts) * effectiveBaseDelay, maxDelayMs)
  const jitter = exponentialDelay * (Math.random() * 0.3 - 0.15) // ±15%
  return Math.min(maxDelayMs, Math.max(effectiveBaseDelay, Math.round(exponentialDelay + jitter)))
}

export function isLocalhostStorageMismatch(uploadUrlString?: string): boolean {
  if (!uploadUrlString || typeof window === 'undefined') return false
  try {
    const uploadUrl = new URL(uploadUrlString, window.location.origin)
    const isUploadLocalhost = LOCALHOST_HOSTS.has(uploadUrl.hostname)
    const isWindowLocalhost = LOCALHOST_HOSTS.has(window.location.hostname)

    return isUploadLocalhost && !isWindowLocalhost
  } catch {
    return false
  }
}

export function isNetworkIssue(error?: unknown): boolean {
  if (!error) {
    return typeof navigator !== 'undefined' && !navigator.onLine
  }

  // 1. Structured typed errors
  if (error instanceof UploadHttpError) {
    return error.isTransient
  }
  if (error instanceof UploadNetworkError) {
    return true
  }

  const err = (typeof error === 'object' && error !== null ? error : {}) as Record<string, unknown>

  // 2. HTTP status inspection (check first before generic offline or NetworkError flags,
  // so non-retryable HTTP 500 / 4xx responses delivered as the browser transitions offline
  // fail immediately instead of being treated as network drops)
  const status =
    typeof err.status === 'number'
      ? err.status
      : typeof (err.request as Record<string, unknown> | undefined)?.status === 'number'
        ? ((err.request as Record<string, unknown>).status as number)
        : undefined

  if (status !== undefined) {
    if (status === 0 || status === 429 || status === 502 || status === 503 || status === 504) {
      return true
    }
    // Explicitly non-retryable statuses (500 Internal Server Error, 4xx except 429)
    if (status === 500 || (status >= 400 && status < 500)) {
      return false
    }
    if (status >= 500 && status < 600) {
      return true
    }
  }

  // 3. Fallback string matching for explicit non-retryable HTTP status messages
  const rawMsg =
    typeof error === 'string' ? error : typeof err.message === 'string' ? err.message : ''
  if (rawMsg) {
    const msg = rawMsg.toLowerCase()
    // Explicit non-retryable status codes in string messages
    if (
      msg.includes('status: 500') ||
      msg.includes('status: 400') ||
      msg.includes('status: 401') ||
      msg.includes('status: 403') ||
      msg.includes('status: 404')
    ) {
      return false
    }
    if (
      msg.includes('network error') ||
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('network changed') ||
      msg.includes('err_network_changed') ||
      msg.includes('err_internet_disconnected') ||
      msg.includes('err_connection_') ||
      msg.includes('err_name_not_resolved') ||
      msg.includes('the network connection was lost') ||
      msg.includes('the internet connection appears to be offline') ||
      (msg.includes('load failed') && !msg.includes('upload failed')) ||
      msg.includes('timed out') ||
      msg.includes('timeout') ||
      msg.includes('bad gateway') ||
      msg.includes('gateway timeout') ||
      msg.includes('service unavailable')
    ) {
      return true
    }
  }

  // 4. Generic offline state (only when the error does not carry a non-retryable status code)
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return true
  }

  if (err.code === 'NETWORK' || err.code === 'NETWORK_ERROR') return true
  if (err.name === 'S3NetworkError' || err.name === 'UploadNetworkError') {
    return true
  }

  // Standard fetch network failure
  if (error instanceof TypeError) {
    return true
  }

  // If there was no HTTP status attached, check generic Uppy NetworkError flag
  if (err.name === 'NetworkError' || err.isNetworkError === true) return true

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
  const { increment, updateFileProgress, completeFile, failFile } = store

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
  activeUppyByTaskId.set(taskId, uppy)

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

        let res: Response
        try {
          res = await fetch(`/api/teams/${teamId}/upload/sign`, {
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
        } catch (err) {
          if (err instanceof TypeError) {
            throw new UploadNetworkError('Network error while signing request', { cause: err })
          }
          throw err
        }

        if (!res.ok) {
          const isTransient =
            res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504
          throw new UploadHttpError(`Failed to sign request: ${res.statusText}`, {
            status: res.status,
            isTransient,
          })
        }

        const data = (await res.json()) as { url: string }
        if (fileId) {
          const active = activeUploads.get(fileId)
          if (active) {
            active.url = data.url
          }
        }
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
  const pendingNetworkRetries = new Set<string>()
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
    retryCounts.clear()
    if (retryTimeout) {
      clearTimeout(retryTimeout)
      retryTimeout = null
    }
    triggerRetry()
  }

  const handleOffline = () => {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : false
    console.warn(`[Uploader] Network 'offline' event received! navigator.onLine = ${isOnline}`)
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
    if (fileId) {
      pendingNetworkRetries.delete(fileId)
      retryCounts.delete(fileId)
    }
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
        await onFileFinished?.(fileId)
      } catch (err) {
        console.error('Failed to confirm upload:', err)
        failFile(taskId, fileId)
        toast.error(m.failed_confirm_upload_with_name({ name: file.name }))
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
    const active = activeUploads.get(fileId)
    const uploadUrl = (file.meta?.url as string | undefined) || active?.url

    activeUploads.delete(fileId)
    failFile(taskId, fileId)

    if (isLocalhostStorageMismatch(uploadUrl)) {
      toast.error(m.upload_failed_s3_endpoint_localhost(), {
        id: 's3-endpoint-localhost-mismatch',
        duration: 10000,
      })
    } else {
      toast.error(m.failed_upload_file_with_name({ name: file.name }))
    }

    const errorPromise = (async () => {
      try {
        await client.api.teams[':teamId'].upload.tasks[':taskId'].$patch({
          param: { teamId, taskId },
          json: {
            fileId,
            errorMessage:
              (error as Error)?.message || (typeof error === 'string' ? error : 'Upload failed'),
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

    const fileId = file.meta?.fileId as string | undefined
    const uploadUrl =
      (file.meta?.url as string | undefined) ||
      (fileId ? activeUploads.get(fileId)?.url : undefined)

    if (isLocalhostStorageMismatch(uploadUrl)) {
      console.warn(
        `[Uploader] Localhost storage endpoint mismatch detected for ${file.name}. Failing permanently without retry.`,
      )
      if (fileId) {
        pendingNetworkRetries.delete(fileId)
      }
      handlePermanentError(file, error)
      return
    }

    if (isNetworkIssue(error)) {
      console.warn(
        `[Uploader] Network error detected for ${file.name}. Keeping upload active to resume when connection is restored.`,
      )

      if (fileId) {
        pendingNetworkRetries.add(fileId)
      }

      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const attempts = (fileId ? retryCounts.get(fileId) || 0 : 0) + 1
        if (fileId) {
          retryCounts.set(fileId, attempts)
        }

        const delayMs = calculateBackoffDelay(attempts)
        console.log(
          `[Uploader] Scheduling retry for ${file.name} (attempt ${attempts}, delay ${delayMs}ms)...`,
        )
        scheduleRetry(delayMs)
      }
      return
    }

    if (fileId) {
      pendingNetworkRetries.delete(fileId)
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
      url,
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
        for (const f of failedFiles) {
          const file = f as { name: string; meta: Record<string, unknown> }
          const fId = file.meta?.fileId as string | undefined
          if (fId && !pendingNetworkRetries.has(fId)) {
            const err = (f as { error?: unknown })?.error
            if (isNetworkIssue(err)) {
              pendingNetworkRetries.add(fId)
              continue
            }
            handlePermanentError(file, err)
          }
        }

        if (pendingNetworkRetries.size > 0) {
          console.log(
            `[Uploader] Batch completed with ${pendingNetworkRetries.size} retrying file(s); waiting for reconnection or backoff to resume...`,
          )
          return
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
    activeUppyByTaskId.delete(taskId)
    if (retryTimeout) {
      clearTimeout(retryTimeout)
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleBackOnline)
      window.removeEventListener('offline', handleOffline)
    }
    await releaseWakeLock()
    uppy.destroy()
  }
}
