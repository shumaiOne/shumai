import { client } from '@/ui/api/client'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui/components/ui/alert-dialog'
import { Button } from '@/ui/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/ui/components/ui/dropdown-menu'
import { Input } from '@/ui/components/ui/input'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import { usePermissions } from '@/ui/hooks/use-permissions'
import { cn } from '@/ui/lib/utils'
import { useDraggable, useDroppable } from '@dnd-kit/react'
import type {
  AssetInfo,
  AssetInfoPaginatedList,
  CollectionInfo,
  ShareLinkInfo,
  AncestorFolder,
} from '@shumai/dtos'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMatch, useNavigate, useParams } from '@tanstack/react-router'
import {
  AlertTriangle,
  Bookmark,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Clapperboard,
  Download,
  Edit,
  Folder,
  LayoutGrid,
  Loader2,
  MoreHorizontal,
  Plus,
  Share2,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useInView } from 'react-intersection-observer'
import { toast } from 'sonner'
import type { DragState } from './dnd-types'

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
  ancestorFolders?: AncestorFolder[]
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
  ancestorFolders,
}: FolderTreeProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { canEdit } = usePermissions(projectId)
  const isRecentlyDeleted = useMatch({
    from: '/projects/$projectId/recently-deleted',
    shouldThrow: false,
  })

  const [isAssetsExpanded, setIsAssetsExpanded] = useState(true)
  const [isCollectionsExpanded, setIsCollectionsExpanded] = useState(true)
  const [isSharesExpanded, setIsSharesExpanded] = useState(true)

  const {
    data: shareLinksData,
    fetchNextPage: fetchNextShareLinks,
    hasNextPage: hasNextShareLinks,
    isFetchingNextPage: isFetchingNextShareLinks,
  } = useInfiniteQuery({
    queryKey: ['shares', projectId],
    queryFn: async ({ pageParam }) => {
      const res = await client.api.projects[':projectId'].shares.$get({
        param: { projectId },
        query: { first: '20', after: pageParam as string },
      })
      if (!res.ok) throw new Error('Failed to fetch share links')
      return (await res.json()) as unknown as {
        data: ShareLinkInfo[]
        pageInfo: { cursor?: string; total?: number }
      }
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.pageInfo?.cursor || undefined,
    enabled: !!projectId,
  })

  const {
    data: collectionsData,
    fetchNextPage: fetchNextCollections,
    hasNextPage: hasNextCollections,
    isFetchingNextPage: isFetchingNextCollections,
  } = useInfiniteQuery({
    queryKey: ['collections', projectId],
    queryFn: async ({ pageParam }) => {
      const res = await client.api.projects[':projectId'].collections.$get({
        param: { projectId },
        query: { first: '20', after: pageParam as string },
      })
      if (!res.ok) throw new Error('Failed to fetch collections')
      return (await res.json()) as unknown as {
        data: CollectionInfo[]
        pageInfo: { cursor?: string; total?: number }
      }
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.pageInfo?.cursor || undefined,
    enabled: !!projectId,
  })

  const { ref: collectionsInViewRef, inView: collectionsInView } = useInView()
  const { ref: sharesInViewRef, inView: sharesInView } = useInView()

  useEffect(() => {
    if (collectionsInView && hasNextCollections && !isFetchingNextCollections) {
      fetchNextCollections()
    }
  }, [collectionsInView, hasNextCollections, isFetchingNextCollections, fetchNextCollections])

  useEffect(() => {
    if (sharesInView && hasNextShareLinks && !isFetchingNextShareLinks) {
      fetchNextShareLinks()
    }
  }, [sharesInView, hasNextShareLinks, isFetchingNextShareLinks, fetchNextShareLinks])

  const collections = useMemo(
    () => collectionsData?.pages.flatMap((p) => p.data) || [],
    [collectionsData],
  )
  const shareLinks = useMemo(
    () => shareLinksData?.pages.flatMap((p) => p.data) || [],
    [shareLinksData],
  )

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

  const params = useParams({
    from: '/projects/$projectId/collections/$collectionId',
    shouldThrow: false,
  })
  const shareParams = useParams({
    from: '/projects/$projectId/shares/$shareId',
    shouldThrow: false,
  })
  const folderParams = useParams({
    from: '/projects/$projectId/folders/$folderId',
    shouldThrow: false,
  })

  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameType, setRenameType] = useState<'collection' | 'share' | 'folder'>('collection')
  const [renameName, setRenameName] = useState('')
  const [isRenameOpen, setIsRenameOpen] = useState(false)

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteType, setDeleteType] = useState<'collection' | 'share' | 'folder'>('collection')
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  const { mutate: renameFolder } = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await client.api.folders[':folderId'].$put({
        param: { folderId: id },
        json: { name },
      })
      if (!res.ok) throw new Error('Failed to rename folder')
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['search', teamId] })
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      toast.success('Folder renamed')
      setIsRenameOpen(false)
    },
    onError: (err) => {
      toast.error(`Error: ${err.message}`)
    },
  })

  const { mutate: deleteFolder } = useMutation({
    mutationFn: async (id: string) => {
      const res = await client.api.folders.$delete({
        json: { ids: [id] },
      })
      if (!res.ok) throw new Error('Failed to delete folder')
      return id
    },
    onSuccess: (deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['search', teamId] })
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      toast.success('Folder deleted')
      setIsDeleteOpen(false)
      if (folderParams?.folderId === deletedId) {
        navigate({
          to: '/projects/$projectId',
          params: { projectId },
        })
      }
    },
    onError: (err) => {
      toast.error(`Error: ${err.message}`)
    },
  })

  const [isDownloadOpen, setIsDownloadOpen] = useState(false)
  const [isLoadingLinks, setIsLoadingLinks] = useState(false)
  const [resolvedFiles, setResolvedFiles] = useState<
    Array<{ id: string; name: string; url: string }>
  >([])

  const handleDownloadFolder = async (folderId: string) => {
    setIsDownloadOpen(true)
    setIsLoadingLinks(true)
    setResolvedFiles([])
    try {
      const res = await client.api.files['download-links'].$post({
        json: { ids: [folderId] },
      })
      if (!res.ok) throw new Error('Failed to prepare download links')
      const data = await res.json()
      setResolvedFiles(data.files)
    } catch (error) {
      toast.error('Failed to prepare download links')
      setIsDownloadOpen(false)
      console.error(error)
    } finally {
      setIsLoadingLinks(false)
    }
  }

  const startDownload = () => {
    const files = [...resolvedFiles]
    setIsDownloadOpen(false)

    if (files.length === 0) return

    toast.info(
      `Starting download of ${files.length} files. Please allow multiple downloads if prompted by your browser.`,
      {
        duration: 5000,
      },
    )

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    const runQueue = async () => {
      const batchSize = 5
      for (let i = 0; i < files.length; i += batchSize) {
        const chunk = files.slice(i, i + batchSize)
        for (const file of chunk) {
          const a = document.createElement('a')
          a.href = file.url
          a.download = file.name
          a.target = '_blank'
          document.body.appendChild(a)
          a.click()
          a.remove()
        }
        await delay(1000)
      }
    }

    runQueue().catch((err) => {
      console.error('Background downloads failed:', err)
      toast.error('Some downloads could not be started')
    })
  }

  const { mutate: renameCollection } = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await client.api.collections[':collectionId'].$patch({
        param: { collectionId: id },
        json: { name },
      })
      if (!res.ok) throw new Error('Failed to rename collection')
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections', projectId] })
      toast.success('Collection renamed')
      setIsRenameOpen(false)
    },
    onError: (err) => {
      toast.error(`Error: ${err.message}`)
    },
  })

  const { mutate: deleteCollection } = useMutation({
    mutationFn: async (id: string) => {
      const res = await client.api.collections[':collectionId'].$delete({
        param: { collectionId: id },
      })
      if (!res.ok) throw new Error('Failed to delete collection')
      return await res.json()
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['collections', projectId] })
      toast.success('Collection deleted')
      setIsDeleteOpen(false)
      if (params?.collectionId === deletedId) {
        navigate({
          to: '/projects/$projectId',
          params: { projectId },
        })
      }
    },
    onError: (err) => {
      toast.error(`Error: ${err.message}`)
    },
  })

  const { mutate: renameShareLink } = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await client.api.shares[':shareId'].$put({
        param: { shareId: id },
        json: { name },
      })
      if (!res.ok) throw new Error('Failed to rename share link')
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shares', projectId] })
      toast.success('Share link renamed')
      setIsRenameOpen(false)
    },
    onError: (err) => {
      toast.error(`Error: ${err.message}`)
    },
  })

  const { mutate: deleteShareLink } = useMutation({
    mutationFn: async (id: string) => {
      const res = await client.api.shares[':shareId'].$delete({
        param: { shareId: id },
      })
      if (!res.ok) throw new Error('Failed to delete share link')
      return id
    },
    onSuccess: (deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['shares', projectId] })
      toast.success('Share link deleted')
      setIsDeleteOpen(false)
      if (shareParams?.shareId === deletedId) {
        navigate({
          to: '/projects/$projectId',
          params: { projectId },
        })
      }
    },
    onError: (err) => {
      toast.error(`Error: ${err.message}`)
    },
  })

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
        </header>

        <ScrollArea
          className={cn(
            'flex-1 min-h-0 transition-all duration-300 ease-in-out',
            isAssetsExpanded
              ? 'opacity-100 visible pointer-events-auto'
              : 'opacity-0 invisible pointer-events-none h-0',
          )}
        >
          <div className="space-y-0.5 pr-3">
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
              canEdit={canEdit}
              onRenameTrigger={(id, currentName) => {
                setRenameId(id)
                setRenameType('folder')
                setRenameName(currentName)
                setIsRenameOpen(true)
              }}
              onDeleteTrigger={(id) => {
                setDeleteId(id)
                setDeleteType('folder')
                setIsDeleteOpen(true)
              }}
              onDownloadTrigger={(id) => {
                handleDownloadFolder(id)
              }}
              ancestorFolders={ancestorFolders}
            />

            {canEdit && (
              <div
                className={cn(
                  'group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  isRecentlyDeleted &&
                    'bg-sidebar-accent text-sidebar-accent-foreground font-medium',
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
            )}
          </div>
        </ScrollArea>
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
            {canEdit && (
              <button
                onClick={() => createCollection()}
                className="text-muted-foreground hover:text-foreground flex-none"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </header>

          <ScrollArea
            className={cn(
              'flex-1 min-h-0 transition-all duration-300 ease-in-out',
              isCollectionsExpanded
                ? 'opacity-100 visible pointer-events-auto'
                : 'opacity-0 invisible pointer-events-none h-0',
            )}
          >
            <div className="space-y-0.5 pr-3">
              <div
                className="group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                onClick={() =>
                  navigate({
                    to: '/projects/$projectId/collections',
                    params: { projectId },
                  })
                }
              >
                <div className="flex h-4 w-4 items-center justify-center">
                  <LayoutGrid className="h-4 w-4 text-sidebar-primary" />
                </div>
                <span className="flex-1 truncate text-sidebar-foreground">
                  All Collections ({collectionsData?.pages[0]?.pageInfo?.total || 0})
                </span>
              </div>

              {collections.map((collection) => {
                const isColActive = params?.collectionId === collection.id
                return (
                  <div
                    key={collection.id}
                    className={cn(
                      'group flex cursor-pointer items-center justify-between rounded-md px-2 py-1 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      isColActive && 'bg-sidebar-accent text-sidebar-accent-foreground font-medium',
                    )}
                    onClick={() =>
                      navigate({
                        to: '/projects/$projectId/collections/$collectionId',
                        params: { projectId, collectionId: collection.id },
                      })
                    }
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="flex h-4 w-4 items-center justify-center shrink-0">
                        <Bookmark className="h-4 w-4 text-sidebar-primary" />
                      </div>
                      <span className="truncate text-sidebar-foreground flex-1">
                        {collection.name}
                      </span>
                    </div>

                    {canEdit && (
                      <div
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="h-6 w-6 shrink-0 hover:bg-muted hover:text-muted-foreground p-0"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-32">
                            <DropdownMenuItem
                              onClick={() => {
                                setRenameId(collection.id)
                                setRenameType('collection')
                                setRenameName(collection.name)
                                setIsRenameOpen(true)
                              }}
                            >
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive focus:bg-destructive/10"
                              onClick={() => {
                                setDeleteId(collection.id)
                                setDeleteType('collection')
                                setIsDeleteOpen(true)
                              }}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                )
              })}
              <div ref={collectionsInViewRef} className="h-1" />
              {isFetchingNextCollections && (
                <div className="flex justify-center p-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {!hideShares && (
        <div
          className={cn(
            'flex flex-col overflow-hidden transition-all duration-300 ease-in-out',
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
            {canEdit && (
              <div className="flex items-center gap-1 flex-none">
                <button
                  onClick={() => createShareLink()}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </header>

          <ScrollArea
            className={cn(
              'flex-1 min-h-0 transition-all duration-300 ease-in-out',
              isSharesExpanded
                ? 'opacity-100 visible pointer-events-auto'
                : 'opacity-0 invisible pointer-events-none h-0',
            )}
          >
            <div className="space-y-0.5 pr-3">
              <div
                className="group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                onClick={() =>
                  navigate({
                    to: '/projects/$projectId/shares',
                    params: { projectId },
                  })
                }
              >
                <div className="flex h-4 w-4 items-center justify-center">
                  <LayoutGrid className="h-4 w-4 text-sidebar-primary" />
                </div>
                <span className="flex-1 truncate text-sidebar-foreground">
                  All Share Links ({shareLinksData?.pages[0]?.pageInfo?.total || 0})
                </span>
              </div>

              {shareLinks.map((link) => (
                <ShareLinkItem
                  key={link.id}
                  link={link}
                  projectId={projectId}
                  dragState={dragState}
                  canEdit={canEdit}
                  onRenameTrigger={(id, currentName) => {
                    setRenameId(id)
                    setRenameType('share')
                    setRenameName(currentName)
                    setIsRenameOpen(true)
                  }}
                  onDeleteTrigger={(id) => {
                    setDeleteId(id)
                    setDeleteType('share')
                    setIsDeleteOpen(true)
                  }}
                />
              ))}
              <div ref={sharesInViewRef} className="h-1" />
              {isFetchingNextShareLinks && (
                <div className="flex justify-center p-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Rename Dialog */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>
              Rename{' '}
              {renameType === 'collection'
                ? 'Collection'
                : renameType === 'share'
                  ? 'Share Link'
                  : 'Folder'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              placeholder="Enter new name"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && renameName.trim()) {
                  if (renameType === 'collection') {
                    renameCollection({ id: renameId!, name: renameName })
                  } else if (renameType === 'share') {
                    renameShareLink({ id: renameId!, name: renameName })
                  } else if (renameType === 'folder') {
                    renameFolder({ id: renameId!, name: renameName })
                  }
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsRenameOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!renameName.trim()}
              onClick={() => {
                if (renameType === 'collection') {
                  renameCollection({ id: renameId!, name: renameName })
                } else if (renameType === 'share') {
                  renameShareLink({ id: renameId!, name: renameName })
                } else if (renameType === 'folder') {
                  renameFolder({ id: renameId!, name: renameName })
                }
              }}
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete{' '}
              {deleteType === 'collection'
                ? 'Collection'
                : deleteType === 'share'
                  ? 'Share Link'
                  : 'Folder'}
              ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this{' '}
              {deleteType === 'collection'
                ? 'collection'
                : deleteType === 'share'
                  ? 'share link'
                  : 'folder'}
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteType === 'collection') {
                  deleteCollection(deleteId!)
                } else if (deleteType === 'share') {
                  deleteShareLink(deleteId!)
                } else if (deleteType === 'folder') {
                  deleteFolder(deleteId!)
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Folder Download Dialog */}
      <Dialog open={isDownloadOpen} onOpenChange={setIsDownloadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isLoadingLinks ? 'Preparing Download' : 'Confirm Download'}</DialogTitle>
            <DialogDescription>
              {isLoadingLinks
                ? 'Resolving all files and folders. Please wait...'
                : 'Selected folder files will be prepared for download.'}
            </DialogDescription>
          </DialogHeader>

          {isLoadingLinks ? (
            <div className="space-y-4 py-6 flex flex-col items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm font-medium text-muted-foreground mt-2">
                Preparing download links...
              </span>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="text-sm text-muted-foreground">
                This download will include{' '}
                <span className="font-semibold text-foreground">{resolvedFiles.length}</span>{' '}
                file(s).
              </div>
              <div className="flex items-start gap-3 p-3 text-sm rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/30">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">No Folder Structure</p>
                  <p className="mt-0.5 text-xs text-amber-700/90 dark:text-amber-400/90">
                    Folder hierarchy will be flattened. All nested files will be downloaded directly
                    into your default download folder.
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {!isLoadingLinks ? (
              <>
                <Button variant="outline" onClick={() => setIsDownloadOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={startDownload}
                  className="gap-2"
                  disabled={resolvedFiles.length === 0}
                >
                  <Download className="h-4 w-4" />
                  Start Download
                </Button>
              </>
            ) : (
              <Button disabled variant="outline">
                Cancel
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ShareLinkItem({
  link,
  projectId,
  dragState,
  canEdit,
  onRenameTrigger,
  onDeleteTrigger,
}: {
  link: ShareLinkInfo
  projectId: string
  dragState?: DragState
  canEdit?: boolean
  onRenameTrigger: (id: string, currentName: string) => void
  onDeleteTrigger: (id: string) => void
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
        'group flex cursor-pointer items-center justify-between rounded-md px-2 py-1 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
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
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="flex h-4 w-4 items-center justify-center shrink-0">
          <Share2 className="h-4 w-4 text-sidebar-primary" />
        </div>
        <span className="truncate text-sidebar-foreground flex-1">{link.name}</span>
      </div>

      {canEdit && (
        <div
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-6 w-6 shrink-0 hover:bg-muted hover:text-muted-foreground p-0"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              <DropdownMenuItem
                onClick={() => {
                  onRenameTrigger(link.id, link.name)
                }}
              >
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                onClick={() => {
                  onDeleteTrigger(link.id)
                }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
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
  canEdit?: boolean
  onRenameTrigger: (id: string, name: string) => void
  onDeleteTrigger: (id: string) => void
  onDownloadTrigger: (id: string) => void
  ancestorFolders?: AncestorFolder[]
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
  canEdit,
  onRenameTrigger,
  onDeleteTrigger,
  onDownloadTrigger,
  ancestorFolders,
}: FolderTreeItemProps) {
  const isAncestor = useMemo(() => {
    return ancestorFolders?.some((f) => f.id === folder.id) ?? false
  }, [ancestorFolders, folder.id])

  const [isExpanded, setIsExpanded] = useState(isRoot || isAncestor)

  useEffect(() => {
    if (isAncestor) {
      setIsExpanded(true)
    }
  }, [isAncestor])
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
    disabled: !!isRoot || !!onSelect || !canEdit,
  })

  const { ref: setDroppableRef, isDropTarget: isOver } = useDroppable({
    id: `tree:${folder.id!}`,
    data: {
      type: 'folder',
      item: folder,
    },
    disabled: dragState?.draggedIds.has(folder.id!) || !!onSelect || !canEdit,
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

        {canEdit && !isRoot && (
          <div
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-6 w-6 shrink-0 hover:bg-muted hover:text-muted-foreground p-0"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32">
                <DropdownMenuItem
                  onClick={() => {
                    onRenameTrigger(folder.id!, folder.name)
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    onDownloadTrigger(folder.id!)
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                  onClick={() => {
                    onDeleteTrigger(folder.id!)
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
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
              canEdit={canEdit}
              onRenameTrigger={onRenameTrigger}
              onDeleteTrigger={onDeleteTrigger}
              onDownloadTrigger={onDownloadTrigger}
              ancestorFolders={ancestorFolders}
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
