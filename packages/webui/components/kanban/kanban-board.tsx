import { useState } from 'react'
import { DragDropProvider, KeyboardSensor, PointerSensor, type DragEndEvent } from '@dnd-kit/react'
import { PointerActivationConstraints } from '@dnd-kit/dom'
import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { toast } from 'sonner'
import { m } from '@/ui/paraglide/messages.js'
import {
  KanbanTaskStatus,
  KanbanTaskType,
  type KanbanTaskInfo,
  type ListKanbanTasksResponse,
} from '@shumai/dtos'
import { KANBAN_STATUS_COLUMNS } from './kanban-types'
import { KanbanColumn } from './kanban-column'
import { KanbanRequestChangesDialog } from './kanban-request-changes-dialog'

interface KanbanBoardProps {
  teamId: string
  selectedGoalId: string | null
  scope: 'team' | 'my'
  currentUserId?: string
  showCancelled: boolean
  onTaskClick: (task: KanbanTaskInfo) => void
  onCreateTaskInColumn: (status: KanbanTaskStatus) => void
}

export function KanbanBoard({
  teamId,
  selectedGoalId,
  scope,
  currentUserId,
  showCancelled,
  onTaskClick,
  onCreateTaskInColumn,
}: KanbanBoardProps) {
  const queryClient = useQueryClient()
  const [requestChangesTask, setRequestChangesTask] = useState<KanbanTaskInfo | null>(null)

  // Unified Update Mutation with Optimistic Updates
  const { mutate: updateTask } = useMutation({
    mutationFn: async ({
      taskId,
      status,
      reason,
    }: {
      taskId: string
      status: KanbanTaskStatus
      reason?: string
    }) => {
      const res = await client.api.teams[':teamId'].kanban.tasks[':taskId'].$patch({
        param: { teamId, taskId },
        json: { status, reason },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: m.error() }))
        throw new Error((err as { message?: string }).message || m.error())
      }
      return await res.json()
    },
    onMutate: async ({ taskId, status }) => {
      // Cancel any outgoing refetches so they don't overwrite optimistic update
      await queryClient.cancelQueries({ queryKey: ['teams', teamId, 'kanban', 'tasks'] })

      // Snapshot previous state
      const previousQueries = queryClient.getQueriesData({
        queryKey: ['teams', teamId, 'kanban', 'tasks'],
      })

      let movedTask: KanbanTaskInfo | null = null

      // Helper to check if a query is a Kanban column infinite query
      const isColumnQuery = (queryKey: readonly unknown[]) => {
        return (
          queryKey[0] === 'teams' &&
          queryKey[1] === teamId &&
          queryKey[2] === 'kanban' &&
          queryKey[3] === 'tasks' &&
          typeof queryKey[4] === 'object' &&
          queryKey[4] !== null &&
          'status' in queryKey[4]
        )
      }

      // 1. Remove task from current column in cache and save it
      queryClient.setQueriesData<InfiniteData<ListKanbanTasksResponse>>(
        {
          predicate: (query) => isColumnQuery(query.queryKey),
        },
        (oldData) => {
          if (!oldData || !Array.isArray(oldData.pages)) return oldData

          let found = false
          const newPages = oldData.pages.map((page) => {
            if (!page || !Array.isArray(page.data)) return page
            const task = page.data.find((t) => t.id === taskId)
            if (task) {
              movedTask = { ...task, status }
              found = true
              return {
                ...page,
                data: page.data.filter((t) => t.id !== taskId),
                pageInfo: {
                  ...page.pageInfo,
                  total: Math.max(0, (page.pageInfo?.total ?? page.data.length) - 1),
                },
              }
            }
            return page
          })

          return found ? { ...oldData, pages: newPages } : oldData
        },
      )

      // 2. Prepend task to destination column cache
      if (movedTask) {
        const taskToAdd = movedTask
        queryClient.setQueriesData<InfiniteData<ListKanbanTasksResponse>>(
          {
            predicate: (query) => {
              if (!isColumnQuery(query.queryKey)) return false
              const filter = query.queryKey[4] as { status?: KanbanTaskStatus } | undefined
              return filter?.status === status
            },
          },
          (oldData) => {
            if (!oldData || !Array.isArray(oldData.pages)) return oldData
            const firstPage = oldData.pages[0] || { data: [], pageInfo: { total: 0 } }
            const firstPageData = Array.isArray(firstPage.data) ? firstPage.data : []
            const updatedFirstPage = {
              ...firstPage,
              data: [taskToAdd, ...firstPageData.filter((t) => t.id !== taskId)],
              pageInfo: {
                ...firstPage.pageInfo,
                total: (firstPage.pageInfo?.total ?? firstPageData.length) + 1,
              },
            }
            return {
              ...oldData,
              pages: [updatedFirstPage, ...oldData.pages.slice(1)],
            }
          },
        )
      }

      return { previousQueries }
    },
    onError: (err, _variables, context) => {
      if (context?.previousQueries) {
        for (const [queryKey, data] of context.previousQueries) {
          queryClient.setQueryData(queryKey, data)
        }
      }
      toast.error(err.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'kanban', 'tasks'] })
    },
  })

  const handleDragEnd = (event: DragEndEvent) => {
    if (event.canceled) return
    const { source, target } = event.operation
    if (!source || !target) return

    const sourceData = source.data as { type?: string; task?: KanbanTaskInfo } | undefined
    const targetData = target.data as { type?: string; status?: KanbanTaskStatus } | undefined

    if (sourceData?.type !== 'kanban_task' || !sourceData.task) return
    if (targetData?.type !== 'kanban_column' || !targetData.status) return

    const task = sourceData.task
    const fromStatus = task.status
    const toStatus = targetData.status

    if (fromStatus === toStatus) return

    // Guard: Agentic task cannot be manually started
    if (task.type === KanbanTaskType.AGENTIC && toStatus === KanbanTaskStatus.IN_PROGRESS) {
      toast.info(m.cannot_move_agentic_task_manually())
      return
    }

    // If agentic task is in review and dragged to TODO or READY, open request changes dialog
    if (
      task.type === KanbanTaskType.AGENTIC &&
      fromStatus === KanbanTaskStatus.IN_REVIEW &&
      (toStatus === KanbanTaskStatus.READY || toStatus === KanbanTaskStatus.TODO)
    ) {
      setRequestChangesTask(task)
      return
    }

    // For all human tasks (and valid agentic transitions), update status via unified API
    updateTask({ taskId: task.id, status: toStatus })
  }

  const columnsToRender = showCancelled
    ? [...KANBAN_STATUS_COLUMNS, KanbanTaskStatus.CANCELLED]
    : KANBAN_STATUS_COLUMNS

  return (
    <DragDropProvider
      sensors={[
        PointerSensor.configure({
          activationConstraints: [new PointerActivationConstraints.Distance({ value: 8 })],
        }),
        KeyboardSensor,
      ]}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden p-4 bg-background/50">
        <div className="flex gap-4 h-full min-w-max pb-2">
          {columnsToRender.map((status) => (
            <KanbanColumn
              key={status}
              teamId={teamId}
              status={status}
              selectedGoalId={selectedGoalId}
              scope={scope}
              currentUserId={currentUserId}
              onTaskClick={onTaskClick}
              onCreateTaskInColumn={onCreateTaskInColumn}
            />
          ))}
        </div>
      </div>

      {/* Request Changes Feedback Dialog */}
      {requestChangesTask && (
        <KanbanRequestChangesDialog
          teamId={teamId}
          taskId={requestChangesTask.id}
          taskTitle={requestChangesTask.title}
          isOpen={!!requestChangesTask}
          onClose={() => setRequestChangesTask(null)}
        />
      )}
    </DragDropProvider>
  )
}
