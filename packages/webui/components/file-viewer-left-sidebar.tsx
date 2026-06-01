import { client } from '@/ui/api/client'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Loader2, PanelLeftClose } from 'lucide-react'
import type { FC } from 'react'
import type { AssetInfoPaginatedList } from '@shumai/dtos'
import { useEffect, useRef } from 'react'
import { useInView } from 'react-intersection-observer'
import { SidebarFileCard } from './sidebar-file-card'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'

interface FileViewerLeftSidebarProps {
  projectId: string
  currentAssetId: string
  parentFolderId: string
  onCollapse: () => void
}

export const FileViewerLeftSidebar: FC<FileViewerLeftSidebarProps> = ({
  projectId,
  currentAssetId,
  parentFolderId,
  onCollapse,
}) => {
  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: '200px',
  })
  const activeItemRef = useRef<HTMLDivElement>(null)
  const hasScrolledRef = useRef(false)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: [
      'folders',
      parentFolderId,
      'children',
      {
        assetType: 'file',
      },
    ],
    queryFn: async ({ pageParam }) => {
      const res = await client.api.folders[':folderId'].children.$get({
        param: { folderId: parentFolderId },
        query: {
          assetType: 'file',
          after: pageParam,
          first: '20',
        },
      })
      if (!res.ok) throw new Error('failed to fetch folder children')
      return (await res.json()) as unknown as AssetInfoPaginatedList
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.pageInfo?.cursor || undefined,
  })

  const files = data?.pages.flatMap((page) => page.data) ?? []

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  // Reset scroll lock when current asset changes
  useEffect(() => {
    hasScrolledRef.current = false
  }, [currentAssetId])

  // Scroll the active item into view
  useEffect(() => {
    const activeFileInView = files.some((f) => f?.id === currentAssetId)
    if (activeFileInView && activeItemRef.current && !hasScrolledRef.current) {
      activeItemRef.current.scrollIntoView({
        block: 'center',
      })
      hasScrolledRef.current = true
    }
  }, [files, currentAssetId])

  return (
    <div className="h-full w-full bg-card border-r border-border flex flex-col">
      <div className="p-2 border-b flex items-center justify-between">
        <h3 className="text-sm font-semibold px-2">Current Folder</h3>
        <Button variant="ghost" size="icon-sm" onClick={onCollapse}>
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 [&>div>div]:block! px-2">
        <div className="p-2 space-y-2">
          {isLoading && (
            <div className="flex justify-center items-center p-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {files.map(
            (file) =>
              file && (
                <SidebarFileCard
                  ref={file.id === currentAssetId ? activeItemRef : null}
                  key={file.id}
                  projectId={projectId}
                  item={file}
                  isActive={file.id === currentAssetId}
                />
              ),
          )}
          <div ref={ref}>
            {isFetchingNextPage && (
              <div className="flex justify-center items-center p-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
