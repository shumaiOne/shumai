import { PublicShareManager } from '@/ui/components/public-share-manager'
import { createFileRoute } from '@tanstack/react-router'

function PublicShareFilePage() {
  const { shareId, fileId } = Route.useParams()
  const { start } = Route.useSearch()

  return <PublicShareManager shareId={shareId} initialFileId={fileId} startTime={start} />
}

export const Route = createFileRoute('/share/$shareId/files/$fileId')({
  component: PublicShareFilePage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      start: search.start ? Number(search.start) : undefined,
    } as { start?: number }
  },
})
