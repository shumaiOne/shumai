import { PublicShareManager } from '@/ui/components/public-share-manager'
import { createFileRoute } from '@tanstack/react-router'

function PublicShareFilePage() {
  const { shareId, fileId } = Route.useParams()
  const { start, version, compare, cmpLeft, cmpRight, cmpActive } = Route.useSearch()

  return (
    <PublicShareManager
      shareId={shareId}
      initialFileId={fileId}
      startTime={start}
      versionId={version}
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
      version: (search.version as string) || undefined,
      compare: search.compare === true || search.compare === 'true' || undefined,
      cmpLeft: (search.cmpLeft as string) || undefined,
      cmpRight: (search.cmpRight as string) || undefined,
      cmpActive: search.cmpActive === 'right' ? 'right' : undefined,
    } as {
      start?: number
      version?: string
      compare?: boolean
      cmpLeft?: string
      cmpRight?: string
      cmpActive?: 'left' | 'right'
    }
  },
})
