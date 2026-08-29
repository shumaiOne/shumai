// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FileBrowserContextMenu } from './context-menu'
import { ContextMenu, ContextMenuTrigger } from '@/ui/components/ui/context-menu'
import type { AssetInfo } from '@shumai/dtos'

describe('FileBrowserContextMenu', () => {
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

  const renderWithMenu = (
    item: AssetInfo,
    props: Partial<React.ComponentProps<typeof FileBrowserContextMenu>> = {},
  ) => {
    return render(
      <ContextMenu>
        <ContextMenuTrigger data-testid="context-trigger">Trigger</ContextMenuTrigger>
        <FileBrowserContextMenu
          item={item}
          selectedIds={new Set()}
          folders={[]}
          files={[item]}
          onRename={vi.fn()}
          onDelete={vi.fn()}
          onDownload={vi.fn()}
          onRestore={vi.fn()}
          onNewFolder={vi.fn()}
          onUploadFile={vi.fn()}
          onUploadFolder={vi.fn()}
          onNewVersion={vi.fn()}
          onManageVersions={vi.fn()}
          onMoveTo={vi.fn()}
          onCopyTo={vi.fn()}
          canEdit={true}
          {...props}
        />
      </ContextMenu>,
    )
  }

  it('renders Manage versions for version_stack item when canEdit is true', () => {
    const onManageVersions = vi.fn()
    renderWithMenu(stackItem, { onManageVersions })

    fireEvent.contextMenu(screen.getByTestId('context-trigger'))

    const manageOption = screen.getByText(/Manage versions|管理版本/i)
    expect(manageOption).toBeTruthy()

    fireEvent.click(manageOption)
    expect(onManageVersions).toHaveBeenCalledWith(stackItem)
  })

  it('does not render Manage versions for regular file item', () => {
    renderWithMenu(fileItem)

    fireEvent.contextMenu(screen.getByTestId('context-trigger'))

    expect(screen.queryByText(/Manage versions|管理版本/i)).toBeNull()
  })
})
