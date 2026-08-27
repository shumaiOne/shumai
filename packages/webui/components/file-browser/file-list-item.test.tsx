// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FileListItem } from './file-list-item'
import type { AssetInfo } from '@shumai/dtos'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@dnd-kit/react', () => ({
  useDraggable: () => ({
    ref: vi.fn(),
    isDragging: false,
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

describe('FileListItem', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    vi.useFakeTimers()
  })

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers()
    })
    vi.useRealTimers()
    cleanup()
  })

  const mockItem: AssetInfo = {
    id: 'file-123',
    name: 'very_long_file_name_for_testing_purposes.mov',
    type: 'file',
    sizeByte: 1024 * 1024 * 5,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    status: 'processed',
  } as AssetInfo

  const renderComponent = (props: Partial<React.ComponentProps<typeof FileListItem>> = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <FileListItem
          item={mockItem}
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
          {...props}
        />
      </QueryClientProvider>,
    )
  }

  it('renders truncated text span when not editing', () => {
    renderComponent()

    expect(screen.queryByRole('textbox')).toBeNull()
    const nameSpan = screen.getByText('very_long_file_name_for_testing_purposes.mov')
    expect(nameSpan).toBeTruthy()
    expect(nameSpan.tagName.toLowerCase()).toBe('span')
    expect(nameSpan.className).toContain('truncate')
  })

  it('shows tooltip on hover when item name overflows', () => {
    renderComponent()

    const span = screen.getByText('very_long_file_name_for_testing_purposes.mov')
    Object.defineProperty(span, 'scrollWidth', { value: 350, configurable: true })
    Object.defineProperty(span, 'clientWidth', { value: 150, configurable: true })

    fireEvent.pointerMove(span, { pointerType: 'mouse' })

    act(() => {
      vi.advanceTimersByTime(200)
    })

    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toBeTruthy()
    expect(tooltip.textContent).toContain('very_long_file_name_for_testing_purposes.mov')
  })

  it('switches to input in editing mode', () => {
    renderComponent({ isEditing: true })

    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input).toBeTruthy()
    expect(input.value).toBe('very_long_file_name_for_testing_purposes.mov')
  })

  it('calls onSelect when row is clicked', () => {
    const onSelect = vi.fn()
    renderComponent({ onSelect })

    const span = screen.getByText('very_long_file_name_for_testing_purposes.mov')
    fireEvent.click(span)

    expect(onSelect).toHaveBeenCalled()
  })

  it('calls onDoubleClick when row is double clicked', () => {
    const onDoubleClick = vi.fn()
    renderComponent({ onDoubleClick })

    const span = screen.getByText('very_long_file_name_for_testing_purposes.mov')
    fireEvent.doubleClick(span)

    expect(onDoubleClick).toHaveBeenCalled()
  })
})
