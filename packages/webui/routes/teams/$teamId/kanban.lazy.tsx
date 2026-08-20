import { createLazyFileRoute } from '@tanstack/react-router'
import { KanbanPage } from '@/ui/components/kanban/kanban-page'

function TeamKanbanPageRoute() {
  const { teamId } = Route.useParams()
  return <KanbanPage teamId={teamId} />
}

export const Route = createLazyFileRoute('/teams/$teamId/kanban')({
  component: TeamKanbanPageRoute,
})
