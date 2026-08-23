import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/components/ui/tabs'
import { m } from '@/ui/paraglide/messages.js'
import { TaskCommentThread } from './task-comment-thread'
import { TaskEventTimeline } from './task-event-timeline'
import type { KanbanTaskDetail } from '@shumai/dtos'

interface TaskActivityPaneProps {
  teamId: string
  task: KanbanTaskDetail
}

export function TaskActivityPane({ teamId, task }: TaskActivityPaneProps) {
  const [activeTab, setActiveTab] = useState<'comments' | 'activity'>('comments')

  return (
    <div className="flex flex-col h-full bg-sidebar/30 border-l border-border/60 overflow-hidden">
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as 'comments' | 'activity')}
        className="flex flex-col h-full"
      >
        <div className="px-3 pt-2.5 pb-1 border-b border-border/60 bg-card/50 shrink-0">
          <TabsList className="w-full grid grid-cols-2 h-8 bg-muted/60">
            <TabsTrigger value="comments" className="text-xs h-7">
              <span>{m.comments()}</span>
              {task.comments.length > 0 && (
                <span className="text-[10px] font-mono text-muted-foreground ml-1">
                  ({task.comments.length})
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs h-7">
              <span>{m.activity()}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden">
          <TabsContent
            value="comments"
            className="h-full m-0 data-[state=active]:flex data-[state=active]:flex-col"
          >
            <TaskCommentThread teamId={teamId} taskId={task.id} initialComments={task.comments} />
          </TabsContent>
          <TabsContent value="activity" className="h-full m-0 data-[state=active]:block">
            <TaskEventTimeline teamId={teamId} taskId={task.id} initialEvents={task.events} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
