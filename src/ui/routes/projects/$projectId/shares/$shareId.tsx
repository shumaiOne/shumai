import { client } from '@/ui/api/client'
import ShareManager from '@/ui/components/share-manager'
import { useTeamContextStore } from '@/ui/stores/team-context'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'

const projectInfoQueryOptions = (projectId: string) => ({
  queryKey: ['projects', projectId],
  queryFn: async () => {
    const res = await client.api.projects[':projectId'].$get({
      param: { projectId: projectId },
    })
    if (!res.ok) throw new Error('Failed to fetch project')
    return await res.json()
  },
})

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
    return <div>Loading project...</div>
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

export const Route = createFileRoute('/projects/$projectId/shares/$shareId')({
  component: SharePage,
  loader: ({ context: { queryClient }, params: { projectId } }) =>
    queryClient.ensureQueryData(projectInfoQueryOptions(projectId)),
  pendingComponent: () => <div>Loading share link...</div>,
})
