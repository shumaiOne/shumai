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
      beforeIndex,
      afterIndex,
    }: {
      taskId: string
      status: KanbanTaskStatus
      reason?: string
      beforeIndex?: string
      afterIndex?: string
      targetTaskId?: string
      position?: 'before' | 'after'
    }) => {
      const res = await client.api.teams[':teamId'].kanban.tasks[':taskId'].$patch({
        param: { teamId, taskId },
        json: { status, reason, beforeIndex, afterIndex },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: m.error() }))
        throw new Error((err as { message?: string }).message || m.error())
      }
      return await res.json()
    },
    onMutate: async ({ taskId, status, targetTaskId, position }) => {
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

      // 2. Insert task into destination column cache at target position
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

            const allItems = oldData.pages
              .flatMap((page) => page?.data ?? [])
              .filter((t) => t.id !== taskId)

            let insertIndex = allItems.length
            if (targetTaskId) {
              const idx = allItems.findIndex((t) => t.id === targetTaskId)
              if (idx !== -1) {
                insertIndex = position === 'before' ? idx : idx + 1
              }
            }

            allItems.splice(insertIndex, 0, taskToAdd)

            let pointer = 0
            const newPages = oldData.pages.map((page, pageIdx) => {
              const pageSize = page?.data ? page.data.length : 0
              const takeSize =
                pageIdx === 0 && pageSize === 0
                  ? 1
                  : pageIdx === oldData.pages.length - 1
                    ? allItems.length - pointer
                    : pageSize
              const pageData = allItems.slice(pointer, pointer + takeSize)
              pointer += takeSize
              return {
                ...page,
                data: pageData,
                pageInfo: {
                  ...page?.pageInfo,
                  total: (page?.pageInfo?.total ?? 0) + 1,
                },
              }
            })

            if (pointer < allItems.length && newPages.length > 0) {
              const lastPageIndex = newPages.length - 1
              newPages[lastPageIndex] = {
                ...newPages[lastPageIndex],
                data: [...(newPages[lastPageIndex]?.data ?? []), ...allItems.slice(pointer)],
              }
            }

            return {
              ...oldData,
              pages: newPages,
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
    if (sourceData?.type !== 'kanban_task' || !sourceData.task) return
    const task = sourceData.task

    const targetData = target.data as
      | { type?: 'reorder'; task?: KanbanTaskInfo; position?: 'before' | 'after' }
      | { type?: 'kanban_column'; status?: KanbanTaskStatus }
      | undefined

    if (!targetData) return

    if (targetData.type === 'reorder' && targetData.task && targetData.position) {
      const targetTask = targetData.task
      const toStatus = targetTask.status

      if (task.id === targetTask.id) return

      // Guard: Agentic task cannot be manually started
      if (task.type === KanbanTaskType.AGENTIC && toStatus === KanbanTaskStatus.IN_PROGRESS) {
        toast.info(m.cannot_move_agentic_task_manually())
        return
      }

      // If agentic task is in review and dragged to TODO or READY, open request changes dialog
      if (
        task.type === KanbanTaskType.AGENTIC &&
        task.status === KanbanTaskStatus.IN_REVIEW &&
        (toStatus === KanbanTaskStatus.READY || toStatus === KanbanTaskStatus.TODO)
      ) {
        setRequestChangesTask(task)
        return
      }

      const beforeIndex =
        targetData.position === 'before' ? (targetTask.sortIndex ?? undefined) : undefined
      const afterIndex =
        targetData.position === 'after' ? (targetTask.sortIndex ?? undefined) : undefined

      updateTask({
        taskId: task.id,
        status: toStatus,
        beforeIndex,
        afterIndex,
        targetTaskId: targetTask.id,
        position: targetData.position,
      })
      return
    }

    if (targetData.type === 'kanban_column' && targetData.status) {
      const toStatus = targetData.status
      if (task.status === toStatus) return

      // Guard: Agentic task cannot be manually started
      if (task.type === KanbanTaskType.AGENTIC && toStatus === KanbanTaskStatus.IN_PROGRESS) {
        toast.info(m.cannot_move_agentic_task_manually())
        return
      }

      // If agentic task is in review and dragged to TODO or READY, open request changes dialog
      if (
        task.type === KanbanTaskType.AGENTIC &&
        task.status === KanbanTaskStatus.IN_REVIEW &&
        (toStatus === KanbanTaskStatus.READY || toStatus === KanbanTaskStatus.TODO)
      ) {
        setRequestChangesTask(task)
        return
      }

      updateTask({ taskId: task.id, status: toStatus })
    }
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
