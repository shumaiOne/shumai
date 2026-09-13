// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FileViewerRightSidebar } from './file-viewer-right-sidebar'
import type { AssetInfo } from '@shumai/dtos'
import { toast } from 'sonner'

vi.mock('react-intersection-observer', () => ({
  useInView: () => ({
    ref: vi.fn(),
    inView: false,
  }),
}))

vi.mock('@/ui/hooks/use-permissions', () => ({
  usePermissions: () => ({
    canEdit: true,
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

const mockExportPost = vi.fn()

vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      projects: {
        ':projectId': {
          fields: {
            $get: vi.fn().mockResolvedValue({
              ok: true,
              json: async () => [],
            }),
          },
          team: {
            $get: vi.fn().mockResolvedValue({
              ok: true,
              json: async () => ({ id: 'team-1' }),
            }),
          },
        },
      },
      files: {
        ':fileId': {
          comments: {
            $get: vi.fn().mockResolvedValue({
              ok: true,
              json: async () => ({
                data: [
                  {
                    id: 'comment-1',
                    message: 'Great shot!',
                    userId: 'user-1',
                    createdAt: new Date().toISOString(),
                  },
                ],
                pageInfo: {},
              }),
            }),
            $post: vi.fn().mockResolvedValue({
              ok: true,
              json: async () => ({ id: 'new-comment-id' }),
            }),
            export: {
              $post: (...args: unknown[]) => mockExportPost(...args),
            },
          },
        },
      },
      shares: {
        ':shareId': {
          files: {
            ':fileId': {
              comments: {
                $get: vi.fn().mockResolvedValue({
                  ok: true,
                  json: async () => ({ data: [], pageInfo: {} }),
                }),
              },
            },
          },
        },
      },
      me: {
        $get: vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ id: 'user-1', name: 'Test User' }),
        }),
      },
    },
  },
}))

describe('FileViewerRightSidebar - Comments Export', () => {
  let queryClient: QueryClient
  let createObjectUrlMock: ReturnType<typeof vi.spyOn>
  let revokeObjectUrlMock: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    vi.clearAllMocks()

    createObjectUrlMock = vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock-url')
    revokeObjectUrlMock = vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {})
    window.HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(false)
    window.HTMLElement.prototype.setPointerCapture = vi.fn()
    window.HTMLElement.prototype.releasePointerCapture = vi.fn()
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  afterEach(() => {
    cleanup()
  })

  const mockFile: AssetInfo = {
    id: 'file-123',
    name: 'sample_cut.mp4',
    proxyType: 'video',
    media: {
      metadata: {
        duration: 120,
        frameRate: 24,
      },
    },
  } as AssetInfo

  it('renders "All comments" and the three-dot button in authenticated sidebar', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <FileViewerRightSidebar
          teamId="team-1"
          projectId="proj-1"
          file={mockFile}
          onSaveField={vi.fn()}
          members={[{ id: 'user-1', name: 'User One', role: 'owner' }]}
          isPublic={false}
        />
      </QueryClientProvider>,
    )

    expect(screen.getByText('All comments')).toBeDefined()
    expect(screen.getByRole('button', { name: 'More options' })).toBeDefined()
  })

  it('does NOT render "All comments" header row in public share view', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <FileViewerRightSidebar
          teamId="team-1"
          projectId="proj-1"
          file={mockFile}
          onSaveField={vi.fn()}
          members={[]}
          isPublic={true}
          shareId="share-123"
        />
      </QueryClientProvider>,
    )

    expect(screen.queryByText('All comments')).toBeNull()
    expect(screen.queryByRole('button', { name: 'More options' })).toBeNull()
  })

  it('opens dropdown menu with Export Comments and the 4 NLE options', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <FileViewerRightSidebar
          teamId="team-1"
          projectId="proj-1"
          file={mockFile}
          onSaveField={vi.fn()}
          members={[{ id: 'user-1', name: 'User One', role: 'owner' }]}
          isPublic={false}
        />
      </QueryClientProvider>,
    )

    const moreButton = screen.getByRole('button', { name: 'More options' })
    fireEvent.pointerDown(moreButton, { button: 0, ctrlKey: false })

    // Submenu trigger should be visible
    const exportText = await screen.findByText('Export Comments')
    const subTrigger = exportText.closest('[data-slot="dropdown-menu-sub-trigger"]') || exportText
    expect(subTrigger).toBeDefined()

    // Open submenu via ArrowRight or click
    fireEvent.keyDown(subTrigger, { key: 'ArrowRight', code: 'ArrowRight' })

    // All 4 formats should be rendered
    expect(await screen.findByText('FCP 10.4.0+')).toBeDefined()
    expect(screen.getByText('FIOJSON')).toBeDefined()

    expect(screen.getByText('Media Composer')).toBeDefined()

    expect(screen.getByText('Premiere Pro')).toBeDefined()
    expect(screen.getAllByText('XML').length).toBe(2) // Media Composer + Premiere Pro

    expect(screen.getByText('Resolve')).toBeDefined()
    expect(screen.getByText('EDL')).toBeDefined()
  })

  it('calls export API and triggers download when selecting an NLE format', async () => {
    const mockBlob = new Blob(['TITLE: sample\n001 ...'], { type: 'application/edl' })
    mockExportPost.mockResolvedValueOnce({
      ok: true,
      blob: async () => mockBlob,
      headers: new Headers({
        'content-disposition': 'attachment; filename="sample_cut_comments.edl"',
      }),
    })

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    render(
      <QueryClientProvider client={queryClient}>
        <FileViewerRightSidebar
          teamId="team-1"
          projectId="proj-1"
          file={mockFile}
          onSaveField={vi.fn()}
          members={[{ id: 'user-1', name: 'User One', role: 'owner' }]}
          isPublic={false}
        />
      </QueryClientProvider>,
    )

    const moreButton = screen.getByRole('button', { name: 'More options' })
    fireEvent.pointerDown(moreButton, { button: 0, ctrlKey: false })

    const exportText = await screen.findByText('Export Comments')
    const subTrigger = exportText.closest('[data-slot="dropdown-menu-sub-trigger"]') || exportText
    fireEvent.keyDown(subTrigger, { key: 'ArrowRight', code: 'ArrowRight' })

    const resolveOption = await screen.findByText('Resolve')
    fireEvent.click(resolveOption.closest('[data-slot="dropdown-menu-item"]') || resolveOption)

    await waitFor(() => {
      expect(mockExportPost).toHaveBeenCalledWith({
        param: { fileId: 'file-123' },
        json: {
          format: 'resolve-edl',
          timeZone: expect.any(String),
        },
      })
    })

    expect(createObjectUrlMock).toHaveBeenCalledWith(mockBlob)
    expect(clickSpy).toHaveBeenCalled()
    expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:mock-url')
    clickSpy.mockRestore()
  })

  it('shows error toast when export fails', async () => {
    mockExportPost.mockResolvedValueOnce({
      ok: false,
      status: 500,
    })

    render(
      <QueryClientProvider client={queryClient}>
        <FileViewerRightSidebar
          teamId="team-1"
          projectId="proj-1"
          file={mockFile}
          onSaveField={vi.fn()}
          members={[{ id: 'user-1', name: 'User One', role: 'owner' }]}
          isPublic={false}
        />
      </QueryClientProvider>,
    )

    const moreButton = screen.getByRole('button', { name: 'More options' })
    fireEvent.pointerDown(moreButton, { button: 0, ctrlKey: false })

    const exportText = await screen.findByText('Export Comments')
    const subTrigger = exportText.closest('[data-slot="dropdown-menu-sub-trigger"]') || exportText
    fireEvent.keyDown(subTrigger, { key: 'ArrowRight', code: 'ArrowRight' })

    const premiereOption = await screen.findByText('Premiere Pro')
    fireEvent.click(premiereOption.closest('[data-slot="dropdown-menu-item"]') || premiereOption)

    await waitFor(() => {
      expect(mockExportPost).toHaveBeenCalledWith({
        param: { fileId: 'file-123' },
        json: {
          format: 'premiere-xml',
          timeZone: expect.any(String),
        },
      })
      expect(toast.error).toHaveBeenCalledWith('Failed to export comments')
    })
  })
})
