// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AssetInfo } from '@shumai/dtos'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FindSimilarDialog } from './find-similar-dialog'

vi.mock('@dnd-kit/react', () => ({
  useDraggable: () => ({ ref: vi.fn(), isDragging: false }),
  useDroppable: () => ({ ref: vi.fn(), isDropTarget: false }),
}))

const mockSearchByImage = vi.fn()
vi.mock('./search-by-image', () => ({
  searchByImage: (...args: unknown[]) => mockSearchByImage(...args),
}))

describe('FindSimilarDialog', () => {
  let queryClient: QueryClient
  let windowOpenSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    windowOpenSpy.mockRestore()
  })

  it('renders version badge for version_stack similar results and opens the stack page on click', async () => {
    const sourceStack: AssetInfo = {
      id: 'source-stack',
      name: 'source_v3.jpg',
      type: 'version_stack',
      status: 'processed',
      createdAt: '2026-01-03T00:00:00Z',
      updatedAt: '2026-01-03T00:00:00Z',
      versionStack: {
        id: 'source-stack',
        versions: [
          {
            id: 'source-v3',
            name: 'source_v3.jpg',
            version: 3,
            current: true,
            status: 'processed',
            previewUrl: null,
            createdAt: '2026-01-03T00:00:00Z',
          },
          {
            id: 'source-v2',
            name: 'source_v2.jpg',
            version: 2,
            current: false,
            status: 'processed',
            previewUrl: null,
            createdAt: '2026-01-02T00:00:00Z',
          },
          {
            id: 'source-v1',
            name: 'source_v1.jpg',
            version: 1,
            current: false,
            status: 'processed',
            previewUrl: null,
            createdAt: '2026-01-01T00:00:00Z',
          },
        ],
      },
    } as AssetInfo

    const matchedStack: AssetInfo = {
      id: 'matched-stack',
      name: 'similar_v5.jpg',
      type: 'version_stack',
      status: 'processed',
      createdAt: '2026-01-05T00:00:00Z',
      updatedAt: '2026-01-05T00:00:00Z',
      preview: {
        proxyType: 'image',
        thumbnailUrl: 'https://example.com/similar_v5.jpg',
      },
      versionStack: {
        id: 'matched-stack',
        versions: Array.from({ length: 5 }, (_, idx) => ({
          id: `matched-v${5 - idx}`,
          name: `similar_v${5 - idx}.jpg`,
          version: 5 - idx,
          current: idx === 0,
          status: 'processed' as const,
          previewUrl: null,
          createdAt: '2026-01-05T00:00:00Z',
        })),
      },
    } as AssetInfo

    mockSearchByImage.mockResolvedValueOnce({
      data: [matchedStack],
      pageInfo: { total: 1 },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <FindSimilarDialog
          image={sourceStack}
          folderId="root-folder"
          teamId="team-1"
          projectId="proj-1"
          onClose={vi.fn()}
        />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('similar_v5.jpg')).toBeTruthy()
    })

    expect(mockSearchByImage).toHaveBeenCalledWith(
      'root-folder',
      expect.objectContaining({ sourceAssetId: 'source-v3' }),
      expect.any(AbortSignal),
    )
    expect(screen.getByText('v5')).toBeTruthy()

    const card = screen.getByText('similar_v5.jpg').closest('[data-testid="file-card"]')!
    fireEvent.click(card)

    expect(windowOpenSpy).toHaveBeenCalledWith(
      '/projects/proj-1/files/matched-stack',
      '_blank',
      'noopener,noreferrer',
    )
  })
})
