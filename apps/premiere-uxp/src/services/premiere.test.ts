import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getActiveProject,
  importFilesIntoProject,
  promptSelectFolder,
  promptSaveFile,
  writeBinaryFile,
  getPremiereModule,
  getUxpModule,
} from './premiere'
import type { Project, Sequence } from '@adobe/premierepro'

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

  describe('promptSelectFolder', () => {
    it('throws when UXP storage is unavailable', async () => {
      await expect(promptSelectFolder()).rejects.toThrow('UXP storage')
    })

    it('delegates to uxp.storage.localFileSystem.getFolder', async () => {
      const mockFolder: UxpFolderEntry = {
        isFile: false,
        isFolder: true,
        name: 'Downloads',
        nativePath: '/Users/test/Downloads',
        createFile: vi.fn(),
        getEntries: vi.fn().mockResolvedValue([]),
      }
      // Mocking UXP window environment on globalThis
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(globalThis as any).window = {
        require: vi.fn().mockImplementation((name: string) => {
          if (name === 'uxp') {
            return {
              storage: {
                localFileSystem: {
                  getFolder: vi.fn().mockResolvedValue(mockFolder),
                },
              },
            }
          }
          return null
        }),
      }

      const folder = await promptSelectFolder()
      expect(folder).toBe(mockFolder)
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

  describe('sequence functions', () => {
    it('getActiveSequence returns active sequence from project', async () => {
      const { getActiveSequence } = await import('./premiere')
      const mockSeq = { name: 'Seq 1', guid: 'guid-1' }
      const mockProject = {
        getActiveSequence: vi.fn().mockResolvedValue(mockSeq),
      }

      const seq = await getActiveSequence(mockProject as unknown as Project)
      expect(seq).toBe(mockSeq)
    })

    it('getAllSequences returns array of sequences', async () => {
      const { getAllSequences } = await import('./premiere')
      const mockSeq1 = { name: 'Seq 1', guid: 'guid-1' }
      const mockSeq2 = { name: 'Seq 2', guid: 'guid-2' }
      const mockProject = {
        getSequences: vi.fn().mockResolvedValue([mockSeq1, mockSeq2]),
      }

      const seqs = await getAllSequences(mockProject as unknown as Project)
      expect(seqs).toHaveLength(2)
      expect(seqs[0].name).toBe('Seq 1')
    })

    it('openSequenceInTimeline opens and activates sequence', async () => {
      const { openSequenceInTimeline } = await import('./premiere')
      const mockSeq = { name: 'Seq 1', guid: 'guid-1' }
      const mockProject = {
        openSequence: vi.fn().mockResolvedValue(true),
        setActiveSequence: vi.fn().mockResolvedValue(true),
      }

      const result = await openSequenceInTimeline(
        mockSeq as unknown as Sequence,
        mockProject as unknown as Project,
      )
      expect(result).toBe(true)
      expect(mockProject.openSequence).toHaveBeenCalledWith(mockSeq)
      expect(mockProject.setActiveSequence).toHaveBeenCalledWith(mockSeq)
    })
  })
})
