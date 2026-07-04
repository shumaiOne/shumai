import { PublicShareManager } from '@/ui/components/public-share-manager'
import { createFileRoute } from '@tanstack/react-router'

function PublicShareFilePage() {
  const { shareId, fileId } = Route.useParams()
  const { start, compare, cmpLeft, cmpRight, cmpActive } = Route.useSearch()

  return (
    <PublicShareManager
      shareId={shareId}
      initialFileId={fileId}
      startTime={start}
      compare={compare}
      compareLeftId={cmpLeft}
      compareRightId={cmpRight}
      compareActiveSide={cmpActive}
    />
  )
}

export const Route = createFileRoute('/share/$shareId/files/$fileId')({
  component: PublicShareFilePage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      start: search.start ? Number(search.start) : undefined,
      compare: search.compare === true || search.compare === 'true' || undefined,
      cmpLeft: (search.cmpLeft as string) || undefined,
      cmpRight: (search.cmpRight as string) || undefined,
      cmpActive: search.cmpActive === 'right' ? 'right' : undefined,
    } as {
      start?: number
      compare?: boolean
      cmpLeft?: string
      cmpRight?: string
      cmpActive?: 'left' | 'right'
    }
  },
})
