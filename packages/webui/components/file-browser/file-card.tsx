import { client } from '@/ui/api/client'
import { m } from '@/ui/paraglide/messages.js'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/ui/components/ui/tooltip'
import { ProgressCircle } from '@/ui/components/ui/progress-circle'
import { formatTimeAgo, getTrashDaysLeft } from '@/ui/lib/time'
import { selectFileNameWithoutExtension } from '@/ui/lib/rename-utils'
import { cn } from '@/ui/lib/utils'
import { useUploadStore } from '@/ui/stores/upload'
import { useDraggable, useDroppable } from '@dnd-kit/react'
import {
  Clock,
  Download,
  Edit,
  History,
  Layers,
  MessageCircleMore,
  MoreHorizontal,
  Trash2,
} from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { DragState } from '../dnd-types'
import FieldRenderer from '../field-renderer'
import { FilePreview } from './file-preview'

import { FieldType, type FieldInfo as MetadataFieldInfo } from '@shumai/dtos'
import { FIELD_TYPE_ICONS } from '../fields-manager'

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
    action: 'rename' | 'delete' | 'download' | 'restore' | 'remove-from-share' | 'manage-versions',
    item: AssetInfo,
  ) => void
  isRecentlyDeleted?: boolean
  isRecents?: boolean
  selectedCount?: number
  fields: MetadataFieldInfo[]
  isShareView?: boolean
  canEdit?: boolean
  /** When false, hides the download action. Defaults to true. */
  allowDownload?: boolean
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
  isRecents,
  selectedCount,
  fields,
  isShareView,
  canEdit = true,
  allowDownload = true,
}: FileCardProps) {
  const [name, setName] = useState(item.name)
  const inputRef = useRef<HTMLInputElement>(null)
  const [isCreatorTooltipOpen, setIsCreatorTooltipOpen] = useState(false)
  const creatorRef = useRef<HTMLParagraphElement>(null)

  const fileUploadState = useUploadStore((state) => state.fileProgress[item.id || ''])
  const uploadPercent = fileUploadState
    ? fileUploadState.total > 0
      ? (fileUploadState.loaded / fileUploadState.total) * 100
      : 0
    : 0

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

  const displayItem = useMemo(() => {
    if (item.status === 'processed' || item.status === 'error') {
      return item
    }
    if (polledItem?.status === 'processed' || polledItem?.status === 'error') {
      return polledItem
    }
    return polledItem || item
  }, [item, polledItem])

  // dnd-kit hooks
  const { ref: setDraggableRef, isDragging: isDraggableDragging } = useDraggable({
    id: `browser:${displayItem.id!}`,
    data: {
      type: displayItem.type,
      id: displayItem.id,
      item: displayItem,
    },
    disabled: disabled,
  })

  const { ref: setDroppableRef, isDropTarget: isOver } = useDroppable({
    id: `browser:${displayItem.id!}`,
    data: {
      type: displayItem.type,
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
  // File/version stack target is valid ONLY if dragging 1 single regular file
  // And strictly, we shouldn't drop on ourselves
  const isValidDropTarget = useMemo(() => {
    if (!dragState?.isActive) return false
    if (dragState.draggedIds.has(displayItem.id!)) return false // Can't drop on self
    return dragState.isSingleFile
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
        if (inputRef.current) {
          selectFileNameWithoutExtension(inputRef.current)
        }
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

  const creatorText = useMemo(() => {
    if (!displayItem.createdAt) return ''
    return m.created_by_at({
      time: formatTimeAgo(displayItem.createdAt),
      author: displayItem.agent
        ? m.user_via_agent({
            user: displayItem.creator?.name || m.unknown_user(),
            agent: displayItem.agent.name,
          })
        : displayItem.creator?.name || m.unknown_user(),
    })
  }, [displayItem.createdAt, displayItem.agent, displayItem.creator?.name])

  const daysLeft = isRecentlyDeleted ? getTrashDaysLeft(displayItem.deletedAt) : null
  const daysLeftTooltip =
    daysLeft === null
      ? ''
      : daysLeft === 1
        ? m.n_days_left_singular({ count: daysLeft })
        : m.n_days_left_plural({ count: daysLeft })

  // A preview (poster thumbnail and/or sprite) can be available before transcoding finishes,
  // since the poster/sprite are generated and persisted ahead of the proxy transcodes.
  const hasPreview = Boolean(displayItem.preview?.thumbnailUrl || displayItem.preview?.spriteUrl)
  const isProcessing = displayItem.status === 'processing' || displayItem.status === 'uploaded'

  // While uploading/transcoding, the creator row is replaced by a short status label so the real
  // date/author only appears once the asset is ready.
  const statusText =
    displayItem.status === 'uploading'
      ? m.uploading()
      : displayItem.status === 'uploaded' || displayItem.status === 'processing'
        ? m.preparing()
        : null

  const previewBadges =
    daysLeft !== null ||
    (typeof displayItem.commentsCount === 'number' && displayItem.commentsCount > 0) ? (
      <div
        data-testid="file-card-preview-badges"
        className="pointer-events-none absolute bottom-1 left-1 z-10 flex items-center gap-1"
      >
        {daysLeft !== null && (
          <span
            data-testid="file-card-days-left"
            title={daysLeftTooltip}
            className="flex items-center gap-1 rounded bg-black/60 px-1 py-0.5 text-xs font-medium tabular-nums text-white"
          >
            <Clock className="h-3.5 w-3.5" />
            <span>{m.days_left_short({ count: daysLeft })}</span>
          </span>
        )}
        {typeof displayItem.commentsCount === 'number' && displayItem.commentsCount > 0 && (
          <span
            data-testid="file-card-comments-count"
            className="flex items-center gap-1 rounded bg-black/60 px-1 py-0.5 text-xs font-medium tabular-nums text-white"
          >
            <MessageCircleMore className="h-3.5 w-3.5" />
            <span>{displayItem.commentsCount}</span>
          </span>
        )}
      </div>
    ) : null

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
      data-testid="file-card"
      className={cn(
        'group relative flex cursor-pointer select-none flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary h-full m-1 outline-none focus:outline-none focus-visible:outline-none',
        (isSelected || isChecked) && 'outline-1 outline-primary border-primary',
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

      <div className="absolute right-2 top-2 z-10 flex items-center gap-1.5">
        {displayItem.agent && (
          <span
            className="select-none rounded bg-black/60 px-1 py-0.5 text-xs font-medium text-white"
            title={displayItem.agent.name}
            data-testid="agent-badge"
          >
            AI
          </span>
        )}
        {displayItem.versionStack && (
          <Badge>
            v
            {displayItem.versionStack.versions.find((v) => v.id === displayItem.id)?.version ??
              displayItem.versionStack.versions.length}
          </Badge>
        )}
      </div>

      <div className="relative aspect-square overflow-hidden bg-muted/30">
        {displayItem.status === 'uploading' ? (
          <div className="flex h-full w-full items-center justify-center bg-background/50">
            <ProgressCircle progress={uploadPercent} className="w-16 h-16 z-10" />
          </div>
        ) : hasPreview ? (
          <>
            <div
              data-testid="file-card-preview-media"
              className={cn('h-full w-full', isProcessing && 'animate-pulse')}
            >
              <FilePreview item={displayItem} showDuration={!isProcessing} />
            </div>
            {previewBadges}
          </>
        ) : displayItem.status === 'error' ? (
          <div className="flex h-full w-full items-center justify-center bg-background/50">
            <span className="z-10 font-medium px-2 text-center text-sm text-destructive font-semibold">
              {m.failed_to_upload()}
            </span>
          </div>
        ) : displayItem.status === 'processing' || displayItem.status === 'uploaded' ? (
          <div className="flex h-full w-full items-center justify-center">
            {/* Same geometry as the upload progress ring, but empty inside and no percentage. */}
            <svg
              viewBox="0 0 50 50"
              data-testid="file-card-preparing-circle"
              className="h-16 w-16 opacity-60 animate-preparing-breathe"
            >
              <circle
                cx="25"
                cy="25"
                r="20"
                className="stroke-muted-foreground"
                strokeWidth="4"
                fill="transparent"
              />
            </svg>
          </div>
        ) : (
          <>
            <FilePreview item={displayItem} showDuration />
            {previewBadges}
          </>
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
            className="h-auto p-0 text-sm font-medium text-foreground truncate !bg-transparent"
          />
          <TooltipProvider delayDuration={100}>
            <Tooltip
              open={isCreatorTooltipOpen}
              onOpenChange={(nextOpen) => {
                if (nextOpen) {
                  if (
                    creatorRef.current &&
                    (creatorRef.current.scrollHeight > creatorRef.current.clientHeight ||
                      creatorRef.current.scrollWidth > creatorRef.current.clientWidth)
                  ) {
                    setIsCreatorTooltipOpen(true)
                  } else {
                    setIsCreatorTooltipOpen(false)
                  }
                } else {
                  setIsCreatorTooltipOpen(false)
                }
              }}
            >
              <TooltipTrigger asChild>
                <p ref={creatorRef} className="text-sm text-muted-foreground line-clamp-2 h-[2lh]">
                  {statusText ?? creatorText}
                </p>
              </TooltipTrigger>
              {isCreatorTooltipOpen && (
                <TooltipContent
                  side="bottom"
                  className="max-w-md break-all text-wrap [text-wrap:normal] text-left"
                >
                  {creatorText}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
        {!isRecents && (
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
                  {canEdit && item.type === 'version_stack' && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        onAction?.('manage-versions', item)
                      }}
                    >
                      <Layers className="mr-2 h-4 w-4" />
                      <span>{m.manage_versions()}</span>
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
        )}
      </div>
      {fields && fields.length > 0 && (
        <div className="space-y-2 border-t p-1 pt-3 mx-2">
          {fields.map((field) => {
            const Icon = field.config?.type
              ? FIELD_TYPE_ICONS[field.config.type as FieldType]
              : null
            return (
              <div key={field.id} className="space-y-1 bg-muted/50 p-1 rounded border">
                <label className="text-xs text-muted-foreground tracking-wide flex items-center gap-1">
                  {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  <span>{field.config?.name}</span>
                </label>
                <div className="min-h-[28px]">
                  <FieldRenderer
                    fieldId={field.id}
                    config={field.config}
                    value={itemFieldValueMap[field.id!]?.value}
                    onSave={
                      canEdit && !isRecents ? (val) => onSaveField(field.id!, val) : undefined
                    }
                    readOnly={field.readOnly || !canEdit || !!isRecents}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
