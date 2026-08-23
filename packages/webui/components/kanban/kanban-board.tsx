import { useState } from 'react'
import { DragDropProvider, KeyboardSensor, PointerSensor, type DragEndEvent } from '@dnd-kit/react'
import { PointerActivationConstraints } from '@dnd-kit/dom'
import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { toast } from 'sonner'
import { m } from '@/ui/paraglide/messages.js'
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
import { Loader2 } from 'lucide-react'
import { KanbanTaskStatus, type KanbanTaskInfo, type ListKanbanTasksResponse } from '@shumai/dtos'
import { KANBAN_STATUS_COLUMNS } from './kanban-types'
import { KanbanColumn } from './kanban-column'

interface KanbanBoardProps {
  teamId: string
  selectedGoalId: string | null
  scope: 'team' | 'my'
  currentUserId?: string
  currentUserRole?: string
  onTaskClick: (task: KanbanTaskInfo) => void
  onCreateTaskInColumn: (status: KanbanTaskStatus) => void
}

export function KanbanBoard({
  teamId,
  selectedGoalId,
  scope,
  currentUserId,
  currentUserRole,
  onTaskClick,
  onCreateTaskInColumn,
}: KanbanBoardProps) {
  const queryClient = useQueryClient()
  const [taskToDelete, setTaskToDelete] = useState<KanbanTaskInfo | null>(null)

  const { mutate: deleteTask, isPending: isDeleting } = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await client.api.teams[':teamId'].kanban.tasks[':taskId'].$delete({
        param: { teamId, taskId },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: m.error() }))
        throw new Error((err as { message?: string }).message || m.error())
      }
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'kanban', 'tasks'] })
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'kanban', 'goals'] })
      toast.success(m.task_deleted())
      setTaskToDelete(null)
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })

  // Unified Update Mutation with Optimistic Updates
  const { mutate: updateTask } = useMutation({
    mutationFn: async ({
      taskId,
      fromStatus,
      status,
      reason,
      beforeIndex,
      afterIndex,
    }: {
      taskId: string
      fromStatus?: KanbanTaskStatus
      status: KanbanTaskStatus
      reason?: string
      beforeIndex?: string
      afterIndex?: string
      targetTaskId?: string
      position?: 'before' | 'after'
    }) => {
      const res = await client.api.teams[':teamId'].kanban.tasks[':taskId'].$patch({
        param: { teamId, taskId },
        json: { fromStatus, status, reason, beforeIndex, afterIndex },
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

    // Check status change permission
    const isOwner = currentUserRole?.toLowerCase() === 'owner'
    const isEditor = currentUserRole?.toLowerCase() === 'editor'
    const isReporter = task.reporter?.id === currentUserId || task.creator?.id === currentUserId
    const isAssignee = task.assignee?.id === currentUserId
    if (!isOwner && !isEditor && !isReporter && !isAssignee) {
      toast.error(m.cannot_change_task_status_permission())
      return
    }

    const targetData = target.data as
      | { type?: 'reorder'; task?: KanbanTaskInfo; position?: 'before' | 'after' }
      | { type?: 'kanban_column'; status?: KanbanTaskStatus; lastTask?: KanbanTaskInfo }
      | undefined

    if (!targetData) return

    if (targetData.type === 'reorder' && targetData.task && targetData.position) {
      const targetTask = targetData.task
      const toStatus = targetTask.status

      if (task.id === targetTask.id) return

      const beforeIndex =
        targetData.position === 'before' ? (targetTask.sortIndex ?? undefined) : undefined
      const afterIndex =
        targetData.position === 'after' ? (targetTask.sortIndex ?? undefined) : undefined

      updateTask({
        taskId: task.id,
        fromStatus: task.status,
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
      const lastTask = targetData.lastTask

      if (lastTask) {
        if (task.id === lastTask.id) {
          if (task.status === toStatus) return
          updateTask({ taskId: task.id, fromStatus: task.status, status: toStatus })
          return
        }

        updateTask({
          taskId: task.id,
          fromStatus: task.status,
          status: toStatus,
          afterIndex: lastTask.sortIndex ?? undefined,
          targetTaskId: lastTask.id,
          position: 'after',
        })
        return
      }

      if (task.status === toStatus) return

      updateTask({ taskId: task.id, fromStatus: task.status, status: toStatus })
    }
  }

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
          {KANBAN_STATUS_COLUMNS.map((status) => (
            <KanbanColumn
              key={status}
              teamId={teamId}
              status={status}
              selectedGoalId={selectedGoalId}
              scope={scope}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              onTaskClick={onTaskClick}
              onDeleteTask={(task) => setTaskToDelete(task)}
              onCreateTaskInColumn={onCreateTaskInColumn}
            />
          ))}
        </div>
      </div>

      {/* Delete Task Confirmation */}
      {taskToDelete && (
        <AlertDialog open={!!taskToDelete} onOpenChange={(open) => !open && setTaskToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{m.delete_task()}</AlertDialogTitle>
              <AlertDialogDescription>
                {m.delete_task_confirm({ title: taskToDelete.title })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>{m.cancel()}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteTask(taskToDelete.id)}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                {m.delete()}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </DragDropProvider>
  )
}
