import { client } from '@/ui/api/client'
import type { TaskInfo } from '@/dtos/upload'
import { useTeamId } from '@/ui/hooks/use-team-id'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { useInView } from 'react-intersection-observer'

function UploadTaskItem({ task }: { task: TaskInfo }) {
  const progress =
    task.total && task.total > 0 ? `${((task.uploaded ?? 0) / task.total) * 100}%` : '0%'
  return (
    <div className="p-2 rounded-md transition-colors hover:bg-sidebar-accent">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium truncate">{task.name ?? 'unknown'}</span>
        <span className="text-xs text-muted-foreground">
          {task.uploaded}/{task.total}
        </span>
      </div>
      <div className="mt-1 h-1 w-full bg-muted rounded-full">
        <div className="h-1 bg-primary rounded-full" style={{ width: progress }} />
      </div>
    </div>
  )
}

export function UploadTasks() {
  const teamId = useTeamId()
  const {
    data: tasksData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['teams', teamId, 'upload', 'tasks'],
    queryFn: async ({ pageParam }) => {
      const res = await client.api.teams[':teamId'].upload.tasks.$get({
        param: { teamId: teamId! },
        query: { after: pageParam as string },
      })
      if (!res.ok) throw new Error('Failed to fetch upload tasks')
      return await res.json()
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => {
      return lastPage.pageInfo?.cursor || undefined
    },
    enabled: !!teamId,
  })

  const { ref, inView } = useInView()

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  const tasks = tasksData?.pages.flatMap((page) => page.data ?? []) ?? []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col space-y-2">
      {tasks?.map((task) => (
        <UploadTaskItem key={task.id} task={task} />
      ))}
      {hasNextPage && (
        <div ref={ref} className="flex items-center justify-center p-2">
          {isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
      )}
    </div>
  )
}
