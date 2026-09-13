// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AssetInfo } from '@shumai/dtos'
import { FilePreviewDialog } from './file-preview-dialog'

vi.mock('@/ui/components/file-viewer', () => ({
  FileViewer: ({ file, autoPlay }: { file: AssetInfo; autoPlay?: boolean }) => (
    <div data-testid="mock-file-viewer" data-autoplay={String(autoPlay)}>
      <span>Viewer for {file.name}</span>
    </div>
  ),
}))

vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      files: {
        ':fileId': {
          $get: vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
              id: 'file-1',
              name: 'test_file.png',
              type: 'file',
            }),
          }),
        },
      },
      shares: {
        ':shareId': {
          files: {
            ':fileId': {
              $get: vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                  id: 'share-file-1',
                  name: 'share_file.png',
                  type: 'file',
                }),
              }),
            },
          },
        },
      },
    },
  },
}))

describe('FilePreviewDialog', () => {
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
    name: 'Designs Folder',
    type: 'folder',
    fileCount: 5,
    sizeByte: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    status: 'processed',
  } as AssetInfo

  const mockFile: AssetInfo = {
    id: 'file-1',
    name: 'photo.jpg',
    type: 'file',
    sizeByte: 2048,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    status: 'processed',
  } as AssetInfo

  it('renders folder preview with icon, folder name, and count', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <FilePreviewDialog item={mockFolder} isOpen={true} onClose={vi.fn()} />
      </QueryClientProvider>,
    )

    expect(screen.getByTestId('folder-preview-icon')).toBeDefined()
    expect(screen.getAllByText('Designs Folder').length).toBeGreaterThan(0)
    expect(screen.getByTestId('folder-preview-count').textContent).toMatch(/5/)
  })

  it('renders real file preview with header and FileViewer', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <FilePreviewDialog item={mockFile} isOpen={true} onClose={vi.fn()} />
      </QueryClientProvider>,
    )

    expect(screen.getByText('photo.jpg')).toBeDefined()
    const viewer = await screen.findByTestId('mock-file-viewer')
    expect(viewer).toBeDefined()
    expect(viewer.getAttribute('data-autoplay')).toBe('true')
  })

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn()
    render(
      <QueryClientProvider client={queryClient}>
        <FilePreviewDialog item={mockFile} isOpen={true} onClose={handleClose} />
      </QueryClientProvider>,
    )

    const closeBtn = screen.getByTestId('quick-preview-close-button')
    fireEvent.click(closeBtn)

    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Space key is pressed while dialog is open', () => {
    const handleClose = vi.fn()
    render(
      <QueryClientProvider client={queryClient}>
        <FilePreviewDialog item={mockFile} isOpen={true} onClose={handleClose} />
      </QueryClientProvider>,
    )

    const spaceEvent = new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true })
    const preventDefaultSpy = vi.spyOn(spaceEvent, 'preventDefault')
    const stopPropagationSpy = vi.spyOn(spaceEvent, 'stopPropagation')

    window.dispatchEvent(spaceEvent)

    expect(handleClose).toHaveBeenCalledTimes(1)
    expect(preventDefaultSpy).toHaveBeenCalled()
    expect(stopPropagationSpy).toHaveBeenCalled()
  })

  it('applies max 1920x1080 or 70vw/70vh bounds styling', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <FilePreviewDialog item={mockFile} isOpen={true} onClose={vi.fn()} />
      </QueryClientProvider>,
    )

    const content = screen.getByTestId('file-preview-dialog-content')
    expect(content.style.maxWidth).toBe('min(1920px, 70vw)')
    expect(content.style.maxHeight).toBe('min(1080px, 70vh)')
  })

  it('does not render when item is null', () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <FilePreviewDialog item={null} isOpen={true} onClose={vi.fn()} />
      </QueryClientProvider>,
    )

    expect(container.firstChild).toBeNull()
  })
})
