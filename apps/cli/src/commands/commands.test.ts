import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { projectLs } from './project'
import { ls } from './ls'
import { mkdir } from './mkdir'
import { getClient } from '../client'

vi.mock('../client', () => ({
  getClient: vi.fn(),
}))

describe('CLI Commands', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let logSpy: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let errorSpy: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let exitSpy: any

  const mockClient = {
    api: {
      projects: {
        $get: vi.fn(),
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
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Proj 1'))
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Proj 2'))
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
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Sub 1'))
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('doc.pdf'))
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
})
