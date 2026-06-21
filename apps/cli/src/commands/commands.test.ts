import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { projectLs } from './project'
import { ls } from './ls'
import { mkdir } from './mkdir'
import { getClient } from '../client'
import { upload } from './upload'
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
        },
      },
      folders: {
        $post: vi.fn(),
        ':folderId': {
          $get: vi.fn(),
          children: {
            $get: vi.fn(),
          },
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
})
