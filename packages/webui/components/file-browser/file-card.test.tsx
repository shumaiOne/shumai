// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FileCard } from './file-card'
import type { AssetInfo } from '@shumai/dtos'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

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

vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      files: {
        ':fileId': {
          $get: vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({}),
          }),
        },
      },
    },
  },
}))

describe('FileCard', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
  })

  afterEach(() => {
    cleanup()
  })

  const stackItem: AssetInfo = {
    id: 'stack-123',
    name: 'version_stack_test',
    type: 'version_stack',
    status: 'processed',
    fileCount: 2,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  } as AssetInfo

  const fileItem: AssetInfo = {
    id: 'file-123',
    name: 'regular_file.png',
    type: 'file',
    status: 'processed',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  } as AssetInfo

  const renderComponent = (props: Partial<React.ComponentProps<typeof FileCard>> = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <FileCard
          item={stackItem}
          isSelected={false}
          isChecked={false}
          isEditing={false}
          onSelect={vi.fn()}
          onDoubleClick={vi.fn()}
          onContextMenu={vi.fn()}
          onDragStart={vi.fn()}
          onDrop={vi.fn()}
          onRename={vi.fn()}
          onFinishEditing={vi.fn()}
          onSaveField={vi.fn()}
          fields={[]}
          canEdit={true}
          {...props}
        />
      </QueryClientProvider>,
    )
  }

  it('renders Manage versions in 3-dot dropdown menu for version_stack item', () => {
    const onAction = vi.fn()
    renderComponent({ item: stackItem, onAction })

    const moreBtn = screen.getByRole('button', { name: '' })
    fireEvent.keyDown(moreBtn, { key: 'ArrowDown', code: 'ArrowDown' })

    const manageItem = screen.getByText(/Manage versions|管理版本/i)
    expect(manageItem).toBeTruthy()

    fireEvent.click(manageItem)
    expect(onAction).toHaveBeenCalledWith('manage-versions', stackItem)
  })

  it('does not render Manage versions in 3-dot dropdown menu for regular file item', () => {
    renderComponent({ item: fileItem })

    const moreBtn = screen.getByRole('button', { name: '' })
    fireEvent.keyDown(moreBtn, { key: 'ArrowDown', code: 'ArrowDown' })

    expect(screen.queryByText(/Manage versions|管理版本/i)).toBeNull()
  })

  it('renders Bot icon badge and user via agent creator when agent created the asset', () => {
    const agentCreatedItem: AssetInfo = {
      ...fileItem,
      creator: { id: 'u1', name: 'Alice' },
      agentId: 'agent-1',
      agent: { id: 'agent-1', name: 'Copilot Bot' },
    } as AssetInfo

    renderComponent({ item: agentCreatedItem })

    const agentBadge = screen.getByTestId('agent-badge')
    expect(agentBadge).toBeTruthy()
    expect(agentBadge.getAttribute('title')).toBe('Copilot Bot')
    expect(agentBadge.textContent).toBe('AI')

    // Should show user via agent in author line
    expect(screen.getByText(/Alice via Copilot Bot|Alice 通过 Copilot Bot/i)).toBeTruthy()
  })

  it('renders both AI text badge and version badge side-by-side on version stack', () => {
    const agentStackItem: AssetInfo = {
      ...stackItem,
      creator: { id: 'u1', name: 'Alice' },
      agentId: 'agent-1',
      agent: { id: 'agent-1', name: 'Copilot Bot' },
      versionStack: {
        versions: [
          { id: 'v1', version: 1, name: 'v1' },
          { id: 'stack-123', version: 2, name: 'v2' },
        ],
      },
    } as AssetInfo

    renderComponent({ item: agentStackItem })

    const agentBadge = screen.getByTestId('agent-badge')
    expect(agentBadge).toBeTruthy()
    expect(agentBadge.textContent).toBe('AI')
    expect(screen.getByText('v2')).toBeTruthy()
  })

  it('applies line-clamp-2 and h-[2lh] to creation info paragraph', () => {
    const itemWithCreator: AssetInfo = {
      ...fileItem,
      creator: { id: 'u1', name: 'Alice' },
    } as AssetInfo

    renderComponent({ item: itemWithCreator })

    const creatorParagraph = screen.getByText(/Alice/i)
    expect(creatorParagraph.className).toContain('line-clamp-2')
    expect(creatorParagraph.className).toContain('h-[2lh]')
  })

  it('does not show tooltip on hover when creator text is not truncated', () => {
    vi.useFakeTimers()
    const itemWithCreator: AssetInfo = {
      ...fileItem,
      creator: { id: 'u1', name: 'Alice' },
    } as AssetInfo

    renderComponent({ item: itemWithCreator })

    const creatorParagraph = screen.getByText(/Alice/i)
    Object.defineProperty(creatorParagraph, 'scrollHeight', { value: 30, configurable: true })
    Object.defineProperty(creatorParagraph, 'clientHeight', { value: 40, configurable: true })
    Object.defineProperty(creatorParagraph, 'scrollWidth', { value: 100, configurable: true })
    Object.defineProperty(creatorParagraph, 'clientWidth', { value: 150, configurable: true })

    fireEvent.pointerMove(creatorParagraph, { pointerType: 'mouse' })

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(screen.queryByRole('tooltip')).toBeNull()
    vi.useRealTimers()
  })

  it('shows tooltip on hover when creator text is truncated', () => {
    vi.useFakeTimers()
    const itemWithCreator: AssetInfo = {
      ...fileItem,
      creator: { id: 'u1', name: 'Very Long Creator Name That Wraps' },
    } as AssetInfo

    renderComponent({ item: itemWithCreator })

    const creatorParagraph = screen.getByText(/Very Long Creator Name/i)
    Object.defineProperty(creatorParagraph, 'scrollHeight', { value: 80, configurable: true })
    Object.defineProperty(creatorParagraph, 'clientHeight', { value: 40, configurable: true })

    fireEvent.pointerMove(creatorParagraph, { pointerType: 'mouse' })

    act(() => {
      vi.advanceTimersByTime(200)
    })

    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toBeTruthy()
    expect(tooltip.textContent).toContain('Very Long Creator Name')
    vi.useRealTimers()
  })

  it('renders comments count badge in preview area when commentsCount > 0', () => {
    const itemWithComments: AssetInfo = {
      ...fileItem,
      commentsCount: 5,
    } as AssetInfo

    renderComponent({ item: itemWithComments })

    const wrapper = screen.getByTestId('file-card-preview-badges')
    expect(wrapper.className).toContain('absolute')
    expect(wrapper.className).toContain('bottom-1')
    expect(wrapper.className).toContain('left-1')
    expect(wrapper.className).toContain('pointer-events-none')

    const commentsBadge = screen.getByTestId('file-card-comments-count')
    expect(commentsBadge.textContent).toContain('5')
    expect(commentsBadge.className).toContain('bg-black/60')
    expect(commentsBadge.className).toContain('text-white')
    expect(commentsBadge.className).toContain('tabular-nums')
  })

  it('does not render comments count badge when commentsCount is 0 or undefined', () => {
    const itemZeroComments: AssetInfo = {
      ...fileItem,
      commentsCount: 0,
    } as AssetInfo

    const { unmount } = renderComponent({ item: itemZeroComments })
    expect(screen.queryByTestId('file-card-comments-count')).toBeNull()
    unmount()

    const itemNoComments: AssetInfo = {
      ...fileItem,
      commentsCount: undefined,
    } as AssetInfo

    renderComponent({ item: itemNoComments })
    expect(screen.queryByTestId('file-card-comments-count')).toBeNull()
  })

  it('renders the days-left badge in preview area for recently deleted items', () => {
    const deletedItem: AssetInfo = {
      ...fileItem,
      deletedAt: new Date().toISOString(),
    } as AssetInfo

    renderComponent({ item: deletedItem, isRecentlyDeleted: true })

    const badge = screen.getByTestId('file-card-days-left')
    expect(badge.textContent).toMatch(/30\s*(d|天)/)
  })

  it('places the comments badge to the right of the days-left badge', () => {
    const deletedItem: AssetInfo = {
      ...fileItem,
      deletedAt: new Date().toISOString(),
      commentsCount: 3,
    } as AssetInfo

    renderComponent({ item: deletedItem, isRecentlyDeleted: true })

    const wrapper = screen.getByTestId('file-card-preview-badges')
    const order = Array.from(wrapper.children).map((child) => child.getAttribute('data-testid'))
    expect(order).toEqual(['file-card-days-left', 'file-card-comments-count'])
  })

  it('does not render the days-left badge outside of recently deleted', () => {
    const deletedItem: AssetInfo = {
      ...fileItem,
      deletedAt: new Date().toISOString(),
    } as AssetInfo

    renderComponent({ item: deletedItem, isRecentlyDeleted: false })
    expect(screen.queryByTestId('file-card-days-left')).toBeNull()
  })

  it('does not render the days-left badge when deletedAt is missing', () => {
    renderComponent({ item: fileItem, isRecentlyDeleted: true })
    expect(screen.queryByTestId('file-card-days-left')).toBeNull()
  })

  it('breathes the preview and shows "Preparing..." in place of the creator while processing', () => {
    const processingItem: AssetInfo = {
      ...fileItem,
      status: 'processing',
      creator: { id: 'u1', name: 'Alice' },
      preview: {
        proxyType: 'video',
        thumbnailUrl: 'https://example.com/poster.webp',
        spriteUrl: 'https://example.com/sprite.webp',
        originalWidth: 1920,
        originalHeight: 1080,
        duration: 10,
      },
    } as AssetInfo

    renderComponent({ item: processingItem })

    // The preview (sprite scrubber base thumbnail) is rendered and breathes instead of an overlay.
    const media = screen.getByTestId('file-card-preview-media')
    expect(media.className).toContain('animate-pulse')
    expect(screen.getByAltText('Thumbnail').getAttribute('src')).toBe(
      'https://example.com/poster.webp',
    )

    // The creator row is replaced by the status label while processing.
    expect(screen.getByText(/Preparing|准备中/i)).toBeTruthy()
    expect(screen.queryByText(/Alice/i)).toBeNull()
  })

  it('shows "Uploading..." in place of the creator while uploading', () => {
    const uploadingItem: AssetInfo = {
      ...fileItem,
      status: 'uploading',
      creator: { id: 'u1', name: 'Alice' },
    } as AssetInfo

    renderComponent({ item: uploadingItem })

    expect(screen.getByText(/Uploading|上传中/i)).toBeTruthy()
    expect(screen.queryByText(/Alice/i)).toBeNull()
  })

  it('shows a skeleton and "Preparing..." when processing without a preview yet', () => {
    const processingItem: AssetInfo = {
      ...fileItem,
      status: 'processing',
      creator: { id: 'u1', name: 'Alice' },
    } as AssetInfo

    renderComponent({ item: processingItem })

    expect(screen.queryByTestId('file-card-preview-media')).toBeNull()
    expect(screen.getByText(/Preparing|准备中/i)).toBeTruthy()
    expect(screen.queryByText(/Alice/i)).toBeNull()
  })

  it('stops breathing the preview and shows the creator once processed', () => {
    const processedItem: AssetInfo = {
      ...fileItem,
      status: 'processed',
      creator: { id: 'u1', name: 'Alice' },
      preview: {
        proxyType: 'video',
        thumbnailUrl: 'https://example.com/poster.webp',
      },
    } as AssetInfo

    renderComponent({ item: processedItem })

    const media = screen.getByTestId('file-card-preview-media')
    expect(media.className).not.toContain('animate-pulse')
    expect(screen.getByAltText('Preview').getAttribute('src')).toBe(
      'https://example.com/poster.webp',
    )
    expect(screen.getByText(/Alice/i)).toBeTruthy()
  })
})
