import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { KanbanTaskStatus, type KanbanGoalInfo, type KanbanTaskInfo } from '@shumai/dtos'
import { KanbanHeader } from './kanban-header'
import { KanbanGoalSidebar } from './kanban-goal-sidebar'
import { KanbanBoard } from './kanban-board'
import { KanbanCreateTaskDialog } from './kanban-create-task-dialog'
import { EditTaskDialog } from './edit-task-dialog/edit-task-dialog'
import { Loader2 } from 'lucide-react'

interface KanbanPageProps {
  teamId: string
}

export function KanbanPage({ teamId }: KanbanPageProps) {
  const [scope, setScope] = useState<'team' | 'my'>('team')
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null)
  const [showCancelled, setShowCancelled] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false)
  const [createTaskInitialStatus, setCreateTaskInitialStatus] = useState<KanbanTaskStatus>(
    KanbanTaskStatus.TODO,
  )

  // Query Current User Role & Info in Team
  const { data: me, isLoading: isLoadingMe } = useQuery({
    queryKey: ['teams', teamId, 'me'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].me.$get({
        param: { teamId },
      })
      if (!res.ok) throw new Error('Failed to fetch me')
      return await res.json()
    },
    enabled: !!teamId,
  })

  // Query Goals for active goal object lookup
  const { data: goalsData } = useQuery({
    queryKey: ['teams', teamId, 'kanban', 'goals'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].kanban.goals.$get({
        param: { teamId },
        query: {},
      })
      if (!res.ok) return { data: [] }
      return (await res.json()) as { data: KanbanGoalInfo[] }
    },
    enabled: !!teamId,
  })

  const goals = goalsData?.data || []
  const selectedGoal = selectedGoalId ? goals.find((g) => g.id === selectedGoalId) || null : null

  const isOwnerOrEditor =
    me?.role?.toLowerCase() === 'owner' || me?.role?.toLowerCase() === 'editor'

  const handleOpenCreateTask = (status: KanbanTaskStatus = KanbanTaskStatus.TODO) => {
    setCreateTaskInitialStatus(status)
    setIsCreateTaskOpen(true)
  }

  const handleTaskClick = (task: KanbanTaskInfo) => {
    setEditingTaskId(task.id)
  }

  if (isLoadingMe) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-row h-full bg-background overflow-hidden font-sans">
      {/* Left Sidebar: Goals (Full Height) */}
      <KanbanGoalSidebar
        teamId={teamId}
        selectedGoalId={selectedGoalId}
        onSelectGoal={setSelectedGoalId}
        isOwnerOrEditor={isOwnerOrEditor}
      />

      {/* Right Column: Top Header Bar + Kanban Board */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <KanbanHeader
          scope={scope}
          onScopeChange={setScope}
          selectedGoal={selectedGoal}
          onClearGoal={() => setSelectedGoalId(null)}
          showCancelled={showCancelled}
          onToggleShowCancelled={() => setShowCancelled((prev) => !prev)}
          onCreateTask={() => handleOpenCreateTask(KanbanTaskStatus.TODO)}
        />

        <KanbanBoard
          teamId={teamId}
          selectedGoalId={selectedGoalId}
          scope={scope}
          currentUserId={me?.id}
          showCancelled={showCancelled}
          onTaskClick={handleTaskClick}
          onCreateTaskInColumn={(status) => handleOpenCreateTask(status)}
        />
      </div>

      {/* Edit Task Dialog */}
      {editingTaskId && (
        <EditTaskDialog
          teamId={teamId}
          taskId={editingTaskId}
          isOpen={!!editingTaskId}
          onClose={() => setEditingTaskId(null)}
          canEdit={isOwnerOrEditor}
        />
      )}

      {/* Create Task Dialog */}
      {isCreateTaskOpen && (
        <KanbanCreateTaskDialog
          teamId={teamId}
          isOpen={isCreateTaskOpen}
          initialStatus={createTaskInitialStatus}
          initialGoalId={selectedGoalId}
          onClose={() => setIsCreateTaskOpen(false)}
        />
      )}
    </div>
  )
}
