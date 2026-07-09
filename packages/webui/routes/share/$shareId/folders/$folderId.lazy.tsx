import { createLazyFileRoute } from '@tanstack/react-router'
import { PublicShareManager } from '@/ui/components/public-share-manager'

function PublicShareFolderPage() {
  const { shareId, folderId } = Route.useParams()

  return <PublicShareManager shareId={shareId} initialFolderId={folderId} />
}

export const Route = createLazyFileRoute('/share/$shareId/folders/$folderId')({
  component: PublicShareFolderPage,
})
