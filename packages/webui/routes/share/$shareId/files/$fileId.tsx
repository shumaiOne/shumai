import { client } from '@/ui/api/client'
import { PublicShareManager } from '@/ui/components/public-share-manager'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

function PublicShareFilePage() {
  const { shareId, fileId } = Route.useParams()
  const { start } = Route.useSearch()

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
      initialFileId={fileId}
      startTime={start}
    />
  )
}

export const Route = createFileRoute('/share/$shareId/files/$fileId')({
  component: PublicShareFilePage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      start: search.start ? Number(search.start) : undefined,
    } as { start?: number }
  },
})
