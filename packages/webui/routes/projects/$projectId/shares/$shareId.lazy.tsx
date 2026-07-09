import { createLazyFileRoute } from '@tanstack/react-router'
import ShareManager from '@/ui/components/share-manager'
import { ProjectFolderSkeleton } from '@/ui/components/loading-skeletons'
import { useTeamContextStore } from '@/ui/stores/team-context'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { client } from '@/ui/api/client'
import { projectInfoQueryOptions } from './$shareId'

function SharePage() {
  const { projectId, shareId } = Route.useParams()
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
      if (!res.ok) throw new Error('Failed to fetch folder')
      return await res.json()
    },
    enabled: !!rootFolderId,
  })

  if (!teamId || !rootFolderId || !rootFolder) {
    return <ProjectFolderSkeleton />
  }

  return (
    <ShareManager
      teamId={teamId}
      projectId={projectId}
      projectName={projectInfo.name ?? ''}
      shareId={shareId}
      rootFolderId={rootFolderId}
    />
  )
}

export const Route = createLazyFileRoute('/projects/$projectId/shares/$shareId')({
  component: SharePage,
})
