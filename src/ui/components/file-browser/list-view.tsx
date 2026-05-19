'use client'

import type { AssetInfo } from '@/dtos/asset'
import type { FieldInfo } from '@/dtos/metadata'
import type { SearchSort } from '@/dtos/search'
import { useDroppable } from '@dnd-kit/react'
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import { ChevronDown, ChevronRight } from 'lucide-react'
import React, { useMemo, useState } from 'react'
import { cn } from '../../lib/utils'
import type { DragState } from '../dnd-types'
import { Checkbox } from '../ui/checkbox'

interface ListRowProps {
  item: AssetInfo
  renderItem: (item: AssetInfo, columnSizing?: Record<string, number>) => React.ReactNode
  active: boolean
  dragState?: DragState
  isSelected?: boolean
  columnSizing?: Record<string, number>
}

function ListRow({ item, renderItem, active, dragState, isSelected, columnSizing }: ListRowProps) {
  const isDraggingItem = dragState?.draggedIds.has(item.id!)
  const isDraggingAny = dragState?.isActive

  const { ref: setTopRef, isDropTarget: isTopOver } = useDroppable({
    id: `reorder-before-${item.id}`,
    data: {
      type: 'reorder',
      item,
      position: 'before',
    },
    disabled: !active || isDraggingItem || !isDraggingAny,
  })

  const { ref: setBottomRef, isDropTarget: isBottomOver } = useDroppable({
    id: `reorder-after-${item.id}`,
    data: {
      type: 'reorder',
      item,
      position: 'after',
    },
    disabled: !active || isDraggingItem || !isDraggingAny,
  })

  const { ref: setRowRef, isDropTarget: isRowOver } = useDroppable({
    id: `browser:${item.id!}`,
    data: {
      type: item.type === 'folder' ? 'folder' : 'file',
      id: item.id,
      item: item,
    },
    disabled: !isDraggingAny,
  })

  const isValidDropTarget = useMemo(() => {
    if (!dragState?.isActive) return false
    if (dragState.draggedIds.has(item.id!)) return false

    if (item.type === 'folder') return true

    if (item.type === 'file') {
      if (dragState.hasFolders) return false
      if (dragState.itemCount !== 1) return false
      return true
    }

    return false
  }, [dragState, item.id, item.type])

  const showDropFeedback = isRowOver && isValidDropTarget

  return (
    <tbody
      ref={setRowRef}
      className={cn(
        'group border-b border-border transition-colors hover:bg-primary/20 relative',
        isSelected && 'bg-primary/10',
        showDropFeedback && 'bg-primary/10',
        isTopOver && 'border-t-2 border-t-primary',
        isBottomOver && 'border-b-2 border-b-primary',
      )}
    >
      <tr
        ref={setTopRef}
        className="p-0 m-0 leading-none bg-transparent pointer-events-auto h-[2px]"
      >
        <td colSpan={100} className="p-0 m-0 border-0" />
      </tr>
      {renderItem(item, columnSizing)}
      <tr
        ref={setBottomRef}
        className="p-0 m-0 leading-none bg-transparent pointer-events-auto h-[2px]"
      >
        <td colSpan={100} className="p-0 m-0 border-0" />
      </tr>
    </tbody>
  )
}

interface FileBrowserListViewProps {
  folders: AssetInfo[]
  files: AssetInfo[]
  totalFolders?: number
  totalFiles?: number
  selectedItem: AssetInfo | null
  selectedIds: Set<string>
  displayedFields: FieldInfo[]
  onItemSelect: (item: AssetInfo, event: React.MouseEvent) => void
  onItemDoubleClick: (item: AssetInfo) => void
  renderItem: (item: AssetInfo, columnSizing?: Record<string, number>) => React.ReactNode
  foldersExpanded: boolean
  setFoldersExpanded: (expanded: boolean) => void
  filesExpanded: boolean
  setFilesExpanded: (expanded: boolean) => void
  foldersRef: (node?: Element | null) => void
  filesRef: (node?: Element | null) => void
  hasNextFoldersPage: boolean
  hasNextFilesPage: boolean
  formatCount: (count: number, isFile: boolean) => string
  formatSize: (bytes: number) => string
  foldersSize: number
  filesSize: number
  handleEmptyAreaClick: (e: React.MouseEvent) => void
  dragState?: DragState
  sort?: SearchSort
}

export function FileBrowserListView({
  folders,
  files,
  totalFolders,
  totalFiles,
  selectedItem,
  selectedIds,
  displayedFields,
  renderItem,
  foldersExpanded,
  setFoldersExpanded,
  filesExpanded,
  setFilesExpanded,
  foldersRef,
  filesRef,
  hasNextFoldersPage,
  hasNextFilesPage,
  formatCount,
  formatSize,
  foldersSize,
  filesSize,
  handleEmptyAreaClick,
  dragState,
  sort,
}: FileBrowserListViewProps) {
  const [columnSizing, setColumnSizing] = useState<Record<string, number>>({})

  const columns = useMemo<ColumnDef<AssetInfo>[]>(() => {
    const cols: ColumnDef<AssetInfo>[] = [
      {
        id: 'name',
        header: 'Name',
        size: 300,
        minSize: 150,
      },
      {
        id: 'size',
        header: 'Size',
        size: 100,
        minSize: 80,
      },
      {
        id: 'modified',
        header: 'Modified',
        size: 200,
        minSize: 150,
      },
    ]

    displayedFields.forEach((field) => {
      cols.push({
        id: field.id,
        header: field.config?.name || field.id,
        size: 150,
        minSize: 100,
      })
    })

    return cols
  }, [displayedFields])

  const table = useReactTable({
    data: [], // We don't use the table's data model for rows yet to keep our custom grouping logic
    columns,
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
    state: {
      columnSizing,
    },
    onColumnSizingChange: setColumnSizing,
  })

  return (
    <div className="flex-1 overflow-x-auto" onClick={handleEmptyAreaClick}>
      <table
        className="w-full border-collapse"
        style={{
          tableLayout: 'fixed',
          width: table.getTotalSize(),
          minWidth: '100%',
        }}
      >
        <thead className="sticky top-0 z-30 bg-background border-b border-border">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="bg-muted/50 whitespace-nowrap">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className={cn(
                    'px-4 py-2 text-left text-xs font-medium text-muted-foreground relative border-r',
                    header.id === 'name' && 'sticky left-0 z-40 bg-muted',
                  )}
                  style={{
                    width: header.getSize(),
                  }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                  <div
                    onMouseDown={header.getResizeHandler()}
                    onTouchStart={header.getResizeHandler()}
                    className={cn(
                      'absolute right-0 top-0 bottom-0 w-1 cursor-col-resize user-select-none touch-none z-50 hover:bg-primary/50 transition-colors',
                      header.column.getIsResizing() && 'bg-primary w-1',
                    )}
                  />
                </th>
              ))}
            </tr>
          ))}
        </thead>

        {folders.length > 0 && (
          <>
            <tbody className="bg-card">
              <tr
                className="border-b border-border hover:bg-muted/50 transition-colors cursor-pointer group"
                onClick={(e) => {
                  e.stopPropagation()
                  setFoldersExpanded(!foldersExpanded)
                }}
              >
                <td
                  className="px-4 py-2 sticky left-0 z-10 bg-card border-r"
                  style={{
                    width: columnSizing?.['name'] || 300,
                    minWidth: columnSizing?.['name'] || 300,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={folders.length > 0 && folders.every((f) => selectedIds.has(f.id!))}
                      onCheckedChange={() => {
                        // Batch selection logic
                      }}
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      className="h-4 w-4"
                    />
                    <div className="p-1 rounded hover:bg-muted">
                      {foldersExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                      {formatCount(totalFolders ?? folders.length, false)} •{' '}
                      {formatSize(foldersSize)}
                    </span>
                  </div>
                </td>
                <td colSpan={columns.length - 1} className="bg-card" />
              </tr>
            </tbody>
            {foldersExpanded &&
              folders.map((item) => (
                <ListRow
                  key={item.id}
                  item={item}
                  renderItem={renderItem}
                  active={sort?.field === 'custom'}
                  dragState={dragState}
                  isSelected={selectedItem?.id === item.id}
                  columnSizing={columnSizing}
                />
              ))}
            {hasNextFoldersPage && (
              <tbody className="bg-transparent">
                <tr>
                  <td colSpan={columns.length}>
                    <div ref={foldersRef} className="h-1" />
                  </td>
                </tr>
              </tbody>
            )}
          </>
        )}

        {files.length > 0 && (
          <>
            <tbody className="bg-card">
              <tr
                className="border-b border-border hover:bg-muted/50 transition-colors cursor-pointer group"
                onClick={(e) => {
                  e.stopPropagation()
                  setFilesExpanded(!filesExpanded)
                }}
              >
                <td
                  className="px-4 py-2 sticky left-0 z-10 bg-card border-r"
                  style={{
                    width: columnSizing?.['name'] || 300,
                    minWidth: columnSizing?.['name'] || 300,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={files.length > 0 && files.every((f) => selectedIds.has(f.id!))}
                      onCheckedChange={() => {
                        // Batch selection logic
                      }}
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      className="h-4 w-4"
                    />
                    <div className="p-1 rounded hover:bg-muted">
                      {filesExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                      {formatCount(totalFiles ?? files.length, true)} • {formatSize(filesSize)}
                    </span>
                  </div>
                </td>
                <td colSpan={columns.length - 1} className="bg-card" />
              </tr>
            </tbody>
            {filesExpanded &&
              files.map((item) => (
                <ListRow
                  key={item.id}
                  item={item}
                  renderItem={renderItem}
                  active={sort?.field === 'custom'}
                  dragState={dragState}
                  isSelected={selectedItem?.id === item.id}
                  columnSizing={columnSizing}
                />
              ))}
            {hasNextFilesPage && (
              <tbody className="bg-transparent">
                <tr>
                  <td colSpan={columns.length}>
                    <div ref={filesRef} className="h-1" />
                  </td>
                </tr>
              </tbody>
            )}
          </>
        )}
      </table>
    </div>
  )
}
