import { client } from '@/ui/api/client'
import { Badge } from '@/ui/components/ui/badge'
import { Button } from '@/ui/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/components/ui/dropdown-menu'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import { useArchiveConfig } from '@/ui/hooks/use-archive-config'
import { cn } from '@/ui/lib/utils'
import { m } from '@/ui/paraglide/messages.js'
import { PointerActivationConstraints } from '@dnd-kit/dom'
import { DragDropProvider, KeyboardSensor, PointerSensor, type DragEndEvent } from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import type { StackVersionInfo } from '@shumai/dtos'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import {
  Archive,
  ArchiveRestore,
  Bot,
  FileIcon,
  GripVertical,
  Loader2,
  MoreVertical,
  Trash2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ArchiveConfirmDialog } from './archive-confirm-dialog'

interface ManageVersionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stackId: string
  canEdit?: boolean
  onVersionRemoved?: (removedVersionId: string, remainingVersions: StackVersionInfo[]) => void
  onStackDissolved?: (remainingFileId: string) => void
}

interface SortableVersionRowProps {
  version: StackVersionInfo
  displayVersionNumber: number
  index: number
  canEdit: boolean
  archiveStorageEnabled?: boolean
  onRemove: (versionId: string) => void
  onArchive?: (versionId: string) => void
  onRestoreArchive?: (versionId: string) => void
}

function formatVersionDate(dateString?: string | null): string | null {
  if (!dateString) return null
  try {
    const date = parseISO(dateString)
    if (isNaN(date.getTime())) return null
    return format(date, 'MMM d, yyyy')
  } catch {
    return null
  }
}

function SortableVersionRow({
  version,
  displayVersionNumber,
  index,
  canEdit,
  archiveStorageEnabled = false,
  onRemove,
  onArchive,
  onRestoreArchive,
}: SortableVersionRowProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const { ref, handleRef } = useSortable({
    id: version.id,
    index,
    disabled: !canEdit,
  })

  const formattedDate = formatVersionDate(version.createdAt)

  return (
    <div
      ref={ref}
      className="group flex items-center gap-3 p-2.5 rounded-lg border border-border bg-card hover:bg-accent/40 transition-colors w-full min-w-0 overflow-hidden"
    >
      {/* 1. Version Label */}
      <div className="flex-shrink-0 flex items-center justify-center bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-semibold select-none min-w-[2.25rem]">
        v{displayVersionNumber}
      </div>

      {/* 2. Drag Handler */}
      {canEdit ? (
        <div
          ref={handleRef}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 -m-1 rounded touch-none flex items-center justify-center flex-shrink-0"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      ) : (
        <div className="w-4 flex-shrink-0" />
      )}

      {/* 3. Thumbnail Preview */}
      <div className="h-12 w-20 flex-shrink-0 overflow-hidden rounded-md border border-border bg-muted flex items-center justify-center">
        {version.previewUrl ? (
          <img
            src={version.previewUrl}
            alt={version.name || ''}
            className="h-full w-full object-cover"
          />
        ) : (
          <FileIcon className="h-5 w-5 text-muted-foreground" />
        )}
      </div>

      {/* 4. Name / Creator / Create Date (2 rows) */}
      <div className="flex flex-col flex-1 min-w-0 text-left overflow-hidden">
        {/* Row 1: Name */}
        <div className="flex items-center gap-1.5 min-w-0 w-full overflow-hidden">
          {(version.status === 'archived' || version.status === 'restoring') && (
            <span
              data-testid={
                version.status === 'restoring'
                  ? 'version-row-restoring-badge'
                  : 'version-row-archived-badge'
              }
              title={version.status === 'restoring' ? m.restoring_status() : m.archived_status()}
              className="inline-flex items-center shrink-0"
            >
              <Archive className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
          )}
          <span
            className="truncate text-sm font-medium text-foreground min-w-0 flex-1 block"
            title={version.name || ''}
          >
            {version.name || 'Untitled'}
          </span>
          {version.status === 'archiving' && (
            <Badge
              variant="secondary"
              data-testid="version-row-archiving-badge"
              className="gap-1 px-1.5 py-0 text-xs shrink-0"
            >
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>{m.archiving_status()}</span>
            </Badge>
          )}
        </div>
        {/* Row 2: Creator & Create Date */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0 w-full overflow-hidden">
          {version.agent ? (
            <span className="flex items-center gap-1 min-w-0 truncate">
              <Bot className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {m.user_via_agent({
                  user: version.creator?.name || m.unknown(),
                  agent: version.agent.name,
                })}
              </span>
            </span>
          ) : (
            <span className="truncate min-w-0">{version.creator?.name || m.unknown()}</span>
          )}
          {formattedDate && (
            <>
              <span className="shrink-0">•</span>
              <span className="shrink-0">{formattedDate}</span>
            </>
          )}
        </div>
      </div>

      {/* 5. Three-dot button (only shows on card hover or dropdown open) */}
      {canEdit && (
        <DropdownMenu modal={false} open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="More options"
              className={cn(
                'h-8 w-8 text-muted-foreground hover:text-foreground transition-opacity flex-shrink-0',
                dropdownOpen
                  ? 'opacity-100'
                  : 'opacity-0 group-hover:opacity-100 focus:opacity-100',
              )}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {archiveStorageEnabled && (!version.status || version.status === 'processed') && (
              <DropdownMenuItem
                data-testid="version-row-archive-action"
                onClick={() => onArchive?.(version.id)}
                className="cursor-pointer"
              >
                <Archive className="h-4 w-4 mr-2" />
                <span>{m.archive()}</span>
              </DropdownMenuItem>
            )}
            {archiveStorageEnabled && version.status === 'archived' && (
              <DropdownMenuItem
                data-testid="version-row-restore-archive-action"
                onClick={() => onRestoreArchive?.(version.id)}
                className="cursor-pointer"
              >
                <ArchiveRestore className="h-4 w-4 mr-2" />
                <span>{m.restore_from_archive()}</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => onRemove(version.id)}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              <span>{m.remove_from_stack()}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

export function ManageVersionsDialog({
  open,
  onOpenChange,
  stackId,
  canEdit = true,
  onVersionRemoved,
  onStackDissolved,
}: ManageVersionsDialogProps) {
  const queryClient = useQueryClient()
  const { archiveStorageEnabled } = useArchiveConfig()
  const [localVersions, setLocalVersions] = useState<StackVersionInfo[]>([])
  const [archiveConfirmState, setArchiveConfirmState] = useState<{
    open: boolean
    mode: 'archive' | 'restore'
    versionId: string | null
  }>({ open: false, mode: 'archive', versionId: null })

  const hasTransitioningVersions = localVersions.some(
    (v) => v.status === 'archiving' || v.status === 'restoring',
  )

  const { data: fetchedVersions, isLoading } = useQuery({
    queryKey: ['version_stacks', stackId, 'versions'],
    queryFn: async () => {
      const res = await client.api.version_stacks[':stackId'].versions.$get({
        param: { stackId },
      })
      if (!res.ok) throw new Error('Failed to fetch versions')
      return (await res.json()) as StackVersionInfo[]
    },
    enabled: open && !!stackId,
    refetchInterval: hasTransitioningVersions ? 2000 : false,
  })

  const { mutate: archiveVersion, isPending: isArchivingVersion } = useMutation({
    mutationFn: async (versionId: string) => {
      const res = await client.api.files.archive.$post({
        json: { ids: [versionId] },
      })
      if (!res.ok) throw new Error(m.archive_failed_toast())
      return await res.json()
    },
    onSuccess: (data) => {
      if (data.archivedAssetIds.length > 0) {
        toast.success(m.archive_started_toast({ count: data.archivedAssetIds.length }))
      } else {
        toast.info(m.archive_no_eligible_assets_toast())
      }
      queryClient.invalidateQueries({ queryKey: ['version_stacks', stackId, 'versions'] })
      queryClient.invalidateQueries({ queryKey: ['files'] })
      queryClient.removeQueries({ queryKey: ['file'] })
      queryClient.invalidateQueries({ queryKey: ['search'] })
      setArchiveConfirmState((prev) => ({ ...prev, open: false, versionId: null }))
    },
    onError: () => {
      toast.error(m.archive_failed_toast())
    },
  })

  const { mutate: restoreArchiveVersion, isPending: isRestoringArchiveVersion } = useMutation({
    mutationFn: async (versionId: string) => {
      const res = await client.api.files['restore-archive'].$post({
        json: { ids: [versionId] },
      })
      if (!res.ok) throw new Error(m.restore_archive_failed_toast())
      return await res.json()
    },
    onSuccess: (data) => {
      if (data.restoredAssetIds.length > 0) {
        toast.success(m.restore_archive_started_toast({ count: data.restoredAssetIds.length }))
      } else {
        toast.info(m.restore_archive_no_eligible_assets_toast())
      }
      queryClient.invalidateQueries({ queryKey: ['version_stacks', stackId, 'versions'] })
      queryClient.invalidateQueries({ queryKey: ['files'] })
      queryClient.removeQueries({ queryKey: ['file'] })
      queryClient.invalidateQueries({ queryKey: ['search'] })
      setArchiveConfirmState((prev) => ({ ...prev, open: false, versionId: null }))
    },
    onError: () => {
      toast.error(m.restore_archive_failed_toast())
    },
  })

  useEffect(() => {
    if (fetchedVersions) {
      setLocalVersions(fetchedVersions)
    }
  }, [fetchedVersions])

  // Reorder mutation
  const { mutate: reorderVersion } = useMutation({
    mutationFn: async ({ fileId, beforeId }: { fileId: string; beforeId: string }) => {
      const res = await client.api.version_stacks[':stackId'].order.$post({
        param: { stackId },
        json: { fileId, beforeId },
      })
      if (!res.ok) throw new Error('Failed to reorder versions')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['version_stacks'] })
      queryClient.invalidateQueries({ queryKey: ['files'] })
      queryClient.invalidateQueries({ queryKey: ['file'] })
      queryClient.invalidateQueries({ queryKey: ['search'] })
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success(m.version_reordered_successfully())
    },
    onError: () => {
      toast.error(m.failed_to_reorder_versions())
      if (fetchedVersions) {
        setLocalVersions(fetchedVersions)
      }
    },
  })

  // Remove version mutation
  const { mutate: removeVersion, isPending: isRemoving } = useMutation({
    mutationFn: async (versionId: string) => {
      const res = await client.api.version_stacks[':stackId'].versions[':versionId'].$delete({
        param: { stackId, versionId },
      })
      if (!res.ok) throw new Error('Failed to remove version from stack')
      return versionId
    },
    onSuccess: (removedVersionId) => {
      toast.success(m.version_removed_successfully())
      const remaining = localVersions.filter((v) => v.id !== removedVersionId)
      setLocalVersions(remaining)

      queryClient.invalidateQueries({ queryKey: ['version_stacks'] })
      queryClient.invalidateQueries({ queryKey: ['files'] })
      queryClient.invalidateQueries({ queryKey: ['file'] })
      queryClient.invalidateQueries({ queryKey: ['search'] })
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })

      if (remaining.length <= 1) {
        const singleRemaining = remaining[0]
        onOpenChange(false)
        if (singleRemaining) {
          onStackDissolved?.(singleRemaining.id)
        }
      } else {
        onVersionRemoved?.(removedVersionId, remaining)
      }
    },
    onError: () => {
      toast.error(m.failed_to_remove_version())
    },
  })

  const handleDragEnd = (event: DragEndEvent) => {
    if (event.canceled) return
    const { source } = event.operation
    if (!isSortable(source)) return
    const { initialIndex, index } = source
    if (initialIndex === index) return

    const updated = [...localVersions]
    const [movedItem] = updated.splice(initialIndex, 1)
    updated.splice(index, 0, movedItem)
    setLocalVersions(updated)

    // Calculate beforeId for the API:
    // When moved to index `index` in a list ordered from newest to oldest:
    // If index is at the very bottom (index === updated.length - 1), beforeId = '-1' (places after all others).
    // Otherwise, beforeId is the ID of the item currently at index + 1 (the next item below it in the list).
    const beforeId = index === updated.length - 1 ? '-1' : updated[index + 1].id

    reorderVersion({
      fileId: movedItem.id,
      beforeId,
    })
  }

  const handleRemove = (versionId: string) => {
    if (isRemoving) return
    removeVersion(versionId)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-3 border-b border-border">
          <DialogTitle className="text-base font-semibold">{m.manage_versions_title()}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] p-4 w-full [&>div>div]:!block">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {m.loading?.() || 'Loading...'}
            </div>
          ) : localVersions.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {m.no_versions_found()}
            </div>
          ) : (
            <div className="space-y-2 w-full min-w-0">
              <DragDropProvider
                sensors={[
                  PointerSensor.configure({
                    activationConstraints: [
                      new PointerActivationConstraints.Distance({ value: 6 }),
                    ],
                  }),
                  KeyboardSensor,
                ]}
                onDragEnd={handleDragEnd}
              >
                {localVersions.map((version, index) => (
                  <SortableVersionRow
                    key={version.id}
                    version={version}
                    displayVersionNumber={localVersions.length - index}
                    index={index}
                    canEdit={canEdit}
                    archiveStorageEnabled={archiveStorageEnabled}
                    onRemove={handleRemove}
                    onArchive={(versionId) =>
                      setArchiveConfirmState({ open: true, mode: 'archive', versionId })
                    }
                    onRestoreArchive={(versionId) =>
                      setArchiveConfirmState({ open: true, mode: 'restore', versionId })
                    }
                  />
                ))}
              </DragDropProvider>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
      <ArchiveConfirmDialog
        open={archiveConfirmState.open}
        onOpenChange={(nextOpen) => setArchiveConfirmState((prev) => ({ ...prev, open: nextOpen }))}
        mode={archiveConfirmState.mode}
        onConfirm={() => {
          if (!archiveConfirmState.versionId) return
          if (archiveConfirmState.mode === 'archive') {
            archiveVersion(archiveConfirmState.versionId)
          } else {
            restoreArchiveVersion(archiveConfirmState.versionId)
          }
        }}
        isPending={isArchivingVersion || isRestoringArchiveVersion}
      />
    </Dialog>
  )
}
