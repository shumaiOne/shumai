import type { AssetInfoPaginatedList, AssetInfo } from '@shumai/dtos'
import { client } from '@/ui/api/client'
import { cn } from '@/ui/lib/utils'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMatch, useNavigate, useParams } from '@tanstack/react-router'
import {
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  ChevronRight,
  Clapperboard,
  Folder,
  Loader2,
  Trash2,
  Plus,
  Share2,
  LayoutGrid,
  Bookmark,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useInView } from 'react-intersection-observer'
import { useDraggable, useDroppable } from '@dnd-kit/react'
import type { DragState } from './dnd-types'
import { toast } from 'sonner'
import type { ShareLinkInfo } from '@shumai/dtos'
import type { CollectionInfo } from '@shumai/dtos'

interface FolderTreeProps {
  teamId: string
  projectId: string
  projectName: string
  rootFolderId: string
  dragState?: DragState
  onSelect?: (folder: AssetInfo) => void
  selectedFolderId?: string
  hideCollections?: boolean
  hideShares?: boolean
}

export function FolderTree({
  teamId,
  projectId,
  projectName,
  rootFolderId,
  dragState,
  onSelect,
  selectedFolderId,
  hideCollections,
  hideShares,
}: FolderTreeProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isRecentlyDeleted = useMatch({
    from: '/projects/$projectId/recently-deleted',
    shouldThrow: false,
  })

  const [isAssetsExpanded, setIsAssetsExpanded] = useState(true)
  const [isCollectionsExpanded, setIsCollectionsExpanded] = useState(true)
  const [isSharesExpanded, setIsSharesExpanded] = useState(true)

  const { data: shareLinksData } = useQuery({
    queryKey: ['shares', projectId],
    queryFn: async () => {
      const res = await client.api.projects[':projectId'].shares.$get({
        param: { projectId },
        query: { first: '100' },
      })
      if (!res.ok) throw new Error('Failed to fetch share links')
      return (await res.json()) as unknown as { data: ShareLinkInfo[] }
    },
    enabled: !!projectId,
  })

  const { data: collectionsData } = useQuery({
    queryKey: ['collections', projectId],
    queryFn: async () => {
      const res = await client.api.projects[':projectId'].collections.$get({
        param: { projectId },
        query: { first: '100' },
      })
      if (!res.ok) throw new Error('Failed to fetch collections')
      return (await res.json()) as unknown as { data: CollectionInfo[] }
    },
    enabled: !!projectId,
  })

  const { mutate: createCollection } = useMutation({
    mutationFn: async () => {
      const res = await client.api.projects[':projectId'].collections.$post({
        param: { projectId },
        json: {
          name: 'Untitled Collection',
          filter: {
            sourceFolderId: rootFolderId,
            searchFilter: {
              conditions: [],
              recursively: true,
            },
          },
        },
      })
      if (!res.ok) throw new Error('Failed to create collection')
      return await res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['collections', projectId] })
      toast.success('Collection created')
      navigate({
        to: '/projects/$projectId/collections/$collectionId',
        params: { projectId, collectionId: data.id },
      })
    },
    onError: (err) => {
      toast.error(`Error: ${err.message}`)
    },
  })

  const { mutate: createShareLink } = useMutation({
    mutationFn: async () => {
      const res = await client.api.projects[':projectId'].shares.$post({
        param: { projectId },
        json: {
          name: new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
        },
      })
      if (!res.ok) throw new Error('Failed to create share link')
      return await res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['shares', projectId] })
      toast.success('Share link created')
      navigate({
        to: '/projects/$projectId/shares/$shareId',
        params: { projectId, shareId: data.id },
      })
    },
    onError: (err) => {
      toast.error(`Error: ${err.message}`)
    },
  })

  const shareLinks = shareLinksData?.data ?? []

  return (
    <div className="flex flex-col h-full overflow-hidden p-3 gap-4 bg-background">
      <div
        className={cn(
          'flex flex-col overflow-hidden transition-all duration-300 ease-in-out border-b border-border pb-4',
          isAssetsExpanded ? 'flex-1 min-h-[50%] h-full' : 'flex-none h-[44px] max-h-[44px]',
        )}
      >
        <header className="group flex items-center justify-between px-2 mb-1 flex-none">
          <div
            className="flex-1 flex items-center gap-1.5 cursor-pointer select-none text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setIsAssetsExpanded(!isAssetsExpanded)}
          >
            <h3 className="text-xs font-semibold uppercase tracking-wider">Assets</h3>
            {isAssetsExpanded ? (
              <ChevronsDownUp className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            ) : (
              <ChevronsUpDown className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            )}
          </div>
          <button className="text-muted-foreground hover:text-foreground flex-none">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </header>

        <div
          className={cn(
            'flex-1 overflow-y-auto min-h-0 space-y-0.5 pr-1 transition-all duration-300 ease-in-out',
            isAssetsExpanded
              ? 'opacity-100 visible pointer-events-auto'
              : 'opacity-0 invisible pointer-events-none h-0',
          )}
        >
          <FolderTreeItem
            key={rootFolderId}
            teamId={teamId}
            projectId={projectId}
            folder={{
              id: rootFolderId,
              name: projectName,
              type: 'folder',
              sizeByte: 0,
              fileCount: 0,
              status: 'processed',
              mediaType: null,
              createdAt: '',
              updatedAt: '',
            }}
            level={0}
            isRoot={true}
            dragState={dragState}
            onSelect={onSelect}
            selectedFolderId={selectedFolderId}
          />
          <div
            className={cn(
              'group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              isRecentlyDeleted && 'bg-sidebar-accent text-sidebar-accent-foreground font-medium',
            )}
            onClick={() =>
              navigate({
                to: '/projects/$projectId/recently-deleted',
                params: { projectId },
              })
            }
          >
            <div className="flex h-4 w-4 items-center justify-center">
              <Trash2 className="h-4 w-4 text-sidebar-primary" />
            </div>
            <span className="flex-1 truncate text-sidebar-foreground">Recently Deleted</span>
          </div>
        </div>
      </div>

      {!hideCollections && (
        <div
          className={cn(
            'flex flex-col overflow-hidden transition-all duration-300 ease-in-out border-b border-border pb-4',
            isCollectionsExpanded ? 'flex-1 min-h-0 h-full' : 'flex-none h-[44px] max-h-[44px]',
          )}
        >
          <header className="group flex items-center justify-between px-2 mb-1 flex-none">
            <div
              className="flex-1 flex items-center gap-1.5 cursor-pointer select-none text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setIsCollectionsExpanded(!isCollectionsExpanded)}
            >
              <h3 className="text-xs font-semibold uppercase tracking-wider">Collections</h3>
              {isCollectionsExpanded ? (
                <ChevronsDownUp className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              ) : (
                <ChevronsUpDown className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              )}
            </div>
            <button
              onClick={() => createCollection()}
              className="text-muted-foreground hover:text-foreground flex-none"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </header>

          <div
            className={cn(
              'flex-1 overflow-y-auto min-h-0 space-y-0.5 pr-1 transition-all duration-300 ease-in-out',
              isCollectionsExpanded
                ? 'opacity-100 visible pointer-events-auto'
                : 'opacity-0 invisible pointer-events-none h-0',
            )}
          >
            {collectionsData?.data.map((collection) => (
              <div
                key={collection.id}
                className="group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                onClick={() =>
                  navigate({
                    to: '/projects/$projectId/collections/$collectionId',
                    params: { projectId, collectionId: collection.id },
                  })
                }
              >
                <div className="flex h-4 w-4 items-center justify-center">
                  <Bookmark className="h-4 w-4 text-sidebar-primary" />
                </div>
                <span className="flex-1 truncate text-sidebar-foreground">{collection.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hideShares && (
        <div
          className={cn(
            'flex flex-col overflow-hidden transition-all duration-300 ease-in-out border-b border-border pb-4',
            isSharesExpanded ? 'flex-1 min-h-0 h-full' : 'flex-none h-[44px] max-h-[44px]',
          )}
        >
          <header className="group flex items-center justify-between px-2 mb-1 flex-none">
            <div
              className="flex-1 flex items-center gap-1.5 cursor-pointer select-none text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setIsSharesExpanded(!isSharesExpanded)}
            >
              <h3 className="text-xs font-semibold uppercase tracking-wider">Share Links</h3>
              {isSharesExpanded ? (
                <ChevronsDownUp className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              ) : (
                <ChevronsUpDown className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              )}
            </div>
            <div className="flex items-center gap-1 flex-none">
              <button
                onClick={() => createShareLink()}
                className="text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </header>

          <div
            className={cn(
              'flex-1 overflow-y-auto min-h-0 space-y-0.5 pr-1 transition-all duration-300 ease-in-out',
              isSharesExpanded
                ? 'opacity-100 visible pointer-events-auto'
                : 'opacity-0 invisible pointer-events-none h-0',
            )}
          >
            <div className="group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              <div className="flex h-4 w-4 items-center justify-center">
                <LayoutGrid className="h-4 w-4 text-sidebar-primary" />
              </div>
              <span className="flex-1 truncate text-sidebar-foreground">
                All Share Links ({shareLinks.length})
              </span>
            </div>

            {shareLinks.map((link) => (
              <ShareLinkItem
                key={link.id}
                link={link}
                projectId={projectId}
                dragState={dragState}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ShareLinkItem({
  link,
  projectId,
  dragState,
}: {
  link: ShareLinkInfo
  projectId: string
  dragState?: DragState
}) {
  const navigate = useNavigate()
  const params = useParams({
    from: '/projects/$projectId/shares/$shareId',
    shouldThrow: false,
  })
  const isActive = params?.shareId === link.id

  const { ref: setDroppableRef, isDropTarget: isOver } = useDroppable({
    id: `share:${link.id}`,
    data: {
      type: 'share-link',
      id: link.id,
    },
  })

  const isValidDropTarget = !!dragState?.isActive

  return (
    <div
      ref={setDroppableRef}
      className={cn(
        'group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        isActive && 'bg-sidebar-accent text-sidebar-accent-foreground font-medium',
        isOver && isValidDropTarget && 'bg-sidebar-accent ring-2 ring-primary ring-inset',
      )}
      onClick={() =>
        navigate({
          to: '/projects/$projectId/shares/$shareId',
          params: { projectId, shareId: link.id },
        })
      }
    >
      <div className="flex h-4 w-4 items-center justify-center">
        <Share2 className="h-4 w-4 text-sidebar-primary" />
      </div>
      <span className="flex-1 truncate text-sidebar-foreground">{link.name}</span>
    </div>
  )
}

interface FolderTreeItemProps {
  teamId: string
  projectId: string
  folder: AssetInfo
  level: number
  isRoot?: boolean
  dragState?: DragState
  onSelect?: (folder: AssetInfo) => void
  selectedFolderId?: string
}

function FolderTreeItem({
  teamId,
  projectId,
  folder,
  level,
  isRoot,
  dragState,
  onSelect,
  selectedFolderId,
}: FolderTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(isRoot || false)
  const navigate = useNavigate()
  const params = useParams({
    from: '/projects/$projectId/folders/$folderId',
    select: (p) => ({ folderId: p.folderId }),
    shouldThrow: false,
  })
  const rootParams = useParams({
    from: '/projects/$projectId/',
    shouldThrow: false,
  })
  const isActive = isRoot ? !!rootParams : params?.folderId === folder.id

  const {
    data: childrenData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery<AssetInfoPaginatedList>({
    queryKey: [
      'folders',
      folder.id,
      'children',
      {
        assetType: 'folder',
      },
    ],
    queryFn: async ({ pageParam }) => {
      const res = await client.api.folders[':folderId'].children.$get({
        param: { folderId: folder.id },
        query: {
          assetType: 'folder',
          after: pageParam as string,
          first: '20',
        },
      })
      if (!res.ok) throw new Error('failed to fetch folder children')
      return (await res.json()) as unknown as AssetInfoPaginatedList
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => {
      return lastPage.pageInfo?.cursor || undefined
    },
    enabled: isExpanded || !!isRoot,
  })

  const { ref, inView } = useInView()

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  const childrenFolders = childrenData?.pages.flatMap((page) => page.data ?? []) ?? []

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsExpanded(!isExpanded)
  }

  const handleFolderClick = () => {
    if (onSelect) {
      onSelect(folder)
      return
    }

    if (isRoot) {
      navigate({
        to: '/projects/$projectId',
        params: { projectId },
      })
    } else {
      navigate({
        to: '/projects/$projectId/folders/$folderId',
        params: { projectId, folderId: folder.id! },
      })
    }
  }

  const { ref: setDraggableRef, isDragging } = useDraggable({
    id: `tree:${folder.id!}`,
    data: {
      type: 'folder',
      item: folder,
    },
    disabled: !!isRoot || !!onSelect,
  })

  const { ref: setDroppableRef, isDropTarget: isOver } = useDroppable({
    id: `tree:${folder.id!}`,
    data: {
      type: 'folder',
      item: folder,
    },
    disabled: dragState?.draggedIds.has(folder.id!) || !!onSelect,
  })

  const setNodeRef = (node: HTMLDivElement | null) => {
    setDraggableRef(node)
    setDroppableRef(node)
  }

  const isValidDropTarget = useMemo(() => {
    if (onSelect) return false
    if (!dragState?.isActive) return false
    if (dragState.draggedIds.has(folder.id!)) return false
    return true
  }, [dragState, folder.id, onSelect])

  const showDropFeedback = isOver && isValidDropTarget

  const isSelected = selectedFolderId === folder.id

  return (
    <div>
      <div
        ref={setNodeRef}
        className={cn(
          'group flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          (isActive || isSelected) &&
            'bg-sidebar-accent text-sidebar-accent-foreground font-medium',
          isDragging && 'opacity-50',
          showDropFeedback && 'bg-sidebar-accent ring-2 ring-primary ring-inset',
        )}
        style={{
          ...(isRoot ? {} : { paddingLeft: `${level * 12 + 8}px` }),
        }}
        onClick={handleFolderClick}
      >
        {!isRoot && (
          <button onClick={handleToggleExpand} className="flex h-4 w-4 items-center justify-center">
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        )}
        {isRoot ? (
          <Clapperboard className="h-4 w-4 text-sidebar-primary" />
        ) : (
          <Folder className="h-4 w-4 text-sidebar-primary" />
        )}
        <span className="flex-1 truncate text-sidebar-foreground">{folder.name}</span>
      </div>

      {isExpanded && (
        <div>
          {isLoading && (
            <div
              className="flex items-center justify-center p-2"
              style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }}
            >
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}
          {childrenFolders.map((child) => (
            <FolderTreeItem
              key={child.id}
              teamId={teamId}
              projectId={projectId}
              folder={child}
              level={level + 1}
              dragState={dragState}
              onSelect={onSelect}
              selectedFolderId={selectedFolderId}
            />
          ))}
          {hasNextPage && (
            <div
              ref={ref}
              className="flex items-center justify-center p-2"
              style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }}
            >
              {isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
