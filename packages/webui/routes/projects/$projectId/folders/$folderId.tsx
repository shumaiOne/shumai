import { client } from '@/ui/api/client'
import FileSystemManager from '@/ui/components/file-system-manager'
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

function FolderPage() {
  const { projectId, folderId } = Route.useParams()
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
    return <div>Loading project...</div>
  }

  return (
    <FileSystemManager
      teamId={teamId}
      projectId={projectId}
      projectName={projectInfo.name ?? ''}
      assetId={folderId}
      rootFolderId={rootFolderId}
    />
  )
}

export const Route = createFileRoute('/projects/$projectId/folders/$folderId')({
  component: FolderPage,
  loader: ({ context: { queryClient }, params: { projectId } }) =>
    queryClient.ensureQueryData(projectInfoQueryOptions(projectId)),
  pendingComponent: () => <div>Loading project...</div>,
})
