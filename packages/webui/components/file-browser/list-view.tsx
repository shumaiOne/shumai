'use client'

import type { AssetInfo } from '@shumai/dtos'
import type { FieldInfo } from '@shumai/dtos'
import type { SearchSort } from '@shumai/dtos'
import { FieldType } from '@shumai/dtos'
import { FIELD_TYPE_ICONS } from '../fields-manager'
import { useDroppable } from '@dnd-kit/react'
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronDown, ChevronRight } from 'lucide-react'
import React, { useMemo, useState, useEffect } from 'react'
import { cn } from '../../lib/utils'
import type { DragState } from '../dnd-types'
import { Checkbox } from '../ui/checkbox'
import { getAllFilesFromEntries } from '@/ui/lib/dnd-utils'

interface ListRowProps {
  item: AssetInfo
  renderItem: (item: AssetInfo, columnSizing?: Record<string, number>) => React.ReactNode
  active: boolean
  dragState?: DragState
  isSelected?: boolean
  columnSizing?: Record<string, number>
  virtualRow: { start: number; index: number }
  measureElement: (el: HTMLElement | null) => void
  isExternalDragging?: boolean
  externalOverFolderId?: string | null
  setExternalOverFolderId?: (id: string | null) => void
  resetExternalDragState?: () => void
  onExternalDrop?: (files: File[], folderId: string) => void
}

function ListRow({
  item,
  renderItem,
  active,
  dragState,
  isSelected,
  columnSizing,
  virtualRow,
  measureElement,
  isExternalDragging,
  externalOverFolderId,
  setExternalOverFolderId,
  resetExternalDragState,
  onExternalDrop,
}: ListRowProps) {
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

  const isExternalOver = isExternalDragging && externalOverFolderId === item.id
  const showDropFeedback = (isRowOver && isValidDropTarget) || isExternalOver

  return (
    <div
      ref={(node) => {
        setRowRef(node)
        measureElement(node)
      }}
      data-index={virtualRow.index}
      onDragEnter={
        isExternalDragging && item.type === 'folder'
          ? () => {
              setExternalOverFolderId?.(item.id!)
            }
          : undefined
      }
      onDragLeave={
        isExternalDragging && item.type === 'folder'
          ? (e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setExternalOverFolderId?.(null)
              }
            }
          : undefined
      }
      onDragOver={
        isExternalDragging && item.type === 'folder'
          ? (e) => {
              e.preventDefault()
            }
          : undefined
      }
      onDrop={
        isExternalDragging && item.type === 'folder'
          ? async (e) => {
              e.preventDefault()
              e.stopPropagation()
              resetExternalDragState?.()
              const files = await getAllFilesFromEntries(e.dataTransfer)
              onExternalDrop?.(files, item.id!)
            }
          : undefined
      }
      className={cn(
        'group border-b border-border transition-colors hover:bg-primary/20 absolute top-0 left-0 w-full flex flex-col outline-none focus:outline-none focus-visible:outline-none',
        isSelected && 'bg-primary/10',
        showDropFeedback && 'bg-primary/10',
        isTopOver && 'border-t-2 border-t-primary',
        isBottomOver && 'border-b-2 border-b-primary',
      )}
      style={{
        transform: `translateY(${virtualRow.start}px)`,
      }}
    >
      <div
        ref={setTopRef}
        className="p-0 m-0 leading-none bg-transparent pointer-events-auto h-[2px] w-full"
      />
      {renderItem(item, columnSizing)}
      <div
        ref={setBottomRef}
        className="p-0 m-0 leading-none bg-transparent pointer-events-auto h-[2px] w-full"
      />
    </div>
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
  hasNextFoldersPage: boolean
  hasNextFilesPage: boolean
  isFetchingNextFoldersPage: boolean
  isFetchingNextFilesPage: boolean
  fetchNextFoldersPage: () => void
  fetchNextFilesPage: () => void
  formatCount: (count: number, isFile: boolean) => string
  formatSize: (bytes: number) => string
  foldersSize: number
  filesSize: number
  totalFoldersSize?: number
  totalFilesSize?: number
  handleEmptyAreaClick: (e: React.MouseEvent) => void
  dragState?: DragState
  sort?: SearchSort
  isExternalDragging?: boolean
  externalOverFolderId?: string | null
  setExternalOverFolderId?: (id: string | null) => void
  resetExternalDragState?: () => void
  onExternalDrop?: (files: File[], folderId: string) => void
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
  hasNextFoldersPage,
  hasNextFilesPage,
  isFetchingNextFoldersPage,
  isFetchingNextFilesPage,
  fetchNextFoldersPage,
  fetchNextFilesPage,
  formatCount,
  formatSize,
  totalFoldersSize,
  totalFilesSize,
  handleEmptyAreaClick,
  dragState,
  sort,
  isExternalDragging,
  externalOverFolderId,
  setExternalOverFolderId,
  resetExternalDragState,
  onExternalDrop,
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
      const Icon = field.config?.type ? FIELD_TYPE_ICONS[field.config.type as FieldType] : null
      cols.push({
        id: field.id,
        header: () => (
          <div className="flex items-center gap-1.5 truncate">
            {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
            <span className="truncate">{field.config?.name || field.id}</span>
          </div>
        ),
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

  const items = useMemo(() => {
    const list: (
      | { type: 'header'; kind: 'folder' | 'file' }
      | { type: 'item'; kind: 'folder' | 'file'; index: number }
    )[] = []

    // Folders section
    const foldersCount = totalFolders ?? folders.length
    if (foldersCount > 0) {
      list.push({ type: 'header', kind: 'folder' })
      if (foldersExpanded) {
        for (let i = 0; i < foldersCount; i++) {
          list.push({ type: 'item', kind: 'folder', index: i })
        }
      }
    }

    // Files section
    const filesCount = totalFiles ?? files.length
    if (filesCount > 0) {
      list.push({ type: 'header', kind: 'file' })
      if (filesExpanded) {
        for (let i = 0; i < filesCount; i++) {
          list.push({ type: 'item', kind: 'file', index: i })
        }
      }
    }

    return list
  }, [foldersExpanded, filesExpanded, folders.length, files.length, totalFolders, totalFiles])

  const localScrollRef = React.useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => localScrollRef.current,
    estimateSize: () => 40,
    getItemKey: React.useCallback(
      (index: number) => {
        const item = items[index]
        if (!item) return index
        if (item.type === 'header') {
          return `header-${item.kind}`
        }
        const dataItem = item.kind === 'folder' ? folders[item.index] : files[item.index]
        return dataItem?.id || `item-${item.kind}-${item.index}`
      },
      [items, folders, files],
    ),
    overscan: 10,
  })

  const virtualItems = rowVirtualizer.getVirtualItems()

  useEffect(() => {
    if (virtualItems.length === 0) return

    for (const virtualItem of virtualItems) {
      const item = items[virtualItem.index]
      if (item?.type === 'item') {
        const isSkeleton = item.kind === 'folder' ? !folders[item.index] : !files[item.index]
        const isNearEnd =
          item.kind === 'folder'
            ? item.index >= folders.length - 15
            : item.index >= files.length - 15

        if (item.kind === 'folder' && hasNextFoldersPage && !isFetchingNextFoldersPage) {
          if (isSkeleton || isNearEnd) {
            fetchNextFoldersPage()
            break
          }
        } else if (item.kind === 'file' && hasNextFilesPage && !isFetchingNextFilesPage) {
          if (isSkeleton || isNearEnd) {
            fetchNextFilesPage()
            break
          }
        }
      }
    }
  }, [
    virtualItems,
    items,
    folders.length,
    files.length,
    hasNextFoldersPage,
    hasNextFilesPage,
    isFetchingNextFoldersPage,
    isFetchingNextFilesPage,
    fetchNextFoldersPage,
    fetchNextFilesPage,
  ])

  return (
    <div ref={localScrollRef} className="flex-1 overflow-auto" onClick={handleEmptyAreaClick}>
      <div
        className="w-full relative"
        style={{
          width: table.getTotalSize(),
          minWidth: '100%',
        }}
      >
        <div className="sticky top-0 z-30 bg-background border-b border-border flex flex-col">
          {table.getHeaderGroups().map((headerGroup) => (
            <div key={headerGroup.id} className="bg-muted/50 whitespace-nowrap flex">
              {headerGroup.headers.map((header) => (
                <div
                  key={header.id}
                  className={cn(
                    'px-4 py-2 text-left text-xs font-medium text-muted-foreground relative border-r flex items-center',
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
                </div>
              ))}
            </div>
          ))}
        </div>

        <div
          className="relative"
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
          }}
        >
          {virtualItems.map((virtualRow) => {
            const item = items[virtualRow.index]

            if (item.type === 'header') {
              const isFolder = item.kind === 'folder'
              const count = isFolder
                ? (totalFolders ?? folders.length)
                : (totalFiles ?? files.length)
              const size = isFolder ? (totalFoldersSize ?? -1) : (totalFilesSize ?? -1)
              const showSize = size > -1
              const expanded = isFolder ? foldersExpanded : filesExpanded
              const setExpanded = isFolder ? setFoldersExpanded : setFilesExpanded
              const hasItems = isFolder ? folders.length > 0 : files.length > 0

              return (
                <div
                  key={`header-${item.kind}`}
                  ref={rowVirtualizer.measureElement}
                  data-index={virtualRow.index}
                  className="absolute top-0 left-0 w-full border-b border-border hover:bg-muted/50 transition-colors cursor-pointer group flex bg-card z-20"
                  style={{
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setExpanded(!expanded)
                  }}
                >
                  <div
                    className="px-4 py-2 sticky left-0 z-10 bg-card border-r flex items-center gap-2"
                    style={{
                      width: columnSizing?.['name'] || 300,
                      minWidth: columnSizing?.['name'] || 300,
                    }}
                  >
                    <Checkbox
                      checked={
                        hasItems &&
                        (isFolder
                          ? folders.every((f) => selectedIds.has(f.id!))
                          : files.every((f) => selectedIds.has(f.id!)))
                      }
                      onCheckedChange={() => {
                        // Batch selection logic
                      }}
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      className="h-4 w-4"
                    />
                    <div className="p-1 rounded hover:bg-muted">
                      {expanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                      {formatCount(count, !isFolder)}
                      {showSize ? ` • ${formatSize(size)}` : ''}
                    </span>
                  </div>
                  <div className="flex-1 bg-card" />
                </div>
              )
            }

            const dataItem = item.kind === 'folder' ? folders[item.index] : files[item.index]

            if (!dataItem) {
              return (
                <div
                  key={`skeleton-${item.kind}-${item.index}`}
                  ref={rowVirtualizer.measureElement}
                  className="absolute top-0 left-0 w-full border-b border-border px-4 py-3 flex items-center animate-pulse"
                  style={{
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className="h-4 bg-muted rounded w-1/4" />
                </div>
              )
            }

            return (
              <ListRow
                key={dataItem.id}
                item={dataItem}
                renderItem={renderItem}
                active={sort?.field === 'custom'}
                dragState={dragState}
                isSelected={selectedItem?.id === dataItem.id}
                columnSizing={columnSizing}
                virtualRow={virtualRow}
                measureElement={rowVirtualizer.measureElement}
                isExternalDragging={isExternalDragging}
                externalOverFolderId={externalOverFolderId}
                setExternalOverFolderId={setExternalOverFolderId}
                resetExternalDragState={resetExternalDragState}
                onExternalDrop={onExternalDrop}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
