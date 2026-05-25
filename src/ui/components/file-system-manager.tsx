import type { AssetInfo, AssetInfoPaginatedList } from '@/dtos/asset'
import { type FieldInfo as MetadataFieldInfo } from '@/dtos/metadata'
import type { SearchCondition, SearchSort } from '@/dtos/search'
import type { CollectionInfo } from '@/dtos/collection'
import { client } from '@/ui/api/client'
import { useMutation } from '@tanstack/react-query'
import { InferRequestType, InferResponseType } from 'hono/client'

import { useFieldStore } from '@/ui/stores/fields'
import { useMemberStore } from '@/ui/stores/members'
import { useUiStore } from '@/ui/stores/ui'
import { useUserMetadataStore } from '@/ui/stores/user-metadata'
import { useTopNavStore } from '@/ui/stores/top-nav'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FileBrowser } from './file-browser/file-browser'
import { FileViewerRightSidebar } from './file-viewer-right-sidebar'
import { FolderTree } from './folder-tree'
import { ResizeHandle } from './resize-handle'
import { useFileSystemDnd } from './use-file-system-dnd'
import { PointerActivationConstraints } from '@dnd-kit/dom'
import { DragDropProvider, DragOverlay, KeyboardSensor, PointerSensor } from '@dnd-kit/react'
import { SnapToPointer } from './dnd-modifiers'
import { cn } from '../lib/utils'

type FileSystemManagerProps = {
  teamId: string
  projectId: string
  projectName: string
  assetId: string
  rootFolderId: string
  collection?: CollectionInfo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onUpdateCollection?: (updates: { name?: string; filter?: any }) => void
}

export default function FileSystemManager({
  teamId,
  projectId,
  projectName,
  assetId,
  rootFolderId,
  collection,
  onUpdateCollection,
}: FileSystemManagerProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { loadedProjectId, setFields } = useFieldStore()
  const $patchMetadata = client.api.teams[':teamId'].files[':fileId'].metadata.$patch
  const { mutate: patchMetadata } = useMutation<
    InferResponseType<typeof $patchMetadata>,
    Error,
    InferRequestType<typeof $patchMetadata>
  >({
    mutationFn: async (request) => {
      const res = await $patchMetadata(request)
      if (!res.ok) throw new Error('Failed to patch metadata')
      return null as unknown as InferResponseType<typeof $patchMetadata>
    },
  })

  const { data: fields } = useQuery({
    queryKey: ['fields', projectId],
    queryFn: async () => {
      const res = await client.api.projects[':projectId'].fields.$get({
        param: { projectId: projectId },
      })
      if (!res.ok) throw new Error('Failed to fetch fields')
      return await res.json()
    },
    enabled: !!projectId,
  })

  useEffect(() => {
    if (fields && projectId !== loadedProjectId) {
      setFields(fields as unknown as MetadataFieldInfo[], projectId)
    }
  }, [fields, projectId, loadedProjectId, setFields])

  const isRecentlyDeleted = assetId === 'recently-deleted'
  const [selectedItem, setSelectedItem] = useState<AssetInfo | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(240)
  const [rightSidebarWidth, setRightSidebarWidth] = useState(360)

  const { members, fetchMembers } = useMemberStore()
  const { metadata, fetchMetadata, setMetadata: setUserMetadata } = useUserMetadataStore()

  useEffect(() => {
    if (teamId) {
      fetchMembers(teamId)
      fetchMetadata(teamId)
    }
  }, [teamId, fetchMembers, fetchMetadata])

  const initialFilterConditions = useMemo(() => {
    return collection?.filter?.searchFilter?.conditions || []
  }, [collection])

  const [filterConditions, setFilterConditions] =
    useState<SearchCondition[]>(initialFilterConditions)

  useEffect(() => {
    setFilterConditions(initialFilterConditions)
  }, [initialFilterConditions])

  const sortKey = `project:${projectId}:sort`
  const sort = (metadata[sortKey] as SearchSort | undefined) || { field: 'custom', order: 'asc' }
  const setSort = (newSort: SearchSort | undefined) => {
    if (newSort) {
      setUserMetadata(teamId, sortKey, newSort)
    }
  }

  const isCollection = !!collection
  const isFiltering = filterConditions.length > 0 || isCollection

  const {
    fileListLeftSidebarCollapsed: isLeftSidebarCollapsed,
    setFileListLeftSidebarCollapsed: setIsLeftSidebarCollapsed,
    fileListRightSidebarCollapsed: isRightSidebarCollapsed,
    setFileListRightSidebarCollapsed: setIsRightSidebarCollapsed,
    viewModes,
  } = useUiStore()

  const displayStyle = viewModes[projectId] ?? 'card'

  const containerRef = useRef<HTMLDivElement>(null)

  const { data: folderInfo } = isRecentlyDeleted
    ? { data: undefined }
    : useQuery({
        queryKey: ['folders', teamId, assetId],
        queryFn: async () => {
          const res = await client.api.teams[':teamId'].folders[':folderId'].$get({
            param: { teamId: teamId, folderId: assetId },
          })
          if (!res.ok) throw new Error('failed to fetch folder')
          return (await res.json()) as unknown as AssetInfo
        },
      })

  const { setProjectState, clearProjectState } = useTopNavStore()

  useEffect(() => {
    setProjectState({
      teamId,
      projectId,
      projectName,
      ancestorFolders: folderInfo?.ancestorFolders ?? [],
      currentAsset: isRecentlyDeleted
        ? { name: 'Recently Deleted', type: 'folder' }
        : isCollection
          ? { name: collection.name, type: 'folder' }
          : { name: folderInfo?.name, type: 'folder' },
      isRootFolder: !isRecentlyDeleted && !isCollection && assetId === rootFolderId,
      onFolderClick: (id: string) => {
        navigate({
          to: '/projects/$projectId/folders/$folderId',
          params: { projectId, folderId: id },
        })
      },
    })

    return () => clearProjectState()
  }, [
    teamId,
    projectId,
    projectName,
    folderInfo,
    isRecentlyDeleted,
    assetId,
    rootFolderId,
    setProjectState,
    clearProjectState,
    navigate,
  ])

  const {
    data: foldersData,
    fetchNextPage: fetchNextFoldersPage,
    hasNextPage: hasNextPageFolders,
    isFetchingNextPage: isFetchingNextFoldersPage,
  } = useInfiniteQuery<AssetInfoPaginatedList>({
    queryKey: isRecentlyDeleted
      ? ['projects', projectId, 'recently-deleted', 'folder']
      : ['search', teamId, assetId, 'folder', filterConditions, sort, isCollection],
    queryFn: async ({ pageParam }) => {
      if (isRecentlyDeleted || isCollection) {
        if (isRecentlyDeleted) {
          const res = await client.api.projects[':projectId']['recently-deleted'].$get({
            param: { projectId: projectId },
            query: {
              assetType: 'folder',
              after: pageParam as string,
            },
          })
          if (!res.ok) throw new Error('failed to fetch recently deleted folders')
          return (await res.json()) as unknown as AssetInfoPaginatedList
        }
        return { data: [], pageInfo: { total: 0 } }
      }
      if (isFiltering) {
        return { data: [], pageInfo: { total: 0 } }
      }

      const res = await client.api.teams[':teamId'].folders[':folderId'].search.$post({
        param: { teamId: teamId, folderId: assetId },
        json: {
          assetType: 'folder',
          after: pageParam as string,
          recursively: false,
          sort,
          conditions: [],
        },
      })
      if (!res.ok) throw new Error('failed to search folders')
      return (await res.json()) as unknown as AssetInfoPaginatedList
    },
    enabled: !isFiltering, // Disable folders when filtering
    initialPageParam: '',
    getNextPageParam: (lastPage) => {
      return lastPage.pageInfo?.cursor || undefined
    },
  })

  const {
    data: filesData,
    fetchNextPage: fetchNextFilesPage,
    hasNextPage: hasNextPageFiles,
    isFetchingNextPage: isFetchingNextFilesPage,
  } = useInfiniteQuery<AssetInfoPaginatedList>({
    queryKey: isRecentlyDeleted
      ? ['projects', projectId, 'recently-deleted', 'file']
      : ['search', teamId, assetId, 'file', filterConditions, sort, isCollection],
    queryFn: async ({ pageParam }) => {
      if (isRecentlyDeleted) {
        const res = await client.api.projects[':projectId']['recently-deleted'].$get({
          param: { projectId: projectId },
          query: {
            assetType: 'file',
            after: pageParam as string,
          },
        })
        if (!res.ok) throw new Error('failed to fetch recently deleted files')
        return (await res.json()) as unknown as AssetInfoPaginatedList
      }

      const res = await client.api.teams[':teamId'].folders[':folderId'].search.$post({
        param: { teamId: teamId, folderId: assetId },
        json: {
          assetType: 'file',
          after: pageParam as string,
          recursively: isFiltering || isCollection,
          conditions: filterConditions,
          sort,
        },
      })
      if (!res.ok) throw new Error('failed to search files')
      return (await res.json()) as unknown as AssetInfoPaginatedList
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => {
      return lastPage.pageInfo?.cursor || undefined
    },
  })

  const folders = foldersData?.pages.flatMap((page) => page.data ?? []) ?? []
  const files = filesData?.pages.flatMap((page) => page.data ?? []) ?? []

  const totalFolders = foldersData?.pages[0]?.pageInfo?.total
  const totalFiles = filesData?.pages[0]?.pageInfo?.total

  const handleClearSelection = () => {
    setSelectedIds(new Set())
    setSelectedItem(null)
    setLastSelectedId(null)
  }

  const { dragState, handleDragStart, handleDragEnd } = useFileSystemDnd({
    teamId,
    projectId,
    assetId,
    folders,
    files,
    selectedIds,
    onClearSelection: handleClearSelection,
  })

  const singleSelectedFile = useMemo(() => {
    if (selectedIds.size !== 1) return null
    const id = Array.from(selectedIds)[0]
    const file = files.find((f) => f.id === id)
    return file || null
  }, [selectedIds, files])

  const handleItemDoubleClick = (item: AssetInfo) => {
    if (item.type === 'folder') {
      if (isRecentlyDeleted) {
        return
      }
      setFilterConditions([])
      navigate({
        to: '/projects/$projectId/folders/$folderId',
        params: { projectId, folderId: item.id },
      })
    } else {
      navigate({
        to: '/projects/$projectId/files/$fileId',
        params: { projectId, fileId: item.versionStack ? item.versionStack.id : item.id },
        search: { version: undefined },
      })
    }
  }

  const handleItemSelect = (item: AssetInfo, event: React.MouseEvent) => {
    const isCtrlOrCmd = event.metaKey || event.ctrlKey
    const isShift = event.shiftKey

    if (isShift && lastSelectedId) {
      // Find the last selected item
      const allItems = [...folders, ...files]
      const lastSelectedItem = allItems.find((i) => i.id === lastSelectedId)

      if (lastSelectedItem) {
        if (lastSelectedItem.type === item.type) {
          // Only select range if they are the same type
          const typeItems = item.type === 'folder' ? folders : files
          const lastIndex = typeItems.findIndex((i) => i.id === lastSelectedId)
          const currentIndex = typeItems.findIndex((i) => i.id === item.id)

          if (lastIndex !== -1 && currentIndex !== -1) {
            const start = Math.min(lastIndex, currentIndex)
            const end = Math.max(lastIndex, currentIndex)
            const rangeItems = typeItems.slice(start, end + 1)

            const newSelectedIds = new Set(selectedIds)
            rangeItems.forEach((rangeItem) => {
              newSelectedIds.add(rangeItem.id)
            })
            setSelectedIds(newSelectedIds)
            setSelectedItem(item)
            return
          }
        } else {
          // If types are different, do nothing (as requested by user)
          return
        }
      }
    }

    if (isCtrlOrCmd) {
      const newSelectedIds = new Set(selectedIds)
      if (newSelectedIds.has(item.id)) {
        newSelectedIds.delete(item.id)
      } else {
        newSelectedIds.add(item.id)
      }
      setSelectedIds(newSelectedIds)
    } else {
      setSelectedIds(new Set([item.id]))
    }

    setLastSelectedId(item.id)
    setSelectedItem(item)
  }

  const handleSaveField = (fileId: string, fieldId: string, value: unknown) => {
    patchMetadata(
      {
        param: { teamId: teamId, fileId: fileId },
        json: [{ key: fieldId, value }] as InferRequestType<typeof $patchMetadata>['json'],
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: [
              'folders',
              teamId,
              assetId,
              'children',
              {
                assetType: 'file',
              },
            ],
          })
          queryClient.invalidateQueries({
            queryKey: ['search', teamId, assetId],
          })
        },
      },
    )
  }

  return (
    <DragDropProvider
      modifiers={[SnapToPointer.configure({ anchor: { x: 0, y: 0 } })]}
      sensors={
        isRecentlyDeleted
          ? []
          : [
              PointerSensor.configure({
                activationConstraints: [new PointerActivationConstraints.Distance({ value: 10 })],
              }),
              KeyboardSensor,
            ]
      }
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-1 flex-col bg-background">
        <div ref={containerRef} className="flex flex-1 overflow-hidden relative">
          {!isLeftSidebarCollapsed && (
            <div
              className="md:hidden fixed inset-0 bg-black/50 z-40"
              onClick={() => setIsLeftSidebarCollapsed(true)}
            />
          )}
          {!isRightSidebarCollapsed && (
            <div
              className="md:hidden fixed inset-0 bg-black/50 z-40"
              onClick={() => setIsRightSidebarCollapsed(true)}
            />
          )}

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
                onResize={(delta) => {
                  setLeftSidebarWidth((prev) => Math.max(180, Math.min(400, prev + delta)))
                }}
                className="hidden md:block"
              />
            </>
          )}

          <FileBrowser
            teamId={teamId}
            projectId={projectId}
            assetId={assetId}
            folders={folders}
            files={files}
            totalFolders={totalFolders}
            totalFiles={totalFiles}
            selectedItem={selectedItem}
            selectedIds={selectedIds}
            onItemSelect={handleItemSelect}
            onItemDoubleClick={handleItemDoubleClick}
            onSaveField={handleSaveField}
            displayStyle={displayStyle}
            onClearSelection={handleClearSelection}
            fetchNextFoldersPage={fetchNextFoldersPage}
            hasNextFoldersPage={hasNextPageFolders || false}
            isFetchingNextFoldersPage={isFetchingNextFoldersPage}
            fetchNextFilesPage={fetchNextFilesPage}
            hasNextFilesPage={hasNextPageFiles || false}
            isFetchingNextFilesPage={isFetchingNextFilesPage}
            isRecentlyDeleted={isRecentlyDeleted}
            filterConditions={filterConditions}
            onFilterChange={setFilterConditions}
            sort={sort}
            onSortChange={setSort}
            dragState={dragState}
            collection={collection}
            onUpdateCollection={onUpdateCollection}
          />

          {!isRightSidebarCollapsed && (
            <>
              <ResizeHandle
                onResize={(delta) => {
                  setRightSidebarWidth((prev) => Math.max(240, Math.min(600, prev - delta)))
                }}
                className="hidden md:block"
              />
              <div
                style={{ width: rightSidebarWidth }}
                className="bg-background border-l border-border flex flex-col flex-shrink-0"
              >
                {singleSelectedFile ? (
                  <FileViewerRightSidebar
                    teamId={teamId}
                    projectId={projectId}
                    file={singleSelectedFile}
                    onSaveField={(fieldId, value) =>
                      handleSaveField(singleSelectedFile.id, fieldId, value)
                    }
                    members={members}
                    hideAnnotationControl={true}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
                    Select an asset to view details
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <DragOverlay>
        {dragState?.isActive ? (
          <div
            className={cn(
              'flex items-center gap-2 rounded-md bg-popover px-3 py-2 text-sm font-medium text-popover-foreground shadow-md ring-1 ring-border cursor-grabbing',
              displayStyle === 'list' &&
                'w-30 h-[40px] px-0 flex-none overflow-hidden justify-center',
            )}
            style={{ transform: 'translate(0px, 0px)' }}
          >
            <span>
              Moving {dragState.itemCount} item{dragState.itemCount !== 1 ? 's' : ''}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DragDropProvider>
  )
}
