import { client } from '@/ui/api/client'
import { m } from '@/ui/paraglide/messages.js'
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

export const collectionInfoQueryOptions = (collectionId: string) => ({
  queryKey: ['collections', collectionId],
  queryFn: async () => {
    const res = await client.api.collections[':collectionId'].$get({
      param: { collectionId },
    })
    if (!res.ok) throw new Error('Failed to fetch collection')
    return await res.json()
  },
})

export const Route = createFileRoute('/projects/$projectId/collections/$collectionId')({
  loader: ({ context: { queryClient }, params: { projectId } }) =>
    queryClient.ensureQueryData(projectInfoQueryOptions(projectId)),
  pendingComponent: () => <div>{m.loading_collection()}</div>,
})
