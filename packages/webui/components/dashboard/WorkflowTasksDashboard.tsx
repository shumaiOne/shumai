import { useEffect, useMemo, useState } from 'react'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'
import { useInView } from 'react-intersection-observer'
import { client } from '@/ui/api/client'
import { m } from '@/ui/paraglide/messages.js'
import {
  WorkflowTaskType,
  WorkflowTaskStatus,
  type WorkflowTaskItem,
  type ListWorkflowTasksResponse,
} from '@shumai/dtos'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/components/ui/table'
import { Badge } from '@/ui/components/ui/badge'
import { Button } from '@/ui/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/components/ui/popover'
import { Checkbox } from '@/ui/components/ui/checkbox'
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
import { Loader2, Filter, Workflow, Square, Eye, RotateCw, AlertTriangle } from 'lucide-react'
import { formatTimeAgo } from '@/ui/lib/time'
import { formatSize } from '@/ui/lib/format'
import { toast } from 'sonner'
import { WorkflowTaskDetailsDialog } from './WorkflowTaskDetailsDialog'

const ALL_WORKFLOW_TASK_TYPES = Object.values(WorkflowTaskType)
const ALL_WORKFLOW_TASK_STATUSES = Object.values(WorkflowTaskStatus)

interface WorkflowTasksDashboardProps {
  teamId: string
}

export function WorkflowTasksDashboard({ teamId }: WorkflowTasksDashboardProps) {
  const queryClient = useQueryClient()
  const [selectedStatuses, setSelectedStatuses] = useState<WorkflowTaskStatus[]>([])
  const [selectedTypes, setSelectedTypes] = useState<WorkflowTaskType[]>([])
  const [taskToStop, setTaskToStop] = useState<WorkflowTaskItem | null>(null)
  const [detailsTask, setDetailsTask] = useState<WorkflowTaskItem | null>(null)

  const { ref: loadMoreRef, inView } = useInView()

  const queryKey = useMemo(
    () => ['teams', teamId, 'workflow-tasks', selectedStatuses, selectedTypes],
    [teamId, selectedStatuses, selectedTypes],
  )

  // Infinite query for listing workflow tasks
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) => {
      const res = await client.api.teams[':teamId']['workflow-tasks'].$get({
        param: { teamId },
        query: {
          first: '20',
          after: pageParam ? String(pageParam) : undefined,
          status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
          types: selectedTypes.length > 0 ? selectedTypes : undefined,
        },
      })
      if (!res.ok) throw new Error('Failed to fetch workflow tasks')
      return (await res.json()) as ListWorkflowTasksResponse
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.pageInfo.endCursor || undefined,
    enabled: !!teamId,
  })

  // Trigger next page when scrolling into view
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  const allTasks = useMemo(() => data?.pages.flatMap((page) => page.nodes) || [], [data])
  const totalCount = data?.pages[0]?.total ?? 0

  // Targeted Active Task Poller: Extract active (pending/processing) task IDs
  const activeTaskIds = useMemo(() => {
    return allTasks
      .filter((t) => t.status === 'pending' || t.status === 'processing')
      .map((t) => t.id)
  }, [allTasks])

  // Polling query: Only active when there are pending or processing tasks
  useQuery({
    queryKey: ['teams', teamId, 'workflow-tasks', 'batch-status', activeTaskIds],
    queryFn: async () => {
      if (activeTaskIds.length === 0) return null
      const res = await client.api.teams[':teamId']['workflow-tasks']['batch-status'].$post({
        param: { teamId },
        json: { taskIds: activeTaskIds },
      })
      if (!res.ok) return null
      const result = await res.json()

      // Update active tasks in-place in the infinite query cache
      if (result.tasks && result.tasks.length > 0) {
        queryClient.setQueryData(
          queryKey,
          (old: InfiniteData<ListWorkflowTasksResponse> | undefined) => {
            if (!old) return old
            const updatedMap = new Map(
              result.tasks.map((task: WorkflowTaskItem) => [task.id, task]),
            )
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                nodes: page.nodes.map((node) => updatedMap.get(node.id) || node),
              })),
            }
          },
        )
      }
      return result
    },
    enabled: activeTaskIds.length > 0,
    refetchInterval: 6000,
  })

  // Stop task mutation
  const stopTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await client.api.teams[':teamId']['workflow-tasks'][':taskId'].stop.$post({
        param: { teamId, taskId },
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Failed to stop task' }))
        throw new Error((errorData as { message?: string }).message || 'Failed to stop task')
      }
      return await res.json()
    },
    onSuccess: (data) => {
      toast.success(m.task_stopped_successfully())
      // In-place update in infinite query cache
      queryClient.setQueryData(
        queryKey,
        (old: InfiniteData<ListWorkflowTasksResponse> | undefined) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              nodes: page.nodes.map((node) => (node.id === data.task.id ? data.task : node)),
            })),
          }
        },
      )
      setTaskToStop(null)
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to stop task')
    },
  })

  const toggleStatus = (status: WorkflowTaskStatus) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
    )
  }

  const toggleType = (type: WorkflowTaskType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    )
  }

  const getStatusBadge = (status?: string | null) => {
    switch (status) {
      case 'completed':
        return (
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-mono text-xs"
          >
            completed
          </Badge>
        )
      case 'processing':
        return (
          <Badge
            variant="outline"
            className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 font-mono text-xs gap-1.5"
          >
            <Loader2 className="h-3 w-3 animate-spin" />
            processing
          </Badge>
        )
      case 'pending':
        return (
          <Badge
            variant="outline"
            className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20 font-mono text-xs"
          >
            pending
          </Badge>
        )
      case 'failed':
        return (
          <Badge
            variant="outline"
            className="bg-destructive/10 text-destructive border-destructive/20 font-mono text-xs"
          >
            failed
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="font-mono text-xs">
            {status || '-'}
          </Badge>
        )
    }
  }

  const getTypeBadge = (type?: string | null) => {
    if (!type) return <Badge variant="outline">-</Badge>
    if (type.startsWith('transcode')) {
      return (
        <Badge
          variant="outline"
          className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 font-mono text-xs"
        >
          {type}
        </Badge>
      )
    }
    if (type.startsWith('ai_') || type === 'chat') {
      return (
        <Badge
          variant="outline"
          className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 font-mono text-xs"
        >
          {type}
        </Badge>
      )
    }
    return (
      <Badge variant="secondary" className="font-mono text-xs">
        {type}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border border-border/50 shadow-xs">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Workflow className="h-5 w-5 text-primary" />
                {m.workflow_tasks()}
              </CardTitle>
              <CardDescription className="mt-1">{m.workflow_tasks_description()}</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {totalCount > 0 && (
                <Badge variant="secondary" className="w-fit text-xs font-normal">
                  {totalCount} {m.workflow_tasks()}
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 text-xs"
                onClick={() => refetch()}
                disabled={isRefetching}
              >
                <RotateCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
                {m.refresh_tasks()}
              </Button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="mt-4 flex flex-wrap items-center gap-3 pt-4 border-t border-border/40">
            {/* Status Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-2 text-xs border-dashed">
                  <Filter className="h-3.5 w-3.5" />
                  {m.filter_by_status()}
                  {selectedStatuses.length > 0 && (
                    <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                      {selectedStatuses.length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="start">
                <div className="text-xs font-semibold text-muted-foreground px-2 py-1 mb-1">
                  {m.select_status()}
                </div>
                <div className="space-y-1">
                  {ALL_WORKFLOW_TASK_STATUSES.map((status) => (
                    <label
                      key={status}
                      className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded-md cursor-pointer text-xs"
                    >
                      <Checkbox
                        checked={selectedStatuses.includes(status)}
                        onCheckedChange={() => toggleStatus(status)}
                      />
                      <span className="font-mono">{status}</span>
                    </label>
                  ))}
                </div>
                {selectedStatuses.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2 h-7 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setSelectedStatuses([])}
                  >
                    {m.clear_status()}
                  </Button>
                )}
              </PopoverContent>
            </Popover>

            {/* Type Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-2 text-xs border-dashed">
                  <Filter className="h-3.5 w-3.5" />
                  {m.filter_by_type()}
                  {selectedTypes.length > 0 && (
                    <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                      {selectedTypes.length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                <div className="text-xs font-semibold text-muted-foreground px-2 py-1 mb-1">
                  {m.select_type()}
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                  {ALL_WORKFLOW_TASK_TYPES.map((type) => (
                    <label
                      key={type}
                      className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded-md cursor-pointer text-xs"
                    >
                      <Checkbox
                        checked={selectedTypes.includes(type)}
                        onCheckedChange={() => toggleType(type)}
                      />
                      <span className="font-mono truncate">{type}</span>
                    </label>
                  ))}
                </div>
                {selectedTypes.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2 h-7 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setSelectedTypes([])}
                  >
                    {m.clear_types()}
                  </Button>
                )}
              </PopoverContent>
            </Popover>

            {/* Clear All Filters */}
            {(selectedStatuses.length > 0 || selectedTypes.length > 0) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setSelectedStatuses([])
                  setSelectedTypes([])
                }}
              >
                {m.clear_all()}
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <div className="p-8 text-center text-sm text-destructive">
              {m.failed_to_load_workflow_tasks()}
            </div>
          ) : allTasks.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              {m.no_workflow_tasks()}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border/50">
                  <TableHead className="w-[170px] pl-6 text-xs font-semibold">
                    {m.task_type()}
                  </TableHead>
                  <TableHead className="w-[130px] px-4 text-xs font-semibold">
                    {m.task_status()}
                  </TableHead>
                  <TableHead className="min-w-[180px] px-4 text-xs font-semibold">
                    {m.file_name()}
                  </TableHead>
                  <TableHead className="w-[110px] px-4 text-xs font-semibold">{m.size()}</TableHead>
                  <TableHead className="w-[160px] px-4 text-xs font-semibold">
                    {m.project_name()}
                  </TableHead>
                  <TableHead className="w-[130px] px-4 text-right text-xs font-semibold">
                    {m.created_at()}
                  </TableHead>
                  <TableHead className="w-[120px] pr-6 text-right text-xs font-semibold">
                    {m.actions()}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allTasks.map((task) => {
                  const canStop = task.status === 'pending' || task.status === 'processing'

                  return (
                    <TableRow key={task.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="py-3 pl-6 font-medium">
                        {getTypeBadge(task.type)}
                      </TableCell>
                      <TableCell className="py-3 px-4 font-medium">
                        {getStatusBadge(task.status)}
                      </TableCell>
                      <TableCell className="py-3 px-4 text-xs font-medium">
                        <span
                          className="truncate block max-w-[220px]"
                          title={task.fileName || task.assetId || '-'}
                        >
                          {task.fileName || task.assetId || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 px-4 text-xs font-mono text-muted-foreground">
                        {task.fileSize !== null && task.fileSize !== undefined
                          ? formatSize(task.fileSize)
                          : '-'}
                      </TableCell>
                      <TableCell className="py-3 px-4 text-xs text-muted-foreground">
                        <span
                          className="truncate block max-w-[160px]"
                          title={task.projectName || task.projectId || '-'}
                        >
                          {task.projectName || task.projectId || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 px-4 text-right text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimeAgo(task.createdAt)}
                      </TableCell>
                      <TableCell className="py-3 pr-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => setDetailsTask(task)}
                            title={m.view_details()}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          {canStop && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                              onClick={() => setTaskToStop(task)}
                              disabled={stopTaskMutation.isPending}
                            >
                              <Square className="h-3 w-3 mr-1 fill-current" />
                              {m.stop_task()}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}

          {/* Infinite Scroll Sentinel */}
          <div ref={loadMoreRef} className="py-4 flex justify-center">
            {isFetchingNextPage && (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stop Task Confirmation Dialog */}
      <AlertDialog
        open={!!taskToStop}
        onOpenChange={(open) => {
          if (!open) setTaskToStop(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <AlertDialogTitle>{m.stop_task_confirm_title()}</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="pt-2 text-sm text-muted-foreground">
              {m.stop_task_confirm_description()}
            </AlertDialogDescription>
            {taskToStop && (
              <div className="mt-3 p-2.5 rounded-md bg-muted/50 border border-border/40 font-mono text-xs space-y-1">
                <div>
                  {m.task_id()}: {taskToStop.id}
                </div>
                {taskToStop.fileName && (
                  <div className="font-sans">
                    {m.file_name()}:{' '}
                    <span className="font-medium text-foreground">{taskToStop.fileName}</span>
                  </div>
                )}
                <div>
                  {m.task_type()}: {taskToStop.type || 'unknown'}
                </div>
                <div>
                  {m.task_status()}: {taskToStop.status}
                </div>
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={stopTaskMutation.isPending}>
              {m.cancel()}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              disabled={stopTaskMutation.isPending}
              onClick={() => {
                if (taskToStop) {
                  stopTaskMutation.mutate(taskToStop.id)
                }
              }}
            >
              {stopTaskMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  {m.stopping()}
                </>
              ) : (
                m.stop_task()
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Task Details Dialog */}
      <WorkflowTaskDetailsDialog
        task={detailsTask}
        open={!!detailsTask}
        onOpenChange={(open) => {
          if (!open) setDetailsTask(null)
        }}
      />
    </div>
  )
}
