import { client } from '@/ui/api/client'
import { File, Loader2 } from 'lucide-react'
import type { FC } from 'react'
import type { AssetInfo, AssetInfoPaginatedList } from '@shumai/dtos'
import { useEffect, useRef, useState } from 'react'
import { useInView } from 'react-intersection-observer'
import { Link } from '@tanstack/react-router'
import { cn } from '@/ui/lib/utils'

interface FileViewerLeftSidebarProps {
  projectId: string
  currentAssetId: string
  parentFolderId: string
  initialFiles: AssetInfo[]
  initialNextCursor: string | undefined
}

export const CarouselFilePreview = ({ item }: { item: AssetInfo }) => {
  if (item.preview?.thumbnailUrl) {
    return (
      <img src={item.preview.thumbnailUrl} alt="Preview" className="w-full h-full object-cover" />
    )
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-muted">
      <File className="w-5 h-5 text-muted-foreground" />
    </div>
  )
}

export const FileViewerLeftSidebar: FC<FileViewerLeftSidebarProps> = ({
  projectId,
  currentAssetId,
  parentFolderId,
  initialFiles,
  initialNextCursor,
}) => {
  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: '200px',
  })
  const activeItemRef = useRef<HTMLDivElement>(null)
  const hasScrolledRef = useRef(false)

  const [files, setFiles] = useState<AssetInfo[]>(initialFiles)
  const [nextCursor, setNextCursor] = useState<string | undefined>(initialNextCursor)
  const [hasMore, setHasMore] = useState<boolean>(!!initialNextCursor)
  const [isFetchingNext, setIsFetchingNext] = useState<boolean>(false)

  // Sync state if initial files / cursor changes (due to parent folder change)
  useEffect(() => {
    setFiles(initialFiles)
    setNextCursor(initialNextCursor)
    setHasMore(!!initialNextCursor)
    hasScrolledRef.current = false
  }, [initialFiles, initialNextCursor])

  // Fetch next page when scrolling near bottom
  useEffect(() => {
    const fetchNextPage = async () => {
      if (!nextCursor || isFetchingNext || !inView || !hasMore) return
      setIsFetchingNext(true)
      try {
        const res = await client.api.folders[':folderId'].search.$post({
          param: { folderId: parentFolderId },
          json: {
            assetType: 'file',
            after: nextCursor,
            first: 200,
            recursively: false,
            conditions: [],
          },
        })
        if (!res.ok) throw new Error('Failed to fetch next page')
        const result = (await res.json()) as unknown as AssetInfoPaginatedList
        const batchFiles = (result.data || []) as AssetInfo[]

        setFiles((prev) => [...prev, ...batchFiles])
        setNextCursor(result.pageInfo?.cursor || undefined)
        setHasMore(!!result.pageInfo?.cursor && batchFiles.length > 0)
      } catch (err) {
        console.error('Error fetching next page:', err)
      } finally {
        setIsFetchingNext(false)
      }
    }

    fetchNextPage()
  }, [inView, nextCursor, hasMore, isFetchingNext, parentFolderId])

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
        behavior: 'smooth',
      })
      hasScrolledRef.current = true
    }
  }, [files, currentAssetId])

  return (
    <div className="h-full w-24 bg-card border-r border-border flex flex-col flex-shrink-0 select-none">
      <div className="flex-1 overflow-y-auto py-4 flex flex-col items-center gap-3 no-scrollbar">
        {files.map((file) => {
          if (!file) return null
          const isActive = file.id === currentAssetId
          return (
            <div
              key={file.id}
              ref={file.id === currentAssetId ? activeItemRef : null}
              className="flex-shrink-0"
            >
              <Link
                to="/projects/$projectId/files/$fileId"
                params={{ projectId, fileId: file.id }}
                search={{ version: undefined }}
                className={cn(
                  'w-[54px] h-[54px] rounded-lg border overflow-hidden flex items-center justify-center transition-all bg-muted/30 block',
                  isActive
                    ? 'border-primary ring-2 ring-primary opacity-100 scale-105'
                    : 'border-border hover:border-primary/50 opacity-65 hover:opacity-100',
                )}
              >
                <CarouselFilePreview item={file} />
              </Link>
            </div>
          )
        })}

        {/* Infinite Scroll Trigger */}
        {hasMore && (
          <div ref={ref} className="py-2 flex justify-center items-center w-full">
            {isFetchingNext && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          </div>
        )}
      </div>
    </div>
  )
}
