'use client'

import type { AssetInfo } from '@shumai/dtos'
import type { SearchSort } from '@shumai/dtos'
import { useDroppable } from '@dnd-kit/react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronDown, ChevronRight } from 'lucide-react'
import React, { useMemo, useState, useEffect, useRef } from 'react'
import { cn } from '../../lib/utils'
import type { DragState } from '../dnd-types'

interface ReorderIndicatorProps {
  id: string
  item: AssetInfo
  position: 'before' | 'after'
  active: boolean
  className?: string
  dragState?: DragState
  isNextItemDragging?: boolean
}

function ReorderIndicator({
  id,
  item,
  position,
  active,
  className,
  dragState,
  isNextItemDragging,
}: ReorderIndicatorProps) {
  const isDraggingItem = dragState?.draggedIds.has(item.id!)
  const isDraggingAny = dragState?.isActive
  const { ref: setNodeRef, isDropTarget: isOver } = useDroppable({
    id,
    data: {
      type: 'reorder',
      item,
      position,
    },
    disabled: !active || isDraggingItem || !isDraggingAny,
  })

  if (isDraggingItem || isNextItemDragging) return null

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'absolute top-0 bottom-0 w-4 flex-shrink-0 flex items-center justify-center pointer-events-auto z-50',
        position === 'before' ? '-left-2 -translate-x-1/2' : '-right-2 translate-x-1/2',
        className,
      )}
    >
      <div
        className={cn(
          'h-full w-[3px] rounded-full transition-colors',
          isOver && active && !isDraggingItem && isDraggingAny ? 'bg-primary' : 'bg-transparent',
        )}
      />
    </div>
  )
}

interface FileBrowserGridViewProps {
  folders: AssetInfo[]
  files: AssetInfo[]
  totalFolders?: number
  totalFiles?: number
  renderItem: (item: AssetInfo) => React.ReactNode
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
  handleEmptyAreaClick: (e: React.MouseEvent) => void
  dragState?: DragState
  sort?: SearchSort
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
}

export function FileBrowserGridView({
  folders,
  files,
  totalFolders,
  totalFiles,
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
  foldersSize,
  filesSize,
  handleEmptyAreaClick,
  dragState,
  sort,
  scrollContainerRef,
}: FileBrowserGridViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [cols, setCols] = useState(5)

  useEffect(() => {
    const updateCols = () => {
      if (!containerRef.current) return
      const width = containerRef.current.offsetWidth
      if (width < 640) setCols(2)
      else if (width < 768) setCols(2)
      else if (width < 1024) setCols(3)
      else if (width < 1280) setCols(4)
      else setCols(5)
    }

    updateCols()
    const observer = new ResizeObserver(updateCols)
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const rows = useMemo(() => {
    const list: (
      | { type: 'header'; kind: 'folder' | 'file' }
      | { type: 'row'; kind: 'folder' | 'file'; rowIndex: number }
    )[] = []

    // Folders
    list.push({ type: 'header', kind: 'folder' })
    if (foldersExpanded) {
      const count = totalFolders ?? folders.length
      const rowCount = Math.ceil(count / cols)
      for (let i = 0; i < rowCount; i++) {
        list.push({ type: 'row', kind: 'folder', rowIndex: i })
      }
    }

    // Files
    list.push({ type: 'header', kind: 'file' })
    if (filesExpanded) {
      const count = totalFiles ?? files.length
      const rowCount = Math.ceil(count / cols)
      for (let i = 0; i < rowCount; i++) {
        list.push({ type: 'row', kind: 'file', rowIndex: i })
      }
    }

    return list
  }, [foldersExpanded, filesExpanded, folders.length, files.length, totalFolders, totalFiles, cols])

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: (index) => (rows[index]?.type === 'header' ? 40 : 200),
    overscan: 5,
  })

  const virtualItems = rowVirtualizer.getVirtualItems()

  useEffect(() => {
    if (virtualItems.length === 0) return

    for (const virtualItem of virtualItems) {
      const row = rows[virtualItem.index]
      if (row?.type === 'row') {
        if (row.kind === 'folder') {
          const lastIndex = (row.rowIndex + 1) * cols
          if (
            lastIndex >= folders.length - cols * 2 &&
            hasNextFoldersPage &&
            !isFetchingNextFoldersPage
          ) {
            fetchNextFoldersPage()
          }
        } else if (row.kind === 'file') {
          const lastIndex = (row.rowIndex + 1) * cols
          if (
            lastIndex >= files.length - cols * 2 &&
            hasNextFilesPage &&
            !isFetchingNextFilesPage
          ) {
            fetchNextFilesPage()
          }
        }
      }
    }
  }, [
    virtualItems,
    rows,
    folders.length,
    files.length,
    hasNextFoldersPage,
    hasNextFilesPage,
    isFetchingNextFoldersPage,
    isFetchingNextFilesPage,
    fetchNextFoldersPage,
    fetchNextFilesPage,
    cols,
  ])

  return (
    <div ref={containerRef} className="flex-1 p-4 relative" onClick={handleEmptyAreaClick}>
      <div
        className="relative w-full"
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
        }}
      >
        {virtualItems.map((virtualRow) => {
          const row = rows[virtualRow.index]

          if (row.type === 'header') {
            const isFolder = row.kind === 'folder'
            const count = isFolder ? (totalFolders ?? folders.length) : (totalFiles ?? files.length)
            const size = isFolder ? foldersSize : filesSize
            const expanded = isFolder ? foldersExpanded : filesExpanded
            const setExpanded = isFolder ? setFoldersExpanded : setFilesExpanded

            return (
              <div
                key={`header-${row.kind}`}
                ref={rowVirtualizer.measureElement}
                data-index={virtualRow.index}
                className="absolute top-0 left-0 w-full z-10 bg-background"
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setExpanded(!expanded)
                  }}
                  className="mb-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  {expanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span>
                    {formatCount(count, !isFolder)} • {formatSize(size)}
                  </span>
                </button>
              </div>
            )
          }

          const isFolder = row.kind === 'folder'
          const dataList = isFolder ? folders : files
          const startIndex = row.rowIndex * cols
          const rowItems = []
          for (let i = 0; i < cols; i++) {
            rowItems.push(dataList[startIndex + i])
          }

          return (
            <div
              key={`row-${row.kind}-${row.rowIndex}`}
              ref={rowVirtualizer.measureElement}
              data-index={virtualRow.index}
              className="absolute top-0 left-0 w-full grid gap-4"
              style={{
                transform: `translateY(${virtualRow.start}px)`,
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              }}
            >
              {rowItems.map((item, i) => {
                const itemIndex = startIndex + i
                if (!item) {
                  const totalCount = isFolder
                    ? (totalFolders ?? folders.length)
                    : (totalFiles ?? files.length)
                  if (itemIndex < totalCount) {
                    return (
                      <div
                        key={`skeleton-${itemIndex}`}
                        className="aspect-square bg-muted animate-pulse rounded-lg"
                      />
                    )
                  }
                  return <div key={`empty-${itemIndex}`} />
                }

                return (
                  <div key={item.id} className="group-reorder relative flex">
                    <ReorderIndicator
                      id={`reorder-before-${row.kind}-${item.id}`}
                      item={item}
                      position="before"
                      active={sort?.field === 'custom'}
                      dragState={dragState}
                    />
                    <div className="flex-1 min-w-0">{renderItem(item)}</div>
                    <ReorderIndicator
                      id={`reorder-after-${row.kind}-${item.id}`}
                      item={item}
                      position="after"
                      active={sort?.field === 'custom'}
                      dragState={dragState}
                      isNextItemDragging={
                        dataList[itemIndex + 1] &&
                        dragState?.draggedIds.has(dataList[itemIndex + 1].id!)
                      }
                    />
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
