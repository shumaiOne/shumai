import { createLazyFileRoute } from '@tanstack/react-router'
import { useTeamContextStore } from '@/ui/stores/team-context'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { client } from '@/ui/api/client'
import FileSystemManager from '@/ui/components/file-system-manager'
import { ProjectFolderSkeleton } from '@/ui/components/loading-skeletons'
import { projectInfoQueryOptions } from './recents'

function RecentsPage() {
  const { projectId } = Route.useParams()
  const { teamId, ensureTeamIdForProject } = useTeamContextStore()

  useEffect(() => {
    ensureTeamIdForProject(projectId)
  }, [projectId, ensureTeamIdForProject])

  const { data: projectInfo } = useSuspenseQuery(projectInfoQueryOptions(projectId))

  const rootFolderId = projectInfo?.rootFolder

  const { data: rootFolder } = useQuery({
    queryKey: ['folders', rootFolderId!],
    queryFn: () =>
      (async () => {
        const res = await client.api.folders[':folderId'].$get({
          param: { folderId: rootFolderId! },
        })
        return await res.json()
      })(),
    enabled: !!rootFolderId,
  })

  if (!teamId || !rootFolderId || !rootFolder) {
    return <ProjectFolderSkeleton />
  }

  return (
    <FileSystemManager
      teamId={teamId}
      projectId={projectId}
      projectName={projectInfo.name ?? ''}
      assetId="recents"
      rootFolderId={rootFolderId}
    />
  )
}

export const Route = createLazyFileRoute('/projects/$projectId/recents')({
  component: RecentsPage,
})
