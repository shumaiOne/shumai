import { client } from '@/ui/api/client'
import { Badge } from '@/ui/components/ui/badge'
import { Button } from '@/ui/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/ui/components/ui/dropdown-menu'
import { cn } from '@/ui/lib/utils'
import { m } from '@/ui/paraglide/messages.js'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  MoreVertical,
  Pencil,
  SquareKanban,
  Trash2,
} from 'lucide-react'
import React from 'react'

export interface MobileFileHeaderProps {
  fileName: string
  folderName?: string
  version?: number
  versions?: Array<{
    id: string
    version: number
    name?: string | null
  }>
  activeFileId: string
  isPublic?: boolean
  shareId?: string
  allowDownload?: boolean
  downloadInfo?: {
    originalKey?: string
    videoTranscodes?: Array<{
      key: string
      width: number
      height: number
    }>
  }
  canEdit?: boolean
  onBack: () => void
  onPrevFile?: () => void
  onNextFile?: () => void
  hasPrevFile?: boolean
  hasNextFile?: boolean
  onSelectVersion?: (versionId: string) => void
  onRename?: () => void
  onDelete?: () => void
  onLinkedTasks?: () => void
  linkedTaskCount?: number
}

export function MobileFileHeader({
  fileName,
  folderName,
  version,
  versions,
  activeFileId,
  isPublic = false,
  shareId,
  allowDownload = true,
  downloadInfo,
  canEdit = false,
  onBack,
  onPrevFile,
  onNextFile,
  hasPrevFile = false,
  hasNextFile = false,
  onSelectVersion,
  onRename,
  onDelete,
  onLinkedTasks,
  linkedTaskCount = 0,
}: MobileFileHeaderProps) {
  const handleDownload = async (key: string) => {
    try {
      const res =
        isPublic && shareId
          ? await client.api.shares[':shareId'].files[':fileId']['download-url'].$post({
              param: { shareId, fileId: activeFileId },
              json: { key },
            })
          : await client.api.files['download-url'].$post({
              json: { key, assetId: activeFileId },
            })
      if (!res.ok) return
      const { url } = await res.json()
      const link = document.createElement('a')
      link.href = url
      link.download = ''
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch {
      // silently fail
    }
  }

  const hasVideoTranscodes = (downloadInfo?.videoTranscodes?.length ?? 0) > 0

  return (
    <header className="flex h-12 w-full items-center justify-between border-b border-border bg-card px-2 py-1.5 shrink-0 select-none z-30">
      {/* Left: Back Button */}
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-8 w-8 text-foreground hover:bg-accent cursor-pointer"
          aria-label={m.previous_page()}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      </div>

      {/* Center: Folder / File Title & Prev / Next Arrows */}
      <div className="flex flex-1 items-center justify-center gap-1 min-w-0 px-1">
        <div className="flex items-center min-w-0 max-w-[65vw]">
          {folderName && (
            <>
              <span className="truncate text-xs font-medium text-muted-foreground max-w-[80px]">
                {folderName}
              </span>
              <span className="text-muted-foreground mx-1 text-xs">/</span>
            </>
          )}

          {versions && versions.length > 1 ? (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 min-w-0 truncate text-xs font-medium text-foreground hover:bg-accent rounded px-1 py-0.5 transition-colors cursor-pointer">
                  <span className="truncate max-w-[120px] font-semibold">{fileName}</span>
                  {version !== undefined && (
                    <Badge variant="outline" className="px-1 py-0 text-[10px] shrink-0 font-normal">
                      v{version}
                    </Badge>
                  )}
                  <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-48 z-40">
                <DropdownMenuLabel className="text-xs">{m.switch_version()}</DropdownMenuLabel>
                {versions.map((v) => (
                  <DropdownMenuItem
                    key={v.id}
                    onClick={() => onSelectVersion?.(v.id)}
                    className={cn(
                      'flex items-center justify-between text-xs cursor-pointer',
                      v.id === activeFileId ? 'bg-accent font-semibold text-accent-foreground' : '',
                    )}
                  >
                    <span>v{v.version}</span>
                    <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                      {v.name || fileName}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-1 min-w-0 truncate">
              <span className="truncate text-xs font-semibold text-foreground max-w-[140px]">
                {fileName}
              </span>
              {version !== undefined && (
                <Badge variant="outline" className="px-1 py-0 text-[10px] shrink-0 font-normal">
                  v{version}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Prev / Next file navigation buttons */}
        {(hasPrevFile || hasNextFile) && (
          <div className="flex items-center gap-0.5 shrink-0 bg-muted/60 rounded p-0.5 ml-1">
            <Button
              variant="ghost"
              size="icon"
              disabled={!hasPrevFile}
              onClick={onPrevFile}
              className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
              title={m.previous_file()}
              aria-label={m.previous_file()}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={!hasNextFile}
              onClick={onNextFile}
              className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
              title={m.next_file()}
              aria-label={m.next_file()}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Right: Three-Dot Menu */}
      <div className="flex items-center gap-1">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-foreground hover:bg-accent cursor-pointer"
              aria-label={m.more_options()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 z-40">
            {/* Download */}
            {allowDownload &&
              (hasVideoTranscodes ? (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="flex items-center gap-2 text-xs cursor-pointer">
                    <Download className="h-3.5 w-3.5" />
                    <span>{m.download()}</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent className="w-48 z-50">
                      <DropdownMenuLabel className="text-xs">{m.download()}</DropdownMenuLabel>
                      {downloadInfo?.videoTranscodes?.map((t) => {
                        const longSide = Math.max(t.width, t.height)
                        let resolution = `${t.height}p`
                        if (longSide >= 3840) resolution = '2160p'
                        else if (longSide >= 1920) resolution = '1080p'
                        else if (longSide >= 1280) resolution = '720p'
                        else if (longSide >= 960) resolution = '540p'
                        else if (longSide >= 640) resolution = '360p'
                        else if (longSide >= 320) resolution = '180p'
                        return (
                          <DropdownMenuItem
                            key={resolution}
                            onClick={() => handleDownload(t.key)}
                            className="flex items-center justify-between text-xs cursor-pointer"
                          >
                            <span>{resolution}</span>
                            <span className="text-[10px] text-muted-foreground">MP4</span>
                          </DropdownMenuItem>
                        )
                      })}
                      {downloadInfo?.originalKey && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDownload(downloadInfo.originalKey!)}
                            className="flex items-center justify-between text-xs cursor-pointer"
                          >
                            <span>{m.original?.() || 'Original'}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {fileName.split('.').pop()?.toUpperCase() || 'RAW'}
                            </span>
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              ) : (
                <DropdownMenuItem
                  onClick={() =>
                    downloadInfo?.originalKey && handleDownload(downloadInfo.originalKey)
                  }
                  disabled={!downloadInfo?.originalKey}
                  className="flex items-center gap-2 text-xs cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{m.download()}</span>
                </DropdownMenuItem>
              ))}

            {/* Switch Version (if multi-version) */}
            {versions && versions.length > 1 && onSelectVersion && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="flex items-center gap-2 text-xs cursor-pointer">
                  <span>{m.switch_version?.() || 'Switch version'}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="w-48 z-50">
                    <DropdownMenuLabel className="text-xs">
                      {m.switch_version?.() || 'Switch version'}
                    </DropdownMenuLabel>
                    {versions.map((v) => (
                      <DropdownMenuItem
                        key={v.id}
                        onClick={() => onSelectVersion(v.id)}
                        className={cn(
                          'flex items-center justify-between text-xs cursor-pointer',
                          v.id === activeFileId
                            ? 'bg-accent font-semibold text-accent-foreground'
                            : '',
                        )}
                      >
                        <span>v{v.version}</span>
                        <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                          {v.name || fileName}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            )}

            {/* Linked Tasks */}
            {onLinkedTasks && (
              <DropdownMenuItem
                onClick={onLinkedTasks}
                className="flex items-center justify-between text-xs cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <SquareKanban className="h-3.5 w-3.5" />
                  <span>{m.linked_tasks?.() || 'Linked Tasks'}</span>
                </span>
                {linkedTaskCount > 0 && (
                  <span className="inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-semibold rounded-full bg-muted-foreground/15 text-foreground">
                    {linkedTaskCount}
                  </span>
                )}
              </DropdownMenuItem>
            )}

            {/* Rename */}
            {canEdit && onRename && (
              <DropdownMenuItem
                onClick={onRename}
                className="flex items-center gap-2 text-xs cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>{m.rename()}</span>
              </DropdownMenuItem>
            )}

            {/* Delete */}
            {canEdit && onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  className="flex items-center gap-2 text-xs text-destructive focus:text-destructive cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{m.delete()}</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
