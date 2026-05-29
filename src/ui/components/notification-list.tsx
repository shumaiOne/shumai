import { client } from '@/ui/api/client'
import { NotificationCard } from '@/ui/components/notification-card'
import { Button } from '@/ui/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/ui/components/ui/tabs'
import { useTeamContextStore } from '@/ui/stores/team-context'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCheckIcon, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useInView } from 'react-intersection-observer'
import type { InferResponseType } from 'hono/client'
import type { GetMeResponse } from '@/dtos/team'

export const NotificationList = () => {
  const { teamId } = useTeamContextStore()
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all')
  const queryClient = useQueryClient()
  const { ref, inView } = useInView()

  const getQueryKey = (teamId: string | null, unread: boolean) => [
    'notifications',
    teamId,
    { unreadOnly: unread },
  ]

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch } =
    useInfiniteQuery({
      queryKey: getQueryKey(teamId ?? null, activeTab === 'unread'),
      queryFn: async ({ pageParam }) => {
        const res = await client.api.teams[':teamId'].notifications.$get({
          param: { teamId: teamId! },
          query: {
            unreadOnly: activeTab === 'unread' ? 'true' : 'false',
            ...(pageParam ? { after: pageParam } : {}),
            pageSize: '20',
          },
        })
        if (!res.ok) throw new Error('failed to fetch notifications')
        return res.json()
      },
      initialPageParam: undefined as string | undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getNextPageParam: (lastPage: any) => lastPage.pageInfo?.cursor || undefined,
      enabled: !!teamId,
    })

  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, fetchNextPage])

  // Flatten data
  const notifications = useMemo(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => data?.pages.flatMap((page: any) => page.data || []) || [],
    [data],
  )

  useEffect(() => {
    if (teamId) {
      queryClient.invalidateQueries({
        queryKey: ['teams', teamId, 'me'],
      })
    }
  }, [teamId, notifications.length, queryClient])

  const $post = client.api.teams[':teamId'].notifications.read.$post
  const markReadMutation = useMutation<
    InferResponseType<typeof $post>,
    Error,
    { teamId: string; notificationId: string }
  >({
    mutationFn: async ({ teamId, notificationId }) => {
      const res = await $post({
        param: { teamId: teamId },
        json: { notificationId: notificationId },
      })
      if (!res.ok) throw new Error('failed to mark read')
      return null as unknown as InferResponseType<typeof $post>
    },
  })

  const handleMarkAllRead = async () => {
    if (notifications.length > 0 && teamId) {
      const topId = notifications[0].id
      if (topId) {
        // Optimistically clear the unread count in React Query cache instantly
        queryClient.setQueryData(['teams', teamId, 'me'], (oldData: GetMeResponse | undefined) => {
          if (!oldData) return oldData
          return {
            ...oldData,
            unreadNotificationCount: 0,
          }
        })

        try {
          await markReadMutation.mutateAsync({
            teamId,
            notificationId: topId,
          })
        } catch (err) {
          console.error('Failed to mark all as read:', err)
        }

        // Invalidate queries to trigger sync refetches
        queryClient.invalidateQueries({
          queryKey: ['notifications', teamId],
        })
        queryClient.invalidateQueries({
          queryKey: ['teams', teamId, 'me'],
        })
        // Refetch to update UI state immediately
        refetch()
      }
    }
  }

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-slate-900">
      <div className="flex-none pb-1">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'all' | 'unread')}
          className="w-full"
        >
          <div className="flex items-center justify-between mb-2">
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs px-3 h-6">
                All
              </TabsTrigger>
              <TabsTrigger value="unread" className="text-xs px-3 h-6">
                Unread
              </TabsTrigger>
            </TabsList>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              onClick={handleMarkAllRead}
              disabled={notifications.length === 0 || markReadMutation.isPending}
              title="Mark all as read"
            >
              <CheckCheckIcon className="w-4 h-4" />
            </Button>
          </div>
        </Tabs>
      </div>

      <div className="flex-1 overflow-y-auto p-2 min-h-0">
        {isLoading && (
          <div className="flex justify-center p-4">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        )}

        {!isLoading && notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-slate-500 dark:text-slate-400">
            <p className="text-sm">No notifications</p>
          </div>
        )}

        <div className="space-y-1">
          {notifications.map((notification) => (
            <NotificationCard key={notification.id} notification={notification} />
          ))}
        </div>

        {/* Infinite Scroll Trigger */}
        <div ref={ref} className="h-4 w-full flex justify-center p-1">
          {isFetchingNextPage && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
        </div>
      </div>
    </div>
  )
}
