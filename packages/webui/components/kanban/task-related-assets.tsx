import { useState } from 'react'
import { Button } from '@/ui/components/ui/button'
import { Separator } from '@/ui/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/components/ui/avatar'
import { m } from '@/ui/paraglide/messages.js'
import type { KanbanTaskAssetInfo } from '@shumai/dtos'
import { AssetPickerDialog } from './asset-picker-dialog'
import { Plus, X, Folder, File, Paperclip } from 'lucide-react'

interface TaskRelatedAssetsProps {
  teamId: string
  projectId?: string | null
  assets: KanbanTaskAssetInfo[]
  onAddAssets: (newAssets: KanbanTaskAssetInfo[]) => void
  onRemoveAsset: (assetId: string) => void
  disabled?: boolean
}

export function TaskRelatedAssets({
  teamId,
  projectId,
  assets,
  onAddAssets,
  onRemoveAsset,
  disabled = false,
}: TaskRelatedAssetsProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false)

  const handleConfirmPicker = (selectedAssets: KanbanTaskAssetInfo[]) => {
    // Filter out already linked assets
    const existingIds = new Set(assets.map((a) => a.id))
    const toAdd = selectedAssets.filter((a) => !existingIds.has(a.id))
    if (toAdd.length > 0) {
      onAddAssets(toAdd)
    }
  }

  return (
    <div className="space-y-2">
      {/* Title + Plus Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
          <span>{m.related_assets()}</span>
          {assets.length > 0 && (
            <span className="text-[11px] text-muted-foreground font-normal">({assets.length})</span>
          )}
        </div>
        {!disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-muted"
            onClick={() => setIsPickerOpen(true)}
            title={m.add_assets()}
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      <Separator />

      {/* Assets List Rows */}
      {assets.length === 0 ? (
        <p className="text-xs text-muted-foreground/70 py-1 italic">{m.no_related_assets()}</p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {assets.map((asset) => {
            const isFolder = asset.type === 'folder'

            return (
              <div
                key={asset.id}
                className="flex items-center justify-between gap-2 p-1.5 px-2 rounded-md bg-muted/40 hover:bg-muted/70 transition-colors text-xs border border-border/40"
              >
                {/* Left: Thumbnail & Names */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {/* Thumbnail / Icon */}
                  <div className="w-7 h-7 rounded bg-muted border shrink-0 flex items-center justify-center overflow-hidden">
                    {asset.thumbnailUrl ? (
                      <img
                        src={asset.thumbnailUrl}
                        alt={asset.name}
                        className="w-full h-full object-cover"
                      />
                    ) : isFolder ? (
                      <Folder className="w-4 h-4 text-primary fill-primary/20" />
                    ) : (
                      <File className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>

                  {/* Name & Path */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-foreground leading-snug">
                      {asset.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate leading-none mt-0.5">
                      {asset.path || '/'}
                    </p>
                  </div>
                </div>

                {/* Right: Creator & Remove Button */}
                <div className="flex items-center gap-2 shrink-0">
                  {asset.creator && (
                    <div
                      className="flex items-center gap-1 text-[11px] text-muted-foreground"
                      title={asset.creator.name}
                    >
                      <Avatar className="w-4 h-4 text-[9px]">
                        <AvatarImage src={asset.creator.image || undefined} />
                        <AvatarFallback>
                          {asset.creator.name.slice(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden sm:inline text-[11px] max-w-[80px] truncate">
                        {asset.creator.name}
                      </span>
                    </div>
                  )}

                  {!disabled && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => onRemoveAsset(asset.id)}
                      title={m.unlink_asset()}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Asset Picker Dialog */}
      {isPickerOpen && (
        <AssetPickerDialog
          teamId={teamId}
          initialProjectId={projectId}
          excludeAssetIds={assets.map((a) => a.id)}
          isOpen={isPickerOpen}
          onClose={() => setIsPickerOpen(false)}
          onConfirm={handleConfirmPicker}
        />
      )}
    </div>
  )
}
