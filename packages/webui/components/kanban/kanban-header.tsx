import { Button } from '@/ui/components/ui/button'
import { m } from '@/ui/paraglide/messages.js'
import { Users, User, Plus, Target, X } from 'lucide-react'
import { type KanbanGoalInfo, UNASSIGNED_GOAL_ID } from '@shumai/dtos'

interface KanbanHeaderProps {
  scope: 'team' | 'my'
  onScopeChange: (scope: 'team' | 'my') => void
  selectedGoal: KanbanGoalInfo | null
  onClearGoal: () => void
  onCreateTask: () => void
}

export function KanbanHeader({
  scope,
  onScopeChange,
  selectedGoal,
  onClearGoal,
  onCreateTask,
}: KanbanHeaderProps) {
  return (
    <header className="h-14 border-b border-border bg-card/60 backdrop-blur-sm px-4 flex items-center justify-between gap-3 shrink-0 select-none">
      {/* Left side: Scope switcher & Goal indicator */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Scope Toggle (Team vs My Tasks) */}
        <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border/50">
          <Button
            variant={scope === 'team' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onScopeChange('team')}
            className={`h-7 px-2.5 text-xs font-medium gap-1.5 transition-all ${
              scope === 'team'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{m.team_tasks()}</span>
          </Button>
          <Button
            variant={scope === 'my' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onScopeChange('my')}
            className={`h-7 px-2.5 text-xs font-medium gap-1.5 transition-all ${
              scope === 'my'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>{m.my_tasks()}</span>
          </Button>
        </div>

        {/* Selected Goal Filter Badge */}
        {selectedGoal && (
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-sidebar-accent border border-sidebar-border text-xs text-sidebar-accent-foreground min-w-0 max-w-[200px] md:max-w-[280px]">
            <Target className="w-3.5 h-3.5 text-sidebar-primary shrink-0" />
            <span className="truncate font-medium">
              {selectedGoal.id === UNASSIGNED_GOAL_ID ? m.unassigned() : selectedGoal.title}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onClearGoal}
              className="h-4 w-4 p-0 ml-0.5 text-muted-foreground hover:text-foreground"
              title={m.clear_filter()}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Right side: Create button */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Create Task Button */}
        <Button size="sm" onClick={onCreateTask} className="h-8 px-3 text-xs gap-1.5 shadow-xs">
          <Plus className="w-3.5 h-3.5" />
          <span>{m.create_task()}</span>
        </Button>
      </div>
    </header>
  )
}
