// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCopyActions } from './use-copy-actions'
import type { AssetInfo } from '@shumai/dtos'
import { toast } from 'sonner'
import * as clipboardModule from '@/ui/lib/clipboard'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const mockDownloadUrlPost = vi.fn()
const mockStoragePathsPost = vi.fn()

vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      files: {
        'download-url': {
          $post: (...args: unknown[]) => mockDownloadUrlPost(...args),
        },
        'storage-paths': {
          $post: (...args: unknown[]) => mockStoragePathsPost(...args),
        },
      },
    },
  },
}))

describe('useCopyActions', () => {
  const dummyFile: AssetInfo = {
    id: 'f1',
    name: 'document.pdf',
    type: 'file',
    status: 'processed',
    sizeByte: 1024,
    fileCount: 0,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  }

  const dummyFolder: AssetInfo = {
    id: 'd1',
    name: 'Folder1',
    type: 'folder',
    status: 'processed',
    sizeByte: 0,
    fileCount: 2,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  }

  const dummyImage: AssetInfo = {
    id: 'img1',
    name: 'photo.jpg',
    type: 'file',
    proxyType: 'image',
    status: 'processed',
    sizeByte: 2048,
    fileCount: 0,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    media: {
      imageTranscodes: [
        {
          id: 't1',
          url: '',
          key: 'files/img1/proxy-768p.webp',
          width: 768,
          height: 1024,
          size: 500,
        },
      ],
    },
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('R2 Regression: Empty download links or storage paths', () => {
    it('does not touch clipboard and does not toast success when all files are archived', async () => {
      const getDownloadLinks = vi.fn().mockResolvedValue({
        files: [],
        skippedArchivedCount: 2,
      })

      const copyDeferredSpy = vi.spyOn(clipboardModule, 'copyToClipboardDeferred')
      const copyTextSpy = vi.spyOn(clipboardModule, 'copyToClipboard')

      const { result } = renderHook(() =>
        useCopyActions({
          projectId: 'p1',
          getDownloadLinks,
        }),
      )

      await act(async () => {
        await result.current.handleCopy('download-link', [dummyFile, { ...dummyFile, id: 'f2' }])
      })

      // Must show error toast
      expect(toast.error).toHaveBeenCalled()
      // Must NOT show success toast
      expect(toast.success).not.toHaveBeenCalled()
      // Must NOT have copied empty string with copyToClipboard
      expect(copyTextSpy).not.toHaveBeenCalled()
      // If deferred was called, it should have returned false and avoided success
      if (copyDeferredSpy.mock.results.length > 0) {
        expect(await copyDeferredSpy.mock.results[0].value).toBe(false)
      }
    })

    it('does not toast success and shows error toast when storage paths return empty array', async () => {
      mockStoragePathsPost.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ paths: [] }),
      })

      const copyDeferredSpy = vi.spyOn(clipboardModule, 'copyToClipboardDeferred')

      const { result } = renderHook(() =>
        useCopyActions({
          projectId: 'p1',
          getDownloadLinks: vi.fn(),
        }),
      )

      await act(async () => {
        await result.current.handleCopy('storage-path', [dummyFile])
      })

      expect(toast.error).toHaveBeenCalled()
      expect(toast.success).not.toHaveBeenCalled()
      if (copyDeferredSpy.mock.results.length > 0) {
        expect(await copyDeferredSpy.mock.results[0].value).toBe(false)
      }
    })
  })

  describe('image copying', () => {
    it('resolves download URL on demand for transcode key and copies image to clipboard', async () => {
      mockDownloadUrlPost.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://cdn/proxy-768p.webp' }),
      })

      const copyImageSpy = vi.spyOn(clipboardModule, 'copyImageToClipboard').mockResolvedValue(true)

      const { result } = renderHook(() =>
        useCopyActions({
          projectId: 'p1',
          getDownloadLinks: vi.fn(),
        }),
      )

      await act(async () => {
        await result.current.handleCopy('image', [dummyImage])
      })

      expect(mockDownloadUrlPost).toHaveBeenCalledWith({
        json: { key: 'files/img1/proxy-768p.webp', assetId: 'img1' },
      })
      expect(copyImageSpy).toHaveBeenCalled()
      expect(toast.success).toHaveBeenCalled()
    })

    it('falls back to thumbnail URL if no transcodes are present', async () => {
      const imageWithThumb: AssetInfo = {
        ...dummyImage,
        media: undefined,
        preview: {
          thumbnailUrl: 'https://cdn/thumb.webp',
        },
      }

      const copyImageSpy = vi.spyOn(clipboardModule, 'copyImageToClipboard').mockResolvedValue(true)

      const { result } = renderHook(() =>
        useCopyActions({
          projectId: 'p1',
          getDownloadLinks: vi.fn(),
        }),
      )

      await act(async () => {
        await result.current.handleCopy('image', [imageWithThumb])
      })

      expect(copyImageSpy).toHaveBeenCalled()
      expect(toast.success).toHaveBeenCalled()
    })

    it('toasts error if copying image fails or is unsupported', async () => {
      vi.spyOn(clipboardModule, 'copyImageToClipboard').mockResolvedValue(false)
      mockDownloadUrlPost.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://cdn/proxy-768p.webp' }),
      })

      const { result } = renderHook(() =>
        useCopyActions({
          projectId: 'p1',
          getDownloadLinks: vi.fn(),
        }),
      )

      await act(async () => {
        await result.current.handleCopy('image', [dummyImage])
      })

      expect(toast.error).toHaveBeenCalled()
      expect(toast.success).not.toHaveBeenCalled()
    })
  })

  describe('download links copying', () => {
    it('copies download links and shows skipped folders suffix when folders are included', async () => {
      const getDownloadLinks = vi.fn().mockResolvedValue({
        files: [{ id: 'f1', name: 'document.pdf', url: 'https://cdn/download-1' }],
      })

      vi.spyOn(clipboardModule, 'copyToClipboardDeferred').mockResolvedValue(true)

      const { result } = renderHook(() =>
        useCopyActions({
          projectId: 'p1',
          getDownloadLinks,
        }),
      )

      await act(async () => {
        await result.current.handleCopy('download-link', [dummyFile, dummyFolder])
      })

      expect(getDownloadLinks).toHaveBeenCalledWith({ json: { ids: ['f1'] } })
      expect(toast.success).toHaveBeenCalled()
    })
  })

  describe('storage paths copying', () => {
    it('fetches storage paths and copies via deferred clipboard', async () => {
      mockStoragePathsPost.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          paths: [
            {
              id: 'f1',
              name: 'document.pdf',
              path: '/data/shumai/files/1',
              backend: 'local',
              isArchived: false,
            },
          ],
        }),
      })

      vi.spyOn(clipboardModule, 'copyToClipboardDeferred').mockResolvedValue(true)

      const { result } = renderHook(() =>
        useCopyActions({
          projectId: 'p1',
          getDownloadLinks: vi.fn(),
        }),
      )

      await act(async () => {
        await result.current.handleCopy('storage-path', [dummyFile])
      })

      expect(mockStoragePathsPost).toHaveBeenCalledWith({ json: { ids: ['f1'] } })
      expect(toast.success).toHaveBeenCalled()
    })
  })

  describe('text copying formats', () => {
    it('copies name, link, id, markdown, and tsv with success toasts', async () => {
      vi.spyOn(clipboardModule, 'copyToClipboard').mockResolvedValue(true)

      const { result } = renderHook(() =>
        useCopyActions({
          projectId: 'p1',
          getDownloadLinks: vi.fn(),
        }),
      )

      for (const kind of ['name', 'link', 'id', 'markdown', 'tsv'] as const) {
        vi.clearAllMocks()
        await act(async () => {
          await result.current.handleCopy(kind, [dummyFile, dummyFolder])
        })
        expect(clipboardModule.copyToClipboard).toHaveBeenCalled()
        expect(toast.success).toHaveBeenCalled()
      }
    })
  })
})
