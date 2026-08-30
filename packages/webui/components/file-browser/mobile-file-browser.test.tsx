// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MobileFileBrowser } from './mobile-file-browser'
import type { AssetInfo } from '@shumai/dtos'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@dnd-kit/react', () => ({
  useDraggable: () => ({
    ref: vi.fn(),
    isDragging: false,
  }),
  useDroppable: () => ({
    ref: vi.fn(),
    isOver: false,
  }),
}))

vi.mock('@/ui/hooks/use-permissions', () => ({
  usePermissions: () => ({
    canEdit: true,
    canAdmin: true,
    canView: true,
  }),
}))

vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      files: {
        $delete: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
        'download-links': {
          $post: vi.fn().mockResolvedValue({ ok: true, json: async () => ({ files: [] }) }),
        },
        restore: {
          $post: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
        },
        ':fileId': {
          $get: vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({}),
          }),
          $put: vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({}),
          }),
        },
      },
      folders: {
        $post: vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ id: 'new-folder-id' }),
        }),
        $delete: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
        restore: {
          $post: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
        },
        ':folderId': {
          $put: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
        },
      },
      teams: {
        ':teamId': {
          upload: {
            tasks: {
              $post: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
              ':taskId': {
                $patch: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
              },
            },
          },
        },
      },
      projects: {
        ':projectId': {
          'empty-trash': {
            $post: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
          },
        },
      },
    },
  },
}))

describe('MobileFileBrowser', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
  })

  afterEach(() => {
    cleanup()
  })

  const mockFolder: AssetInfo = {
    id: 'folder-1',
    name: 'Test Folder',
    type: 'folder',
    fileCount: 3,
    sizeByte: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    status: 'processed',
  } as AssetInfo

  const mockFile: AssetInfo = {
    id: 'file-1',
    name: 'test_document.pdf',
    type: 'file',
    sizeByte: 1024 * 100,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    status: 'processed',
  } as AssetInfo

  const defaultProps = {
    teamId: 'team-1',
    projectId: 'project-1',
    assetId: 'root-folder',
    folders: [mockFolder],
    files: [mockFile],
    selectedItem: null,
    selectedIds: new Set<string>(),
    onItemSelect: vi.fn(),
    onItemDoubleClick: vi.fn(),
    onClearSelection: vi.fn(),
    fetchNextFoldersPage: vi.fn(),
    hasNextFoldersPage: false,
    isFetchingNextFoldersPage: false,
    fetchNextFilesPage: vi.fn(),
    hasNextFilesPage: false,
    isFetchingNextFilesPage: false,
  }

  const renderComponent = (props: Partial<React.ComponentProps<typeof MobileFileBrowser>> = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MobileFileBrowser {...defaultProps} {...props} />
      </QueryClientProvider>,
    )
  }

  it('renders folders and files in mobile grid', () => {
    renderComponent()

    expect(screen.getByText('Test Folder')).toBeDefined()
    expect(screen.getByText('test_document.pdf')).toBeDefined()
  })

  it('triggers onItemSelect when an item is clicked', () => {
    const onItemSelect = vi.fn()
    renderComponent({ onItemSelect })

    const folderElement = screen.getByText('Test Folder')
    fireEvent.click(folderElement)

    expect(onItemSelect).toHaveBeenCalled()
  })

  it('triggers onItemDoubleClick when an item is double-clicked', () => {
    const onItemDoubleClick = vi.fn()
    renderComponent({ onItemDoubleClick })

    const folderElement = screen.getByText('Test Folder')
    fireEvent.doubleClick(folderElement)

    expect(onItemDoubleClick).toHaveBeenCalledWith(mockFolder)
  })

  it('renders empty state when there are no folders and files and not loading', () => {
    renderComponent({ folders: [], files: [], isLoading: false })

    expect(screen.getByText(/This folder is empty|此文件夹为空/i)).toBeDefined()
  })

  it('renders loading skeleton and does not render empty state when isLoading is true', () => {
    renderComponent({ folders: [], files: [], isLoading: true })

    expect(screen.queryByText(/This folder is empty|此文件夹为空/i)).toBeNull()
    expect(screen.getByTestId('mobile-file-browser-loading-skeleton')).toBeDefined()
  })

  it('renders collapsible section headers for folders and files with count and size', () => {
    renderComponent({
      totalFoldersSize: 50000,
      totalFilesSize: 100000,
    })

    expect(screen.getByText(/1 Folder • 50 KB/i)).toBeDefined()
    expect(screen.getByText(/1 Asset • 100 KB/i)).toBeDefined()
  })

  it('collapses and expands folders and files when clicking section headers', () => {
    renderComponent()

    expect(screen.getByText('Test Folder')).toBeDefined()
    expect(screen.getByText('test_document.pdf')).toBeDefined()

    // Collapse folders
    const folderHeaderBtn = screen.getByRole('button', { name: /Folder/i })
    fireEvent.click(folderHeaderBtn)

    expect(screen.queryByText('Test Folder')).toBeNull()

    // Expand folders back
    fireEvent.click(folderHeaderBtn)
    expect(screen.getByText('Test Folder')).toBeDefined()

    // Collapse files
    const fileHeaderBtn = screen.getByRole('button', { name: /Asset/i })
    fireEvent.click(fileHeaderBtn)

    expect(screen.queryByText('test_document.pdf')).toBeNull()

    // Expand files back
    fireEvent.click(fileHeaderBtn)
    expect(screen.getByText('test_document.pdf')).toBeDefined()
  })

  it('renders Floating Action Button when canEdit is true', () => {
    renderComponent()

    expect(screen.getByRole('button', { name: /actions/i })).toBeDefined()
  })

  it('completes upload and confirms upload on 2xx response', async () => {
    const originalXhr = window.XMLHttpRequest
    const patchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })

    const { client } = await import('@/ui/api/client')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(client.api.teams[':teamId'].upload.tasks as any)['$post'] = vi
      .fn()
      .mockImplementation(async (req) => {
        const json = req.json
        return {
          ok: true,
          json: async () => ({
            taskId: 'task-1',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            presignedUrls: json.files.map((f: any) => ({
              id: f.id,
              url: 'https://upload.example.com',
              fileId: 'server-file-1',
            })),
          }),
        }
      })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(client.api.teams[':teamId'].upload.tasks[':taskId'] as any)['$patch'] = patchMock

    class MockXhr {
      open = vi.fn()
      setRequestHeader = vi.fn()
      send = vi.fn(() => {
        this.status = 200
        this.onload?.()
      })
      status = 200
      upload = { onprogress: null as unknown }
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      onabort: (() => void) | null = null
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    window.XMLHttpRequest = MockXhr as any

    const { container } = renderComponent()
    const fileInput = container.querySelector(
      'input[type="file"]:not([webkitdirectory])',
    ) as HTMLInputElement
    expect(fileInput).toBeDefined()

    const testFile = new File(['content'], 'hello.txt', { type: 'text/plain' })
    fireEvent.change(fileInput, { target: { files: [testFile] } })

    // Wait for mutation to finish
    await vi.waitFor(() => {
      expect(patchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          param: { teamId: 'team-1', taskId: 'task-1' },
          json: { fileId: 'server-file-1' },
        }),
      )
    })

    window.XMLHttpRequest = originalXhr
  })

  it('fails upload and confirms with error on non-2xx status', async () => {
    const originalXhr = window.XMLHttpRequest
    const patchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })

    const { client } = await import('@/ui/api/client')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(client.api.teams[':teamId'].upload.tasks as any)['$post'] = vi
      .fn()
      .mockImplementation(async (req) => {
        const json = req.json
        return {
          ok: true,
          json: async () => ({
            taskId: 'task-2',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            presignedUrls: json.files.map((f: any) => ({
              id: f.id,
              url: 'https://upload.example.com',
              fileId: 'server-file-2',
            })),
          }),
        }
      })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(client.api.teams[':teamId'].upload.tasks[':taskId'] as any)['$patch'] = patchMock

    class MockXhr500 {
      open = vi.fn()
      setRequestHeader = vi.fn()
      send = vi.fn(() => {
        this.status = 500
        this.onload?.()
      })
      status = 500
      upload = { onprogress: null as unknown }
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      onabort: (() => void) | null = null
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    window.XMLHttpRequest = MockXhr500 as any

    const { container } = renderComponent()
    const fileInput = container.querySelector(
      'input[type="file"]:not([webkitdirectory])',
    ) as HTMLInputElement

    const testFile = new File(['content'], 'error.txt', { type: 'text/plain' })
    fireEvent.change(fileInput, { target: { files: [testFile] } })

    await vi.waitFor(() => {
      expect(patchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          param: { teamId: 'team-1', taskId: 'task-2' },
          json: {
            fileId: 'server-file-2',
            errorMessage: 'upload failed with status: 500',
          },
        }),
      )
    })

    window.XMLHttpRequest = originalXhr
  })

  it('fails upload and confirms with error on network failure', async () => {
    const originalXhr = window.XMLHttpRequest
    const patchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })

    const { client } = await import('@/ui/api/client')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(client.api.teams[':teamId'].upload.tasks as any)['$post'] = vi
      .fn()
      .mockImplementation(async (req) => {
        const json = req.json
        return {
          ok: true,
          json: async () => ({
            taskId: 'task-3',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            presignedUrls: json.files.map((f: any) => ({
              id: f.id,
              url: 'https://upload.example.com',
              fileId: 'server-file-3',
            })),
          }),
        }
      })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(client.api.teams[':teamId'].upload.tasks[':taskId'] as any)['$patch'] = patchMock

    class MockXhrError {
      open = vi.fn()
      setRequestHeader = vi.fn()
      send = vi.fn(() => {
        this.onerror?.()
      })
      status = 0
      upload = { onprogress: null as unknown }
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      onabort: (() => void) | null = null
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    window.XMLHttpRequest = MockXhrError as any

    const { container } = renderComponent()
    const fileInput = container.querySelector(
      'input[type="file"]:not([webkitdirectory])',
    ) as HTMLInputElement

    const testFile = new File(['content'], 'network-error.txt', { type: 'text/plain' })
    fireEvent.change(fileInput, { target: { files: [testFile] } })

    await vi.waitFor(() => {
      expect(patchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          param: { teamId: 'team-1', taskId: 'task-3' },
          json: {
            fileId: 'server-file-3',
            errorMessage: 'upload failed with error: Network error',
          },
        }),
      )
    })

    window.XMLHttpRequest = originalXhr
  })

  it('hides Floating Action Button in public share mode', () => {
    renderComponent({ isPublic: true })

    expect(screen.queryByRole('button', { name: /actions/i })).toBeNull()
  })
})
