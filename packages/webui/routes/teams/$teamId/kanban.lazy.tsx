import { createLazyFileRoute } from '@tanstack/react-router'
import { KanbanPage } from '@/ui/components/kanban/kanban-page'

function TeamKanbanPageRoute() {
  const { teamId } = Route.useParams()
  const { taskId } = Route.useSearch()
  return <KanbanPage teamId={teamId} initialTaskId={taskId} />
}

export const Route = createLazyFileRoute('/teams/$teamId/kanban')({
  component: TeamKanbanPageRoute,
})
