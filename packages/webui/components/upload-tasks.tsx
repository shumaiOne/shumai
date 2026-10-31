import { client } from '@/ui/api/client'
import type { TaskInfo } from '@shumai/dtos'
import { useTeamId } from '@/ui/hooks/use-team-id'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useUploadStore } from '@/ui/stores/upload'
import { cancelActiveUploadTask } from '@/ui/lib/uploader'
import { Loader2, CheckCircle2, Clock, UploadCloud, AlertCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useInView } from 'react-intersection-observer'
import { format, parseISO, isToday, isYesterday } from 'date-fns'
import { Progress } from '@/ui/components/ui/progress'
import { Button } from '@/ui/components/ui/button'
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
import { toast } from 'sonner'
import { formatTimeAgo } from '@/ui/lib/time'
import { m } from '@/ui/paraglide/messages.js'

function formatDayHeader(dateString: string): string {
  const date = parseISO(dateString)
  if (isNaN(date.getTime())) {
    return m.unknown_date()
  }
  if (isToday(date)) {
    return m.today()
  }
  if (isYesterday(date)) {
    return m.yesterday()
  }
  return format(date, m.date_format_long())
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function UploadTaskItem({ task, teamId }: { task: TaskInfo; teamId?: string }) {
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false)
  const clientProgress = useUploadStore((state) => state.tasks[task.id])
  const cancelTaskInStore = useUploadStore((state) => state.cancelTask)
  const queryClient = useQueryClient()

  const isCompleted = clientProgress
    ? clientProgress.loaded === clientProgress.total && task.uploaded === task.total
    : task.uploaded === task.total

  const isFailed = task.status === 'failed'
  const isDone = task.status === 'completed' || isCompleted
  const isRunning = !isDone && !isFailed

  const percent = isDone
    ? 100
    : clientProgress
      ? clientProgress.total > 0
        ? (clientProgress.loaded / clientProgress.total) * 100
        : 0
      : task.total > 0
        ? (task.uploaded / task.total) * 100
        : 0

  let formattedTime: string
  try {
    formattedTime = formatTimeAgo(task.createdAt)
  } catch {
    formattedTime = m.unknown()
  }

  const { mutate: cancelMutation, isPending: isCanceling } = useMutation({
    mutationFn: async () => {
      cancelActiveUploadTask(task.id)
      cancelTaskInStore(task.id)

      if (teamId) {
        const res = await client.api.teams[':teamId'].upload.tasks[':taskId'].cancel.$post({
          param: { teamId, taskId: task.id },
        })
        if (!res.ok) {
          throw new Error('Failed to cancel upload task')
        }
        return await res.json()
      }
    },
    onSuccess: () => {
      setIsCancelConfirmOpen(false)
      toast.success(m.upload_task_canceled())
      queryClient.invalidateQueries({
        queryKey: ['teams', teamId, 'upload', 'tasks'],
      })
      queryClient.invalidateQueries({
        queryKey: ['search', teamId],
      })
    },
    onError: (err) => {
      console.error('Failed to cancel upload task:', err)
      toast.error(m.failed_to_cancel_upload_task())
    },
  })

  return (
    <div className="group relative flex flex-col p-4 rounded-xl border border-sidebar-border bg-sidebar-accent/30 text-sidebar-foreground shadow-xs transition-all duration-200 hover:shadow-md hover:border-sidebar-foreground/20 hover:bg-sidebar-accent/50">
      {/* Top row: Name & Status Badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <span
            className="text-sm font-semibold tracking-tight text-sidebar-foreground truncate block"
            title={task.name}
          >
            {task.name || m.untitled_upload()}
          </span>
        </div>
        <div className="flex-shrink-0">
          {isDone ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full transition-colors">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {m.done()}
            </span>
          ) : isFailed ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
              <AlertCircle className="w-3.5 h-3.5" />
              {m.status_failed()}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-sidebar-primary bg-sidebar-primary/10 px-2 py-0.5 rounded-full animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {m.uploading_status()}
            </span>
          )}
        </div>
      </div>

      {/* Middle row: Created Time (Date & Time together) */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3 font-medium">
        <Clock className="w-3.5 h-3.5 text-muted-foreground/75" />
        <span>{formattedTime}</span>
      </div>

      {/* Bottom row: Progress Bar, Fraction & Cancel Button */}
      <div className="space-y-1.5 mt-auto">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-muted-foreground/80">
            {clientProgress
              ? `${formatBytes(clientProgress.loaded)} / ${formatBytes(clientProgress.total)} (${m.files_progress({ uploaded: task.uploaded, total: task.total })})`
              : m.files_progress({ uploaded: task.uploaded, total: task.total })}
          </span>
          <div className="flex items-center gap-2">
            {!isDone && !isFailed && (
              <span className="text-sidebar-primary font-mono font-bold">
                {Math.round(percent)}%
              </span>
            )}
            {isRunning && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                disabled={isCanceling}
                onClick={(e) => {
                  e.stopPropagation()
                  setIsCancelConfirmOpen(true)
                }}
              >
                {isCanceling ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                {m.cancel()}
              </Button>
            )}
          </div>
        </div>
        <Progress value={percent} className="h-1.5 w-full bg-muted" />
      </div>

      <AlertDialog open={isCancelConfirmOpen} onOpenChange={setIsCancelConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.cancel_upload_task_confirm_title()}</AlertDialogTitle>
            <AlertDialogDescription>
              {m.cancel_upload_task_confirm_description()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCanceling}>{m.cancel()}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isCanceling}
              onClick={(e) => {
                e.preventDefault()
                cancelMutation()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCanceling ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {m.cancel_upload_task()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

interface TaskGroup {
  day: string
  tasks: TaskInfo[]
}

export function UploadTasks() {
  const teamId = useTeamId()
  const uploading = useUploadStore((state) => state.uploading)
  const clientActiveTasks = useUploadStore((state) => state.tasks)
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
    refetchInterval: uploading > 0 ? 2000 : false,
  })

  const { ref, inView } = useInView()

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  const tasks = tasksData?.pages.flatMap((page) => page.data ?? []) ?? []

  const combinedTasks = useMemo(() => {
    const serverTaskIds = new Set(tasks.map((t) => t.id))
    const clientOnlyTasks: TaskInfo[] = Object.values(clientActiveTasks)
      .filter((ct) => !serverTaskIds.has(ct.taskId))
      .map((ct) => {
        const completedCount = Object.values(ct.files).filter(
          (f) => f.status === 'completed' || f.status === 'failed',
        ).length

        return {
          id: ct.taskId,
          name: ct.name,
          total: Object.keys(ct.files).length,
          uploaded: completedCount,
          createdAt: new Date().toISOString(),
        }
      })

    return [...clientOnlyTasks, ...tasks].sort((a, b) => b.id.localeCompare(a.id))
  }, [tasks, clientActiveTasks])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (combinedTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-border rounded-xl bg-muted/10 my-4">
        <UploadCloud className="h-8 w-8 text-muted-foreground/50 mb-3" />
        <p className="text-sm font-semibold text-muted-foreground">{m.no_uploads_yet()}</p>
        <p className="text-xs text-muted-foreground/60 mt-1 max-w-[180px]">{m.no_uploads_hint()}</p>
      </div>
    )
  }

  // Group tasks by day (maintaining desc ordering)
  const taskGroups: TaskGroup[] = []
  combinedTasks.forEach((task) => {
    const day = formatDayHeader(task.createdAt)
    let group = taskGroups.find((g) => g.day === day)
    if (!group) {
      group = { day, tasks: [] }
      taskGroups.push(group)
    }
    group.tasks.push(task)
  })

  return (
    <div className="flex flex-col space-y-4">
      {taskGroups.map((group) => (
        <div key={group.day} className="relative flex flex-col">
          {/* Day Sticky Header */}
          <div className="sticky top-0 bg-sidebar/95 backdrop-blur-sm z-10 py-2 px-1 flex items-center justify-between border-b border-border/40">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
              {group.day}
            </span>
            <span className="text-[10px] font-semibold text-muted-foreground/60 bg-muted px-2 py-0.5 rounded-full">
              {group.tasks.length === 1
                ? m.n_tasks_singular({ count: group.tasks.length })
                : m.n_tasks_plural({ count: group.tasks.length })}
            </span>
          </div>
          {/* Tasks in Day */}
          <div className="mt-3 space-y-3">
            {group.tasks.map((task) => (
              <UploadTaskItem key={task.id} task={task} teamId={teamId} />
            ))}
          </div>
        </div>
      ))}

      {hasNextPage && (
        <div ref={ref} className="flex items-center justify-center p-4">
          {isFetchingNextPage && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        </div>
      )}
    </div>
  )
}
