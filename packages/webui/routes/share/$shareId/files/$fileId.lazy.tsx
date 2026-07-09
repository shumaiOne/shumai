import { createLazyFileRoute } from '@tanstack/react-router'
import { PublicShareManager } from '@/ui/components/public-share-manager'

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

export const Route = createLazyFileRoute('/share/$shareId/files/$fileId')({
  component: PublicShareFilePage,
})
