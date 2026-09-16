import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  formatResolutionLabel,
  getResolutionRank,
  resolveRawDownloadUrl,
  fetchVideoProxies,
  importAssetIntoPremiere,
} from './import'
import * as premiereModule from './premiere'
import * as clientModule from '../api/client'
import type { AssetSummary } from '../components/FileItem'

describe('import service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('formatResolutionLabel', () => {
    it('formats given resolution strings', () => {
      expect(formatResolutionLabel(undefined, undefined, '1080p')).toBe('1080p (MP4)')
      expect(formatResolutionLabel(undefined, undefined, '720')).toBe('720p (MP4)')
    })

    it('formats given height numbers', () => {
      expect(formatResolutionLabel(1920, 1080)).toBe('1080p (MP4)')
      expect(formatResolutionLabel(1280, 720)).toBe('720p (MP4)')
    })

    it('formats by width if height is missing', () => {
      expect(formatResolutionLabel(1920, undefined)).toBe('1080p (MP4)')
      expect(formatResolutionLabel(1280, undefined)).toBe('720p (MP4)')
      expect(formatResolutionLabel(3840, undefined)).toBe('2160p (MP4)')
    })

    it('falls back to Proxy (MP4)', () => {
      expect(formatResolutionLabel(undefined, undefined)).toBe('Proxy (MP4)')
    })
  })

  describe('getResolutionRank', () => {
    it('extracts resolution numeric rank', () => {
      expect(getResolutionRank('1080p (MP4)')).toBe(1080)
      expect(getResolutionRank('720p (MP4)')).toBe(720)
      expect(getResolutionRank('Proxy (MP4)')).toBe(0)
    })
  })

  describe('resolveRawDownloadUrl', () => {
    it('resolves directly via download-url when original key is in knownAsset', async () => {
      const mockDownloadUrlPost = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ url: 'https://s3.example.com/direct-raw.mp4' }),
      })

      vi.spyOn(clientModule, 'getShumaiClient').mockReturnValue({
        api: {
          files: {
            'download-url': {
              $post: mockDownloadUrlPost,
            },
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      const knownAsset: AssetSummary = {
        id: 'file-1',
        name: 'direct-raw.mp4',
        type: 'file',
        media: {
          original: {
            key: 'files/test/direct-raw.mp4',
          },
        },
      }

      const result = await resolveRawDownloadUrl('http://test', 'key', 'file-1', knownAsset)
      expect(result.url).toBe('https://s3.example.com/direct-raw.mp4')
      expect(result.name).toBe('direct-raw.mp4')
      expect(mockDownloadUrlPost).toHaveBeenCalledWith({
        json: { key: 'files/test/direct-raw.mp4', assetId: 'file-1' },
      })
    })

    it('resolves via GET :fileId and download-url when not in knownAsset', async () => {
      const mockGet = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'file-1',
          name: 'remote-video.mp4',
          media: {
            original: {
              key: 'files/remote/video.mp4',
            },
          },
        }),
      })
      const mockDownloadUrlPost = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ url: 'https://s3.example.com/presigned-remote.mp4' }),
      })

      vi.spyOn(clientModule, 'getShumaiClient').mockReturnValue({
        api: {
          files: {
            ':fileId': {
              $get: mockGet,
            },
            'download-url': {
              $post: mockDownloadUrlPost,
            },
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      const result = await resolveRawDownloadUrl('http://test', 'key', 'file-1')
      expect(result.url).toBe('https://s3.example.com/presigned-remote.mp4')
      expect(result.name).toBe('remote-video.mp4')
      expect(mockGet).toHaveBeenCalledWith({ param: { fileId: 'file-1' } })
      expect(mockDownloadUrlPost).toHaveBeenCalledWith({
        json: { key: 'files/remote/video.mp4', assetId: 'file-1' },
      })
    })

    it('falls back to download-links endpoint when download-url is unavailable', async () => {
      const mockPost = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          files: [{ id: 'file-1', name: 'video.mov', url: 'https://s3.example.com/video.mov' }],
        }),
      })

      vi.spyOn(clientModule, 'getShumaiClient').mockReturnValue({
        api: {
          files: {
            'download-links': {
              $post: mockPost,
            },
          },
        },
        // Partial mock of Hono client for unit test isolation
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      const result = await resolveRawDownloadUrl('http://test', 'key', 'file-1')
      expect(result.url).toBe('https://s3.example.com/video.mov')
      expect(result.name).toBe('video.mov')
      expect(mockPost).toHaveBeenCalledWith({ json: { ids: ['file-1'] } })
    })

    it('throws error when all resolution methods fail', async () => {
      vi.spyOn(clientModule, 'getShumaiClient').mockReturnValue({
        api: {
          files: {
            'download-links': {
              $post: vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
                json: async () => ({ error: 'Server error' }),
              }),
            },
          },
        },
        // Partial mock of Hono client for unit test isolation
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      await expect(resolveRawDownloadUrl('http://test', 'key', 'file-1')).rejects.toThrow(
        'Server error',
      )
    })
  })

  describe('fetchVideoProxies', () => {
    it('returns available proxies sorted descending', async () => {
      const mockGet = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'file-1',
          media: {
            videoTranscodes: [
              {
                id: 't-720',
                key: 'files/720.mp4',
                url: 'https://s3.example.com/720.mp4',
                width: 1280,
                height: 720,
              },
              {
                id: 't-1080',
                key: 'files/1080.mp4',
                url: 'https://s3.example.com/1080.mp4',
                width: 1920,
                height: 1080,
              },
            ],
          },
        }),
      })

      vi.spyOn(clientModule, 'getShumaiClient').mockReturnValue({
        api: {
          files: {
            ':fileId': {
              $get: mockGet,
            },
          },
        },
        // Partial mock of Hono client for unit test isolation
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      const proxies = await fetchVideoProxies('http://test', 'key', 'file-1')
      expect(proxies).toHaveLength(2)
      // Highest resolution first
      expect(proxies[0].label).toBe('1080p (MP4)')
      expect(proxies[1].label).toBe('720p (MP4)')
    })
  })

  describe('importAssetIntoPremiere', () => {
    const mockAsset: AssetSummary = {
      id: 'asset-1',
      name: 'Sample.mov',
      type: 'file',
    }

    it('returns error when no active project in Premiere', async () => {
      vi.spyOn(premiereModule, 'getActiveProject').mockResolvedValue(null)

      const result = await importAssetIntoPremiere({
        endpoint: 'http://test',
        apiKey: 'key',
        asset: mockAsset,
        type: 'raw',
      })

      expect(result.success).toBe(false)
      expect(result.message).toContain('Please open or create a project')
    })

    it('returns cancelled when user cancels file picker after URL resolution', async () => {
      // Mocking incomplete Premiere Project object in unit test
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(premiereModule, 'getActiveProject').mockResolvedValue({} as any)
      vi.spyOn(clientModule, 'getShumaiClient').mockReturnValue({
        api: {
          files: {
            'download-links': {
              $post: vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                  files: [{ id: 'asset-1', name: 'Sample.mov', url: 'https://s3.example.com/raw' }],
                }),
              }),
            },
          },
        },
        // Partial mock of Hono client for unit test isolation
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      vi.spyOn(premiereModule, 'promptSaveFile').mockResolvedValue(null)

      const result = await importAssetIntoPremiere({
        endpoint: 'http://test',
        apiKey: 'key',
        asset: mockAsset,
        type: 'raw',
      })

      expect(result.success).toBe(false)
      expect(result.cancelled).toBe(true)
      expect(premiereModule.promptSaveFile).toHaveBeenCalledWith('Sample.mov')
    })

    it('fails before opening file picker if download link resolution fails', async () => {
      // Mocking incomplete Premiere Project object in unit test
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(premiereModule, 'getActiveProject').mockResolvedValue({} as any)
      vi.spyOn(clientModule, 'getShumaiClient').mockReturnValue({
        api: {
          files: {
            'download-links': {
              $post: vi.fn().mockResolvedValue({
                ok: false,
                status: 401,
                json: async () => ({ error: 'Unauthorized: Invalid API Key' }),
              }),
            },
          },
        },
        // Partial mock of Hono client for unit test isolation
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      const promptSpy = vi.spyOn(premiereModule, 'promptSaveFile')

      await expect(
        importAssetIntoPremiere({
          endpoint: 'http://test',
          apiKey: 'key',
          asset: mockAsset,
          type: 'raw',
        }),
      ).rejects.toThrow('Unauthorized: Invalid API Key')

      // Ensure save picker is never triggered if auth/link resolution fails
      expect(promptSpy).not.toHaveBeenCalled()
    })

    it('downloads and imports file successfully', async () => {
      // Mocking incomplete Premiere Project object in unit test
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockProject = {} as any
      vi.spyOn(premiereModule, 'getActiveProject').mockResolvedValue(mockProject)

      const mockSaveFile = {
        isFile: true as const,
        isFolder: false as const,
        name: 'Sample.mov',
        nativePath: '/Users/test/Sample.mov',
        write: vi.fn().mockResolvedValue(undefined),
      }
      vi.spyOn(premiereModule, 'promptSaveFile').mockResolvedValue(mockSaveFile)
      vi.spyOn(premiereModule, 'writeBinaryFile').mockResolvedValue(undefined)
      vi.spyOn(premiereModule, 'importFilesIntoProject').mockResolvedValue(true)

      vi.spyOn(clientModule, 'getShumaiClient').mockReturnValue({
        api: {
          files: {
            'download-links': {
              $post: vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                  files: [{ id: 'asset-1', name: 'Sample.mov', url: 'https://s3.example.com/raw' }],
                }),
              }),
            },
          },
        },
        // Partial mock of Hono client for unit test isolation
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      // Mock global fetch
      const dummyBuffer = new ArrayBuffer(8)
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        arrayBuffer: async () => dummyBuffer,
        // Mocking Response object for unit test
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      const onProgress = vi.fn()
      const result = await importAssetIntoPremiere({
        endpoint: 'http://test',
        apiKey: 'key',
        asset: mockAsset,
        type: 'raw',
        onProgress,
      })

      expect(result.success).toBe(true)
      expect(result.message).toContain('Successfully imported Sample.mov')
      expect(premiereModule.importFilesIntoProject).toHaveBeenCalledWith(mockProject, [
        '/Users/test/Sample.mov',
      ])
      expect(onProgress).toHaveBeenCalled()
      fetchSpy.mockRestore()
    })
  })
})
