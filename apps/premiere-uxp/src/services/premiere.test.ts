import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getActiveProject,
  importFilesIntoProject,
  promptSaveFile,
  writeBinaryFile,
  getPremiereModule,
  getUxpModule,
} from './premiere'
import type { Project } from '@adobe/premierepro'

describe('premiere service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Reset any global require mocks on globalThis
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).require
    // Reset window mock on globalThis
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).window
  })

  describe('module getters', () => {
    it('returns null when premierepro is not available', () => {
      expect(getPremiereModule()).toBeNull()
    })

    it('returns null when uxp is not available', () => {
      expect(getUxpModule()).toBeNull()
    })

    it('resolves premiere module from global require when present', () => {
      const mockPpro = { Project: { getActiveProject: vi.fn() } }
      // Mocking UXP window environment on globalThis
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(globalThis as any).window = {
        require: vi.fn().mockImplementation((name: string) => {
          if (name === 'premierepro') return mockPpro
          return null
        }),
      }

      expect(getPremiereModule()).toBe(mockPpro)
    })
  })

  describe('getActiveProject', () => {
    it('returns null when module is missing', async () => {
      const project = await getActiveProject()
      expect(project).toBeNull()
    })

    it('returns active project when available', async () => {
      const mockProject = { name: 'MyProject.prproj' }
      // Mocking UXP window environment on globalThis
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(globalThis as any).window = {
        require: vi.fn().mockImplementation((name: string) => {
          if (name === 'premierepro') {
            return {
              Project: {
                getActiveProject: vi.fn().mockResolvedValue(mockProject),
              },
            }
          }
          return null
        }),
      }

      const project = await getActiveProject()
      expect(project).toBe(mockProject)
    })
  })

  describe('importFilesIntoProject', () => {
    it('returns false when filePaths is empty', async () => {
      const project = { importFiles: vi.fn() } as unknown as Project
      const success = await importFilesIntoProject(project, [])
      expect(success).toBe(false)
      expect(project.importFiles).not.toHaveBeenCalled()
    })

    it('calls project.importFiles with suppressUI true', async () => {
      const project = {
        importFiles: vi.fn().mockResolvedValue(true),
      } as unknown as Project

      const success = await importFilesIntoProject(project, ['/path/to/video.mp4'])
      expect(success).toBe(true)
      expect(project.importFiles).toHaveBeenCalledWith(['/path/to/video.mp4'], true, null, false)
    })

    it('handles import error gracefully', async () => {
      const project = {
        importFiles: vi.fn().mockRejectedValue(new Error('Import failed in host')),
      } as unknown as Project

      const success = await importFilesIntoProject(project, ['/path/to/video.mp4'])
      expect(success).toBe(false)
    })
  })

  describe('promptSaveFile', () => {
    it('throws when UXP storage is unavailable', async () => {
      await expect(promptSaveFile('test.mp4')).rejects.toThrow('UXP storage')
    })

    it('delegates to uxp.storage.localFileSystem.getFileForSaving', async () => {
      const mockFile: UxpFileEntry = {
        isFile: true,
        isFolder: false,
        name: 'test.mp4',
        nativePath: '/path/test.mp4',
        write: vi.fn(),
      }
      // Mocking UXP window environment on globalThis
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(globalThis as any).window = {
        require: vi.fn().mockImplementation((name: string) => {
          if (name === 'uxp') {
            return {
              storage: {
                localFileSystem: {
                  getFileForSaving: vi.fn().mockResolvedValue(mockFile),
                },
              },
            }
          }
          return null
        }),
      }

      const file = await promptSaveFile('test.mp4')
      expect(file).toBe(mockFile)
    })
  })

  describe('writeBinaryFile', () => {
    it('calls file.write with binary format option', async () => {
      const mockFile: UxpFileEntry = {
        isFile: true,
        isFolder: false,
        name: 'test.mp4',
        nativePath: '/path/test.mp4',
        write: vi.fn().mockResolvedValue(undefined),
      }

      // Mocking UXP window environment on globalThis
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(globalThis as any).window = {
        require: vi.fn().mockImplementation((name: string) => {
          if (name === 'uxp') {
            return {
              storage: {
                formats: { binary: 'binary-format-token' },
              },
            }
          }
          return null
        }),
      }

      const dummyBuffer = new ArrayBuffer(16)
      await writeBinaryFile(mockFile, dummyBuffer)
      expect(mockFile.write).toHaveBeenCalledWith(dummyBuffer, { format: 'binary-format-token' })
    })
  })
})
