import { client } from '@/ui/api/client'
import type { AssetInfo, FieldValueInfo } from '@shumai/dtos'
import { useQuery } from '@tanstack/react-query'

import { Badge } from '@/ui/components/ui/badge'
import { Button } from '@/ui/components/ui/button'
import { Checkbox } from '@/ui/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/components/ui/dropdown-menu'
import { EditableText } from '@/ui/components/ui/editable-text'
import { Skeleton } from '@/ui/components/ui/skeleton'
import { formatTimeAgo } from '@/ui/lib/time'
import { cn } from '@/ui/lib/utils'
import { useDraggable, useDroppable } from '@dnd-kit/react'
import { Download, Edit, History, MoreHorizontal, Trash2 } from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { DragState } from '../dnd-types'
import FieldRenderer from '../field-renderer'
import { FilePreview } from './file-preview'

import { type FieldInfo as MetadataFieldInfo } from '@shumai/dtos'

interface FileCardProps {
  teamId?: string
  item: AssetInfo
  isSelected: boolean
  isChecked: boolean
  isEditing: boolean
  onSelect: (item: AssetInfo, event: React.MouseEvent) => void
  onDoubleClick: (item: AssetInfo) => void
  onContextMenu: (e: React.MouseEvent, item: AssetInfo) => void
  // Deprecated manual drag handlers replaced by dnd-kit
  onDragStart: (item: AssetInfo) => void
  onDrop: (target: AssetInfo) => void
  onRename: (newName: string) => void
  onFinishEditing: () => void
  onSaveField: (fieldId: string, value: unknown) => void
  dragState?: DragState
  disabled?: boolean
  onAction?: (
    action: 'rename' | 'delete' | 'download' | 'restore' | 'remove-from-share',
    item: AssetInfo,
  ) => void
  isRecentlyDeleted?: boolean
  selectedCount?: number
  fields: MetadataFieldInfo[]
  isShareView?: boolean
  canEdit?: boolean
}

export function FileCard({
  teamId,
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
  onSaveField,
  dragState,
  disabled,
  onAction,
  isRecentlyDeleted,
  selectedCount,
  fields,
  isShareView,
  canEdit = true,
}: FileCardProps) {
  const [name, setName] = useState(item.name)
  const inputRef = useRef<HTMLInputElement>(null)

  const shouldPoll =
    (item.type === 'file' || item.type === 'version_stack') &&
    !!teamId &&
    (item.status === 'uploading' || item.status === 'uploaded' || item.status === 'processing')

  const { data: polledItem } = useQuery({
    queryKey: ['file', teamId, item.id],
    queryFn: async () => {
      const res = await client.api.files[':fileId'].$get({
        param: { fileId: item.id || '' },
      })
      if (!res.ok) throw new Error('failed to fetch file')
      return (await res.json()) as unknown as AssetInfo
    },
    enabled: shouldPoll,
    refetchInterval: (query: unknown) => {
      const data = (query as { state: { data: { status?: string } } }).state.data
      return data?.status === 'processed' ? false : 1000
    },
  })

  const displayItem = polledItem || item

  // dnd-kit hooks
  const { ref: setDraggableRef, isDragging: isDraggableDragging } = useDraggable({
    id: `browser:${displayItem.id!}`,
    data: {
      type: 'file',
      id: displayItem.id,
      item: displayItem,
    },
    disabled: disabled,
  })

  const { ref: setDroppableRef, isDropTarget: isOver } = useDroppable({
    id: `browser:${displayItem.id!}`,
    data: {
      type: 'file',
      id: displayItem.id,
      item: displayItem,
    },
  })

  // Combine refs
  const setNodeRef = (node: HTMLElement | null) => {
    setDraggableRef(node)
    setDroppableRef(node)
  }

  // Determine if this item is being dragged (either directly or as part of selection)
  const isBeingDragged =
    isDraggableDragging || (dragState?.draggedIds.has(displayItem.id!) ?? false)

  // Determine if this is a valid drop target
  // File target is valid ONLY if dragging 1 item AND it is a file (version stack)
  // And strictly, we shouldn't drop on ourselves
  const isValidDropTarget = useMemo(() => {
    if (!dragState?.isActive) return false
    if (dragState.draggedIds.has(displayItem.id!)) return false // Can't drop on self
    if (dragState.hasFolders) return false // Can't drag folders onto file
    if (dragState.itemCount !== 1) return false // Can't drag multiple files onto file
    return true
  }, [dragState, displayItem.id])

  const showDropFeedback = isOver && isValidDropTarget

  // We only gray out the original item, drag overlay will show the "ghost"
  const opacity = isBeingDragged ? 0.5 : 1

  const itemFieldValueMap = useMemo(() => {
    return (displayItem.fieldValues || []).reduce(
      (acc: Record<string, FieldValueInfo>, val: FieldValueInfo) => {
        acc[val.fieldId!] = val
        return acc
      },
      {} as Record<string, FieldValueInfo>,
    )
  }, [displayItem.fieldValues])

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

  // Reset name if item changes
  useEffect(() => {
    setName(displayItem.name)
  }, [displayItem.name])

  const handleClick = (e: React.MouseEvent) => {
    onSelect(displayItem, e)
  }

  const handleRename = () => {
    if (name !== displayItem.name) {
      onRename(name || '')
    }
    onFinishEditing()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleRename()
    }
    if (e.key === 'Escape') {
      setName(displayItem.name || '')
      onFinishEditing()
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={{ opacity }}
      onClick={handleClick}
      onDoubleClick={() => onDoubleClick(displayItem)}
      onContextMenu={(e) => onContextMenu(e, displayItem)}
      onMouseDown={(e) => {
        if (e.shiftKey) {
          e.preventDefault()
        }
      }}
      className={cn(
        'group relative flex cursor-pointer select-none flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary h-full m-1',
        isSelected && 'outline-1 outline-primary border-primary',
        showDropFeedback && 'border-primary outline-1 outline-primary',
      )}
    >
      <div className="absolute left-2 top-2 z-10">
        <Checkbox
          checked={isChecked}
          onCheckedChange={() => {}}
          onClick={(e) => {
            e.stopPropagation()
            onSelect(displayItem, e)
          }}
          className="h-4 w-4 bg-white/20 dark:bg-white/20 border-2 data-[state=checked]:bg-primary data-[state=checked]:border-primary border-foreground/15"
        />
      </div>

      {displayItem.versionStack && (
        <Badge className="absolute right-2 top-2 z-10">
          v
          {displayItem.versionStack.versions.find((v) => v.id === displayItem.id)?.version ??
            displayItem.versionStack.versions.length}
        </Badge>
      )}

      <div className="relative aspect-square overflow-hidden bg-muted/30">
        {displayItem.status === 'uploading' ||
        displayItem.status === 'processing' ||
        displayItem.status === 'uploaded' ||
        displayItem.status === 'error' ? (
          <div className="flex h-full w-full items-center justify-center bg-background/50">
            {displayItem.status !== 'error' && (
              <Skeleton className="absolute inset-0 h-full w-full" />
            )}
            <span
              className={cn(
                'z-10 font-medium px-2 text-center text-sm',
                displayItem.status === 'error'
                  ? 'text-destructive font-semibold'
                  : 'text-muted-foreground capitalize',
              )}
            >
              {displayItem.status === 'uploaded'
                ? 'Processing'
                : displayItem.status === 'error'
                  ? 'Failed to upload'
                  : displayItem.status}
            </span>
          </div>
        ) : (
          <FilePreview item={displayItem} />
        )}
      </div>

      <div className="flex items-center justify-between gap-2 p-3">
        <div className="min-w-0 flex-1">
          <EditableText
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={handleKeyDown}
            disabled={!isEditing}
            className="h-auto p-0 text-sm text-foreground !bg-transparent"
          />
          <p className="text-sm text-muted-foreground">
            {displayItem.createdAt && formatTimeAgo(displayItem.createdAt)} by{' '}
            {displayItem.creator?.name}
          </p>
        </div>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon-sm"
              variant="ghost"
              className="cursor-pointer"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4 text-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isShareView ? (
              <>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    onAction?.('download', item)
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  <span>Download</span>
                </DropdownMenuItem>
                {canEdit && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      onAction?.('remove-from-share', item)
                    }}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Remove from Share</span>
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
                <span>Restore</span>
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
                    <span>Rename</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    onAction?.('download', item)
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  <span>Download</span>
                </DropdownMenuItem>
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
                      <span>Delete</span>
                    </DropdownMenuItem>
                  </>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {fields && fields.length > 0 && (
        <div className="space-y-2 border-t p-3 mx-2">
          {fields.map((field) => (
            <div key={field.id} className="space-y-1">
              <label className="text-xs text-muted-foreground tracking-wide">
                {field.config?.name}
              </label>
              <div className="min-h-[28px]">
                <FieldRenderer
                  config={field.config}
                  value={itemFieldValueMap[field.id!]?.value}
                  onSave={canEdit ? (val) => onSaveField(field.id!, val) : undefined}
                  readOnly={field.readOnly || !canEdit}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
