import { useEffect, useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useDroppable, useDragOperation } from '@dnd-kit/react'
import { useInView } from 'react-intersection-observer'
import { client } from '@/ui/api/client'
import { cn } from '@/ui/lib/utils'
import { m } from '@/ui/paraglide/messages.js'
import { Button } from '@/ui/components/ui/button'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import { KanbanTaskStatus, type KanbanTaskInfo, type ListKanbanTasksResponse } from '@shumai/dtos'
import { getStatusColor, getStatusLabel } from './kanban-types'
import { KanbanCard } from './kanban-card'
import { Plus, Loader2 } from 'lucide-react'

interface KanbanColumnProps {
  teamId: string
  status: KanbanTaskStatus
  selectedGoalId: string | null
  scope: 'team' | 'my'
  currentUserId?: string
  onTaskClick: (task: KanbanTaskInfo) => void
  onCreateTaskInColumn: (status: KanbanTaskStatus) => void
}

export function KanbanColumn({
  teamId,
  status,
  selectedGoalId,
  scope,
  currentUserId,
  onTaskClick,
  onCreateTaskInColumn,
}: KanbanColumnProps) {
  const { ref: setDroppableRef, isDropTarget } = useDroppable({
    id: status,
    data: {
      type: 'kanban_column',
      status,
    },
  })

  const { source, target } = useDragOperation()
  const isDraggingTask = source?.data?.type === 'kanban_task'
  const isOverThisColumn =
    isDraggingTask &&
    (isDropTarget ||
      (target?.data?.type === 'kanban_column' && target.data.status === status) ||
      (target?.data?.type === 'reorder' &&
        (target.data.task as KanbanTaskInfo | undefined)?.status === status))

  const isOverColumnEmptySpace =
    isDraggingTask && target?.data?.type === 'kanban_column' && target.data.status === status

  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0.1,
  })

  const assigneeId = scope === 'my' ? currentUserId : undefined

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['teams', teamId, 'kanban', 'tasks', { status, goalId: selectedGoalId, assigneeId }],
    queryFn: async ({ pageParam = '' }) => {
      const res = await client.api.teams[':teamId'].kanban.tasks.$get({
        param: { teamId },
        query: {
          status,
          goalId: selectedGoalId || undefined,
          assigneeId: assigneeId || undefined,
          first: '20',
          after: (pageParam as string) || undefined,
        },
      })
      if (!res.ok) throw new Error('Failed to fetch column tasks')
      return (await res.json()) as unknown as ListKanbanTasksResponse
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.pageInfo?.cursor || undefined,
    refetchInterval: 5000,
    enabled: !!teamId,
  })

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  const allTasks = useMemo(() => {
    return data?.pages?.flatMap((page) => (Array.isArray(page?.data) ? page.data : [])) || []
  }, [data])

  const lastVisibleTask = allTasks.filter((t) => t.id !== source?.id).at(-1)
  const totalCount = data?.pages?.[0]?.pageInfo?.total ?? allTasks.length
  const statusColor = getStatusColor(status)

  return (
    <div
      className={cn(
        'flex flex-col h-full max-h-full w-80 md:w-84 shrink-0 rounded-xl bg-card/60 border border-border/70 shadow-xs transition-colors duration-200 overflow-hidden select-none',
        isOverThisColumn && 'ring-2 ring-primary/60 bg-primary/[0.03] border-primary/40',
      )}
    >
      {/* Column Header */}
      <div className="h-11 px-3.5 flex items-center justify-between border-b border-border/60 bg-card/80 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', statusColor.dot)} />
          <h3 className="text-xs font-bold tracking-wide uppercase text-foreground/90 truncate">
            {getStatusLabel(status)}
          </h3>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-muted font-medium text-muted-foreground">
            {totalCount}
          </span>
        </div>
      </div>

      {/* Column Task Cards Body */}
      <ScrollArea className="flex-1 min-h-0 [&>div>div]:block!">
        <div ref={setDroppableRef} className="p-2.5 space-y-2.5 min-h-[120px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : allTasks.length === 0 ? (
            <div className="relative flex flex-col items-center justify-center py-10 px-4 text-center">
              {isOverColumnEmptySpace && (
                <div className="absolute top-3 left-3 right-3 h-[3px] rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.6)] z-30 pointer-events-none" />
              )}
              <p className="text-xs text-muted-foreground/70">{m.no_tasks_in_column()}</p>
            </div>
          ) : (
            allTasks.map((task) => (
              <KanbanCard
                key={task.id}
                task={task}
                onClick={onTaskClick}
                showBottomIndicator={isOverColumnEmptySpace && task.id === lastVisibleTask?.id}
              />
            ))
          )}

          {/* Infinite Scroll Sentinel */}
          <div ref={loadMoreRef} className="h-2" />
          {isFetchingNextPage && (
            <div className="flex justify-center py-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Fixed Column Footer: + Create Task */}
      <div className="p-2 border-t border-border/50 bg-card/90 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onCreateTaskInColumn(status)}
          className="w-full justify-center h-8 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 border border-dashed border-border/80"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          <span>{m.create_task()}</span>
        </Button>
      </div>
    </div>
  )
}
