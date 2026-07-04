import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/components/ui/dropdown-menu'
import { cn } from '@/ui/lib/utils'
import { m } from '@/ui/paraglide/messages.js'
import { Check, ChevronDown, FileIcon, X } from 'lucide-react'
import type { CompareSide } from './types'

interface VersionItem {
  id: string
  version: number
  name?: string | null
  previewUrl?: string | null
  creator?: { id: string; name: string | null } | null
}

interface ComparePaneTopbarProps {
  side: CompareSide
  fileName: string
  version?: number
  activeVersionId: string
  versions: VersionItem[]
  isActive: boolean
  onActivate: () => void
  onSwitchVersion: (versionId: string) => void
  onExit: () => void
}

export function ComparePaneTopbar({
  side,
  fileName,
  version,
  activeVersionId,
  versions,
  isActive,
  onActivate,
  onSwitchVersion,
  onExit,
}: ComparePaneTopbarProps) {
  const iconButtonClass = cn(
    'flex-shrink-0 rounded p-1 transition-colors',
    isActive
      ? 'text-background/70 hover:bg-background/20 hover:text-background'
      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
  )

  const exitButton = (
    <button onClick={onExit} title={m.exit_compare()} className={iconButtonClass}>
      <X className="h-4 w-4" />
    </button>
  )

  const label = (
    <button
      onClick={onActivate}
      className={cn(
        'flex min-w-0 items-center gap-1 rounded px-2 py-1 text-sm font-medium transition-colors',
        isActive
          ? 'text-background hover:bg-background/20'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
      )}
    >
      <span className="truncate">{fileName}</span>
      {version !== undefined && (
        <span
          className={cn(
            'flex-shrink-0 rounded border px-1 py-0 text-xs',
            isActive ? 'border-background/40' : 'border-border',
          )}
        >
          v{version}
        </span>
      )}
    </button>
  )

  const versionDropdown = (
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={onActivate}
        title={m.switch_version()}
        className={iconButtonClass}
      >
        <ChevronDown className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={side === 'left' ? 'start' : 'end'} className="w-80 p-1">
        <div className="flex max-h-96 flex-col gap-1 overflow-y-auto">
          {versions.map((v) => {
            const isCurrent = v.id === activeVersionId
            return (
              <DropdownMenuItem
                key={v.id}
                onClick={() => onSwitchVersion(v.id)}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2"
              >
                <div className="flex min-w-[2rem] flex-shrink-0 items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground select-none">
                  v{v.version}
                </div>
                <div className="flex h-10 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                  {v.previewUrl ? (
                    <img
                      src={v.previewUrl}
                      alt={v.name || undefined}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <FileIcon className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col text-left">
                  <span className="truncate text-sm font-semibold text-foreground">{v.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {v.creator?.name || 'Unknown'}
                  </span>
                </div>
                {isCurrent && <Check className="ml-auto h-4 w-4 flex-shrink-0 text-primary" />}
              </DropdownMenuItem>
            )
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div
      onMouseDown={onActivate}
      className={cn(
        'flex h-10 flex-shrink-0 items-center gap-1 border-b px-2 transition-colors',
        isActive
          ? 'border-b-2 border-primary bg-foreground text-background'
          : 'border-border bg-card text-muted-foreground',
      )}
    >
      {side === 'left' ? (
        <>
          {exitButton}
          {label}
          {versionDropdown}
        </>
      ) : (
        <>
          {label}
          {versionDropdown}
          <div className="ml-auto" />
          {exitButton}
        </>
      )}
    </div>
  )
}
