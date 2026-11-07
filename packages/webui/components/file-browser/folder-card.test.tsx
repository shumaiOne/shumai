// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AssetInfo } from '@shumai/dtos'
import { FolderCard } from './folder-card'

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

describe('FolderCard', () => {
  afterEach(() => {
    cleanup()
  })

  const folderItem: AssetInfo = {
    id: 'folder-123',
    name: 'regular_folder',
    type: 'folder',
    status: 'processed',
    fileCount: 2,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  } as AssetInfo

  const renderComponent = (props: Partial<React.ComponentProps<typeof FolderCard>> = {}) => {
    return render(
      <FolderCard
        item={folderItem}
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
        {...props}
      />,
    )
  }

  it('renders previews for the children of a folder', () => {
    const itemWithChildren: AssetInfo = {
      ...folderItem,
      latestChildren: [
        { type: 'image', preview: { proxyType: 'image', thumbnailUrl: 'http://x/thumb-1.png' } },
        { type: 'image', preview: { proxyType: 'image', thumbnailUrl: 'http://x/thumb-2.png' } },
      ],
    } as AssetInfo

    renderComponent({ item: itemWithChildren })

    const previews = screen.getAllByAltText('Preview')
    expect(previews).toHaveLength(2)
  })

  it('renders the days-left badge in the preview area for recently deleted folders', () => {
    const deletedItem: AssetInfo = {
      ...folderItem,
      deletedAt: new Date().toISOString(),
      latestChildren: [
        { type: 'image', preview: { proxyType: 'image', thumbnailUrl: 'http://x/thumb-1.png' } },
      ],
    } as AssetInfo

    renderComponent({ item: deletedItem, isRecentlyDeleted: true })

    const badge = screen.getByTestId('folder-card-days-left')
    expect(badge.textContent).toMatch(/30\s*(d|天)/)
    // The badge must not hide the preview of the deleted folder's content
    expect(screen.getAllByAltText('Preview')).toHaveLength(1)
  })

  it('does not render the days-left badge outside of recently deleted', () => {
    const deletedItem: AssetInfo = {
      ...folderItem,
      deletedAt: new Date().toISOString(),
    } as AssetInfo

    renderComponent({ item: deletedItem, isRecentlyDeleted: false })
    expect(screen.queryByTestId('folder-card-days-left')).toBeNull()
  })

  it('does not render the days-left badge when deletedAt is missing', () => {
    renderComponent({ item: folderItem, isRecentlyDeleted: true })
    expect(screen.queryByTestId('folder-card-days-left')).toBeNull()
  })

  it('does not render selection checkbox when hideCheckbox is true', () => {
    renderComponent({ item: folderItem, hideCheckbox: true })
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('renders selection checkbox by default when hideCheckbox is false or omitted', () => {
    renderComponent({ item: folderItem })
    expect(screen.getByRole('checkbox')).toBeTruthy()
  })

  it('does not render 3-dot dropdown menu when hideActions is true', () => {
    renderComponent({ item: folderItem, hideActions: true })
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('triggers onSelect with { isCheckbox: true } when folder checkbox is clicked', () => {
    const onSelect = vi.fn()
    const onDoubleClick = vi.fn()

    renderComponent({
      item: folderItem,
      onSelect,
      onDoubleClick,
    })

    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)

    expect(onDoubleClick).not.toHaveBeenCalled()
    expect(onSelect).toHaveBeenCalledWith(folderItem, expect.anything(), { isCheckbox: true })
  })

  it('triggers onDoubleClick on single card body click in public share view even when checked', () => {
    const onSelect = vi.fn()
    const onDoubleClick = vi.fn()

    renderComponent({
      item: folderItem,
      isPublic: true,
      isChecked: true,
      onSelect,
      onDoubleClick,
    })

    const card = screen.getByTestId('file-card')
    fireEvent.click(card)

    expect(onDoubleClick).toHaveBeenCalledWith(folderItem)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('does not trigger onDoubleClick multiple times on double-click in public share view', () => {
    const onSelect = vi.fn()
    const onDoubleClick = vi.fn()

    renderComponent({
      item: folderItem,
      isPublic: true,
      onSelect,
      onDoubleClick,
    })

    const card = screen.getByTestId('file-card')
    fireEvent.click(card, { detail: 1 })
    fireEvent.click(card, { detail: 2 })
    fireEvent.doubleClick(card)

    expect(onDoubleClick).toHaveBeenCalledTimes(1)
    expect(onDoubleClick).toHaveBeenCalledWith(folderItem)
  })

  it('preserves multi-selection in internal workspace when clicking already selected folder card body', () => {
    const onSelect = vi.fn()
    const onDoubleClick = vi.fn()

    renderComponent({
      item: folderItem,
      isPublic: false,
      isChecked: true,
      selectedCount: 2,
      onSelect,
      onDoubleClick,
    })

    const card = screen.getByTestId('file-card')
    fireEvent.click(card)

    expect(onSelect).not.toHaveBeenCalled()
    expect(onDoubleClick).not.toHaveBeenCalled()
  })
})
