import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/components/ui/dialog'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/components/ui/popover'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/components/ui/avatar'
import { m } from '@/ui/paraglide/messages.js'
import { KanbanTaskStatus, type KanbanTaskInfo } from '@shumai/dtos'
import {
  getStatusBadgeColor,
  getStatusLabel,
  getPriorityBadgeColor,
  getPriorityLabel,
} from './kanban-types'
import { EditTaskDialog } from './edit-task-dialog/edit-task-dialog'
import { SquareKanban, Plus, X, Search, Loader2, Bot } from 'lucide-react'
import { cn } from '@/ui/lib/utils'
import { toast } from 'sonner'

interface AssetLinkedTasksDialogProps {
  teamId: string
  assetId: string
  assetName?: string
  isOpen: boolean
  onClose: () => void
}

const SELECTABLE_STATUSES: KanbanTaskStatus[] = [
  KanbanTaskStatus.TODO,
  KanbanTaskStatus.READY,
  KanbanTaskStatus.IN_PROGRESS,
  KanbanTaskStatus.IN_REVIEW,
  KanbanTaskStatus.DONE,
  KanbanTaskStatus.BLOCKED,
]

export function AssetLinkedTasksDialog({
  teamId,
  assetId,
  assetName,
  isOpen,
  onClose,
}: AssetLinkedTasksDialogProps) {
  const queryClient = useQueryClient()
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [isLinkSelectorOpen, setIsLinkSelectorOpen] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<KanbanTaskStatus>(KanbanTaskStatus.TODO)
  const [searchQuery, setSearchQuery] = useState('')

  // 1. Fetch tasks currently linked to this asset
  const { data: linkedTasksData, isLoading: isLoadingLinked } = useQuery({
    queryKey: ['teams', teamId, 'kanban', 'assets', assetId, 'tasks'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].kanban.assets[':assetId'].tasks.$get({
        param: { teamId, assetId },
      })
      if (!res.ok) throw new Error('Failed to fetch linked tasks')
      return (await res.json()) as { data: KanbanTaskInfo[]; total: number }
    },
    enabled: !!teamId && !!assetId && isOpen,
  })

  const linkedTasks = linkedTasksData?.data || []
  const linkedTaskIds = useMemo(() => new Set(linkedTasks.map((t) => t.id)), [linkedTasks])

  // 2. Fetch tasks for link picker
  const { data: statusTasksData, isLoading: isLoadingStatusTasks } = useQuery({
    queryKey: ['teams', teamId, 'kanban', 'tasks', 'status', selectedStatus],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].kanban.tasks.$get({
        param: { teamId },
        query: { status: selectedStatus, first: '100' },
      })
      if (!res.ok) return { data: [] }
      return (await res.json()) as { data: KanbanTaskInfo[] }
    },
    enabled: !!teamId && isLinkSelectorOpen && isOpen,
  })

  const availableTasks = statusTasksData?.data || []
  const filteredAvailableTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return availableTasks.filter((t) => {
      if (linkedTaskIds.has(t.id)) return false
      if (!query) return true
      return t.title.toLowerCase().includes(query)
    })
  }, [availableTasks, linkedTaskIds, searchQuery])

  // 3. Mutations
  const linkTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await client.api.teams[':teamId'].kanban.assets[':assetId'].tasks.$post({
        param: { teamId, assetId },
        json: { taskId },
      })
      if (!res.ok) throw new Error('Failed to link task')
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['teams', teamId, 'kanban', 'assets', assetId, 'tasks'],
      })
      queryClient.invalidateQueries({
        queryKey: ['teams', teamId, 'kanban'],
      })
      toast.success(m.asset_linked())
    },
  })

  const unlinkTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await client.api.teams[':teamId'].kanban.assets[':assetId'].tasks[
        ':taskId'
      ].$delete({
        param: { teamId, assetId, taskId },
      })
      if (!res.ok) throw new Error('Failed to unlink task')
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['teams', teamId, 'kanban', 'assets', assetId, 'tasks'],
      })
      queryClient.invalidateQueries({
        queryKey: ['teams', teamId, 'kanban'],
      })
      toast.success(m.asset_unlinked())
    },
  })

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-2xl flex flex-col h-[520px] p-0 overflow-hidden">
          {/* Header */}
          <DialogHeader className="p-4 border-b flex flex-row items-center justify-between space-y-0 shrink-0">
            <div className="flex items-center gap-2 min-w-0 pr-4">
              <SquareKanban className="w-5 h-5 text-primary shrink-0" />
              <div className="min-w-0">
                <DialogTitle className="text-sm font-semibold truncate">
                  {m.linked_tasks()}
                </DialogTitle>
                {assetName && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{assetName}</p>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Linked Tasks List */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-background">
            <ScrollArea className="flex-1 min-h-0 p-4 [&>div>div]:block!">
              {isLoadingLinked ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : linkedTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-xs text-muted-foreground gap-2">
                  <SquareKanban className="w-8 h-8 opacity-30" />
                  <p>{m.no_linked_tasks()}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {linkedTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => setEditingTaskId(task.id)}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/50 cursor-pointer transition-all hover:border-border"
                    >
                      {/* Left: Status, Priority, Title */}
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {task.isAgentTask && (
                          <span className="p-1 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400 shrink-0">
                            <Bot className="w-3.5 h-3.5" />
                          </span>
                        )}
                        <span
                          className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded border uppercase font-medium shrink-0',
                            getStatusBadgeColor(task.status),
                          )}
                        >
                          {getStatusLabel(task.status)}
                        </span>
                        <span
                          className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded border uppercase font-medium shrink-0',
                            getPriorityBadgeColor(task.priority),
                          )}
                        >
                          {getPriorityLabel(task.priority)}
                        </span>
                        <span className="text-xs font-medium text-foreground truncate flex-1">
                          {task.title}
                        </span>
                      </div>

                      {/* Right: Assignee & Unlink Button */}
                      <div className="flex items-center gap-2 shrink-0">
                        {task.assignee && (
                          <div
                            className="flex items-center gap-1 text-[11px] text-muted-foreground"
                            title={task.assignee.name}
                          >
                            <Avatar className="w-4 h-4 text-[9px]">
                              <AvatarImage src={task.assignee.image || undefined} />
                              <AvatarFallback>
                                {task.assignee.name.slice(0, 1).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="hidden sm:inline text-[11px] max-w-[70px] truncate">
                              {task.assignee.name}
                            </span>
                          </div>
                        )}

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation()
                            unlinkTaskMutation.mutate(task.id)
                          }}
                          title={m.unlink_task()}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Bottom Action: Link to Task Popover */}
          <div className="p-3 px-4 border-t bg-muted/10 flex items-center justify-between shrink-0">
            <Popover open={isLinkSelectorOpen} onOpenChange={setIsLinkSelectorOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                  <Plus className="w-3.5 h-3.5" />
                  <span>{m.link_to_task()}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 sm:w-96 p-0" align="start">
                {/* Search Bar */}
                <div className="p-2 border-b">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                    <Input
                      placeholder={m.search_tasks()}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 h-8 text-xs bg-muted/30"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Status Tabs */}
                <div className="flex border-b overflow-x-auto p-1 gap-1 bg-muted/20">
                  {SELECTABLE_STATUSES.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setSelectedStatus(status)}
                      className={cn(
                        'px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap',
                        selectedStatus === status
                          ? 'bg-background shadow-xs text-foreground font-semibold'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                      )}
                    >
                      {getStatusLabel(status)}
                    </button>
                  ))}
                </div>

                {/* Task List */}
                <ScrollArea className="h-56">
                  {isLoadingStatusTasks ? (
                    <div className="flex items-center justify-center p-6 text-xs text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                      <span>{m.loading()}</span>
                    </div>
                  ) : filteredAvailableTasks.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      {m.no_matching_tasks()}
                    </div>
                  ) : (
                    <div className="p-1 space-y-0.5">
                      {filteredAvailableTasks.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            linkTaskMutation.mutate(t.id)
                            setIsLinkSelectorOpen(false)
                          }}
                          className="w-full text-left p-2 rounded hover:bg-muted/60 transition-colors flex items-center justify-between gap-2 text-xs group"
                        >
                          <span className="truncate flex-1 font-medium text-foreground">
                            {t.title}
                          </span>
                          <span
                            className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded border uppercase shrink-0',
                              getStatusBadgeColor(t.status),
                            )}
                          >
                            {getStatusLabel(t.status)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>

            <Button variant="ghost" size="sm" onClick={onClose} className="text-xs h-8">
              {m.close()}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Edit Dialog when a linked task is clicked */}
      {editingTaskId && (
        <EditTaskDialog
          teamId={teamId}
          taskId={editingTaskId}
          isOpen={true}
          onClose={() => setEditingTaskId(null)}
        />
      )}
    </>
  )
}
