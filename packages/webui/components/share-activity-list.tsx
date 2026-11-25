import type { ShareActivityKind } from '@shumai/dtos'
import { useInfiniteQuery } from '@tanstack/react-query'
import { isToday, isYesterday } from 'date-fns'
import { CircleUserRound } from 'lucide-react'
import { useEffect } from 'react'
import { useInView } from 'react-intersection-observer'
import { client } from '@/ui/api/client'
import { m } from '@/ui/paraglide/messages.js'
import { getLocale } from '@/ui/paraglide/runtime.js'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'

function activityLabel(kind: ShareActivityKind) {
  switch (kind) {
    case 'share_viewed':
      return m.share_activity_opened_share_link()
    case 'asset_viewed':
      return m.share_activity_viewed_asset()
    case 'asset_downloaded':
      return m.share_activity_downloaded()
    case 'comment_created':
      return m.share_activity_commented()
  }
}

function formatDay(date: Date) {
  if (isToday(date)) return m.today()
  if (isYesterday(date)) return m.yesterday()
  return date.toLocaleDateString(getLocale(), { dateStyle: 'medium' })
}

export function ShareActivityList({ shareId }: { shareId: string }) {
  const query = useInfiniteQuery({
    queryKey: ['share-activities', shareId],
    queryFn: async ({ pageParam, signal }) => {
      const response = await client.api.shares[':shareId'].activities.$get(
        { param: { shareId }, query: { first: '20', after: pageParam } },
        { init: { signal } },
      )
      if (!response.ok) throw new Error(m.share_activity_load_failed())
      return response.json()
    },
    initialPageParam: '',
    getNextPageParam: (page) => page.pageInfo.cursor || undefined,
  })
  const { ref, inView } = useInView()
  const { fetchNextPage, hasNextPage, isFetching, isError } = query
  useEffect(() => {
    if (inView && hasNextPage && !isFetching && !isError) void fetchNextPage()
  }, [fetchNextPage, hasNextPage, inView, isError, isFetching])

  const events = new Map(
    query.data?.pages.flatMap((page) => page.data.map((event) => [event.id, event] as const)),
  )
  const days = Map.groupBy(events.values(), (event) => new Date(event.createdAt).toDateString())

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="space-y-4 p-3">
        {query.isPending && <p className="text-sm text-muted-foreground">{m.loading()}</p>}
        {query.isSuccess && events.size === 0 && (
          <p className="text-sm text-muted-foreground">{m.no_activity_yet()}</p>
        )}
        {[...days].map(([day, entries]) => (
          <section key={day} className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">
              {formatDay(new Date(entries[0].createdAt))}
            </h3>
            <ul className="space-y-2">
              {entries.map((event) => (
                <li
                  key={event.id}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-2 py-2"
                >
                  {event.user ? (
                    <Avatar className="size-8">
                      <AvatarImage src={event.user.image} alt="" />
                      <AvatarFallback>{event.user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  ) : (
                    <CircleUserRound aria-hidden="true" className="size-8 text-muted-foreground" />
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {event.user?.name || m.someone()}
                    </div>
                    <div className="flex items-baseline gap-x-2 text-xs text-muted-foreground">
                      {event.asset && (
                        <span className="min-w-0 truncate" title={event.asset.name ?? undefined}>
                          {event.asset.name ?? m.share_activity_deleted_asset()}
                        </span>
                      )}
                      <time dateTime={event.createdAt} className="shrink-0 whitespace-nowrap">
                        {new Date(event.createdAt).toLocaleTimeString(getLocale(), {
                          timeStyle: 'short',
                        })}
                      </time>
                    </div>
                  </div>
                  <span className="max-w-24 text-right text-xs">{activityLabel(event.kind)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {query.isError && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{m.share_activity_load_failed()}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void (query.isFetchNextPageError ? fetchNextPage() : query.refetch())}
            >
              {m.retry()}
            </Button>
          </div>
        )}
        {hasNextPage && <div ref={ref}>{query.isFetchingNextPage && m.loading()}</div>}
      </div>
    </ScrollArea>
  )
}
