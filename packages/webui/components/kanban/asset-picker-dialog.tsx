import { client } from '@/ui/api/client'
import { FolderTree } from '@/ui/components/folder-tree'
import { Button } from '@/ui/components/ui/button'
import { Checkbox } from '@/ui/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/ui/select'
import { formatSize } from '@/ui/lib/format'
import { m } from '@/ui/paraglide/messages.js'
import type {
  AssetInfo,
  AssetInfoPaginatedList,
  KanbanTaskAssetInfo,
  ProjectInfo,
} from '@shumai/dtos'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Check, File, Folder, Loader2, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useInView } from 'react-intersection-observer'

interface AssetPickerDialogProps {
  teamId: string
  initialProjectId?: string | null
  excludeAssetIds?: string[]
  isOpen: boolean
  onClose: () => void
  onConfirm: (selectedAssets: KanbanTaskAssetInfo[]) => void
}

export function AssetPickerDialog({
  teamId,
  initialProjectId,
  excludeAssetIds = [],
  isOpen,
  onClose,
  onConfirm,
}: AssetPickerDialogProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || '')
  const [selectedFolder, setSelectedFolder] = useState<AssetInfo | null>(null)
  const [selectedAssets, setSelectedAssets] = useState<Map<string, KanbanTaskAssetInfo>>(new Map())

  // Fetch all projects in the team
  const { data: projectsData, isLoading: isLoadingProjects } = useQuery({
    queryKey: ['teams', teamId, 'projects'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].projects.$get({
        param: { teamId },
        query: { first: '100' },
      })
      if (!res.ok) throw new Error('Failed to fetch projects')
      return (await res.json()) as unknown as { data: ProjectInfo[] }
    },
    enabled: !!teamId && isOpen,
  })

  const projects = projectsData?.data || []
  const activeProjectId = selectedProjectId || (projects[0]?.id ?? '')
  const selectedProject = projects.find((p) => p.id === activeProjectId)
  const activeFolderId = selectedFolder?.id || selectedProject?.rootFolder || ''
  const isRootFolder = activeFolderId === selectedProject?.rootFolder

  // Fetch subfolders inside active folder with infinite pagination
  const {
    data: foldersData,
    fetchNextPage: fetchNextFolders,
    hasNextPage: hasNextFolders,
    isFetchingNextPage: isFetchingNextFolders,
    isLoading: isLoadingFolders,
  } = useInfiniteQuery<AssetInfoPaginatedList>({
    queryKey: ['folders', activeFolderId, 'children', 'folder', 'picker'],
    queryFn: async ({ pageParam }) => {
      const res = await client.api.folders[':folderId'].children.$get({
        param: { folderId: activeFolderId },
        query: { assetType: 'folder', after: pageParam as string, first: '20' },
      })
      if (!res.ok) throw new Error('Failed to fetch folders')
      return (await res.json()) as unknown as AssetInfoPaginatedList
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.pageInfo?.cursor || undefined,
    enabled: !!activeFolderId && isOpen,
  })

  // Fetch files inside active folder with infinite pagination
  const {
    data: filesData,
    fetchNextPage: fetchNextFiles,
    hasNextPage: hasNextFiles,
    isFetchingNextPage: isFetchingNextFiles,
    isLoading: isLoadingFiles,
  } = useInfiniteQuery<AssetInfoPaginatedList>({
    queryKey: ['folders', activeFolderId, 'children', 'file', 'picker'],
    queryFn: async ({ pageParam }) => {
      const res = await client.api.folders[':folderId'].children.$get({
        param: { folderId: activeFolderId },
        query: { assetType: 'file', after: pageParam as string, first: '20' },
      })
      if (!res.ok) throw new Error('Failed to fetch files')
      return (await res.json()) as unknown as AssetInfoPaginatedList
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.pageInfo?.cursor || undefined,
    enabled: !!activeFolderId && isOpen,
  })

  const { ref: loadMoreRef, inView } = useInView()

  useEffect(() => {
    if (inView) {
      if (hasNextFolders && !isFetchingNextFolders) {
        fetchNextFolders()
      } else if (hasNextFiles && !isFetchingNextFiles) {
        fetchNextFiles()
      }
    }
  }, [
    inView,
    hasNextFolders,
    isFetchingNextFolders,
    fetchNextFolders,
    hasNextFiles,
    isFetchingNextFiles,
    fetchNextFiles,
  ])

  const isLoadingChildren = (isLoadingFolders && !foldersData) || (isLoadingFiles && !filesData)
  const isFetchingMore = isFetchingNextFolders || isFetchingNextFiles

  const children = useMemo(() => {
    const folders = foldersData?.pages.flatMap((page) => page.data ?? []) ?? []
    const files = filesData?.pages.flatMap((page) => page.data ?? []) ?? []
    return [...folders, ...files]
  }, [foldersData, filesData])

  const toggleSelectAsset = (asset: AssetInfo) => {
    const next = new Map(selectedAssets)
    if (next.has(asset.id)) {
      next.delete(asset.id)
    } else {
      const path = selectedProject
        ? `/${[selectedProject.name, ...(asset.ancestorFolders || []).map((a) => a.name)].filter(Boolean).join('/')}`
        : '/'

      next.set(asset.id, {
        id: asset.id,
        name: asset.name,
        type: asset.type as 'file' | 'folder' | 'root' | 'version_stack',
        proxyType: asset.proxyType ?? null,
        thumbnailUrl: asset.preview?.thumbnailUrl ?? null,
        path,
        creator: asset.creator
          ? {
              id: asset.creator.id,
              name: asset.creator.name,
              image: asset.creator.image ?? undefined,
            }
          : null,
        sizeByte: asset.sizeByte ?? 0,
        fileCount: asset.fileCount ?? null,
        projectId: asset.projectId ?? selectedProject?.id ?? null,
        createdAt: asset.createdAt ?? new Date().toISOString(),
      })
    }
    setSelectedAssets(next)
  }

  const toggleSelectCurrentFolder = () => {
    if (!selectedFolder || isRootFolder) return
    const next = new Map(selectedAssets)
    if (next.has(selectedFolder.id)) {
      next.delete(selectedFolder.id)
    } else {
      const path = selectedProject
        ? `/${[selectedProject.name, ...(selectedFolder.ancestorFolders || []).map((a) => a.name)].filter(Boolean).join('/')}`
        : '/'

      next.set(selectedFolder.id, {
        id: selectedFolder.id,
        name: selectedFolder.name,
        type: 'folder',
        proxyType: null,
        thumbnailUrl: null,
        path,
        creator: selectedFolder.creator
          ? {
              id: selectedFolder.creator.id,
              name: selectedFolder.creator.name,
              image: selectedFolder.creator.image ?? undefined,
            }
          : null,
        sizeByte: selectedFolder.sizeByte ?? 0,
        fileCount: selectedFolder.fileCount ?? null,
        projectId: selectedFolder.projectId ?? selectedProject?.id ?? null,
        createdAt: selectedFolder.createdAt ?? new Date().toISOString(),
      })
    }
    setSelectedAssets(next)
  }

  const handleConfirm = () => {
    onConfirm(Array.from(selectedAssets.values()))
    onClose()
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="sm:max-w-4xl flex flex-col h-[650px] p-0 overflow-hidden gap-1">
        <DialogHeader className="px-4 py-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Folder className="w-5 h-5 text-primary" />
            <DialogTitle>{m.select_assets()}</DialogTitle>
          </div>
        </DialogHeader>

        {/* Second Row Toolbar: Project Selector with Hint Text */}
        <div className="flex items-center gap-2.5 px-4 py-1.5 border-b bg-transparent shrink-0">
          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
            {m.current_project_label()}:
          </span>
          <div className="w-64">
            <Select
              value={activeProjectId}
              onValueChange={(val) => {
                setSelectedProjectId(val)
                setSelectedFolder(null)
              }}
            >
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue placeholder={m.select_project()} />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Main 2-Pane Content */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Left Pane: Folder Tree */}
          <div className="w-1/3 min-h-0 border-r bg-sidebar/30 flex flex-col overflow-hidden">
            <ScrollArea className="flex-1 min-h-0 [&>div>div]:block!">
              {selectedProject && selectedProject.rootFolder ? (
                <div className="p-2">
                  <FolderTree
                    teamId={teamId}
                    projectId={selectedProject.id}
                    projectName={selectedProject.name}
                    rootFolderId={selectedProject.rootFolder}
                    onSelect={(folder) => setSelectedFolder(folder)}
                    selectedFolderId={activeFolderId}
                    hideCollections
                    hideShares
                    hideRecentlyDeleted
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full p-6 text-xs text-muted-foreground">
                  {isLoadingProjects ? (
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  ) : (
                    m.no_project_selected()
                  )}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Right Pane: Asset List */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-background">
            {/* Top folder action / status banner */}
            <div className="p-2.5 px-4 border-b flex items-center justify-between bg-muted/20 shrink-0">
              <div className="flex items-center gap-2 text-xs font-medium truncate">
                <Folder className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="truncate">
                  {selectedFolder ? selectedFolder.name : selectedProject?.name || ''}
                </span>
                {isRootFolder && (
                  <span className="text-[10px] text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded">
                    Root
                  </span>
                )}
              </div>

              {/* Select Current Folder button (disabled if root folder) */}
              {!isRootFolder && selectedFolder && (
                <Button
                  size="sm"
                  variant={selectedAssets.has(selectedFolder.id) ? 'secondary' : 'outline'}
                  className="h-7 text-xs gap-1.5"
                  onClick={toggleSelectCurrentFolder}
                  disabled={excludeAssetIds.includes(selectedFolder.id)}
                >
                  {selectedAssets.has(selectedFolder.id) ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-primary" />
                      {m.saved()}
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      {m.select_current_folder()}
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* List of files & folders inside current directory */}
            <ScrollArea className="flex-1 min-h-0 [&>div>div]:block!">
              {isLoadingChildren ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : children.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-xs text-muted-foreground gap-2">
                  <Folder className="w-8 h-8 opacity-30" />
                  <p>{m.no_assets_in_folder()}</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {children.map((asset) => {
                    const isExcluded = excludeAssetIds.includes(asset.id)
                    const isSelected = selectedAssets.has(asset.id)
                    const isFolder = asset.type === 'folder'

                    return (
                      <div
                        key={asset.id}
                        onClick={() => {
                          if (!isExcluded) toggleSelectAsset(asset)
                        }}
                        className={`flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 cursor-pointer transition-colors ${
                          isSelected ? 'bg-primary/5' : ''
                        } ${isExcluded ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <Checkbox
                          checked={isSelected}
                          disabled={isExcluded}
                          onCheckedChange={() => {
                            if (!isExcluded) toggleSelectAsset(asset)
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />

                        {/* Thumbnail / Icon */}
                        <div className="w-9 h-9 rounded bg-muted/60 border shrink-0 flex items-center justify-center overflow-hidden">
                          {asset.preview?.thumbnailUrl ? (
                            <img
                              src={asset.preview.thumbnailUrl}
                              alt={asset.name}
                              className="w-full h-full object-cover"
                            />
                          ) : isFolder ? (
                            <Folder className="w-5 h-5 text-primary fill-primary/20" />
                          ) : (
                            <File className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate text-foreground">
                            {asset.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {isFolder
                              ? `${asset.fileCount ?? 0} items`
                              : formatSize(asset.sizeByte || 0)}
                            {asset.creator?.name ? ` • ${asset.creator.name}` : ''}
                          </p>
                        </div>
                      </div>
                    )
                  })}

                  {/* Infinite scroll sentinel & bottom loading spinner */}
                  <div ref={loadMoreRef} className="h-1" />
                  {isFetchingMore && (
                    <div className="flex items-center justify-center p-3">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-3 px-4 border-t flex items-center justify-between sm:justify-between bg-muted/10 shrink-0">
          <div className="text-xs text-muted-foreground">
            {selectedAssets.size > 0 &&
              m.n_assets_selected({
                count: selectedAssets.size,
              })}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              {m.cancel()}
            </Button>
            <Button size="sm" onClick={handleConfirm} disabled={selectedAssets.size === 0}>
              {m.add_assets()}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
