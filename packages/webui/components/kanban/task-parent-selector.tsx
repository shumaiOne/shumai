import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { m } from '@/ui/paraglide/messages.js'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/components/ui/popover'
import { Input } from '@/ui/components/ui/input'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import { KanbanTaskStatus, type KanbanTaskInfo, type KanbanTaskSummary } from '@shumai/dtos'
import { getStatusBadgeColor, getStatusLabel } from './kanban-types'
import { Link2, Search, X, Check, Loader2 } from 'lucide-react'
import { cn } from '@/ui/lib/utils'

interface TaskParentSelectorProps {
  teamId: string
  currentTaskId?: string
  excludeTaskIds?: string[]
  value?: string[]
  knownTasks?: Array<KanbanTaskSummary | KanbanTaskInfo>
  onChange?: (parentIds: string[]) => void
  disabled?: boolean
  canEdit?: boolean
  className?: string
}

const SELECTABLE_STATUSES: KanbanTaskStatus[] = [
  KanbanTaskStatus.TODO,
  KanbanTaskStatus.READY,
  KanbanTaskStatus.IN_PROGRESS,
  KanbanTaskStatus.IN_REVIEW,
  KanbanTaskStatus.DONE,
  KanbanTaskStatus.BLOCKED,
]

export function TaskParentSelector({
  teamId,
  currentTaskId,
  excludeTaskIds = [],
  value = [],
  knownTasks = [],
  onChange,
  disabled = false,
  canEdit = true,
  className,
}: TaskParentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<KanbanTaskStatus>(KanbanTaskStatus.TODO)
  const [searchQuery, setSearchQuery] = useState('')

  // Map of known tasks for label rendering of selected items
  const [taskMetadataCache, setTaskMetadataCache] = useState<
    Record<string, { title: string; status: KanbanTaskStatus }>
  >(() => {
    const initial: Record<string, { title: string; status: KanbanTaskStatus }> = {}
    for (const t of knownTasks) {
      initial[t.id] = { title: t.title, status: t.status }
    }
    return initial
  })

  // Query 100 tasks of the currently selected status
  const { data: statusTasksData, isLoading } = useQuery({
    queryKey: ['teams', teamId, 'kanban', 'tasks', 'status', selectedStatus],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].kanban.tasks.$get({
        param: { teamId },
        query: { status: selectedStatus, first: '100' },
      })
      if (!res.ok) return { data: [] }
      return (await res.json()) as { data: KanbanTaskInfo[] }
    },
    enabled: !!teamId && isOpen,
  })

  // Update metadata cache when tasks arrive
  const fetchedTasks = statusTasksData?.data || []
  useMemo(() => {
    if (fetchedTasks.length > 0) {
      setTaskMetadataCache((prev) => {
        let changed = false
        const next = { ...prev }
        for (const t of fetchedTasks) {
          if (!next[t.id] || next[t.id].title !== t.title || next[t.id].status !== t.status) {
            next[t.id] = { title: t.title, status: t.status }
            changed = true
          }
        }
        return changed ? next : prev
      })
    }
  }, [fetchedTasks])

  const excludeSet = useMemo(() => {
    const set = new Set(excludeTaskIds)
    if (currentTaskId) set.add(currentTaskId)
    return set
  }, [currentTaskId, excludeTaskIds])

  // Filter tasks in current status tab by search query and exclusions
  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return fetchedTasks.filter((t) => {
      if (excludeSet.has(t.id)) return false
      if (!query) return true
      return t.title.toLowerCase().includes(query)
    })
  }, [fetchedTasks, excludeSet, searchQuery])

  const handleToggle = (taskId: string) => {
    if (!canEdit || disabled) return
    const isSelected = value.includes(taskId)
    const nextValue = isSelected ? value.filter((id) => id !== taskId) : [...value, taskId]
    onChange?.(nextValue)
  }

  const handleRemove = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!canEdit || disabled) return
    onChange?.(value.filter((id) => id !== taskId))
  }

  const isInteractive = canEdit && !disabled

  return (
    <Popover
      open={isOpen && isInteractive}
      onOpenChange={(open) => isInteractive && setIsOpen(open)}
    >
      <PopoverTrigger asChild>
        <div
          role="button"
          tabIndex={isInteractive ? 0 : -1}
          className={cn(
            'w-full min-h-[36px] px-2.5 py-1.5 flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background text-xs transition-colors',
            isInteractive
              ? 'cursor-pointer hover:border-ring/60 focus:outline-none focus:ring-2 focus:ring-ring/50'
              : 'cursor-not-allowed opacity-70',
            className,
          )}
        >
          {value.length === 0 ? (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Link2 className="w-3.5 h-3.5 text-muted-foreground/70" />
              <span>{m.select_parent_tasks()}</span>
            </div>
          ) : (
            value.map((id) => {
              const meta = taskMetadataCache[id]
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] bg-muted text-foreground border border-border/80 shrink-0 max-w-[220px]"
                >
                  {meta?.status && (
                    <span
                      className={cn(
                        'px-1 py-0.2 rounded text-[9px] uppercase font-semibold shrink-0',
                        getStatusBadgeColor(meta.status),
                      )}
                    >
                      {getStatusLabel(meta.status)}
                    </span>
                  )}
                  <span className="truncate font-medium">{meta?.title || id}</span>
                  {isInteractive && (
                    <button
                      type="button"
                      onClick={(e) => handleRemove(id, e)}
                      className="text-muted-foreground hover:text-destructive shrink-0 p-0.5 -mr-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              )
            })
          )}
        </div>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[var(--radix-popover-trigger-width)] min-w-[320px] sm:min-w-[420px] max-w-[500px] p-2.5 space-y-2 bg-popover border border-border rounded-lg shadow-lg"
      >
        {/* Part 1: Status Toggle Group */}
        <div className="flex flex-wrap gap-1.5 pb-0.5">
          {SELECTABLE_STATUSES.map((st) => {
            const isSelected = selectedStatus === st
            return (
              <button
                key={st}
                type="button"
                onClick={() => setSelectedStatus(st)}
                className={cn(
                  'text-[11px] h-7 px-2.5 rounded-md font-medium transition-colors border shrink-0',
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'bg-muted/50 hover:bg-accent text-muted-foreground hover:text-foreground border-border/60',
                )}
              >
                {getStatusLabel(st)}
              </button>
            )
          })}
        </div>

        {/* Part 2: Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={m.filter_tasks_placeholder()}
            className="h-8 pl-8 text-xs bg-muted/40"
            autoFocus
          />
        </div>

        {/* Part 2: Selection List */}
        <div className="border rounded-md overflow-hidden bg-background/50">
          <ScrollArea className="h-48 p-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground italic">
                {m.no_matching_tasks()}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredTasks.map((t) => {
                  const isSelected = value.includes(t.id)
                  return (
                    <div
                      key={t.id}
                      onClick={() => handleToggle(t.id)}
                      className={cn(
                        'flex items-center justify-between p-2 rounded-md hover:bg-accent cursor-pointer transition-colors text-xs border border-transparent',
                        isSelected && 'bg-accent/50 border-border/50',
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                        <div
                          className={cn(
                            'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                            isSelected
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'border-input bg-background',
                          )}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span
                          className={cn(
                            'px-1.5 py-0.5 rounded text-[10px] uppercase font-medium shrink-0',
                            getStatusBadgeColor(t.status),
                          )}
                        >
                          {getStatusLabel(t.status)}
                        </span>
                        <span className="font-medium text-foreground truncate">{t.title}</span>
                      </div>
                      {t.assignee && (
                        <span className="text-[10px] text-muted-foreground truncate shrink-0">
                          {t.assignee.name}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  )
}
