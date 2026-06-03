import { client } from '@/ui/api/client'
import { ProjectFolderSkeleton } from '@/ui/components/loading-skeletons'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Outlet } from '@tanstack/react-router'

function ShareLayout() {
  const { shareId } = Route.useParams()

  const {
    data: shareInfo,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['share-info', shareId],
    queryFn: async () => {
      const res = await client.api.shares[':shareId'].info.$get({
        param: { shareId },
      })
      if (!res.ok) throw new Error('Failed to fetch share info')
      return await res.json()
    },
  })

  if (isLoading) return <ProjectFolderSkeleton />

  if (error || !shareInfo)
    return (
      <div className="flex h-screen items-center justify-center text-destructive">
        Share not found or inaccessible.
      </div>
    )

  return <Outlet />
}

export const Route = createFileRoute('/share/$shareId')({
  component: ShareLayout,
  beforeLoad: ({ params: { shareId } }) => {
    return {
      password: localStorage.getItem(`share_pwd_${shareId}`) || '',
    }
  },
})
