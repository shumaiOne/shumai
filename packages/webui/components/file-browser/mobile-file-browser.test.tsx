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

  it('renders empty state when there are no folders and files', () => {
    renderComponent({ folders: [], files: [] })

    expect(screen.getByText(/This folder is empty|此文件夹为空/i)).toBeDefined()
  })

  it('renders Floating Action Button when canEdit is true', () => {
    renderComponent()

    expect(screen.getByRole('button', { name: /actions/i })).toBeDefined()
  })

  it('hides Floating Action Button in public share mode', () => {
    renderComponent({ isPublic: true })

    expect(screen.queryByRole('button', { name: /actions/i })).toBeNull()
  })
})
