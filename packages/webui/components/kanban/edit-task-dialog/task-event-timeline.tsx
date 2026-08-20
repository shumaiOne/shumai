import { useQuery } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { m } from '@/ui/paraglide/messages.js'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import { KanbanTaskEventType, type KanbanEventInfo, type KanbanRunSummary } from '@shumai/dtos'
import { getRunStatusBadgeColor, getStatusLabel } from '../kanban-types'
import { format } from 'date-fns'
import { Activity, Bot, Loader2 } from 'lucide-react'
import { cn } from '@/ui/lib/utils'

interface TaskEventTimelineProps {
  teamId: string
  taskId: string
  runs?: KanbanRunSummary[]
  initialEvents?: KanbanEventInfo[]
}

function getEventDescription(event: KanbanEventInfo): string {
  const data = event.data || {}
  switch (event.type) {
    case KanbanTaskEventType.CREATED:
      return 'Created task'
    case KanbanTaskEventType.STATUS_CHANGED:
      return `Changed status from ${event.fromStatus ? getStatusLabel(event.fromStatus) : 'None'} to ${event.toStatus ? getStatusLabel(event.toStatus) : 'None'}`
    case KanbanTaskEventType.ASSIGNED:
      return 'Assigned task'
    case KanbanTaskEventType.UNASSIGNED:
      return 'Unassigned task'
    case KanbanTaskEventType.PRIORITY_CHANGED:
      return `Changed priority to ${String(data.to || '')}`
    case KanbanTaskEventType.GOAL_CHANGED:
      return 'Updated goal association'
    case KanbanTaskEventType.DEPENDENCY_ADDED:
      return 'Added prerequisite dependency'
    case KanbanTaskEventType.DEPENDENCY_REMOVED:
      return 'Removed prerequisite dependency'
    case KanbanTaskEventType.CHANGES_REQUESTED:
      return `Requested changes: "${String(data.reason || '')}"`
    case KanbanTaskEventType.BLOCKED:
      return `Task blocked: "${String(data.reason || data.blockReason || '')}"`
    case KanbanTaskEventType.UNBLOCKED:
      return 'Task unblocked'
    case KanbanTaskEventType.RECLAIMED:
      return 'Task reclaimed'
    case KanbanTaskEventType.CANCELLED:
      return 'Task cancelled'
    case KanbanTaskEventType.COMMENTED:
      return 'Added a comment'
    default:
      return event.type
  }
}

export function TaskEventTimeline({
  teamId,
  taskId,
  runs = [],
  initialEvents,
}: TaskEventTimelineProps) {
  const { data: eventsData, isLoading } = useQuery({
    queryKey: ['teams', teamId, 'kanban', 'tasks', taskId, 'events'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].kanban.tasks[':taskId'].events.$get({
        param: { teamId, taskId },
      })
      if (!res.ok) throw new Error('Failed to fetch events')
      return (await res.json()) as { data: KanbanEventInfo[] }
    },
    initialData: initialEvents ? { data: initialEvents } : undefined,
    enabled: !!teamId && !!taskId,
  })

  const events = eventsData?.data || []

  return (
    <ScrollArea className="h-full p-3">
      <div className="space-y-5 pr-2">
        {/* AI Run Attempts History */}
        {runs.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
              <Bot className="w-3.5 h-3.5 text-purple-500" />
              <span>AI Execution Attempts</span>
              <span className="text-[11px] font-mono text-muted-foreground">({runs.length})</span>
            </div>

            <div className="space-y-2">
              {runs.map((run) => (
                <div
                  key={run.id}
                  className="p-2.5 rounded-lg border border-purple-500/20 bg-purple-500/[0.03] space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-purple-600 dark:text-purple-400">
                        {m.run_attempt({ number: run.attempt })}
                      </span>
                      <span
                        className={cn(
                          'px-1.5 py-0.2 rounded text-[10px] font-medium border uppercase',
                          getRunStatusBadgeColor(run.status),
                        )}
                      >
                        {run.status}
                      </span>
                    </div>

                    <span className="text-[10px] text-muted-foreground font-mono">
                      {format(new Date(run.startedAt), 'MM/dd HH:mm')}
                    </span>
                  </div>

                  {run.summary && (
                    <p className="text-[11px] text-foreground/80 bg-background/80 p-2 rounded border border-border/50 whitespace-pre-wrap">
                      {run.summary}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audit Event Stream */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
            <Activity className="w-3.5 h-3.5 text-primary" />
            <span>Audit History</span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : events.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              {m.no_activity_yet()}
            </div>
          ) : (
            <div className="relative pl-4 space-y-3 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60">
              {events.map((event) => (
                <div key={event.id} className="relative flex items-start gap-2 text-xs">
                  <div className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full bg-background border-2 border-primary shrink-0" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-medium text-foreground truncate">
                        {event.actor?.name || 'System'}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                        {format(new Date(event.createdAt), 'MM/dd HH:mm')}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                      {getEventDescription(event)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  )
}
