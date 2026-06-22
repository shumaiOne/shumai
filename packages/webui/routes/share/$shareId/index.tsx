import { PublicShareManager } from '@/ui/components/public-share-manager'
import { createFileRoute } from '@tanstack/react-router'

function PublicShareIndexPage() {
  const { shareId } = Route.useParams()

  return <PublicShareManager shareId={shareId} />
}

export const Route = createFileRoute('/share/$shareId/')({
  component: PublicShareIndexPage,
})
