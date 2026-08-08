import { Checkbox } from '@/ui/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/components/ui/dropdown-menu'
import { EditableText } from '@/ui/components/ui/editable-text'
import { cn } from '@/ui/lib/utils'
import { useDraggable, useDroppable } from '@dnd-kit/react'
import type { AssetInfo, ChildPreview } from '@shumai/dtos'
import { m } from '@/ui/paraglide/messages.js'
import { Download, Edit, History, MoreHorizontal, Trash2 } from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { DragState } from '../dnd-types'
import { FilePreview } from './file-preview'
import { getAllFilesFromEntries } from '@/ui/lib/dnd-utils'

interface FolderCardProps {
  item: AssetInfo
  isSelected: boolean
  isChecked: boolean
  isEditing: boolean
  onSelect: (item: AssetInfo, event: React.MouseEvent) => void
  onDoubleClick: (item: AssetInfo) => void
  onContextMenu: (e: React.MouseEvent, item: AssetInfo) => void
  // Deprecated manual drag props replaced by dnd-kit
  onDragStart: (item: AssetInfo) => void
  onDrop: (target: AssetInfo) => void
  onRename: (newName: string) => void
  onFinishEditing: () => void
  dragState?: DragState
  disabled?: boolean
  onAction?: (
    action: 'rename' | 'delete' | 'download' | 'restore' | 'remove-from-share',
    item: AssetInfo,
  ) => void
  isRecentlyDeleted?: boolean
  selectedCount?: number
  canEdit?: boolean
  isShareView?: boolean
  isExternalDragging?: boolean
  externalOverFolderId?: string | null
  setExternalOverFolderId?: (id: string | null) => void
  resetExternalDragState?: () => void
  onExternalDrop?: (files: File[], folderId: string) => void
  /** When false, hides the download action. Defaults to true. */
  allowDownload?: boolean
}

const FolderPreviewGrid = ({ items }: { items: ChildPreview[] }) => {
  const latestChildren = items as NonNullable<AssetInfo['latestChildren']>
  const safeChildren = latestChildren ? latestChildren.slice(0, 3) : []
  const count = safeChildren.length

  const renderItem = (child: ChildPreview) => {
    if (!child) return null
    return <FilePreview item={child} />
  }

  if (count === 0) {
    return <div></div>
  }

  // 1 Item
  if (count === 1) {
    return (
      <div className="w-full h-full bg-foreground/6 rounded-sm">{renderItem(safeChildren[0])}</div>
    )
  }

  // 2 Items
  if (count === 2) {
    return (
      <div className="grid grid-cols-2 gap-0.5 h-full w-full">
        <div className="overflow-hidden h-full bg-foreground/6 rounded-sm">
          {renderItem(safeChildren[0])}
        </div>
        <div className="overflow-hidden h-full bg-foreground/6 rounded-sm">
          {renderItem(safeChildren[1])}
        </div>
      </div>
    )
  }

  // 3 Items
  return (
    <div className="grid grid-cols-3 gap-0.5 h-full w-full">
      <div className="col-span-1 overflow-hidden h-full relative bg-foreground/6 rounded-sm col-span-2">
        <div className="absolute inset-0 w-full h-full">{renderItem(safeChildren[0])}</div>
      </div>
      <div className="col-span-1 grid grid-rows-2 gap-0.5 h-full col-span-1">
        <div className="overflow-hidden h-full relative bg-foreground/6 rounded-sm">
          <div className="absolute inset-0 w-full h-full">{renderItem(safeChildren[1])}</div>
        </div>
        <div className="overflow-hidden h-full relative bg-foreground/6 rounded-sm">
          <div className="absolute inset-0 w-full h-full">{renderItem(safeChildren[2])}</div>
        </div>
      </div>
    </div>
  )
}

export function FolderCard({
  item,
  isSelected,
  isChecked,
  isEditing,
  onSelect,
  onDoubleClick,
  onContextMenu,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onDragStart: _onDragStart,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onDrop: _onDrop,
  onRename,
  onFinishEditing,
  dragState,
  disabled,
  onAction,
  isRecentlyDeleted,
  selectedCount,
  canEdit = true,
  isShareView,
  isExternalDragging,
  externalOverFolderId,
  setExternalOverFolderId,
  resetExternalDragState,
  onExternalDrop,
  allowDownload = true,
}: FolderCardProps) {
  const [name, setName] = useState(item.name || '')
  const inputRef = useRef<HTMLInputElement>(null)

  // dnd-kit hooks
  const { ref: setDraggableRef, isDragging: isDraggableDragging } = useDraggable({
    id: `browser:${item.id!}`,
    data: {
      type: 'folder',
      id: item.id,
      item: item,
    },
    disabled: disabled,
  })

  const { ref: setDroppableRef, isDropTarget: isOver } = useDroppable({
    id: `browser:${item.id!}`,
    data: {
      type: 'folder',
      id: item.id,
      item: item,
    },
  })

  const setNodeRef = (node: HTMLElement | null) => {
    setDraggableRef(node)
    setDroppableRef(node)
  }

  const isBeingDragged = isDraggableDragging || (dragState?.draggedIds.has(item.id!) ?? false)

  const isValidDropTarget = useMemo(() => {
    if (!dragState?.isActive) return false
    if (dragState.draggedIds.has(item.id!)) return false // Can't drop on self

    // Folder is always valid drop target unless self/descendant
    return true
  }, [dragState, item.id])

  const isExternalOver = isExternalDragging && externalOverFolderId === item.id
  const showDropFeedback = (isOver && isValidDropTarget) || isExternalOver
  const opacity = isBeingDragged ? 0.5 : 1

  useEffect(() => {
    if (isEditing) {
      // Use a longer timeout to ensure the context menu has closed and
      // the DOM has stabilized before focusing. Radix focus restoration
      // can sometimes conflict with immediate focus calls.
      const timeoutId = setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 150)
      return () => clearTimeout(timeoutId)
    }
  }, [isEditing])

  useEffect(() => {
    setName(item.name || '')
  }, [item.name])

  const handleClick = (e: React.MouseEvent) => {
    onSelect(item, e)
  }

  const handleRename = () => {
    if (name !== item.name) {
      onRename(name || '')
    }
    onFinishEditing()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleRename()
    }
    if (e.key === 'Escape') {
      setName(item.name || '')
      onFinishEditing()
    }
  }

  // SVG background logic from fancy card
  const width = 300
  const height = 220
  const tabHeight = 8
  const config = {
    cornerRadius: 4,
    tabRadius: 5,
    tabSlope: 15,
    tabBaseWidth: 120,
  }
  const folderPath = useMemo(() => {
    const { cornerRadius: cr, tabRadius: tr, tabSlope: ts, tabBaseWidth: tbw } = config
    const s = 1
    return `M ${s}, ${tabHeight + s} L ${s}, ${s + tr} A ${tr} ${tr} 0 0 1 ${s + tr} ${s} L ${tbw - ts + s - tr} ${s} Q ${tbw - ts + s} ${s} ${tbw - ts + s} ${s} L ${tbw + s} ${tabHeight + s} L ${width - cr - s} ${tabHeight + s} A ${cr} ${cr} 0 0 1 ${width - s} ${tabHeight + cr + s} L ${width - s} ${height - cr - s} A ${cr} ${cr} 0 0 1 ${width - cr - s} ${height - s} L ${cr + s} ${height - s} A ${cr} ${cr} 0 0 1 ${s} ${height - cr - s} Z`
      .replace(/\s+/g, ' ')
      .trim()
  }, [])

  return (
    <div
      ref={setNodeRef}
      style={{ opacity }}
      onClick={handleClick}
      onDoubleClick={() => onDoubleClick(item)}
      onContextMenu={(e) => onContextMenu(e, item)}
      onMouseDown={(e) => {
        if (e.shiftKey) {
          e.preventDefault()
        }
      }}
      onDragEnter={
        isExternalDragging
          ? () => {
              setExternalOverFolderId?.(item.id!)
            }
          : undefined
      }
      onDragLeave={
        isExternalDragging
          ? (e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setExternalOverFolderId?.(null)
              }
            }
          : undefined
      }
      onDragOver={
        isExternalDragging
          ? (e) => {
              e.preventDefault()
            }
          : undefined
      }
      onDrop={
        isExternalDragging
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
        'group relative w-full max-w-[340px] select-none cursor-pointer isolate flex flex-col items-center h-full outline-none focus:outline-none focus-visible:outline-none',
      )}
    >
      <div className="absolute inset-0 z-10 pointer-events-none">
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="overflow-visible"
        >
          <path
            d={folderPath}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            strokeWidth={showDropFeedback || isSelected ? 2 : 1}
            className={cn(
              'transition-colors duration-200 fill-none group-hover:stroke-primary stroke-foreground/10',
              (isSelected || isChecked || showDropFeedback) && 'stroke-primary',
            )}
          />
        </svg>
      </div>

      <div className="absolute inset-0 -z-10 pointer-events-none">
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="overflow-visible"
        >
          <path
            d={folderPath}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            strokeWidth={showDropFeedback ? 3 : 1}
            className={cn(
              'transition-colors duration-200 fill-foreground/6 dark:fill-foreground/4',
            )}
          />
        </svg>
      </div>

      <div className="shadow-[0_-4px_6px_rgba(0,0,0,0.08)] relative w-full flex flex-1 flex-col p-2 mt-5 bg-muted dark:bg-muted/50 rounded-sm">
        <div className="relative w-full aspect-video shrink-0 overflow-hidden">
          <div className="absolute top-1 left-1 z-30 transition-all duration-200">
            <Checkbox
              checked={isChecked}
              onClick={(e) => e.stopPropagation()} // Let parent handler deal with it
              className="w-5 h-5 border-1 border-foreground/20 bg-background/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
          </div>

          {item.latestChildren && item.latestChildren.length > 0 && (
            <FolderPreviewGrid items={item.latestChildren} />
          )}
        </div>

        <div className="flex flex-col gap-1 mt-2 px-1">
          <EditableText
            ref={inputRef}
            value={name || ''}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={handleKeyDown}
            disabled={!isEditing}
            className="font-semibold text-foreground text-lg leading-tight truncate h-auto p-0 !bg-transparent"
            title={name}
          />

          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs tracking-wide opacity-80">
              {(item.fileCount || 0) === 1
                ? m.n_items_singular({ count: item.fileCount || 0 })
                : m.n_items_plural({ count: item.fileCount || 0 })}
            </span>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 -mr-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <MoreHorizontal size={18} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isShareView ? (
                  <>
                    {allowDownload && (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          onAction?.('download', item)
                        }}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        <span>{m.download()}</span>
                      </DropdownMenuItem>
                    )}
                    {canEdit && (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          onAction?.('remove-from-share', item)
                        }}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>{m.remove_from_share()}</span>
                      </DropdownMenuItem>
                    )}
                  </>
                ) : isRecentlyDeleted ? (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      onAction?.('restore', item)
                    }}
                  >
                    <History className="mr-2 h-4 w-4" />
                    <span>{m.restore()}</span>
                  </DropdownMenuItem>
                ) : (
                  <>
                    {canEdit && (!isChecked || (selectedCount || 0) <= 1) && (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          onAction?.('rename', item)
                        }}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        <span>{m.rename()}</span>
                      </DropdownMenuItem>
                    )}
                    {allowDownload && (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          onAction?.('download', item)
                        }}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        <span>{m.download()}</span>
                      </DropdownMenuItem>
                    )}
                    {canEdit && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            onAction?.('delete', item)
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          <span>{m.delete()}</span>
                        </DropdownMenuItem>
                      </>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  )
}
