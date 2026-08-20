import { useQuery } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/components/ui/dialog'
import { m } from '@/ui/paraglide/messages.js'
import { Loader2, Bot, User } from 'lucide-react'
import type { KanbanTaskDetail } from '@shumai/dtos'
import { TaskInfoForm } from './task-info-form'
import { TaskActivityPane } from './task-activity-pane'

interface EditTaskDialogProps {
  teamId: string
  taskId: string | null
  isOpen: boolean
  onClose: () => void
  canEdit?: boolean
}

export function EditTaskDialog({
  teamId,
  taskId,
  isOpen,
  onClose,
  canEdit = true,
}: EditTaskDialogProps) {
  const {
    data: task,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['teams', teamId, 'kanban', 'task', taskId],
    queryFn: async () => {
      if (!taskId) return null
      const res = await client.api.teams[':teamId'].kanban.tasks[':taskId'].$get({
        param: { teamId, taskId },
      })
      if (!res.ok) throw new Error('Failed to fetch task details')
      return (await res.json()) as KanbanTaskDetail
    },
    enabled: !!teamId && !!taskId && isOpen,
  })

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl w-[94vw] h-[86vh] p-0 gap-0 flex flex-col overflow-hidden bg-background">
        <DialogHeader className="px-5 py-3 border-b border-border/70 flex flex-row items-center justify-between space-y-0 shrink-0 bg-card/80">
          <div className="flex items-center gap-2 min-w-0 pr-4">
            {task?.type === 'AGENTIC' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 shrink-0">
                <Bot className="w-3.5 h-3.5" />
                <span>{m.task_type_agentic()}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-muted text-muted-foreground border border-border shrink-0">
                <User className="w-3.5 h-3.5" />
                <span>{m.task_type_manual()}</span>
              </span>
            )}

            <DialogTitle className="text-sm font-semibold truncate text-foreground">
              {task?.title || m.edit_task()}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* 2-Columns Body: Left 2/3, Right 1/3 */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center p-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : error || !task ? (
            <div className="flex-1 flex items-center justify-center p-12 text-xs text-muted-foreground">
              {m.file_not_found()}
            </div>
          ) : (
            <>
              {/* Left Column (2/3 width) */}
              <div className="flex-1 md:w-2/3 h-full overflow-hidden flex flex-col">
                <TaskInfoForm teamId={teamId} task={task} canEdit={canEdit} />
              </div>

              {/* Right Column (1/3 width) */}
              <div className="md:w-1/3 h-full overflow-hidden flex flex-col">
                <TaskActivityPane teamId={teamId} task={task} />
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
