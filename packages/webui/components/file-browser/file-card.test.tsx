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
})
