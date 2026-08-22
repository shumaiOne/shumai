import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { cn } from '@/ui/lib/utils'
import { m } from '@/ui/paraglide/messages.js'
import { Button } from '@/ui/components/ui/button'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/components/ui/dropdown-menu'
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
import {
  Target,
  Plus,
  MoreHorizontal,
  Edit2,
  Trash2,
  ListTodo,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { type KanbanGoalInfo, UNASSIGNED_GOAL_ID } from '@shumai/dtos'
import { KanbanCreateGoalDialog } from './kanban-create-goal-dialog'

interface KanbanGoalSidebarProps {
  teamId: string
  selectedGoalId: string | null
  onSelectGoal: (goalId: string | null) => void
  isOwnerOrEditor?: boolean
}

export function KanbanGoalSidebar({
  teamId,
  selectedGoalId,
  onSelectGoal,
  isOwnerOrEditor = true,
}: KanbanGoalSidebarProps) {
  const queryClient = useQueryClient()
  const [isCreateGoalOpen, setIsCreateGoalOpen] = useState(false)
  const [goalToEdit, setGoalToEdit] = useState<KanbanGoalInfo | null>(null)
  const [goalToDelete, setGoalToDelete] = useState<KanbanGoalInfo | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)

  const { data: goalsData, isLoading } = useQuery({
    queryKey: ['teams', teamId, 'kanban', 'goals'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].kanban.goals.$get({
        param: { teamId },
        query: {},
      })
      if (!res.ok) throw new Error('Failed to fetch goals')
      return (await res.json()) as { data: KanbanGoalInfo[] }
    },
    enabled: !!teamId,
  })

  const goals = goalsData?.data || []
  const totalGoalTasks = goals.reduce((acc, g) => acc + (g.taskCount || 0), 0)

  const { mutate: deleteGoal, isPending: isDeleting } = useMutation({
    mutationFn: async (goalId: string) => {
      const res = await client.api.teams[':teamId'].kanban.goals[':goalId'].$delete({
        param: { teamId, goalId },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: m.error() }))
        throw new Error((err as { message?: string }).message || m.error())
      }
      return await res.json()
    },
    onSuccess: (_, deletedGoalId) => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'kanban', 'goals'] })
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'kanban', 'tasks'] })
      toast.success(m.goal_deleted())
      if (selectedGoalId === deletedGoalId) {
        onSelectGoal(null)
      }
      setGoalToDelete(null)
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })

  if (isCollapsed) {
    return (
      <div className="border-r border-sidebar-border bg-sidebar flex flex-col items-center w-12 shrink-0 transition-all duration-300">
        <div className="h-14 flex items-center justify-center border-b border-sidebar-border w-full shrink-0">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsCollapsed(false)}
            title={m.goals()}
            className="text-sidebar-foreground/70 hover:text-sidebar-foreground"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="mt-3 flex flex-col items-center gap-2">
          <Button
            variant={selectedGoalId === null ? 'secondary' : 'ghost'}
            size="icon-sm"
            onClick={() => onSelectGoal(null)}
            title={m.all_tasks()}
            className={cn(
              'w-8 h-8 rounded-md',
              selectedGoalId === null && 'bg-sidebar-accent text-sidebar-accent-foreground',
            )}
          >
            <ListTodo className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsCreateGoalOpen(true)}
            title={m.new_goal()}
            className="w-8 h-8 rounded-md text-sidebar-foreground/70 hover:text-sidebar-foreground"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {isCreateGoalOpen && (
          <KanbanCreateGoalDialog
            teamId={teamId}
            isOpen={isCreateGoalOpen}
            onClose={() => setIsCreateGoalOpen(false)}
          />
        )}
      </div>
    )
  }

  return (
    <aside className="w-64 border-r border-sidebar-border bg-sidebar flex flex-col shrink-0 transition-all duration-300 select-none">
      {/* Sidebar Header */}
      <div className="h-14 px-3 flex items-center justify-between border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-2 font-semibold text-xs tracking-wider uppercase text-sidebar-foreground/70">
          <Target className="w-4 h-4 text-sidebar-primary" />
          <span>{m.goals()}</span>
        </div>

        <div className="flex items-center gap-1">
          {isOwnerOrEditor && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setIsCreateGoalOpen(true)}
              className="h-7 w-7 text-sidebar-foreground/70 hover:text-sidebar-foreground"
              title={m.new_goal()}
            >
              <Plus className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsCollapsed(true)}
            className="h-7 w-7 text-sidebar-foreground/70 hover:text-sidebar-foreground"
            title="Collapse"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Goals List */}
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-1">
          {/* All Tasks Item */}
          <div
            onClick={() => onSelectGoal(null)}
            className={cn(
              'flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors group h-8 min-h-[32px]',
              selectedGoalId === null
                ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
            )}
          >
            <div className="flex items-center gap-2 truncate min-w-0">
              <ListTodo className="w-3.5 h-3.5 shrink-0 text-sidebar-primary" />
              <span className="truncate">{m.all_tasks()}</span>
            </div>
            {totalGoalTasks > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-sidebar-border text-sidebar-foreground/60 shrink-0">
                {totalGoalTasks}
              </span>
            )}
          </div>

          {/* Goal Items */}
          {isLoading ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : goals.length === 0 ? (
            <div className="px-2.5 py-4 text-center text-xs text-muted-foreground">
              {m.no_goals_yet()}
            </div>
          ) : (
            goals.map((goal) => {
              const isSelected = selectedGoalId === goal.id
              const isUnassigned = goal.id === UNASSIGNED_GOAL_ID
              const title = isUnassigned ? m.unassigned() : goal.title
              const hasActions = isOwnerOrEditor && !isUnassigned
              return (
                <div
                  key={goal.id}
                  onClick={() => onSelectGoal(goal.id)}
                  className={cn(
                    'flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors group relative h-8 min-h-[32px]',
                    isSelected
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                  )}
                >
                  <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                    <Target
                      className={cn(
                        'w-3.5 h-3.5 shrink-0',
                        isSelected ? 'text-sidebar-primary' : 'text-muted-foreground',
                      )}
                    />
                    <span className="truncate" title={title}>
                      {title}
                    </span>
                  </div>

                  <div className="flex items-center shrink-0 ml-1">
                    {hasActions ? (
                      <>
                        {(goal.taskCount ?? 0) > 0 && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-sidebar-border text-sidebar-foreground/60 group-hover:hidden group-focus-within:hidden [&:has(~_div_[data-state=open])]:hidden">
                            {goal.taskCount}
                          </span>
                        )}

                        <div
                          className="hidden group-hover:flex group-focus-within:flex [&:has([data-state=open])]:flex items-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                              >
                                <MoreHorizontal className="w-3.5 h-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36">
                              <DropdownMenuItem
                                onClick={() => {
                                  setGoalToEdit(goal)
                                }}
                              >
                                <Edit2 className="w-3.5 h-3.5 mr-2" />
                                {m.edit()}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                onClick={() => {
                                  setGoalToDelete(goal)
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-2" />
                                {m.delete()}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </>
                    ) : (
                      (goal.taskCount ?? 0) > 0 && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-sidebar-border text-sidebar-foreground/60">
                          {goal.taskCount}
                        </span>
                      )
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>

      {/* Create / Edit Goal Dialog */}
      {(isCreateGoalOpen || goalToEdit) && (
        <KanbanCreateGoalDialog
          teamId={teamId}
          isOpen={isCreateGoalOpen || !!goalToEdit}
          goalToEdit={goalToEdit}
          onClose={() => {
            setIsCreateGoalOpen(false)
            setGoalToEdit(null)
          }}
        />
      )}

      {/* Delete Goal Confirmation */}
      {goalToDelete && (
        <AlertDialog open={!!goalToDelete} onOpenChange={(open) => !open && setGoalToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{m.delete_goal()}</AlertDialogTitle>
              <AlertDialogDescription>
                {m.delete_goal_confirm({ title: goalToDelete.title })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>{m.cancel()}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteGoal(goalToDelete.id)}
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
    </aside>
  )
}
