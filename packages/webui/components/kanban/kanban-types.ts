import { KanbanTaskPriority, KanbanTaskStatus, KanbanTaskRunStatus } from '@shumai/dtos'
import { m } from '@/ui/paraglide/messages.js'

export const KANBAN_STATUS_COLUMNS: KanbanTaskStatus[] = [
  KanbanTaskStatus.TODO,
  KanbanTaskStatus.READY,
  KanbanTaskStatus.IN_PROGRESS,
  KanbanTaskStatus.BLOCKED,
  KanbanTaskStatus.IN_REVIEW,
  KanbanTaskStatus.DONE,
]

export function getStatusLabel(status: KanbanTaskStatus): string {
  switch (status) {
    case KanbanTaskStatus.TODO:
      return m.status_todo()
    case KanbanTaskStatus.READY:
      return m.status_ready()
    case KanbanTaskStatus.IN_PROGRESS:
      return m.status_in_progress()
    case KanbanTaskStatus.BLOCKED:
      return m.status_blocked()
    case KanbanTaskStatus.IN_REVIEW:
      return m.status_in_review()
    case KanbanTaskStatus.DONE:
      return m.status_done()
    case KanbanTaskStatus.CANCELLED:
      return m.status_cancelled()
    default:
      return status
  }
}

export function getStatusColor(status: KanbanTaskStatus): {
  badge: string
  border: string
  dot: string
  bg: string
} {
  switch (status) {
    case KanbanTaskStatus.TODO:
      return {
        badge: 'bg-muted text-muted-foreground border-border',
        border: 'border-border',
        dot: 'bg-muted-foreground',
        bg: 'bg-muted/30',
      }
    case KanbanTaskStatus.READY:
      return {
        badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        border: 'border-blue-500/30',
        dot: 'bg-blue-500',
        bg: 'bg-blue-500/5',
      }
    case KanbanTaskStatus.IN_PROGRESS:
      return {
        badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        border: 'border-amber-500/30',
        dot: 'bg-amber-500',
        bg: 'bg-amber-500/5',
      }
    case KanbanTaskStatus.BLOCKED:
      return {
        badge: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
        border: 'border-red-500/30',
        dot: 'bg-red-500',
        bg: 'bg-red-500/5',
      }
    case KanbanTaskStatus.IN_REVIEW:
      return {
        badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
        border: 'border-purple-500/30',
        dot: 'bg-purple-500',
        bg: 'bg-purple-500/5',
      }
    case KanbanTaskStatus.DONE:
      return {
        badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        border: 'border-emerald-500/30',
        dot: 'bg-emerald-500',
        bg: 'bg-emerald-500/5',
      }
    case KanbanTaskStatus.CANCELLED:
      return {
        badge: 'bg-muted text-muted-foreground/60 border-border',
        border: 'border-border',
        dot: 'bg-muted-foreground/50',
        bg: 'bg-muted/10',
      }
  }
}

export function getStatusBadgeColor(status: KanbanTaskStatus): string {
  return getStatusColor(status).badge
}

export function getPriorityLabel(priority: KanbanTaskPriority): string {
  switch (priority) {
    case KanbanTaskPriority.LOW:
      return m.priority_low()
    case KanbanTaskPriority.MEDIUM:
      return m.priority_medium()
    case KanbanTaskPriority.HIGH:
      return m.priority_high()
    case KanbanTaskPriority.URGENT:
      return m.priority_urgent()
    default:
      return priority
  }
}

export function getPriorityBadgeColor(priority: KanbanTaskPriority): string {
  switch (priority) {
    case KanbanTaskPriority.LOW:
      return 'bg-muted text-muted-foreground border-border'
    case KanbanTaskPriority.MEDIUM:
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
    case KanbanTaskPriority.HIGH:
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
    case KanbanTaskPriority.URGENT:
      return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 font-semibold'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}

export function getRunStatusBadgeColor(status: KanbanTaskRunStatus): string {
  switch (status) {
    case KanbanTaskRunStatus.RUNNING:
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
    case KanbanTaskRunStatus.COMPLETED:
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
    case KanbanTaskRunStatus.REVIEW_REQUESTED:
      return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
    case KanbanTaskRunStatus.BLOCKED:
    case KanbanTaskRunStatus.FAILED:
    case KanbanTaskRunStatus.TIMED_OUT:
      return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
    case KanbanTaskRunStatus.CANCELLED:
    case KanbanTaskRunStatus.RECLAIMED:
      return 'bg-muted text-muted-foreground border-border'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}
