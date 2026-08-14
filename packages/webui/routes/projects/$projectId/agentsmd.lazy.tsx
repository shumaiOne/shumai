import { client } from '@/ui/api/client'
import AgentsMdManager from '@/ui/components/agents-md/agents-md-manager'
import { ProjectFolderSkeleton } from '@/ui/components/loading-skeletons'
import { useTeamContextStore } from '@/ui/stores/team-context'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { createLazyFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { projectInfoQueryOptions } from './agentsmd'

function ProjectAgentsMdPage() {
  const { projectId } = Route.useParams()
  const { teamId, ensureTeamIdForProject } = useTeamContextStore()

  useEffect(() => {
    ensureTeamIdForProject(projectId)
  }, [projectId, ensureTeamIdForProject])

  const { data: projectInfo } = useSuspenseQuery(projectInfoQueryOptions(projectId))

  const rootFolderId = projectInfo?.rootFolder

  const { data: rootFolder } = useQuery({
    queryKey: ['folders', rootFolderId!],
    queryFn: async () => {
      const res = await client.api.folders[':folderId'].$get({
        param: { folderId: rootFolderId! },
      })
      if (!res.ok) throw new Error('failed to fetch folder')
      return await res.json()
    },
    enabled: !!rootFolderId,
  })

  if (!teamId || !rootFolderId || !rootFolder) {
    return <ProjectFolderSkeleton />
  }

  return (
    <AgentsMdManager
      teamId={teamId}
      projectId={projectId}
      projectName={projectInfo.name ?? ''}
      assetId={rootFolderId}
      rootFolderId={rootFolderId}
      isRoot={true}
    />
  )
}

export const Route = createLazyFileRoute('/projects/$projectId/agentsmd')({
  component: ProjectAgentsMdPage,
})
