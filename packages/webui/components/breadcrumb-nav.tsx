import { Badge } from '@/ui/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/ui/components/ui/dropdown-menu'
import {
  DockToLeft,
  DockToLeftFilled,
  DockToRight,
  DockToRightFilled,
} from '@/ui/components/ui/icons'
import { usePermissions } from '@/ui/hooks/use-permissions'
import { cn } from '@/ui/lib/utils'
import type { AncestorFolder } from '@shumai/dtos'
import { Link, useNavigate } from '@tanstack/react-router'
import { Check, ChevronDown, FileIcon, History, LayoutGrid, List } from 'lucide-react'

interface BreadcrumbNavProps {
  teamId: string
  projectId: string
  projectName: string
  ancestorFolders: AncestorFolder[]
  currentAsset: {
    name?: string
    type: 'file' | 'folder'
    version?: number
  }
  isRootFolder: boolean
  displayStyle?: 'card' | 'list'
  onDisplayStyleChange?: (style: 'card' | 'list') => void
  isLeftSidebarCollapsed?: boolean
  onLeftSidebarToggle?: () => void
  isRightSidebarCollapsed: boolean
  onRightSidebarToggle: () => void
  isPublic?: boolean
  shareId?: string
  onFolderClick?: (folderId: string) => void
  fileId?: string
  versions?: Array<{
    id: string
    version: number
    name?: string | null
    previewUrl?: string | null
    creator?: { id: string; name: string | null } | null
  }>
}

export function BreadcrumbNav({
  teamId,
  projectId,
  projectName,
  ancestorFolders,
  currentAsset,
  isRootFolder,
  displayStyle,
  onDisplayStyleChange,
  isLeftSidebarCollapsed,
  onLeftSidebarToggle,
  isRightSidebarCollapsed,
  onRightSidebarToggle,
  isPublic = false,
  onFolderClick,
  fileId,
  versions,
}: BreadcrumbNavProps) {
  const navigate = useNavigate()
  const { canEdit } = usePermissions(projectId)

  const handleVersionClick = (versionId: string) => {
    if (!projectId || !fileId) return
    navigate({
      to: '/projects/$projectId/files/$fileId',
      params: { projectId, fileId },
      search: (prev: Record<string, unknown>) => ({ ...prev, version: versionId }),
    })
  }

  const breadcrumbs: { name: string; path?: string; id?: string; isMuted?: boolean }[] = isPublic
    ? [
        {
          name: projectName,
          id: 'root', // Special ID for share root
        },
        ...ancestorFolders
          .slice()
          .reverse()
          .map((folder) => ({
            name: folder.name || '',
            id: folder.id,
          })),
      ]
    : [
        { name: 'All Projects', path: `/teams/${teamId}`, isMuted: true },
        { name: projectName, path: `/projects/${projectId}` },
        ...ancestorFolders
          .slice()
          .reverse()
          .map((folder) => ({
            name: folder.name || '',
            path: `/projects/${projectId}/folders/${folder.id}`,
          })),
      ]

  return (
    <div className="flex h-14 flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-2">
      <div className="flex min-w-0 flex-shrink items-center gap-1">
        {breadcrumbs.map((breadcrumb, index) => (
          <div key={index} className="flex items-center gap-1">
            {index > 0 && <span className="text-muted-foreground">/</span>}
            {breadcrumb.path ? (
              <Link
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                to={breadcrumb.path as any}
                className={cn(
                  'truncate rounded px-2 py-1 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                  breadcrumb.isMuted ? 'text-muted-foreground' : 'text-foreground',
                )}
              >
                {breadcrumb.name}
              </Link>
            ) : (
              <button
                onClick={() => breadcrumb.id && onFolderClick?.(breadcrumb.id)}
                className="truncate rounded px-2 py-1 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground text-foreground"
              >
                {breadcrumb.name}
              </button>
            )}
          </div>
        ))}
        {!isRootFolder && (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">/</span>
            {currentAsset.type === 'folder' ? (
              <span className="truncate rounded px-2 py-1 text-sm font-medium text-foreground">
                {currentAsset.name}
              </span>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 truncate rounded px-2 py-1 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                  <span>{currentAsset.name}</span>
                  {currentAsset.version !== undefined && (
                    <Badge variant="outline" className="px-1 py-0 text-xs">
                      v{currentAsset.version}
                    </Badge>
                  )}
                  <ChevronDown className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuItem onClick={() => console.log('Download')}>
                    Download
                  </DropdownMenuItem>
                  {canEdit && (
                    <DropdownMenuItem onClick={() => console.log('Rename')}>
                      Rename
                    </DropdownMenuItem>
                  )}
                  {canEdit && (
                    <DropdownMenuItem onClick={() => console.log('Delete')}>
                      Delete
                    </DropdownMenuItem>
                  )}

                  {versions && versions.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="flex items-center gap-2">
                          <History className="h-4 w-4" />
                          <span>Versions</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                          <DropdownMenuSubContent className="w-80 p-1">
                            <div className="flex flex-col gap-1 max-h-96 overflow-y-auto">
                              {versions.map((v) => {
                                const isActive = currentAsset.version === v.version
                                return (
                                  <DropdownMenuItem
                                    key={v.id}
                                    onClick={() => handleVersionClick(v.id)}
                                    className="flex items-center gap-3 py-2 px-3 rounded-md cursor-pointer focus:bg-accent focus:text-accent-foreground"
                                  >
                                    <div className="flex-shrink-0 flex items-center justify-center bg-muted dark:bg-muted-foreground/20 text-muted-foreground dark:text-muted-foreground rounded-full px-2 py-0.5 text-xs font-semibold select-none min-w-[2rem]">
                                      v{v.version}
                                    </div>

                                    <div className="h-10 w-16 flex-shrink-0 overflow-hidden rounded-md border border-border bg-muted flex items-center justify-center">
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

                                    <div className="flex flex-col flex-1 min-w-0 text-left">
                                      <span className="truncate text-sm font-semibold text-foreground">
                                        {v.name}
                                      </span>
                                      <span className="truncate text-xs text-muted-foreground">
                                        {v.creator?.name || 'Unknown'}
                                      </span>
                                    </div>

                                    {isActive && (
                                      <Check className="h-4 w-4 text-primary ml-auto flex-shrink-0" />
                                    )}
                                  </DropdownMenuItem>
                                )
                              })}
                            </div>
                            <DropdownMenuSeparator />
                            <div className="p-1">
                              <button
                                className="w-full text-center text-xs font-medium py-2 px-3 rounded-md bg-muted/80 hover:bg-muted text-foreground transition-colors"
                                onClick={() => console.log('Manage versions')}
                              >
                                Manage versions...
                              </button>
                            </div>
                          </DropdownMenuSubContent>
                        </DropdownMenuPortal>
                      </DropdownMenuSub>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </div>

      {!fileId && (
        <div className="flex flex-shrink-0 items-center gap-1 rounded-md border border-border bg-background p-1">
          {/* Left Sidebar Toggle */}
          {!isPublic && onLeftSidebarToggle && (
            <button
              onClick={onLeftSidebarToggle}
              className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
              title={isLeftSidebarCollapsed ? 'Show Left Sidebar' : 'Hide Left Sidebar'}
            >
              {isLeftSidebarCollapsed ? (
                <DockToLeft className="h-4 w-4" />
              ) : (
                <DockToLeftFilled className="h-4 w-4 fill-primary stroke-0" />
              )}
            </button>
          )}

          {/* Card View */}
          {!isPublic && displayStyle && onDisplayStyleChange && (
            <>
              <button
                onClick={() => onDisplayStyleChange('card')}
                className={`rounded p-1.5 transition-colors ${
                  displayStyle === 'card'
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                }`}
                title="Card View"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>

              {/* List View */}
              <button
                onClick={() => onDisplayStyleChange('list')}
                className={`rounded p-1.5 transition-colors ${
                  displayStyle === 'list'
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                }`}
                title="List View"
              >
                <List className="h-4 w-4" />
              </button>
            </>
          )}

          {/* Right Sidebar Toggle */}
          <button
            onClick={onRightSidebarToggle}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
            title={isRightSidebarCollapsed ? 'Show Right Sidebar' : 'Hide Right Sidebar'}
          >
            {isRightSidebarCollapsed ? (
              <DockToRight className="h-4 w-4" />
            ) : (
              <DockToRightFilled className="h-4 w-4 fill-primary stroke-0" />
            )}
          </button>
        </div>
      )}
    </div>
  )
}
