import { client } from '@/ui/api/client'
import { ProjectFolderSkeleton } from '@/ui/components/loading-skeletons'
import { createFileRoute } from '@tanstack/react-router'

export const projectInfoQueryOptions = (projectId: string) => ({
  queryKey: ['projects', projectId],
  queryFn: async () => {
    const res = await client.api.projects[':projectId'].$get({
      param: { projectId: projectId },
    })
    if (!res.ok) throw new Error('Failed to fetch project')
    return await res.json()
  },
})

export const Route = createFileRoute('/projects/$projectId/folders/$folderId')({
  loader: ({ context: { queryClient }, params: { projectId } }) =>
    queryClient.ensureQueryData(projectInfoQueryOptions(projectId)),
  pendingComponent: () => <ProjectFolderSkeleton />,
})
