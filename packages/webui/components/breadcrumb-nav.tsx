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
import { useQuery } from '@tanstack/react-query'
import {
  Bot,
  Check,
  ChevronDown,
  Columns2,
  FileIcon,
  History,
  LayoutGrid,
  List,
  Menu,
  SquareKanban,
} from 'lucide-react'
import { useState } from 'react'
import { useDualSidebarStore } from '@/ui/stores/dual-sidebar'
import { ManageVersionsDialog } from './manage-versions-dialog'
import { AssetLinkedTasksDialog } from './kanban/asset-linked-tasks-dialog'

interface BreadcrumbNavProps {
  teamId: string
  projectId: string
  projectName: string
  ancestorFolders: AncestorFolder[]
  currentAsset: {
    id?: string
    name?: string
    type: 'file' | 'folder'
    version?: number
    proxyType?: 'image' | 'video' | 'audio' | 'pdf' | null
  }
  isRootFolder: boolean
  customTerminalBreadcrumb?: string
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
  onRename?: () => void
  onDelete?: () => void
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
  customTerminalBreadcrumb,
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
  onRename,
  onDelete,
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
  const { openMobileMenu } = useDualSidebarStore()
  const [isManageVersionsOpen, setIsManageVersionsOpen] = useState(false)
  const [isLinkedTasksOpen, setIsLinkedTasksOpen] = useState(false)

  const targetAssetId = fileId || currentAsset.id
  const isRecentlyDeleted = currentAsset.name === 'Recently Deleted'
  const isCollection = currentAsset.name === 'All Collections'
  const showKanbanLink =
    !isPublic &&
    !isRootFolder &&
    !isRecentlyDeleted &&
    !isCollection &&
    !compareMode &&
    !!targetAssetId

  const { data: linkedTasksData } = useQuery({
    queryKey: ['teams', teamId, 'kanban', 'assets', targetAssetId, 'tasks'],
    queryFn: async () => {
      if (!teamId || !targetAssetId) return { data: [], total: 0 }
      const res = await client.api.teams[':teamId'].kanban.assets[':assetId'].tasks.$get({
        param: { teamId, assetId: targetAssetId },
      })
      if (!res.ok) return { data: [], total: 0 }
      return (await res.json()) as { data: Array<{ id: string }>; total: number }
    },
    enabled: !!teamId && !!targetAssetId && showKanbanLink,
  })

  const linkedTaskCount = linkedTasksData?.total ?? linkedTasksData?.data?.length ?? 0

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

  const hasTerminal = Boolean(customTerminalBreadcrumb || (!isRootFolder && !compareMode))

  const mobileProjectItem = {
    name: projectName,
    path: isPublic ? undefined : `/projects/${projectId}`,
    id: 'root',
  }

  const mobileAncestorItems = ancestorFolders
    .slice()
    .reverse()
    .map((folder) => ({
      name: folder.name || '',
      path: isPublic ? undefined : `/projects/${projectId}/folders/${folder.id}`,
      id: folder.id,
    }))

  const mobileMiddleItems = hasTerminal ? mobileAncestorItems : mobileAncestorItems.slice(0, -1)
  const mobileTerminalDirect =
    !hasTerminal && mobileAncestorItems.length > 0
      ? mobileAncestorItems[mobileAncestorItems.length - 1]
      : null

  const renderTerminal = (isMobile = false) => {
    if (customTerminalBreadcrumb) {
      return (
        <span
          className={cn(
            'truncate rounded px-2 py-1 text-sm font-medium text-foreground',
            isMobile && 'min-w-0 flex-1',
          )}
        >
          {customTerminalBreadcrumb}
        </span>
      )
    }

    if (!isRootFolder && !compareMode) {
      if (currentAsset.type === 'folder') {
        return (
          <span
            className={cn(
              'truncate rounded px-2 py-1 text-sm font-medium text-foreground',
              isMobile && 'min-w-0 flex-1',
            )}
          >
            {currentAsset.name}
          </span>
        )
      }

      return (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger
            className={cn(
              'flex items-center gap-1 truncate rounded px-2 py-1 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
              isMobile && 'min-w-0 flex-1',
            )}
          >
            <span className="truncate">{currentAsset.name}</span>
            {currentAsset.version !== undefined && (
              <Badge variant="outline" className="px-1 py-0 text-xs shrink-0">
                v{currentAsset.version}
              </Badge>
            )}
            <ChevronDown className="h-4 w-4 shrink-0" />
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
            {canEdit && onRename && (
              <DropdownMenuItem onClick={onRename}>{m.rename()}</DropdownMenuItem>
            )}
            {canEdit && onDelete && (
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                {m.delete()}
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
                          className="w-full text-center text-xs font-medium py-2 px-3 rounded-md bg-muted/80 hover:bg-muted text-foreground transition-colors cursor-pointer"
                          onClick={() => setIsManageVersionsOpen(true)}
                        >
                          {m.manage_versions()}
                        </button>
                      </div>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }

    return null
  }

  return (
    <div className="flex h-14 flex-nowrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-2 overflow-hidden">
      {/* Mobile Breadcrumbs (md:hidden) */}
      <div className="flex md:hidden min-w-0 flex-1 items-center gap-1 overflow-hidden">
        {!isPublic && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openMobileMenu()}
            className="h-8 w-8 text-foreground hover:bg-accent shrink-0 -ml-2 mr-1"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}

        {hasTerminal || mobileTerminalDirect ? (
          <>
            {mobileProjectItem.path ? (
              <Link
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                to={mobileProjectItem.path as any}
                className="min-w-0 flex-1 max-w-[45%] truncate rounded px-1.5 py-1 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground shrink"
              >
                {mobileProjectItem.name}
              </Link>
            ) : (
              <button
                onClick={() => mobileProjectItem.id && onFolderClick?.(mobileProjectItem.id)}
                className="min-w-0 flex-1 max-w-[45%] truncate rounded px-1.5 py-1 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground text-left shrink cursor-pointer"
              >
                {mobileProjectItem.name}
              </button>
            )}

            <span className="text-muted-foreground shrink-0">/</span>

            {mobileMiddleItems.length > 0 && (
              <>
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="text-muted-foreground hover:text-foreground text-sm font-medium px-1.5 py-0.5 rounded hover:bg-accent shrink-0 cursor-pointer"
                      aria-label="Show omitted folders"
                    >
                      ...
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {mobileMiddleItems.map((item, idx) => (
                      <DropdownMenuItem key={idx} asChild>
                        {item.path ? (
                          <Link
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            to={item.path as any}
                            className="cursor-pointer"
                          >
                            {item.name}
                          </Link>
                        ) : (
                          <button
                            onClick={() => item.id && onFolderClick?.(item.id)}
                            className="cursor-pointer w-full text-left"
                          >
                            {item.name}
                          </button>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <span className="text-muted-foreground shrink-0">/</span>
              </>
            )}

            {hasTerminal
              ? renderTerminal(true)
              : mobileTerminalDirect && (
                  <span className="min-w-0 flex-1 truncate rounded px-1.5 py-1 text-sm font-medium text-foreground">
                    {mobileTerminalDirect.name}
                  </span>
                )}
          </>
        ) : (
          <span className="min-w-0 flex-1 truncate rounded px-1.5 py-1 text-sm font-medium text-foreground">
            {mobileProjectItem.name}
          </span>
        )}

        {showKanbanLink && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground hover:bg-muted ml-1 cursor-pointer shrink-0"
            onClick={() => setIsLinkedTasksOpen(true)}
            title={m.linked_tasks()}
          >
            <SquareKanban className="w-4 h-4" />
            {linkedTaskCount > 0 && (
              <span className="inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-semibold rounded-full bg-muted-foreground/15 text-foreground">
                {linkedTaskCount}
              </span>
            )}
          </Button>
        )}
      </div>

      {/* Desktop Breadcrumbs (hidden md:flex) */}
      <div className="hidden md:flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
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
        {hasTerminal && (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">/</span>
            {renderTerminal(false)}
          </div>
        )}

        {showKanbanLink && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground hover:bg-muted ml-1 cursor-pointer shrink-0"
            onClick={() => setIsLinkedTasksOpen(true)}
            title={m.linked_tasks()}
          >
            <SquareKanban className="w-4 h-4" />
            {linkedTaskCount > 0 && (
              <span className="inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-semibold rounded-full bg-muted-foreground/15 text-foreground">
                {linkedTaskCount}
              </span>
            )}
          </Button>
        )}
      </div>

      {showKanbanLink && isLinkedTasksOpen && targetAssetId && (
        <AssetLinkedTasksDialog
          teamId={teamId}
          assetId={targetAssetId}
          assetName={currentAsset.name}
          isOpen={isLinkedTasksOpen}
          onClose={() => setIsLinkedTasksOpen(false)}
        />
      )}

      {fileId && versions && versions.length > 0 && (
        <ManageVersionsDialog
          open={isManageVersionsOpen}
          onOpenChange={setIsManageVersionsOpen}
          stackId={fileId}
          canEdit={canEdit}
          onStackDissolved={(remainingFileId) => {
            setIsManageVersionsOpen(false)
            navigate({
              to: '/projects/$projectId/files/$fileId',
              params: { projectId, fileId: remainingFileId },
            })
          }}
          onVersionRemoved={(removedVersionId, remainingVersions) => {
            const currentVersionId = currentAsset.version
              ? versions.find((v) => v.version === currentAsset.version)?.id
              : undefined
            if (currentVersionId === removedVersionId) {
              const topVersion = remainingVersions[0]
              if (topVersion) {
                navigate({
                  to: '/projects/$projectId/files/$fileId',
                  params: { projectId, fileId },
                  search: (prev: Record<string, unknown>) => ({
                    ...prev,
                    version: topVersion.id,
                  }),
                })
              }
            }
          }}
        />
      )}

      <div className="hidden md:flex items-center gap-2">
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
