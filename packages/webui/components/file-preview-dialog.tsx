import React, { useEffect } from 'react'
import { Folder, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import type { AssetInfo } from '@shumai/dtos'
import { client } from '@/ui/api/client'
import { m } from '@/ui/paraglide/messages.js'
import { Dialog, DialogContent, DialogTitle } from '@/ui/components/ui/dialog'
import { FileViewer } from './file-viewer'
import { cn } from '../lib/utils'

export interface FilePreviewDialogProps {
  item: AssetInfo | null
  isOpen: boolean
  onClose: () => void
  allowDownload?: boolean
  shareId?: string
  isPublic?: boolean
}

export function FilePreviewDialog({
  item,
  isOpen,
  onClose,
  allowDownload = true,
  shareId,
}: FilePreviewDialogProps) {
  // Capture-phase keydown listener for Space key to unconditionally close the preview
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [isOpen, onClose])

  const isFolder = item?.type === 'folder'
  const targetFileId = item?.versionStack ? item.versionStack.id : item?.id

  // Fetch full asset data (with presigned high-res/transcoded media URLs) when previewing a file
  const { data: detailedFile } = useQuery({
    queryKey: shareId ? ['shares', shareId, 'files', targetFileId] : ['files', targetFileId],
    queryFn: async () => {
      if (!targetFileId) throw new Error('No target file ID')
      const res = shareId
        ? await client.api.shares[':shareId'].files[':fileId'].$get({
            param: { shareId, fileId: targetFileId },
          })
        : await client.api.files[':fileId'].$get({
            param: { fileId: targetFileId },
          })
      if (!res.ok) throw new Error('Failed to fetch file detail')
      return (await res.json()) as unknown as AssetInfo
    },
    enabled: isOpen && !isFolder && !!targetFileId,
    placeholderData: item ?? undefined,
  })

  if (!item) return null

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        data-testid="file-preview-dialog-content"
        showCloseButton={false}
        className={cn(
          'p-0 overflow-hidden flex flex-col gap-0 border bg-background rounded-lg shadow-2xl outline-none focus:outline-none focus-visible:outline-none',
          isFolder
            ? 'w-full max-w-md max-h-[min(1080px,70vh)]'
            : 'w-[min(1920px,70vw)] h-[min(1080px,70vh)] max-w-[min(1920px,70vw)] max-h-[min(1080px,70vh)]',
        )}
        style={{
          maxWidth: 'min(1920px, 70vw)',
          maxHeight: 'min(1080px, 70vh)',
        }}
      >
        {/* Subtle top header bar with title and close button */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card select-none shrink-0">
          <div className="flex items-center gap-2 min-w-0 mr-4">
            <DialogTitle className="text-sm font-medium text-foreground truncate" title={item.name}>
              {item.name}
            </DialogTitle>
          </div>
          <button
            data-testid="quick-preview-close-button"
            onClick={onClose}
            className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Area */}
        {isFolder ? (
          <div className="flex flex-col items-center justify-center p-8 text-center select-none gap-4">
            <div className="p-4 rounded-2xl bg-primary/10 text-primary">
              <Folder className="w-16 h-16 stroke-[1.5]" data-testid="folder-preview-icon" />
            </div>
            <div className="flex flex-col items-center gap-1 max-w-full px-2">
              <h3
                className="text-lg font-semibold text-foreground truncate max-w-full"
                title={item.name}
              >
                {item.name}
              </h3>
              <p className="text-sm text-muted-foreground" data-testid="folder-preview-count">
                {(item.fileCount || 0) === 1
                  ? m.n_items_singular({ count: item.fileCount || 0 })
                  : m.n_items_plural({ count: item.fileCount || 0 })}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 relative min-h-0 overflow-hidden bg-background">
            <FileViewer
              file={detailedFile || item}
              allowDownload={allowDownload}
              shareId={shareId}
              autoPlay={true}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
