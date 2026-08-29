// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
})
