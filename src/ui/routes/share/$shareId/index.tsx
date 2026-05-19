import { client } from '@/ui/api/client'
import { PublicShareManager } from '@/ui/components/public-share-manager'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

function PublicShareIndexPage() {
  const { shareId } = Route.useParams()

  const { data: shareInfo } = useQuery({
    queryKey: ['share-info', shareId],
    queryFn: async () => {
      const res = await client.api.shares[':shareId'].info.$get({
        param: { shareId },
      })
      if (!res.ok) throw new Error('Failed to fetch share info')
      return await res.json()
    },
  })

  if (!shareInfo) return null

  return (
    <PublicShareManager
      shareInfo={{
        ...shareInfo,
        expireAt: shareInfo.expireAt ?? null,
        isDisabled: shareInfo.isDisabled ?? false,
      }}
      initialFolderId={shareInfo.rootFolderId}
    />
  )
}

export const Route = createFileRoute('/share/$shareId/')({
  component: PublicShareIndexPage,
})
