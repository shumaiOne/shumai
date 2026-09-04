import type { AssetInfo, FieldValueInfo } from '@shumai/dtos'
import { client } from '@/ui/api/client'
import { useQuery } from '@tanstack/react-query'

import { useDraggable } from '@dnd-kit/react'
import { Bot, File, Folder, MoreVertical, AudioLines } from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/ui/lib/utils'
import { formatSize } from '@/ui/lib/format'
import { selectFileNameWithoutExtension } from '@/ui/lib/rename-utils'
import type { DragState } from '../dnd-types'
import FieldRenderer from '../field-renderer'
import { Badge } from '@/ui/components/ui/badge'
import { Checkbox } from '@/ui/components/ui/checkbox'
import { EditableText } from '@/ui/components/ui/editable-text'
import { useUploadStore } from '@/ui/stores/upload'
import { ProgressCircle } from '@/ui/components/ui/progress-circle'

import { type FieldInfo as MetadataFieldInfo } from '@shumai/dtos'

interface FileListItemProps {
  teamId?: string
  item: AssetInfo
  isSelected: boolean
  isChecked: boolean
  isEditing: boolean
  onSelect: (item: AssetInfo, event: React.MouseEvent) => void
  onDoubleClick: (item: AssetInfo) => void
  onContextMenu: (e: React.MouseEvent, item: AssetInfo) => void
  onDragStart: (item: AssetInfo) => void
  onDrop: (target: AssetInfo) => void
  onRename: (newName: string) => void
  onFinishEditing: () => void
  onSaveField: (fieldId: string, value: unknown) => void
  dragState?: DragState
  disabled?: boolean
  fields: MetadataFieldInfo[]
  columnSizing?: Record<string, number>
  canEdit?: boolean
  isRecents?: boolean
}

export function FileListItem({
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
  fields,
  columnSizing,
  canEdit = true,
  isRecents,
}: FileListItemProps) {
  const [name, setName] = useState(item.name)
  const inputRef = useRef<HTMLInputElement>(null)

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

  const isBeingDragged =
    isDraggableDragging || (dragState?.draggedIds.has(displayItem.id!) ?? false)

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

  useEffect(() => {
    setName(displayItem.name)
  }, [displayItem.name])

  const formatDate = (date?: string) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

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
      ref={setDraggableRef}
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
      className="group cursor-pointer select-none transition-colors whitespace-nowrap flex w-full outline-none focus:outline-none focus-visible:outline-none"
    >
      <div
        className={cn(
          'px-4 py-2 sticky left-0 z-10 transition-colors border-r shrink-0',
          isSelected || isChecked ? 'bg-muted' : 'bg-card group-hover:bg-muted',
        )}
        style={{
          width: columnSizing?.['name'] || 300,
          minWidth: columnSizing?.['name'] || 300,
        }}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <Checkbox
            checked={isChecked}
            onCheckedChange={() => {}}
            onClick={(e) => {
              e.stopPropagation()
              onSelect(displayItem, e)
            }}
            className="h-4 w-4 shrink-0 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
          <div className="w-8 h-8 shrink-0 flex items-center justify-center bg-muted rounded overflow-hidden">
            {displayItem.status === 'uploading' ? (
              <ProgressCircle progress={uploadPercent} className="w-7 h-7" />
            ) : displayItem.preview?.thumbnailUrl ? (
              <img
                src={displayItem.preview.thumbnailUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : displayItem.preview?.proxyType === 'audio' || displayItem.proxyType === 'audio' ? (
              <AudioLines className="h-4 w-4 text-muted-foreground" />
            ) : displayItem.type === 'folder' ? (
              <Folder className="h-4 w-4 text-primary" />
            ) : (
              <File className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <EditableText
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={handleKeyDown}
            disabled={!isEditing}
            className="h-auto p-0 text-sm font-medium text-foreground truncate min-w-0 flex-1"
          />
          {displayItem.status === 'error' && (
            <span className="text-xs text-destructive font-semibold shrink-0">
              (Failed to upload)
            </span>
          )}

          {displayItem.agent && (
            <div
              className="rounded-md bg-background/80 backdrop-blur-sm p-1 shadow-xs border border-border/50 text-foreground shrink-0"
              title={displayItem.agent.name}
              data-testid="agent-badge"
            >
              <Bot className="h-3.5 w-3.5" />
            </div>
          )}

          {displayItem.versionStack && (
            <Badge variant="outline" className="px-1 py-0 text-xs shrink-0">
              v
              {displayItem.versionStack.versions.find((v) => v.id === displayItem.id)?.version ??
                displayItem.versionStack.versions.length}
            </Badge>
          )}
        </div>
      </div>
      <div
        className="px-4 py-2 text-sm text-muted-foreground truncate border-r shrink-0 flex items-center"
        style={{
          width: columnSizing?.['size'] || 100,
          minWidth: columnSizing?.['size'] || 100,
        }}
      >
        {displayItem.type === 'folder'
          ? '-'
          : displayItem.sizeByte
            ? formatSize(displayItem.sizeByte)
            : '-'}
      </div>
      <div
        className="px-4 py-2 border-r shrink-0 flex items-center"
        style={{
          width: columnSizing?.['modified'] || 200,
          minWidth: columnSizing?.['modified'] || 200,
        }}
      >
        <div className="flex items-center justify-between overflow-hidden w-full">
          <span className="text-sm text-muted-foreground truncate">
            {formatDate(displayItem.updatedAt)}
          </span>
          {!isRecents && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                const rect = (e.target as HTMLElement).getBoundingClientRect()
                const contextEvent = new MouseEvent(e.nativeEvent.type, {
                  bubbles: true,
                  cancelable: true,
                  clientX: rect.left,
                  clientY: rect.bottom,
                }) as unknown as React.MouseEvent<Element, MouseEvent>
                onContextMenu(contextEvent, displayItem)
              }}
              className="opacity-0 shrink-0 transition-opacity group-hover:opacity-100 ml-2"
            >
              <MoreVertical className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
      </div>
      {displayItem.type === 'file' &&
        fields.map((field) => (
          <div
            key={field.id}
            className="px-4 py-2 truncate border-r shrink-0 flex items-center"
            style={{
              width: columnSizing?.[field.id!] || 150,
              minWidth: columnSizing?.[field.id!] || 150,
            }}
          >
            <FieldRenderer
              fieldId={field.id}
              config={field.config}
              value={itemFieldValueMap[field.id!]?.value}
              onSave={canEdit && !isRecents ? (val) => onSaveField(field.id!, val) : undefined}
              readOnly={field.readOnly || !canEdit || !!isRecents}
            />
          </div>
        ))}
    </div>
  )
}
