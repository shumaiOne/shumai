import type { AssetInfo } from '@/dtos/asset'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/ui/components/ui/context-menu'
import { Download, Edit, FolderPlus, Trash2, UploadCloud, History, FileText } from 'lucide-react'

interface FileBrowserContextMenuProps {
  item: AssetInfo | null
  selectedIds: Set<string>
  onRename: (item: AssetInfo) => void
  onDelete: (items: AssetInfo[]) => void
  onDownload: (items: AssetInfo[]) => void
  onRestore: (items: AssetInfo[]) => void
  onNewFolder: (name: string) => void
  onUploadFile: () => void
  onUploadFolder: () => void
  folders: AssetInfo[]
  files: AssetInfo[]
  isRecentlyDeleted?: boolean
  onOpenAgentsMd?: (item: AssetInfo | null) => void
  isShareView?: boolean
  onRemoveFromShare?: (items: AssetInfo[]) => void
}

export function FileBrowserContextMenu({
  item,
  selectedIds,
  onRename,
  onDelete,
  onDownload,
  onRestore,
  onNewFolder,
  onUploadFile,
  onUploadFolder,
  folders,
  files,
  isRecentlyDeleted,
  onOpenAgentsMd,
  isShareView,
  onRemoveFromShare,
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

  const handleRestore = () => {
    onRestore(itemsToRestore)
  }

  if (isShareView) {
    if (!item) return null
    return (
      <ContextMenuContent>
        <ContextMenuItem
          onSelect={() => onRemoveFromShare?.(itemsToModify)}
          className="text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          <span>Remove from Share</span>
        </ContextMenuItem>
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
          <span>Restore</span>
        </ContextMenuItem>
      </ContextMenuContent>
    )
  }

  if (!item) {
    // Right-click on empty area
    return (
      <ContextMenuContent
        onCloseAutoFocus={(e) => {
          e.preventDefault()
        }}
      >
        <ContextMenuItem onSelect={onUploadFile}>
          <UploadCloud className="mr-2 h-4 w-4" />
          <span>Upload File</span>
        </ContextMenuItem>
        <ContextMenuItem onSelect={onUploadFolder}>
          <UploadCloud className="mr-2 h-4 w-4" />
          <span>Upload Folder</span>
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            onNewFolder('New Folder')
          }}
        >
          <FolderPlus className="mr-2 h-4 w-4" />
          <span>New Folder</span>
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
          <span>Download</span>
        </ContextMenuItem>
        <ContextMenuItem onSelect={handleDelete} className="text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          <span>Delete</span>
        </ContextMenuItem>
      </ContextMenuContent>
    ) : (
      <ContextMenuContent
        onCloseAutoFocus={(e) => {
          e.preventDefault()
        }}
      >
        <ContextMenuItem
          onSelect={() => {
            handleRename()
          }}
        >
          <Edit className="mr-2 h-4 w-4" />
          <span>Rename</span>
        </ContextMenuItem>
        <ContextMenuItem onSelect={handleDownload}>
          <Download className="mr-2 h-4 w-4" />
          <span>Download</span>
        </ContextMenuItem>

        {item.type === 'folder' && onOpenAgentsMd && (
          <ContextMenuItem onSelect={() => onOpenAgentsMd(item)}>
            <FileText className="mr-2 h-4 w-4" />
            <span>AGENTS.md</span>
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />
        <ContextMenuItem onSelect={handleDelete} className="text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          <span>Delete</span>
        </ContextMenuItem>
      </ContextMenuContent>
    )

  return <>{contextMenuContent}</>
}
