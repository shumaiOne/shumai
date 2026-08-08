import { client } from '@/ui/api/client'
import { Badge } from '@/ui/components/ui/badge'
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
import {
  BotFilled,
  DockToLeft,
  DockToLeftFilled,
  DockToRight,
  DockToRightFilled,
} from '@/ui/components/ui/icons'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/ui/components/ui/tooltip'
import { usePermissions } from '@/ui/hooks/use-permissions'
import { cn } from '@/ui/lib/utils'
import { m } from '@/ui/paraglide/messages.js'
import type { AncestorFolder } from '@shumai/dtos'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  Bot,
  Check,
  ChevronDown,
  Columns2,
  FileIcon,
  History,
  LayoutGrid,
  List,
} from 'lucide-react'

interface BreadcrumbNavProps {
  teamId: string
  projectId: string
  projectName: string
  ancestorFolders: AncestorFolder[]
  currentAsset: {
    name?: string
    type: 'file' | 'folder'
    version?: number
    proxyType?: 'image' | 'video' | 'audio' | 'pdf' | null
  }
  isRootFolder: boolean
  displayStyle?: 'card' | 'list'
  onDisplayStyleChange?: (style: 'card' | 'list') => void
  isLeftSidebarCollapsed?: boolean
  onLeftSidebarToggle?: () => void
  isRightSidebarCollapsed: boolean
  onRightSidebarToggle: () => void
  isChatbotOpen?: boolean
  onChatbotToggle?: () => void
  isPublic?: boolean
  shareId?: string
  allowDownload?: boolean
  onFolderClick?: (folderId: string) => void
  fileId?: string
  downloadInfo?: {
    originalKey?: string
    videoTranscodes?: Array<{
      key: string
      width: number
      height: number
    }>
  }
  versions?: Array<{
    id: string
    version: number
    name?: string | null
    previewUrl?: string | null
    creator?: { id: string; name: string | null } | null
  }>
  compareMode?: boolean
  canCompareVersions?: boolean
  onCompareVersions?: () => void
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
  isChatbotOpen = false,
  onChatbotToggle,
  isPublic = false,
  onFolderClick,
  fileId,
  shareId,
  allowDownload = true,
  downloadInfo,
  versions,
  compareMode = false,
  canCompareVersions = false,
  onCompareVersions,
}: BreadcrumbNavProps) {
  const navigate = useNavigate()
  const { canEdit } = usePermissions(projectId)

  const isChatbotDisabled = false

  const handleVersionClick = (versionId: string) => {
    if (!fileId) return
    if (isPublic && shareId) {
      navigate({
        to: '/share/$shareId/files/$fileId',
        params: { shareId, fileId },
        search: (prev: Record<string, unknown>) => ({ ...prev, version: versionId }),
      })
      return
    }
    if (!projectId) return
    navigate({
      to: '/projects/$projectId/files/$fileId',
      params: { projectId, fileId },
      search: (prev: Record<string, unknown>) => ({ ...prev, version: versionId }),
    })
  }

  const handleDownload = async (key: string) => {
    if (!fileId) return
    try {
      const res = shareId
        ? await client.api.shares[':shareId'].files[':fileId']['download-url'].$post({
            param: { shareId, fileId },
            json: { key },
          })
        : await client.api.files['download-url'].$post({
            json: { key, assetId: fileId },
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

  const isAudio = currentAsset.proxyType === 'audio'
  const hasVideoTranscodes = !isAudio && (downloadInfo?.videoTranscodes?.length ?? 0) > 0

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
        { name: m.all_projects(), path: `/teams/${teamId}`, isMuted: true },
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
        {!isRootFolder && !compareMode && (
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
                  {allowDownload &&
                    (hasVideoTranscodes ? (
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="flex items-center gap-2">
                          <span>{m.download()}</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                          <DropdownMenuSubContent className="w-48">
                            <DropdownMenuLabel>{m.download()}</DropdownMenuLabel>
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
                                  className="flex items-center justify-between"
                                >
                                  <span>{resolution}</span>
                                  <span className="text-xs text-muted-foreground">MP4</span>
                                </DropdownMenuItem>
                              )
                            })}
                            {downloadInfo?.originalKey && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleDownload(downloadInfo.originalKey!)}
                                  className="flex items-center justify-between"
                                >
                                  <span>Original</span>
                                  <span className="text-xs text-muted-foreground">
                                    {currentAsset.name?.split('.').pop()?.toUpperCase() || 'RAW'}
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
                      >
                        {m.download()}
                      </DropdownMenuItem>
                    ))}
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

                  {canCompareVersions && onCompareVersions && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onCompareVersions()}>
                        <Columns2 className="h-4 w-4" />
                        <span>{m.compare_versions()}</span>
                      </DropdownMenuItem>
                    </>
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

      <div className="flex items-center gap-2">
        <div className="flex flex-shrink-0 items-center gap-1 rounded-md border border-border bg-background p-1">
          {/* Left Sidebar Toggle */}
          {!fileId && !isPublic && onLeftSidebarToggle && (
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
          {!fileId && !isPublic && displayStyle && onDisplayStyleChange && (
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
            className={`rounded p-1.5 transition-colors ${
              !isRightSidebarCollapsed && !isChatbotOpen
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            }`}
            title={isRightSidebarCollapsed ? 'Show Right Sidebar' : 'Hide Right Sidebar'}
          >
            {!isRightSidebarCollapsed && !isChatbotOpen ? (
              <DockToRightFilled className="h-4 w-4 fill-primary stroke-0" />
            ) : (
              <DockToRight className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Chatbot Toggle Button */}
        {!isPublic && onChatbotToggle && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <button
                    disabled={isChatbotDisabled}
                    onClick={onChatbotToggle}
                    className={cn(
                      'h-9 w-9 flex items-center justify-center rounded-full border border-border bg-background transition-colors',
                      isChatbotOpen
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                      isChatbotDisabled && 'opacity-50 cursor-not-allowed',
                    )}
                  >
                    {isChatbotOpen ? (
                      <BotFilled className="h-6 w-6 text-primary transition-colors" />
                    ) : (
                      <Bot className="h-6 w-6 text-muted-foreground transition-colors" />
                    )}
                  </button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {isChatbotDisabled
                    ? m.configure_chatbot_agent_first()
                    : isChatbotOpen
                      ? m.hide_chatbot()
                      : m.show_chatbot()}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  )
}
