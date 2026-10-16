// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AssetInfo } from '@shumai/dtos'
import { SearchFilterDialog } from './search-filter-dialog'

vi.mock('@dnd-kit/react', () => ({
  useDraggable: () => ({
    ref: vi.fn(),
    isDragging: false,
  }),
  useDroppable: () => ({
    ref: vi.fn(),
    isDropTarget: false,
  }),
}))

const mockSearchPost = vi.fn()
const mockSettingsGet = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ semanticSearchEnabled: true }),
})

vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      teams: {
        ':teamId': {
          settings: {
            $get: (...args: unknown[]) => mockSettingsGet(...args),
          },
        },
      },
      folders: {
        ':folderId': {
          search: {
            $post: (...args: unknown[]) => mockSearchPost(...args),
          },
        },
      },
      files: {
        ':fileId': {
          $get: vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({}),
          }),
        },
      },
      projects: {
        ':projectId': {
          collections: {
            $post: vi.fn().mockResolvedValue({
              ok: true,
              json: async () => ({ id: 'col-1' }),
            }),
          },
        },
      },
    },
  },
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useRouterState: () => '/projects/proj-1',
}))

describe('SearchFilterDialog', () => {
  let queryClient: QueryClient
  let windowOpenSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    windowOpenSpy.mockRestore()
  })

  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    teamId: 'team-1',
    projectId: 'proj-1',
    assetId: 'folder-root',
    fields: [],
    initialConditions: [],
    onApply: vi.fn(),
  }

  it('renders initial ready to search state when open and no query', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <SearchFilterDialog {...defaultProps} />
      </QueryClientProvider>,
    )

    expect(screen.getByText(/Ready to search|准备搜索/i)).toBeTruthy()
  })

  it('renders search results in a responsive grid using FileCard and FolderCard without checkboxes or action menus', async () => {
    const mockFile: AssetInfo = {
      id: 'file-101',
      name: 'video_clip.mp4',
      type: 'file',
      sizeByte: 1048576,
      status: 'processed',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      preview: {
        proxyType: 'video',
        thumbnailUrl: 'https://example.com/clip.jpg',
        duration: 120,
      },
    } as AssetInfo

    const mockFolder: AssetInfo = {
      id: 'folder-202',
      name: 'B-Roll Folder',
      type: 'folder',
      fileCount: 4,
      status: 'processed',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    } as AssetInfo

    mockSearchPost.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [mockFile, mockFolder],
        pageInfo: { total: 2 },
      }),
    })

    render(
      <QueryClientProvider client={queryClient}>
        <SearchFilterDialog
          {...defaultProps}
          initialConditions={[{ field: 'name', operator: 'contains', value: 'video' }]}
        />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('video_clip.mp4')).toBeTruthy()
      expect(screen.getByText('B-Roll Folder')).toBeTruthy()
    })

    // Neither card renders checkboxes or 3-dots action menus in search dialog
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByRole('button', { name: /more/i })).toBeNull()

    // Grid container is present
    const fileCard = screen.getByText('video_clip.mp4').closest('[data-testid="file-card"]')
    expect(fileCard).toBeTruthy()
    const gridContainer = fileCard?.parentElement
    expect(gridContainer?.className).toContain('grid')
  })

  it('single-clicking a file opens detail page in a new tab seeking to startTime without closing dialog', async () => {
    const onOpenChange = vi.fn()
    const mockSemanticFile: AssetInfo = {
      id: 'file-sem-1',
      name: 'interview.mp4',
      type: 'file',
      status: 'processed',
      startTime: 45,
      endTime: 90,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      preview: {
        proxyType: 'video',
        thumbnailUrl: 'https://example.com/interview.jpg',
        duration: 300,
      },
    } as AssetInfo

    mockSearchPost.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [mockSemanticFile],
        pageInfo: { total: 1 },
      }),
    })

    render(
      <QueryClientProvider client={queryClient}>
        <SearchFilterDialog
          {...defaultProps}
          onOpenChange={onOpenChange}
          initialConditions={[{ field: 'name', operator: 'contains', value: 'interview' }]}
        />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('interview.mp4')).toBeTruthy()
    })

    // Matched chunk duration replaces total duration in preview
    const matchedBadge = screen.getByTestId('file-preview-matched-duration')
    expect(matchedBadge.textContent).toBe('00:45 - 01:30')

    // Single click on file card
    const card = screen.getByText('interview.mp4').closest('[data-testid="file-card"]')!
    fireEvent.click(card)

    expect(windowOpenSpy).toHaveBeenCalledWith(
      '/projects/proj-1/files/file-sem-1?start=45',
      '_blank',
      'noopener,noreferrer',
    )
    // Dialog should NOT be closed
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('single-clicking a folder opens folder page in a new tab without closing dialog', async () => {
    const onOpenChange = vi.fn()
    const mockFolder: AssetInfo = {
      id: 'folder-sub-1',
      name: 'Subfolder Alpha',
      type: 'folder',
      status: 'processed',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    } as AssetInfo

    mockSearchPost.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [mockFolder],
        pageInfo: { total: 1 },
      }),
    })

    render(
      <QueryClientProvider client={queryClient}>
        <SearchFilterDialog
          {...defaultProps}
          onOpenChange={onOpenChange}
          initialConditions={[{ field: 'name', operator: 'contains', value: 'Subfolder' }]}
        />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('Subfolder Alpha')).toBeTruthy()
    })

    const card = screen.getByText('Subfolder Alpha').closest('[data-testid="file-card"]')!
    fireEvent.click(card)

    expect(windowOpenSpy).toHaveBeenCalledWith(
      '/projects/proj-1/folders/folder-sub-1',
      '_blank',
      'noopener,noreferrer',
    )
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('renders multiple distinct chunk matches for the same video file with unique timestamps', async () => {
    const chunk1: AssetInfo = {
      id: 'video-same',
      name: 'drone_shots.mp4',
      type: 'file',
      status: 'processed',
      startTime: 10,
      endTime: 30,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      preview: {
        proxyType: 'video',
        thumbnailUrl: 'https://example.com/drone.jpg',
        duration: 200,
      },
    } as AssetInfo

    const chunk2: AssetInfo = {
      id: 'video-same',
      name: 'drone_shots.mp4',
      type: 'file',
      status: 'processed',
      startTime: 120,
      endTime: 150,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      preview: {
        proxyType: 'video',
        thumbnailUrl: 'https://example.com/drone.jpg',
        duration: 200,
      },
    } as AssetInfo

    mockSearchPost.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [chunk1, chunk2],
        pageInfo: { total: 2 },
      }),
    })

    render(
      <QueryClientProvider client={queryClient}>
        <SearchFilterDialog
          {...defaultProps}
          initialConditions={[{ field: 'name', operator: 'contains', value: 'drone' }]}
        />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      const titles = screen.getAllByText('drone_shots.mp4')
      expect(titles).toHaveLength(2)
    })

    const badges = screen.getAllByTestId('file-preview-matched-duration')
    expect(badges).toHaveLength(2)
    expect(badges[0].textContent).toBe('00:10 - 00:30')
    expect(badges[1].textContent).toBe('02:00 - 02:30')
  })
})
