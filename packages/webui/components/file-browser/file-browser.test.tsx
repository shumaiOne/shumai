// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FileBrowser } from './file-browser'
import type { AssetInfo } from '@shumai/dtos'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (options: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: options.count }, (_, i) => ({
        index: i,
        start: i * 50,
        size: 50,
        key: i,
      })),
    getTotalSize: () => options.count * 50,
  }),
}))

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

vi.mock('@/ui/components/file-viewer', () => ({
  FileViewer: ({ file }: { file: AssetInfo }) => (
    <div data-testid="mock-file-viewer">
      <span>Viewer for {file.name}</span>
    </div>
  ),
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
          $get: vi.fn().mockImplementation(async ({ param }: { param: { fileId: string } }) => ({
            ok: true,
            json: async () => ({
              id: param.fileId,
              name: param.fileId === 'file-2' ? 'second_document.pdf' : 'photo.jpg',
              type: 'file',
            }),
          })),
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
          shares: {
            $get: vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) }),
            $post: vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'share-1' }) }),
          },
          reparent: {
            $post: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
          },
          copy: {
            $post: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
          },
        },
      },
    },
  },
}))

describe('FileBrowser', () => {
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
    onSaveField: vi.fn(),
    displayStyle: 'card' as const,
    onClearSelection: vi.fn(),
    fetchNextFoldersPage: vi.fn(),
    hasNextFoldersPage: false,
    isFetchingNextFoldersPage: false,
    fetchNextFilesPage: vi.fn(),
    hasNextFilesPage: false,
    isFetchingNextFilesPage: false,
  }

  const renderComponent = (props: Partial<React.ComponentProps<typeof FileBrowser>> = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <FileBrowser {...defaultProps} {...props} />
      </QueryClientProvider>,
    )
  }

  it('renders folders and files in card view', () => {
    renderComponent()

    expect(screen.getByText('Test Folder')).toBeDefined()
    expect(screen.getByText('test_document.pdf')).toBeDefined()
  })

  it('renders empty state when there are no folders and files and not loading', () => {
    renderComponent({ folders: [], files: [], isLoading: false })

    expect(screen.getByText(/This folder is empty|此文件夹为空/i)).toBeDefined()
  })

  it('renders loading skeleton and does not render empty state when isLoading is true (card view)', () => {
    renderComponent({ folders: [], files: [], isLoading: true, displayStyle: 'card' })

    expect(screen.queryByText(/This folder is empty|此文件夹为空/i)).toBeNull()
    expect(screen.getByTestId('file-browser-loading-skeleton')).toBeDefined()
  })

  it('renders loading skeleton and does not render empty state when isLoading is true (list view)', () => {
    renderComponent({ folders: [], files: [], isLoading: true, displayStyle: 'list' })

    expect(screen.queryByText(/This folder is empty|此文件夹为空/i)).toBeNull()
    expect(screen.getByTestId('file-browser-loading-skeleton')).toBeDefined()
  })

  it('opens quick preview when Space is pressed on a selected file', async () => {
    renderComponent({
      selectedIds: new Set(['file-1']),
      selectedItem: mockFile,
    })

    fireEvent.keyDown(window, { key: ' ', code: 'Space' })

    expect(screen.getByTestId('file-preview-dialog-content')).toBeDefined()
    expect(await screen.findByTestId('mock-file-viewer')).toBeDefined()
  })

  it('opens quick preview when Space is pressed on a selected folder', () => {
    renderComponent({
      selectedIds: new Set(['folder-1']),
      selectedItem: mockFolder,
    })

    fireEvent.keyDown(window, { key: ' ', code: 'Space' })

    expect(screen.getByTestId('file-preview-dialog-content')).toBeDefined()
    expect(screen.getByTestId('folder-preview-icon')).toBeDefined()
  })

  it('previews the latest selected item when multiple items are selected', async () => {
    const mockFile2: AssetInfo = {
      id: 'file-2',
      name: 'second_document.pdf',
      type: 'file',
      sizeByte: 2048,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      status: 'processed',
    } as AssetInfo

    renderComponent({
      files: [mockFile, mockFile2],
      selectedIds: new Set(['file-1', 'file-2']),
      selectedItem: mockFile2,
    })

    fireEvent.keyDown(window, { key: ' ', code: 'Space' })

    expect(screen.getByTestId('file-preview-dialog-content')).toBeDefined()
    expect(await screen.findByText('Viewer for second_document.pdf')).toBeDefined()
  })

  it('does not open quick preview when Space is pressed with no selection', () => {
    renderComponent({
      selectedIds: new Set(),
      selectedItem: null,
    })

    fireEvent.keyDown(window, { key: ' ', code: 'Space' })

    expect(screen.queryByTestId('file-preview-dialog-content')).toBeNull()
  })

  it('does not open quick preview when Space is pressed while typing in an input element', () => {
    renderComponent({
      selectedIds: new Set(['file-1']),
      selectedItem: mockFile,
    })

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    fireEvent.keyDown(input, { key: ' ', code: 'Space' })

    expect(screen.queryByTestId('file-preview-dialog-content')).toBeNull()
    document.body.removeChild(input)
  })
})
