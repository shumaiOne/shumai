import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { m } from '@/ui/paraglide/messages.js'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/components/ui/dialog'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import { toast } from 'sonner'
import { Link2, Plus, Trash2, Search, Loader2, ArrowRight } from 'lucide-react'
import type { KanbanTaskSummary, KanbanTaskInfo } from '@shumai/dtos'
import { getStatusLabel } from '../kanban-types'

interface TaskDependencyManagerProps {
  teamId: string
  taskId: string
  dependencies: KanbanTaskSummary[]
  dependents: KanbanTaskSummary[]
  canEdit?: boolean
}

export function TaskDependencyManager({
  teamId,
  taskId,
  dependencies,
  dependents,
  canEdit = true,
}: TaskDependencyManagerProps) {
  const queryClient = useQueryClient()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Query all team tasks for linking
  const { data: teamTasksData, isLoading: isLoadingTasks } = useQuery({
    queryKey: ['teams', teamId, 'kanban', 'tasks', 'all'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].kanban.tasks.$get({
        param: { teamId },
        query: { first: '100' },
      })
      if (!res.ok) throw new Error('Failed to fetch team tasks')
      return (await res.json()) as { data: KanbanTaskInfo[] }
    },
    enabled: isAddOpen,
  })

  // Add dependency mutation
  const { mutate: addDependency, isPending: isAdding } = useMutation({
    mutationFn: async (parentId: string) => {
      const res = await client.api.teams[':teamId'].kanban.tasks[':taskId'].dependencies.$post({
        param: { teamId, taskId },
        json: { parentId },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: m.error() }))
        throw new Error((err as { message?: string }).message || m.error())
      }
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'kanban', 'task', taskId] })
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'kanban', 'tasks'] })
      toast.success(m.dependency_added())
      setIsAddOpen(false)
      setSearchQuery('')
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })

  // Remove dependency mutation
  const { mutate: removeDependency, isPending: isRemoving } = useMutation({
    mutationFn: async (parentId: string) => {
      const res = await client.api.teams[':teamId'].kanban.tasks[':taskId'].dependencies[
        ':parentId'
      ].$delete({
        param: { teamId, taskId, parentId },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: m.error() }))
        throw new Error((err as { message?: string }).message || m.error())
      }
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'kanban', 'task', taskId] })
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'kanban', 'tasks'] })
      toast.success(m.dependency_removed())
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })

  const existingParentIds = new Set(dependencies.map((d) => d.id))
  const existingChildIds = new Set(dependents.map((d) => d.id))

  const availableTasks = (teamTasksData?.data || []).filter(
    (t) =>
      t.id !== taskId &&
      !existingParentIds.has(t.id) &&
      !existingChildIds.has(t.id) &&
      (!searchQuery.trim() || t.title.toLowerCase().includes(searchQuery.toLowerCase())),
  )

  return (
    <div className="space-y-4">
      {/* Prerequisites (Blocked By) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/90">
            <Link2 className="w-3.5 h-3.5 text-primary" />
            <span>{m.blocked_by()}</span>
            <span className="text-[11px] font-mono text-muted-foreground">
              ({dependencies.length})
            </span>
          </div>
          {canEdit && (
            <Button
              variant="outline"
              size="xs"
              onClick={() => setIsAddOpen(true)}
              className="h-6 px-2 text-[11px] gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>{m.add_dependency()}</span>
            </Button>
          )}
        </div>

        {dependencies.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 italic">{m.no_dependencies()}</p>
        ) : (
          <div className="space-y-1.5">
            {dependencies.map((dep) => (
              <div
                key={dep.id}
                className="flex items-center justify-between p-2 rounded-md bg-muted/40 border border-border/60 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium border uppercase bg-background shrink-0">
                    {getStatusLabel(dep.status)}
                  </span>
                  <span className="truncate font-medium text-foreground">{dep.title}</span>
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removeDependency(dep.id)}
                    disabled={isRemoving}
                    className="h-5 w-5 text-muted-foreground hover:text-destructive shrink-0 ml-2"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dependents (Blocking) */}
      <div className="space-y-2 pt-2 border-t border-border/50">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/90">
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
          <span>{m.blocking()}</span>
          <span className="text-[11px] font-mono text-muted-foreground">({dependents.length})</span>
        </div>

        {dependents.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 italic">{m.no_dependencies()}</p>
        ) : (
          <div className="space-y-1.5">
            {dependents.map((dep) => (
              <div
                key={dep.id}
                className="flex items-center justify-between p-2 rounded-md bg-muted/40 border border-border/60 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium border uppercase bg-background shrink-0">
                    {getStatusLabel(dep.status)}
                  </span>
                  <span className="truncate font-medium text-foreground">{dep.title}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Dependency Search Dialog */}
      <Dialog open={isAddOpen} onOpenChange={(open) => !open && setIsAddOpen(false)}>
        <DialogContent className="sm:max-w-[460px] flex flex-col h-[480px]">
          <DialogHeader>
            <DialogTitle>{m.add_dependency()}</DialogTitle>
          </DialogHeader>

          <div className="relative my-2">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={m.search_tasks_to_link()}
              className="h-9 pl-8 text-xs"
              autoFocus
            />
          </div>

          <div className="flex-1 border rounded-md overflow-hidden bg-sidebar/30">
            <ScrollArea className="h-full p-2">
              <div className="space-y-1.5">
                {isLoadingTasks ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : availableTasks.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    {m.no_matching_tasks()}
                  </div>
                ) : (
                  availableTasks.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => addDependency(t.id)}
                      className="flex items-center justify-between p-2.5 rounded-md hover:bg-sidebar-accent cursor-pointer transition-colors border border-transparent hover:border-sidebar-border group"
                    >
                      <div className="flex flex-col min-w-0 flex-1 pr-2">
                        <span className="text-xs font-semibold truncate text-foreground group-hover:text-sidebar-accent-foreground">
                          {t.title}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">
                            {getStatusLabel(t.status)}
                          </span>
                          {t.assignee && (
                            <span className="text-[10px] text-muted-foreground truncate">
                              • {t.assignee.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        size="xs"
                        variant="secondary"
                        disabled={isAdding}
                        className="h-6 px-2 text-[10px] shrink-0"
                      >
                        {m.add()}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
