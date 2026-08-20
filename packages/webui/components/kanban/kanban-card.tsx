import { useDraggable, useDroppable, useDragOperation } from '@dnd-kit/react'
import { cn } from '@/ui/lib/utils'
import { m } from '@/ui/paraglide/messages.js'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/components/ui/avatar'
import { KanbanTaskStatus, KanbanTaskType, type KanbanTaskInfo } from '@shumai/dtos'
import { getPriorityBadgeColor, getPriorityLabel } from './kanban-types'
import { Bot, Calendar, Link2, MessageSquare, AlertTriangle, Target, Sparkles } from 'lucide-react'
import { format, isPast } from 'date-fns'

interface KanbanCardProps {
  task: KanbanTaskInfo
  onClick: (task: KanbanTaskInfo) => void
  disabled?: boolean
  isFirst?: boolean
  showBottomIndicator?: boolean
}

export function KanbanCard({
  task,
  onClick,
  disabled,
  isFirst,
  showBottomIndicator,
}: KanbanCardProps) {
  const { source } = useDragOperation()
  const isDraggingAny = !!source

  const { ref: setDraggableRef, isDragging } = useDraggable({
    id: task.id,
    data: {
      type: 'kanban_task',
      task,
    },
    disabled,
  })

  const { ref: setTopDroppableRef, isDropTarget: isTopOver } = useDroppable({
    id: `reorder-before-${task.id}`,
    data: {
      type: 'reorder',
      task,
      position: 'before',
    },
    disabled: isDragging || disabled,
  })

  const { ref: setBottomDroppableRef, isDropTarget: isBottomOver } = useDroppable({
    id: `reorder-after-${task.id}`,
    data: {
      type: 'reorder',
      task,
      position: 'after',
    },
    disabled: isDragging || disabled,
  })

  const isAgentic = task.type === KanbanTaskType.AGENTIC
  const isBlocked = task.status === KanbanTaskStatus.BLOCKED
  const isOverdue = task.dueDate
    ? isPast(new Date(task.dueDate)) &&
      task.status !== KanbanTaskStatus.DONE &&
      task.status !== KanbanTaskStatus.CANCELLED
    : false

  return (
    <div className="relative">
      {/* Top 50% Droppable Zone (reorder before this card) */}
      <div
        ref={setTopDroppableRef}
        className={cn(
          'absolute left-0 right-0 z-20',
          isFirst ? '-top-6 h-[calc(50%+24px)]' : '-top-1 h-[calc(50%+4px)]',
          isDraggingAny && !isDragging ? 'pointer-events-auto' : 'pointer-events-none',
        )}
      />

      {/* Bottom 50% Droppable Zone (reorder after this card) */}
      <div
        ref={setBottomDroppableRef}
        className={cn(
          'absolute bottom-0 left-0 right-0 h-1/2 z-20',
          isDraggingAny && !isDragging ? 'pointer-events-auto' : 'pointer-events-none',
        )}
      />

      {/* Top Reorder Drop Indicator Line */}
      {isTopOver && !isDragging && (
        <div className="absolute -top-1.5 left-0 right-0 h-[3px] rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.6)] z-30 pointer-events-none" />
      )}

      {/* Bottom Reorder Drop Indicator Line */}
      {(isBottomOver || showBottomIndicator) && !isDragging && (
        <div className="absolute -bottom-1.5 left-0 right-0 h-[3px] rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.6)] z-30 pointer-events-none" />
      )}

      {/* Task Card Body */}
      <div
        ref={setDraggableRef}
        onClick={() => onClick(task)}
        className={cn(
          'group relative flex flex-col gap-2 p-3 rounded-lg border text-card-foreground transition-all duration-200 cursor-pointer select-none',
          isDragging && 'opacity-40 scale-95 shadow-lg ring-2 ring-primary',
          !isDragging && 'hover:shadow-md',
          // Agentic task distinct border & subtle glow
          isAgentic
            ? 'border-purple-500/40 dark:border-purple-400/50 bg-gradient-to-br from-purple-500/[0.04] via-card to-background shadow-xs hover:border-purple-500 hover:shadow-[0_0_16px_rgba(168,85,247,0.18)] ring-1 ring-purple-500/20'
            : 'border-border/80 bg-card hover:border-primary/50 shadow-2xs',
          // Blocked warning state
          isBlocked && 'border-red-500/60 bg-red-500/[0.03] ring-1 ring-red-500/20',
        )}
      >
        {/* Top Header Row: Goal Tag & Badges */}
        <div className="flex items-center justify-between gap-1.5 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {/* Priority Badge */}
            <span
              className={cn(
                'px-1.5 py-0.5 rounded text-[10px] font-medium border uppercase tracking-wider shrink-0',
                getPriorityBadgeColor(task.priority),
              )}
            >
              {getPriorityLabel(task.priority)}
            </span>

            {/* Goal Tag */}
            {task.goal && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border/70 truncate max-w-[130px]">
                <Target className="w-2.5 h-2.5 shrink-0" />
                <span className="truncate">{task.goal.title}</span>
              </span>
            )}
          </div>

          {/* Task Type Badge (Agentic vs Manual) */}
          {isAgentic ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 shrink-0">
              <Bot className="w-3 h-3" />
              <span>{m.task_type_agentic()}</span>
              {task.latestRun && (
                <span className="font-mono text-[9px] opacity-80">#{task.latestRun.attempt}</span>
              )}
            </span>
          ) : (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border shrink-0">
              {m.task_type_manual()}
            </span>
          )}
        </div>

        {/* Task Title */}
        <h4 className="text-xs font-semibold leading-snug line-clamp-2 text-foreground break-words">
          {task.title}
        </h4>

        {/* Blocked Reason Banner */}
        {isBlocked && (
          <div className="flex items-start gap-1.5 p-1.5 rounded bg-red-500/10 border border-red-500/20 text-[11px] text-red-600 dark:text-red-400">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span className="line-clamp-2 break-words">
              {task.latestStatusEvent?.blockReason ||
                task.latestStatusEvent?.reason ||
                task.latestStatusEvent?.summary ||
                m.status_blocked()}
            </span>
          </div>
        )}

        {/* Review Feedback Banner */}
        {task.status === KanbanTaskStatus.IN_REVIEW && task.latestStatusEvent?.summary && (
          <div className="flex items-start gap-1.5 p-1.5 rounded bg-purple-500/10 border border-purple-500/20 text-[11px] text-purple-600 dark:text-purple-400">
            <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span className="line-clamp-2 break-words">{task.latestStatusEvent.summary}</span>
          </div>
        )}

        {/* Card Footer: Assignee & Metadata Badges */}
        <div className="flex items-center justify-between gap-2 pt-1 mt-auto border-t border-border/40 text-[11px] text-muted-foreground">
          {/* Assignee */}
          <div className="flex items-center gap-1.5 min-w-0">
            {task.assignee ? (
              <>
                {isAgentic ? (
                  <div className="w-5 h-5 rounded-full bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shrink-0">
                    <Bot className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                  </div>
                ) : (
                  <Avatar size="sm" className="w-5 h-5 border border-border">
                    <AvatarImage src={task.assignee.image} />
                    <AvatarFallback className="text-[9px]">
                      {task.assignee.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                <span className="truncate text-xs font-medium text-foreground/80 max-w-[90px]">
                  {task.assignee.name}
                </span>
              </>
            ) : (
              <span className="text-[11px] italic text-muted-foreground/60">{m.unassigned()}</span>
            )}
          </div>

          {/* Right side stats: Due Date, Dependencies, Comments */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Due Date */}
            {task.dueDate && (
              <div
                className={cn(
                  'flex items-center gap-1 text-[10px] font-mono',
                  isOverdue ? 'text-red-500 font-semibold' : 'text-muted-foreground',
                )}
                title={format(new Date(task.dueDate), 'yyyy/MM/dd HH:mm')}
              >
                <Calendar className="w-3 h-3" />
                <span>{format(new Date(task.dueDate), 'MM/dd')}</span>
              </div>
            )}

            {/* Dependencies count */}
            {task.dependencyCount > 0 && (
              <div
                className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                title={`${task.dependencyCount} dependencies`}
              >
                <Link2 className="w-3 h-3" />
                <span>{task.dependencyCount}</span>
              </div>
            )}

            {/* Comments count */}
            {task.commentCount > 0 && (
              <div
                className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                title={`${task.commentCount} comments`}
              >
                <MessageSquare className="w-3 h-3" />
                <span>{task.commentCount}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
