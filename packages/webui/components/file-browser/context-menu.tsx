import type { AssetInfo } from '@shumai/dtos'
import type { ShareLinkInfo } from '@shumai/dtos'
import { m } from '@/ui/paraglide/messages.js'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuPortal,
} from '@/ui/components/ui/context-menu'
import {
  Download,
  Edit,
  FolderPlus,
  Trash2,
  UploadCloud,
  History,
  FileText,
  Link,
  Plus,
  ArrowRight,
  Copy,
} from 'lucide-react'

interface FileBrowserContextMenuProps {
  item: AssetInfo | null
  selectedIds: Set<string>
  onRename: (item: AssetInfo) => void
  onDelete: (items: AssetInfo[]) => void
  onDownload: (items: AssetInfo[]) => void
  onCopyNameAndDownloadLink?: (items: AssetInfo[]) => void
  onRestore: (items: AssetInfo[]) => void
  onNewFolder: (name: string) => void
  onUploadFile: () => void
  onUploadFolder: () => void
  onNewVersion: (item: AssetInfo) => void
  onMoveTo: (items: AssetInfo[]) => void
  onCopyTo: (items: AssetInfo[]) => void
  folders: AssetInfo[]
  files: AssetInfo[]
  isRecentlyDeleted?: boolean
  isRecents?: boolean
  onOpenAgentsMd?: (item: AssetInfo | null) => void
  isShareView?: boolean
  onRemoveFromShare?: (items: AssetInfo[]) => void
  shareLinks?: ShareLinkInfo[]
  onCreateShareLink?: (items: AssetInfo[]) => void
  onAddToShareLink?: (shareId: string, items: AssetInfo[]) => void
  canEdit?: boolean
}

export function FileBrowserContextMenu({
  item,
  selectedIds,
  onRename,
  onDelete,
  onDownload,
  onCopyNameAndDownloadLink,
  onRestore,
  onNewFolder,
  onUploadFile,
  onUploadFolder,
  onNewVersion,
  onMoveTo,
  onCopyTo,
  folders,
  files,
  isRecentlyDeleted,
  isRecents,
  onOpenAgentsMd,
  isShareView,
  onRemoveFromShare,
  shareLinks = [],
  onCreateShareLink,
  onAddToShareLink,
  canEdit = true,
}: FileBrowserContextMenuProps) {
  const allItems = [...folders, ...files]
  const selectedItems = allItems.filter((i) => selectedIds.has(i.id!))
  const isItemSelected = item && selectedIds.has(item.id!)
  const itemsToModify = isItemSelected ? selectedItems : item ? [item] : []
  const itemsToDelete = itemsToModify
  const itemsToRestore = itemsToModify

  const handleRename = () => {
    if (item) {
      onRename(item)
    }
  }

  const handleDelete = () => {
    onDelete(itemsToDelete)
  }

  const handleDownload = () => {
    if (isItemSelected) {
      onDownload(selectedItems)
    } else if (item) {
      onDownload([item])
    }
  }

  const handleCopyNameAndDownloadLink = () => {
    if (isItemSelected) {
      onCopyNameAndDownloadLink?.(selectedItems)
    } else if (item) {
      onCopyNameAndDownloadLink?.([item])
    }
  }

  const handleRestore = () => {
    onRestore(itemsToRestore)
  }

  if (isRecents) {
    return null
  }

  if (isShareView) {
    if (!item) return null
    return (
      <ContextMenuContent>
        <ContextMenuItem onSelect={handleDownload}>
          <Download className="mr-2 h-4 w-4" />
          <span>{m.download()}</span>
        </ContextMenuItem>
        <ContextMenuItem onSelect={handleCopyNameAndDownloadLink}>
          <Copy className="mr-2 h-4 w-4" />
          <span>{m.copy_name_and_download_link()}</span>
        </ContextMenuItem>
        {canEdit && (
          <ContextMenuItem
            onSelect={() => onRemoveFromShare?.(itemsToModify)}
            className="text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            <span>{m.remove_from_share()}</span>
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    )
  }

  if (isRecentlyDeleted) {
    if (!item) {
      return null
    }
    return (
      <ContextMenuContent>
        <ContextMenuItem onSelect={handleRestore}>
          <History className="mr-2 h-4 w-4" />
          <span>{m.restore()}</span>
        </ContextMenuItem>
      </ContextMenuContent>
    )
  }

  if (!item) {
    if (!canEdit || isRecents) return null
    // Right-click on empty area
    return (
      <ContextMenuContent
        onCloseAutoFocus={(e) => {
          e.preventDefault()
        }}
      >
        <ContextMenuItem onSelect={onUploadFile}>
          <UploadCloud className="mr-2 h-4 w-4" />
          <span>{m.upload_file()}</span>
        </ContextMenuItem>
        <ContextMenuItem onSelect={onUploadFolder}>
          <UploadCloud className="mr-2 h-4 w-4" />
          <span>{m.upload_folder()}</span>
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            onNewFolder(m.new_folder())
          }}
        >
          <FolderPlus className="mr-2 h-4 w-4" />
          <span>{m.new_folder()}</span>
        </ContextMenuItem>
      </ContextMenuContent>
    )
  }

  const contextMenuContent =
    isItemSelected && selectedIds.size > 1 ? (
      <ContextMenuContent
        onCloseAutoFocus={(e) => {
          e.preventDefault()
        }}
      >
        <ContextMenuItem onSelect={handleDownload}>
          <Download className="mr-2 h-4 w-4" />
          <span>{m.download()}</span>
        </ContextMenuItem>
        <ContextMenuItem onSelect={handleCopyNameAndDownloadLink}>
          <Copy className="mr-2 h-4 w-4" />
          <span>{m.copy_name_and_download_link()}</span>
        </ContextMenuItem>
        {canEdit && (
          <ContextMenuItem onSelect={() => onMoveTo(itemsToModify)}>
            <ArrowRight className="mr-2 h-4 w-4" />
            <span>{m.move_to()}</span>
          </ContextMenuItem>
        )}
        {canEdit && (
          <ContextMenuItem onSelect={() => onCopyTo(itemsToModify)}>
            <Copy className="mr-2 h-4 w-4" />
            <span>{m.copy_to()}</span>
          </ContextMenuItem>
        )}
        {canEdit && (
          <ContextMenuItem onSelect={handleDelete} className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            <span>{m.delete()}</span>
          </ContextMenuItem>
        )}

        {canEdit && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => onCreateShareLink?.(itemsToModify)}>
              <Plus className="mr-2 h-4 w-4" />
              <span>{m.create_share_link()}</span>
            </ContextMenuItem>

            {shareLinks.length > 0 && (
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <Link className="mr-2 h-4 w-4" />
                  <span>{m.add_to_share_links()}</span>
                </ContextMenuSubTrigger>
                <ContextMenuPortal>
                  <ContextMenuSubContent className="w-48">
                    {shareLinks.map((share) => (
                      <ContextMenuItem
                        key={share.id}
                        onSelect={() => onAddToShareLink?.(share.id, itemsToModify)}
                      >
                        <span className="truncate">{share.name}</span>
                      </ContextMenuItem>
                    ))}
                  </ContextMenuSubContent>
                </ContextMenuPortal>
              </ContextMenuSub>
            )}
          </>
        )}
      </ContextMenuContent>
    ) : (
      <ContextMenuContent
        onCloseAutoFocus={(e) => {
          e.preventDefault()
        }}
      >
        {canEdit && (
          <ContextMenuItem
            onSelect={() => {
              handleRename()
            }}
          >
            <Edit className="mr-2 h-4 w-4" />
            <span>{m.rename()}</span>
          </ContextMenuItem>
        )}
        <ContextMenuItem onSelect={handleDownload}>
          <Download className="mr-2 h-4 w-4" />
          <span>{m.download()}</span>
        </ContextMenuItem>
        <ContextMenuItem onSelect={handleCopyNameAndDownloadLink}>
          <Copy className="mr-2 h-4 w-4" />
          <span>{m.copy_name_and_download_link()}</span>
        </ContextMenuItem>

        {canEdit && (
          <ContextMenuItem onSelect={() => onMoveTo(itemsToModify)}>
            <ArrowRight className="mr-2 h-4 w-4" />
            <span>{m.move_to()}</span>
          </ContextMenuItem>
        )}
        {canEdit && (
          <ContextMenuItem onSelect={() => onCopyTo(itemsToModify)}>
            <Copy className="mr-2 h-4 w-4" />
            <span>{m.copy_to()}</span>
          </ContextMenuItem>
        )}

        {canEdit && (item.type === 'file' || item.type === 'version_stack') && (
          <ContextMenuItem onSelect={() => onNewVersion(item)}>
            <UploadCloud className="mr-2 h-4 w-4" />
            <span>{m.create_new_version()}</span>
          </ContextMenuItem>
        )}

        {item.type === 'folder' && onOpenAgentsMd && (
          <ContextMenuItem onSelect={() => onOpenAgentsMd(item)}>
            <FileText className="mr-2 h-4 w-4" />
            <span>AGENTS.md</span>
          </ContextMenuItem>
        )}

        {canEdit && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={handleDelete} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              <span>{m.delete()}</span>
            </ContextMenuItem>

            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => onCreateShareLink?.(itemsToModify)}>
              <Plus className="mr-2 h-4 w-4" />
              <span>{m.create_share_link()}</span>
            </ContextMenuItem>

            {shareLinks.length > 0 && (
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <Link className="mr-2 h-4 w-4" />
                  <span>{m.add_to_share_links()}</span>
                </ContextMenuSubTrigger>
                <ContextMenuPortal>
                  <ContextMenuSubContent className="w-48">
                    {shareLinks.map((share) => (
                      <ContextMenuItem
                        key={share.id}
                        onSelect={() => onAddToShareLink?.(share.id, itemsToModify)}
                      >
                        <span className="truncate">{share.name}</span>
                      </ContextMenuItem>
                    ))}
                  </ContextMenuSubContent>
                </ContextMenuPortal>
              </ContextMenuSub>
            )}
          </>
        )}
      </ContextMenuContent>
    )

  return <>{contextMenuContent}</>
}
