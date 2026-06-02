import { client } from '@/ui/api/client'
import FileSystemManager from '@/ui/components/file-system-manager'
import { useTeamContextStore } from '@/ui/stores/team-context'
import { useMutation, useQuery, useSuspenseQuery } from '@tanstack/react-query'
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

const collectionInfoQueryOptions = (collectionId: string) => ({
  queryKey: ['collections', collectionId],
  queryFn: async () => {
    const res = await client.api.collections[':collectionId'].$get({
      param: { collectionId },
    })
    if (!res.ok) throw new Error('Failed to fetch collection')
    return await res.json()
  },
})

function CollectionPage() {
  const { projectId, collectionId } = Route.useParams()
  const { teamId, ensureTeamIdForProject } = useTeamContextStore()

  useEffect(() => {
    ensureTeamIdForProject(projectId)
  }, [projectId, ensureTeamIdForProject])

  const { data: projectInfo } = useSuspenseQuery(projectInfoQueryOptions(projectId))

  const { data: collection, refetch: refetchCollection } = useQuery({
    ...collectionInfoQueryOptions(collectionId),
  })

  const { mutate: updateCollection } = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: async (updates: { name?: string; filter?: any }) => {
      const res = await client.api.collections[':collectionId'].$patch({
        param: { collectionId },
        json: updates,
      })
      if (!res.ok) throw new Error('Failed to update collection')
      return await res.json()
    },
    onSuccess: () => {
      refetchCollection()
    },
  })

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

  if (!teamId || !rootFolderId || !rootFolder || !collection) {
    return <div>Loading collection...</div>
  }

  const sourceFolderId = collection.filter.sourceFolderId || rootFolderId

  return (
    <FileSystemManager
      teamId={teamId}
      projectId={projectId}
      projectName={projectInfo.name ?? ''}
      assetId={sourceFolderId}
      rootFolderId={rootFolderId}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      collection={collection as any}
      onUpdateCollection={updateCollection}
    />
  )
}

export const Route = createFileRoute('/projects/$projectId/collections/$collectionId')({
  component: CollectionPage,
  loader: ({ context: { queryClient }, params: { projectId } }) =>
    queryClient.ensureQueryData(projectInfoQueryOptions(projectId)),
  pendingComponent: () => <div>Loading collection...</div>,
})
