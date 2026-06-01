'use client'

import type { AssetInfo } from '@shumai/dtos'
import type { SearchSort } from '@shumai/dtos'
import { useDroppable } from '@dnd-kit/react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import React from 'react'
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
        position === 'before' && [
          'hidden',
          'max-md:[.group-reorder:nth-child(2n+1)_&]:flex',
          'md:max-lg:[.group-reorder:nth-child(3n+1)_&]:flex',
          'lg:max-xl:[.group-reorder:nth-child(4n+1)_&]:flex',
          'xl:[.group-reorder:nth-child(5n+1)_&]:flex',
        ],
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
}: FileBrowserGridViewProps) {
  return (
    <div className="flex-1 p-4" onClick={handleEmptyAreaClick}>
      {folders.length > 0 && (
        <div className="mb-8">
          <button
            onClick={() => setFoldersExpanded(!foldersExpanded)}
            className="mb-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            {foldersExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <span>
              {formatCount(totalFolders ?? folders.length, false)} • {formatSize(foldersSize)}
            </span>
          </button>
          {foldersExpanded && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {folders.map((item, index) => (
                  <div key={item.id} className="group-reorder relative flex">
                    <ReorderIndicator
                      id={`reorder-before-folder-${item.id}`}
                      item={item}
                      position="before"
                      active={sort?.field === 'custom'}
                      dragState={dragState}
                    />
                    <div className="flex-1 min-w-0">{renderItem(item)}</div>
                    <ReorderIndicator
                      id={`reorder-after-folder-${item.id}`}
                      item={item}
                      position="after"
                      active={sort?.field === 'custom'}
                      dragState={dragState}
                      isNextItemDragging={
                        folders[index + 1] && dragState?.draggedIds.has(folders[index + 1].id!)
                      }
                    />
                  </div>
                ))}
              </div>
              {hasNextFoldersPage && <div ref={foldersRef} className="h-1" />}
            </>
          )}
        </div>
      )}

      {files.length > 0 && (
        <div>
          <button
            onClick={() => setFilesExpanded(!filesExpanded)}
            className="mb-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            {filesExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <span>
              {formatCount(totalFiles ?? files.length, true)} • {formatSize(filesSize)}
            </span>
          </button>
          {filesExpanded && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {files.map((item, index) => (
                  <div key={item.id} className="group-reorder relative flex">
                    <ReorderIndicator
                      id={`reorder-before-file-${item.id}`}
                      item={item}
                      position="before"
                      active={sort?.field === 'custom'}
                      dragState={dragState}
                    />
                    <div className="flex-1 min-w-0">{renderItem(item)}</div>
                    <ReorderIndicator
                      id={`reorder-after-file-${item.id}`}
                      item={item}
                      position="after"
                      active={sort?.field === 'custom'}
                      dragState={dragState}
                      isNextItemDragging={
                        files[index + 1] && dragState?.draggedIds.has(files[index + 1].id!)
                      }
                    />
                  </div>
                ))}
              </div>
              {hasNextFilesPage && <div ref={filesRef} className="h-1" />}
            </>
          )}
        </div>
      )}
    </div>
  )
}
