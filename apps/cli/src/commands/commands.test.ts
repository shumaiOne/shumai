import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { projectLs } from './project'
import { ls } from './ls'
import { mkdir } from './mkdir'
import { getClient } from '../client'
import { upload } from './upload'
import { createVersion } from './create-version'
import { rename } from './rename'
import { move } from './move'
import { deleteAsset } from './delete'
import fs from 'node:fs'
import http from 'node:http'

vi.mock('../client', () => ({
  getClient: vi.fn(),
}))

vi.mock('node:http', () => ({
  default: {
    request: vi.fn(),
  },
}))

describe('CLI Commands', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let logSpy: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let writeSpy: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let errorSpy: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let exitSpy: any

  const mockClient = {
    api: {
      projects: {
        $get: vi.fn(),
        ':projectId': {
          $get: vi.fn(),
          reparent: {
            $post: vi.fn(),
          },
        },
      },
      folders: {
        $post: vi.fn(),
        ':folderId': {
          $get: vi.fn(),
          $put: vi.fn(),
          children: {
            $get: vi.fn(),
          },
        },
      },
      files: {
        $delete: vi.fn(),
        ':fileId': {
          $get: vi.fn(),
          $put: vi.fn(),
        },
      },
      teams: {
        ':teamId': {
          upload: {
            tasks: {
              $post: vi.fn(),
              ':taskId': {
                $patch: vi.fn(),
              },
            },
          },
        },
      },
    },
  }

  beforeEach(() => {
    vi.resetAllMocks()
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((code?: string | number | null): never => {
        throw new Error(`process.exit(${code})`)
      })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getClient).mockReturnValue(mockClient as any)
  })

  afterEach(() => {
    logSpy.mockRestore()
    writeSpy.mockRestore()
    errorSpy.mockRestore()
    exitSpy.mockRestore()
  })

  describe('project ls', () => {
    it('prints list of projects correctly', async () => {
      mockClient.api.projects.$get.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'p1', name: 'Proj 1', rootFolder: 'root1' },
            { id: 'p2', name: 'Proj 2', rootFolder: 'root2' },
          ],
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      await projectLs()

      expect(mockClient.api.projects.$get).toHaveBeenCalledWith({
        query: { first: '200' },
      })
      expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('Proj 1'))
      expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('Proj 2'))
    })
  })

  describe('ls', () => {
    it('queries folders and files and displays table', async () => {
      mockClient.api.folders[':folderId'].children.$get
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [{ id: 'subfolder1', name: 'Sub 1', type: 'folder', sizeByte: 0 }],
          }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [{ id: 'file1', name: 'doc.pdf', type: 'file', sizeByte: 1024 }],
          }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)

      await ls('parentId123')

      expect(mockClient.api.folders[':folderId'].children.$get).toHaveBeenCalledTimes(2)
      expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('Sub 1'))
      expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('doc.pdf'))
    })
  })

  describe('mkdir', () => {
    it('calls POST /folders and prints the folder ID', async () => {
      mockClient.api.folders.$post.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'new_folder_ulid' }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      await mkdir('NewFolder', 'parent_ulid')

      expect(mockClient.api.folders.$post).toHaveBeenCalledWith({
        json: { name: 'NewFolder', parentId: 'parent_ulid' },
      })
      expect(logSpy).toHaveBeenCalledWith('Created folder with ID: new_folder_ulid')
    })
  })

  describe('upload', () => {
    it('uploads a file successfully and confirms the task', async () => {
      const tempFile = 'temp-test-file.txt'
      fs.writeFileSync(tempFile, 'hello world')

      mockClient.api.folders[':folderId'].$get.mockResolvedValue({
        ok: true,
        json: async () => ({ projectId: 'p123' }),
        // We use any here because we are mocking the hono client response shape in a unit test context
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      mockClient.api.projects[':projectId'].$get.mockResolvedValue({
        ok: true,
        json: async () => ({ teamId: 't123' }),
        // We use any here because we are mocking the hono client response shape in a unit test context
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      mockClient.api.teams[':teamId'].upload.tasks.$post.mockImplementation(
        async (req: unknown) => {
          const rootNodeId = (req as { json: { files: { id: string }[] } }).json.files[0].id
          return {
            ok: true,
            json: async () => ({
              taskId: 'task123',
              presignedUrls: [
                { id: rootNodeId, fileId: 'file-123', url: 'http://localhost/upload' },
              ],
              createdAssets: [{ tempId: rootNodeId, assetId: 'file-123' }],
            }),
            // We use any here because we are mocking the hono client response shape in a unit test context
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any
        },
      )

      mockClient.api.teams[':teamId'].upload.tasks[':taskId'].$patch.mockResolvedValue({
        ok: true,
        // We use any here because we are mocking the hono client response shape in a unit test context
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      const mockRes = {
        statusCode: 200,
        resume: vi.fn(),
      }
      let mockReqCallback: ((res: { statusCode: number; resume: () => void }) => void) | null = null
      const mockReq = {
        on: vi.fn().mockImplementation(() => {
          return mockReq
        }),
        write: vi.fn(),
        end: vi.fn().mockImplementation(() => {
          if (mockReqCallback) {
            mockReqCallback(mockRes)
          }
        }),
        destroy: vi.fn(),
      }

      vi.mocked(http.request).mockImplementation(((
        _options: unknown,
        callback: (res: { statusCode: number; resume: () => void }) => void,
      ) => {
        mockReqCallback = callback
        return mockReq
        // We use any here because we are mocking the http request function in a unit test context
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any)

      await upload(tempFile, 'folder-123')

      expect(mockClient.api.folders[':folderId'].$get).toHaveBeenCalledWith({
        param: { folderId: 'folder-123' },
      })
      expect(mockClient.api.projects[':projectId'].$get).toHaveBeenCalledWith({
        param: { projectId: 'p123' },
      })
      expect(mockClient.api.teams[':teamId'].upload.tasks.$post).toHaveBeenCalled()
      expect(mockClient.api.teams[':teamId'].upload.tasks[':taskId'].$patch).toHaveBeenCalledWith({
        param: { teamId: 't123', taskId: 'task123' },
        json: { fileId: 'file-123' },
      })

      try {
        fs.unlinkSync(tempFile)
      } catch {
        // Ignore if file doesn't exist
      }
    })
  })

  describe('create-version', () => {
    it('fails if local path is a directory', async () => {
      const tempDir = 'temp-test-dir'
      fs.mkdirSync(tempDir, { recursive: true })

      await expect(createVersion(tempDir, 'file-123')).rejects.toThrow('process.exit(1)')

      try {
        fs.rmdirSync(tempDir)
      } catch {
        // Ignore
      }
    })

    it('fails if parent asset is not file or version_stack', async () => {
      const tempFile = 'temp-test-file-ver.txt'
      fs.writeFileSync(tempFile, 'hello ver')

      mockClient.api.folders[':folderId'].$get.mockResolvedValue({
        ok: true,
        json: async () => ({ type: 'folder', projectId: 'p123' }),
        // We use any here because we are mocking the hono client response shape in a unit test context
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      await expect(createVersion(tempFile, 'folder-123')).rejects.toThrow('process.exit(1)')

      try {
        fs.unlinkSync(tempFile)
      } catch {
        // Ignore
      }
    })

    it('succeeds if parent asset is a file', async () => {
      const tempFile = 'temp-test-file-ver.txt'
      fs.writeFileSync(tempFile, 'hello ver')

      mockClient.api.folders[':folderId'].$get.mockResolvedValue({
        ok: true,
        json: async () => ({ type: 'file', projectId: 'p123' }),
        // We use any here because we are mocking the hono client response shape in a unit test context
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      mockClient.api.projects[':projectId'].$get.mockResolvedValue({
        ok: true,
        json: async () => ({ teamId: 't123' }),
        // We use any here because we are mocking the hono client response shape in a unit test context
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      mockClient.api.teams[':teamId'].upload.tasks.$post.mockImplementation(
        async (req: unknown) => {
          const rootNodeId = (req as { json: { files: { id: string }[] } }).json.files[0].id
          return {
            ok: true,
            json: async () => ({
              taskId: 'task123',
              presignedUrls: [
                { id: rootNodeId, fileId: 'file-123', url: 'http://localhost/upload' },
              ],
              createdAssets: [{ tempId: rootNodeId, assetId: 'file-123' }],
            }),
            // We use any here because we are mocking the hono client response shape in a unit test context
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any
        },
      )

      mockClient.api.teams[':teamId'].upload.tasks[':taskId'].$patch.mockResolvedValue({
        ok: true,
        // We use any here because we are mocking the hono client response shape in a unit test context
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      const mockRes = {
        statusCode: 200,
        resume: vi.fn(),
      }
      let mockReqCallback: ((res: { statusCode: number; resume: () => void }) => void) | null = null
      const mockReq = {
        on: vi.fn().mockImplementation(() => {
          return mockReq
        }),
        write: vi.fn(),
        end: vi.fn().mockImplementation(() => {
          if (mockReqCallback) {
            mockReqCallback(mockRes)
          }
        }),
        destroy: vi.fn(),
      }

      vi.mocked(http.request).mockImplementation(((
        _options: unknown,
        callback: (res: { statusCode: number; resume: () => void }) => void,
      ) => {
        mockReqCallback = callback
        return mockReq
        // We use any here because we are mocking the http request function in a unit test context
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any)

      await createVersion(tempFile, 'file-123')

      expect(mockClient.api.folders[':folderId'].$get).toHaveBeenCalledWith({
        param: { folderId: 'file-123' },
      })
      expect(mockClient.api.teams[':teamId'].upload.tasks.$post).toHaveBeenCalledWith({
        param: { teamId: 't123' },
        json: expect.objectContaining({ parentId: 'file-123' }),
      })

      try {
        fs.unlinkSync(tempFile)
      } catch {
        // Ignore
      }
    })
  })

  describe('rename', () => {
    it('exits with error when assetId or newName is missing', async () => {
      await expect(rename('', 'new-name')).rejects.toThrow('process.exit(1)')
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Asset ID is required'))

      await expect(rename('asset-1', '')).rejects.toThrow('process.exit(1)')
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('New name is required'))
    })

    it('renames a folder when asset type is folder', async () => {
      mockClient.api.folders[':folderId'].$get.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'f-1', type: 'folder' }),
      } as unknown as Response)
      mockClient.api.folders[':folderId'].$put.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'f-1', name: 'Renamed Folder' }),
      } as unknown as Response)

      await rename('f-1', 'Renamed Folder')

      expect(mockClient.api.folders[':folderId'].$put).toHaveBeenCalledWith({
        param: { folderId: 'f-1' },
        json: { name: 'Renamed Folder' },
      })
      expect(logSpy).toHaveBeenCalledWith('Renamed asset f-1 to "Renamed Folder"')
    })

    it('renames a file when asset type is file', async () => {
      mockClient.api.folders[':folderId'].$get.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'file-1', type: 'file' }),
      } as unknown as Response)
      mockClient.api.files[':fileId'].$put.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'file-1', name: 'new.mp4' }),
      } as unknown as Response)

      await rename('file-1', 'new.mp4')

      expect(mockClient.api.files[':fileId'].$put).toHaveBeenCalledWith({
        param: { fileId: 'file-1' },
        json: { name: 'new.mp4' },
      })
      expect(logSpy).toHaveBeenCalledWith('Renamed asset file-1 to "new.mp4"')
    })

    it('exits with error when asset fetch fails', async () => {
      mockClient.api.folders[':folderId'].$get.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Asset not found' }),
      } as unknown as Response)

      await expect(rename('unknown-id', 'name')).rejects.toThrow('process.exit(1)')
      expect(errorSpy).toHaveBeenCalledWith('Error: Asset not found')
    })
  })

  describe('move', () => {
    it('exits with error when assetIds or parentId is missing', async () => {
      await expect(move([], 'parent-1')).rejects.toThrow('process.exit(1)')
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('At least one asset ID is required'),
      )

      await expect(move(['a-1'], '')).rejects.toThrow('process.exit(1)')
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Option -p/--parent <parentId> is required'),
      )
    })

    it('successfully moves assets', async () => {
      mockClient.api.folders[':folderId'].$get.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'parent-1', projectId: 'proj-1' }),
      } as unknown as Response)
      mockClient.api.projects[':projectId'].reparent.$post.mockResolvedValue({
        ok: true,
      } as unknown as Response)

      await move(['a-1', 'a-2'], 'parent-1')

      expect(mockClient.api.projects[':projectId'].reparent.$post).toHaveBeenCalledWith({
        param: { projectId: 'proj-1' },
        json: {
          assetIds: ['a-1', 'a-2'],
          newParentId: 'parent-1',
        },
      })
      expect(logSpy).toHaveBeenCalledWith('Moved 2 asset(s) to parent parent-1')
    })

    it('exits with error when destination parent is not found', async () => {
      mockClient.api.folders[':folderId'].$get.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Folder not found' }),
      } as unknown as Response)

      await expect(move(['a-1'], 'missing-parent')).rejects.toThrow('process.exit(1)')
      expect(errorSpy).toHaveBeenCalledWith('Error: Folder not found')
    })
  })

  describe('deleteAsset', () => {
    it('exits with error when --allow-delete is false', async () => {
      await expect(deleteAsset(['a-1'], false)).rejects.toThrow('process.exit(1)')
      expect(errorSpy).toHaveBeenCalledWith(
        'Error: Deleting an asset requires the --allow-delete flag.',
      )
    })

    it('exits with error when assetIds is empty', async () => {
      await expect(deleteAsset([], true)).rejects.toThrow('process.exit(1)')
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Asset ID is required'))
    })

    it('exits with error when more than one asset ID is passed', async () => {
      await expect(deleteAsset(['a-1', 'a-2'], true)).rejects.toThrow('process.exit(1)')
      expect(errorSpy).toHaveBeenCalledWith('Error: Can only delete one asset at a time.')
    })

    it('successfully deletes a single asset when --allow-delete is provided', async () => {
      mockClient.api.files.$delete.mockResolvedValue({
        ok: true,
      } as unknown as Response)

      await deleteAsset(['a-1'], true)

      expect(mockClient.api.files.$delete).toHaveBeenCalledWith({
        json: { ids: ['a-1'] },
      })
      expect(logSpy).toHaveBeenCalledWith('Deleted asset a-1')
    })

    it('exits with error when delete API returns an error', async () => {
      mockClient.api.files.$delete.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Failed to delete' }),
      } as unknown as Response)

      await expect(deleteAsset(['a-1'], true)).rejects.toThrow('process.exit(1)')
      expect(errorSpy).toHaveBeenCalledWith('Error: Failed to delete')
    })
  })
})
