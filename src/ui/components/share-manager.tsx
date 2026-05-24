import type { AncestorFolder, AssetInfo, AssetInfoPaginatedList } from '@/dtos/asset'
import { client } from '@/ui/api/client'
import { useMutation, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, useMemo } from 'react'
import { FileBrowser } from './file-browser/file-browser'
import { ShareSettingsSidebar } from './share-settings-sidebar'
import { FolderTree } from './folder-tree'
import { ResizeHandle } from './resize-handle'
import { useFileSystemDnd } from './use-file-system-dnd'
import { DragDropProvider, DragOverlay, KeyboardSensor, PointerSensor } from '@dnd-kit/react'
import { PointerActivationConstraints } from '@dnd-kit/dom'
import { SnapToPointer } from './dnd-modifiers'
import { useUiStore } from '@/ui/stores/ui'
import { useUserMetadataStore } from '@/ui/stores/user-metadata'
import { useTopNavStore } from '@/ui/stores/top-nav'
import type { ShareLinkInfo } from '@/dtos/share'
import { toast } from 'sonner'

type ShareManagerProps = {
  teamId: string
  projectId: string
  projectName: string
  shareId: string
  rootFolderId: string // Project root folder id for the left sidebar tree
}

export default function ShareManager({
  teamId,
  projectId,
  projectName,
  shareId,
  rootFolderId,
}: ShareManagerProps) {
  const queryClient = useQueryClient()
  const { fetchMetadata } = useUserMetadataStore()

  useEffect(() => {
    if (teamId) {
      fetchMetadata(teamId)
    }
  }, [teamId, fetchMetadata])

  const { data: shareLink } = useQuery({
    queryKey: ['share', shareId],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].shares[':shareId'].$get({
        param: { teamId, shareId },
      })
      if (!res.ok) throw new Error('Failed to fetch share link')
      return (await res.json()) as unknown as ShareLinkInfo
    },
  })

  const shareRootId = shareLink?.rootFolderId
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [ancestorFolders, setAncestorFolders] = useState<AncestorFolder[]>([])

  useEffect(() => {
    if (shareRootId) {
      setCurrentFolderId(shareRootId)
      setAncestorFolders([])
      setSelectedIds(new Set())
    }
  }, [shareRootId, shareId])

  const setProjectState = useTopNavStore((s) => s.setProjectState)
  const clearProjectState = useTopNavStore((s) => s.clearProjectState)

  const handleBreadcrumbClick = (folderId: string) => {
    if (folderId === currentFolderId) return

    if (folderId === shareRootId) {
      setCurrentFolderId(shareRootId)
      setAncestorFolders([])
    } else {
      const index = ancestorFolders.findIndex((f) => f.id === folderId)
      if (index !== -1) {
        setCurrentFolderId(folderId)
        setAncestorFolders(ancestorFolders.slice(index + 1))
      }
    }
    setSelectedIds(new Set())
  }

  const [leftSidebarWidth, setLeftSidebarWidth] = useState(240)
  const [rightSidebarWidth, setRightSidebarWidth] = useState(360)

  const {
    fileListLeftSidebarCollapsed: isLeftSidebarCollapsed,
    fileListRightSidebarCollapsed: isRightSidebarCollapsed,
    viewModes,
  } = useUiStore()

  const displayStyle = viewModes[projectId] ?? 'card'

  const {
    data: foldersData,
    fetchNextPage: fetchNextFoldersPage,
    hasNextPage: hasNextPageFolders,
    isFetchingNextPage: isFetchingNextFoldersPage,
  } = useInfiniteQuery<AssetInfoPaginatedList>({
    queryKey: ['folder-children', teamId, currentFolderId, 'folder'],
    queryFn: async ({ pageParam }) => {
      const res = await client.api.teams[':teamId'].folders[':folderId'].children.$get({
        param: { teamId, folderId: currentFolderId! },
        query: {
          assetType: 'folder',
          after: pageParam as string,
        },
      })
      if (!res.ok) throw new Error('Failed to fetch folders')
      return (await res.json()) as unknown as AssetInfoPaginatedList
    },
    enabled: !!currentFolderId,
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.pageInfo?.cursor || undefined,
  })

  const {
    data: filesData,
    fetchNextPage: fetchNextFilesPage,
    hasNextPage: hasNextPageFiles,
    isFetchingNextPage: isFetchingNextFilesPage,
  } = useInfiniteQuery<AssetInfoPaginatedList>({
    queryKey: ['folder-children', teamId, currentFolderId, 'file'],
    queryFn: async ({ pageParam }) => {
      const res = await client.api.teams[':teamId'].folders[':folderId'].children.$get({
        param: { teamId, folderId: currentFolderId! },
        query: {
          assetType: 'file',
          after: pageParam as string,
        },
      })
      if (!res.ok) throw new Error('Failed to fetch files')
      return (await res.json()) as unknown as AssetInfoPaginatedList
    },
    enabled: !!currentFolderId,
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.pageInfo?.cursor || undefined,
  })

  const folders = useMemo(
    () => foldersData?.pages.flatMap((page) => page.data ?? []) ?? [],
    [foldersData],
  )
  const files = useMemo(
    () => filesData?.pages.flatMap((page) => page.data ?? []) ?? [],
    [filesData],
  )

  useEffect(() => {
    if (shareLink) {
      setProjectState({
        teamId,
        projectId,
        projectName,
        ancestorFolders,
        currentAsset: {
          name:
            currentFolderId === shareRootId
              ? shareLink.name
              : folders.find((f) => f.id === currentFolderId)?.name || shareLink.name,
          type: 'folder',
        },
        isRootFolder: false, // Ensure share link name or subfolder is always shown in TopNav
        shareId,
        onFolderClick: handleBreadcrumbClick,
      })
    }
    return () => clearProjectState()
  }, [
    teamId,
    projectId,
    projectName,
    ancestorFolders,
    currentFolderId,
    shareRootId,
    shareLink,
    shareId,
    folders,
    setProjectState,
    clearProjectState,
  ])

  const handleClearSelection = () => {
    setSelectedIds(new Set())
  }

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const { dragState, handleDragStart, handleDragEnd } = useFileSystemDnd({
    teamId,
    projectId,
    assetId: currentFolderId || '',
    folders,
    files,
    selectedIds,
    onClearSelection: handleClearSelection,
  })

  const $removeFromShare = client.api.teams[':teamId'].shares[':shareId'].assets[':assetId'].$delete
  const { mutate: removeFromShare } = useMutation({
    mutationFn: async (assetId: string) => {
      const res = await $removeFromShare({
        param: { teamId, shareId, assetId },
      })
      if (!res.ok) throw new Error('Failed to remove')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folder-children', teamId, currentFolderId] })
      toast.success('Removed from share')
    },
  })

  const handleItemDoubleClick = (item: AssetInfo) => {
    if (item.type === 'folder' || item.targetType === 'folder') {
      const currentFolderName =
        currentFolderId === shareRootId
          ? shareLink?.name || ''
          : folders.find((f) => f.id === currentFolderId)?.name || 'Unknown'

      setAncestorFolders((prev) => [{ id: currentFolderId!, name: currentFolderName }, ...prev])
      setCurrentFolderId(item.id)
      setSelectedIds(new Set())
    }
  }

  if (!shareLink) return <div>Loading...</div>

  return (
    <DragDropProvider
      modifiers={[SnapToPointer.configure({ anchor: { x: 0, y: 0 } })]}
      sensors={[
        PointerSensor.configure({
          activationConstraints: [new PointerActivationConstraints.Distance({ value: 10 })],
        }),
        KeyboardSensor,
      ]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-screen flex-col bg-background">
        <div className="flex flex-1 overflow-hidden relative">
          {!isLeftSidebarCollapsed && (
            <>
              <div className="bg-background" style={{ width: leftSidebarWidth }}>
                <FolderTree
                  teamId={teamId}
                  projectId={projectId}
                  projectName={projectName}
                  rootFolderId={rootFolderId}
                  dragState={dragState}
                />
              </div>
              <ResizeHandle
                onResize={(delta) =>
                  setLeftSidebarWidth((p) => Math.max(180, Math.min(400, p + delta)))
                }
              />
            </>
          )}

          <FileBrowser
            teamId={teamId}
            projectId={projectId}
            assetId={currentFolderId || ''}
            folders={folders}
            files={files}
            selectedItem={null}
            selectedIds={selectedIds}
            onItemSelect={(item, e) => {
              if (e.metaKey || e.ctrlKey) {
                const next = new Set(selectedIds)
                if (next.has(item.id)) next.delete(item.id)
                else next.add(item.id)
                setSelectedIds(next)
              } else {
                setSelectedIds(new Set([item.id]))
              }
            }}
            onItemDoubleClick={handleItemDoubleClick}
            onSaveField={() => {}}
            displayStyle={displayStyle}
            onClearSelection={handleClearSelection}
            fetchNextFoldersPage={fetchNextFoldersPage}
            hasNextFoldersPage={hasNextPageFolders}
            isFetchingNextFoldersPage={isFetchingNextFoldersPage}
            fetchNextFilesPage={fetchNextFilesPage}
            hasNextFilesPage={hasNextPageFiles}
            isFetchingNextFilesPage={isFetchingNextFilesPage}
            filterConditions={[]}
            onFilterChange={() => {}}
            dragState={dragState}
            isShareView={true}
            onRemoveFromShare={(items) => {
              items.forEach((i) => removeFromShare(i.id))
            }}
            fieldVisibility={shareLink.fieldVisibility}
          />

          {!isRightSidebarCollapsed && (
            <>
              <ResizeHandle
                onResize={(delta) =>
                  setRightSidebarWidth((p) => Math.max(240, Math.min(600, p - delta)))
                }
              />
              <div style={{ width: rightSidebarWidth }} className="flex-shrink-0">
                <ShareSettingsSidebar teamId={teamId} shareLink={shareLink} />
              </div>
            </>
          )}
        </div>
      </div>
      <DragOverlay>
        {dragState?.isActive ? (
          <div className="flex items-center gap-2 rounded-md bg-popover px-3 py-2 text-sm font-medium shadow-md">
            Moving {dragState.itemCount} item{dragState.itemCount !== 1 ? 's' : ''}
          </div>
        ) : null}
      </DragOverlay>
    </DragDropProvider>
  )
}
