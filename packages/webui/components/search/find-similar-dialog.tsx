import type { AssetInfo, ImageSearchMediaType } from '@shumai/dtos'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useInView } from 'react-intersection-observer'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import { ToggleGroup, ToggleGroupItem } from '@/ui/components/ui/toggle-group'
import { m } from '@/ui/paraglide/messages.js'
import { searchByImage } from './search-by-image'
import { SearchResultCards } from './search-result-cards'

type MediaFilter = ImageSearchMediaType | 'all'

export function FindSimilarDialog({
  image,
  folderId,
  teamId,
  projectId,
  onClose,
}: {
  image: AssetInfo
  folderId: string
  teamId: string
  projectId: string
  onClose: () => void
}) {
  const [filter, setFilter] = useState<MediaFilter>('all')
  const sourceAssetId =
    image.versionStack?.versions.find((version) => version.current)?.id ?? image.id
  const { ref, inView } = useInView()
  const { data, error, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteQuery({
      queryKey: ['find-similar', folderId, sourceAssetId, filter],
      queryFn: ({ pageParam, signal }) =>
        searchByImage(
          folderId,
          {
            sourceAssetId,
            conditions: [],
            operator: 'AND',
            mediaType: filter === 'all' ? undefined : filter,
            first: 20,
            after: pageParam,
          },
          signal,
        ),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (page) => page.pageInfo.cursor,
      retry: false,
    })

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage && !error) void fetchNextPage()
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage, error])

  const results = data?.pages.flatMap((page) => page.data) ?? []
  const total = data?.pages[0]?.pageInfo.total

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="flex h-[85vh] flex-col overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="px-6 pt-5 pr-12">
          <DialogTitle>{m.find_similar()}</DialogTitle>
          <DialogDescription className="truncate">{image.name}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-6 pb-4">
          <ToggleGroup
            aria-label={m.image_search_media_filter()}
            type="single"
            variant="outline"
            value={filter}
            onValueChange={(value) => {
              if (value === 'all' || value === 'image' || value === 'video') setFilter(value)
            }}
          >
            <ToggleGroupItem value="all">{m.all()}</ToggleGroupItem>
            <ToggleGroupItem value="image">{m.image_search_images()}</ToggleGroupItem>
            <ToggleGroupItem value="video">{m.image_search_videos()}</ToggleGroupItem>
          </ToggleGroup>
          {total != null && (
            <span className="text-xs text-muted-foreground">
              {m.matched_items({ count: String(total) })}
            </span>
          )}
        </div>
        <ScrollArea className="min-h-0 flex-1 [&>div>div]:block!">
          <div className="p-6">
            {(isLoading || isFetchingNextPage) && (
              <p
                role="status"
                className="flex items-center gap-2 py-2 text-sm text-muted-foreground"
              >
                <Loader2 className="size-4 animate-spin" />
                {m.loading()}
              </p>
            )}
            {error && (
              <p role="alert" className="py-2 text-sm text-destructive">
                {error.message}
              </p>
            )}
            {!isLoading && !error && results.length === 0 && (
              <p className="py-2 text-sm text-muted-foreground">{m.no_records_matched()}</p>
            )}
            <SearchResultCards teamId={teamId} projectId={projectId} results={results} />
            {hasNextPage && !error && <div ref={ref} className="h-1" />}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
