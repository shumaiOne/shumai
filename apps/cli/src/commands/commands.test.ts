import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { getClient } from '../client'
import { upload } from './upload'
import { createVersion } from './create-version'
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

describe('CLI upload commands', () => {
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
        $delete: vi.fn(),
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

  const originalAllowDelete = process.env.SHUMAI_ALLOW_DELETE

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
    if (originalAllowDelete !== undefined) {
      process.env.SHUMAI_ALLOW_DELETE = originalAllowDelete
    } else {
      delete process.env.SHUMAI_ALLOW_DELETE
    }
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
})
