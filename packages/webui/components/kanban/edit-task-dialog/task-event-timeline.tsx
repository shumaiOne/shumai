import { useQuery } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { m } from '@/ui/paraglide/messages.js'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import { KanbanTaskEventType, type KanbanEventInfo } from '@shumai/dtos'
import { getStatusLabel } from '../kanban-types'
import { format } from 'date-fns'
import { Loader2 } from 'lucide-react'

interface TaskEventTimelineProps {
  teamId: string
  taskId: string
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
    case KanbanTaskEventType.CANCELLED:
      return 'Task cancelled'
    case KanbanTaskEventType.COMMENTED:
      return 'Added a comment'
    default:
      return event.type
  }
}

export function TaskEventTimeline({ teamId, taskId, initialEvents }: TaskEventTimelineProps) {
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
      <div className="space-y-4 pr-2">
        {/* Audit Event Stream */}
        <div className="space-y-2">
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
