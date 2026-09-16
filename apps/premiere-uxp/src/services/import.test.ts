import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  formatResolutionLabel,
  getResolutionRank,
  resolveRawDownloadUrl,
  fetchVideoProxies,
  getUniqueFileName,
  getFolderEntryNames,
  createUniqueFileInFolder,
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

  describe('getUniqueFileName', () => {
    it('returns exact name when no collision exists', () => {
      expect(getUniqueFileName([], 'image.png')).toBe('image.png')
      expect(getUniqueFileName(['other.png', 'test.mov'], 'image.png')).toBe('image.png')
    })

    it('appends _1 on first collision', () => {
      expect(getUniqueFileName(['image.png'], 'image.png')).toBe('image_1.png')
    })

    it('appends _2 when original and _1 both exist', () => {
      expect(getUniqueFileName(['image.png', 'image_1.png'], 'image.png')).toBe('image_2.png')
    })

    it('handles case-insensitive collision checks', () => {
      expect(getUniqueFileName(['IMAGE.PNG'], 'image.png')).toBe('image_1.png')
      expect(getUniqueFileName(['image.png', 'IMAGE_1.PNG'], 'image.png')).toBe('image_2.png')
    })

    it('handles files without extensions', () => {
      expect(getUniqueFileName(['README'], 'README')).toBe('README_1')
      expect(getUniqueFileName(['README', 'README_1'], 'README')).toBe('README_2')
    })

    it('handles files with multiple dots', () => {
      expect(getUniqueFileName(['archive.tar.gz'], 'archive.tar.gz')).toBe('archive.tar_1.gz')
      expect(getUniqueFileName(['archive.tar.gz', 'archive.tar_1.gz'], 'archive.tar.gz')).toBe(
        'archive.tar_2.gz',
      )
    })
  })

  describe('getFolderEntryNames', () => {
    it('reads entry names from folder.getEntries', async () => {
      const mockFolder = {
        isFile: false as const,
        isFolder: true as const,
        name: 'dir',
        nativePath: '/path/dir',
        createFile: vi.fn(),
        getEntries: vi.fn().mockResolvedValue([
          { name: 'file1.mp4', isFile: true, isFolder: false },
          { name: 'subfolder', isFile: false, isFolder: true },
        ]),
      }

      const names = await getFolderEntryNames(mockFolder)
      expect(names).toEqual(['file1.mp4', 'subfolder'])
    })

    it('handles folder.getEntries error gracefully', async () => {
      const mockFolder = {
        isFile: false as const,
        isFolder: true as const,
        name: 'dir',
        nativePath: '/path/dir',
        createFile: vi.fn(),
        getEntries: vi.fn().mockRejectedValue(new Error('Permission denied')),
      }

      const names = await getFolderEntryNames(mockFolder)
      expect(names).toEqual([])
    })
  })

  describe('createUniqueFileInFolder', () => {
    it('creates file with candidate name when no collision', async () => {
      const mockCreatedFile = {
        isFile: true as const,
        isFolder: false as const,
        name: 'test.mp4',
        nativePath: '/path/test.mp4',
        write: vi.fn(),
      }
      const mockFolder = {
        isFile: false as const,
        isFolder: true as const,
        name: 'dir',
        nativePath: '/path/dir',
        createFile: vi.fn().mockResolvedValue(mockCreatedFile),
        getEntries: vi.fn().mockResolvedValue([]),
      }

      const res = await createUniqueFileInFolder(mockFolder, 'test.mp4')
      expect(res.name).toBe('test.mp4')
      expect(res.file).toBe(mockCreatedFile)
      expect(mockFolder.createFile).toHaveBeenCalledWith('test.mp4', { overwrite: false })
    })

    it('auto-increments suffix when candidate creation fails due to collision', async () => {
      const mockCreatedFile = {
        isFile: true as const,
        isFolder: false as const,
        name: 'test_1.mp4',
        nativePath: '/path/test_1.mp4',
        write: vi.fn(),
      }
      const mockFolder = {
        isFile: false as const,
        isFolder: true as const,
        name: 'dir',
        nativePath: '/path/dir',
        createFile: vi
          .fn()
          .mockRejectedValueOnce(new Error('File exists'))
          .mockResolvedValueOnce(mockCreatedFile),
        getEntries: vi.fn().mockResolvedValue([]),
      }

      const res = await createUniqueFileInFolder(mockFolder, 'test.mp4')
      expect(res.name).toBe('test_1.mp4')
      expect(res.file).toBe(mockCreatedFile)
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

    it('returns cancelled when user cancels folder picker', async () => {
      // Mocking incomplete Premiere Project object in unit test
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(premiereModule, 'getActiveProject').mockResolvedValue({} as any)
      vi.spyOn(premiereModule, 'promptSelectFolder').mockResolvedValue(null)

      const result = await importAssetIntoPremiere({
        endpoint: 'http://test',
        apiKey: 'key',
        asset: mockAsset,
        type: 'raw',
      })

      expect(result.success).toBe(false)
      expect(result.cancelled).toBe(true)
      expect(premiereModule.promptSelectFolder).toHaveBeenCalled()
    })

    it('fails after folder selection if download link resolution fails', async () => {
      // Mocking incomplete Premiere Project object in unit test
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(premiereModule, 'getActiveProject').mockResolvedValue({} as any)
      const mockFolder = {
        isFile: false as const,
        isFolder: true as const,
        name: 'dir',
        nativePath: '/path/dir',
        createFile: vi.fn(),
        getEntries: vi.fn().mockResolvedValue([]),
      }
      vi.spyOn(premiereModule, 'promptSelectFolder').mockResolvedValue(mockFolder)

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

      await expect(
        importAssetIntoPremiere({
          endpoint: 'http://test',
          apiKey: 'key',
          asset: mockAsset,
          type: 'raw',
        }),
      ).rejects.toThrow('Unauthorized: Invalid API Key')
    })

    it('downloads and imports file successfully with original name when no conflict', async () => {
      // Mocking incomplete Premiere Project object in unit test
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockProject = {} as any
      vi.spyOn(premiereModule, 'getActiveProject').mockResolvedValue(mockProject)

      const mockSaveFile = {
        isFile: true as const,
        isFolder: false as const,
        name: 'Sample.mov',
        nativePath: '/Users/test/Downloads/Sample.mov',
        write: vi.fn().mockResolvedValue(undefined),
      }
      const mockFolder = {
        isFile: false as const,
        isFolder: true as const,
        name: 'Downloads',
        nativePath: '/Users/test/Downloads',
        createFile: vi.fn().mockResolvedValue(mockSaveFile),
        getEntries: vi.fn().mockResolvedValue([]),
      }
      vi.spyOn(premiereModule, 'promptSelectFolder').mockResolvedValue(mockFolder)
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
      expect(result.fileName).toBe('Sample.mov')
      expect(result.message).toContain('Successfully imported Sample.mov')
      expect(mockFolder.createFile).toHaveBeenCalledWith('Sample.mov', { overwrite: false })
      expect(premiereModule.importFilesIntoProject).toHaveBeenCalledWith(mockProject, [
        '/Users/test/Downloads/Sample.mov',
      ])
      expect(onProgress).toHaveBeenCalled()
      fetchSpy.mockRestore()
    })

    it('automatically adds _1 suffix when name conflict exists in selected folder', async () => {
      // Mocking incomplete Premiere Project object in unit test
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockProject = {} as any
      vi.spyOn(premiereModule, 'getActiveProject').mockResolvedValue(mockProject)

      const mockSaveFile = {
        isFile: true as const,
        isFolder: false as const,
        name: 'Sample_1.mov',
        nativePath: '/Users/test/Downloads/Sample_1.mov',
        write: vi.fn().mockResolvedValue(undefined),
      }
      const mockFolder = {
        isFile: false as const,
        isFolder: true as const,
        name: 'Downloads',
        nativePath: '/Users/test/Downloads',
        createFile: vi.fn().mockResolvedValue(mockSaveFile),
        getEntries: vi
          .fn()
          .mockResolvedValue([{ name: 'Sample.mov', isFile: true, isFolder: false }]),
      }
      vi.spyOn(premiereModule, 'promptSelectFolder').mockResolvedValue(mockFolder)
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

      const dummyBuffer = new ArrayBuffer(8)
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        arrayBuffer: async () => dummyBuffer,
        // Mocking Response object for unit test
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      const result = await importAssetIntoPremiere({
        endpoint: 'http://test',
        apiKey: 'key',
        asset: mockAsset,
        type: 'raw',
      })

      expect(result.success).toBe(true)
      expect(result.fileName).toBe('Sample_1.mov')
      expect(result.message).toContain('Successfully imported Sample_1.mov')
      expect(mockFolder.createFile).toHaveBeenCalledWith('Sample_1.mov', { overwrite: false })
      expect(premiereModule.importFilesIntoProject).toHaveBeenCalledWith(mockProject, [
        '/Users/test/Downloads/Sample_1.mov',
      ])
      fetchSpy.mockRestore()
    })
  })
})
