import { createLazyFileRoute } from '@tanstack/react-router'
import { PublicShareManager } from '@/ui/components/public-share-manager'

function PublicShareIndexPage() {
  const { shareId } = Route.useParams()

  return <PublicShareManager shareId={shareId} />
}

export const Route = createLazyFileRoute('/share/$shareId/')({
  component: PublicShareIndexPage,
})
