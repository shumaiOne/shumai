import { PublicShareManager } from '@/ui/components/public-share-manager'
import { createFileRoute } from '@tanstack/react-router'

function PublicShareFolderPage() {
  const { shareId, folderId } = Route.useParams()

  return <PublicShareManager shareId={shareId} initialFolderId={folderId} />
}

export const Route = createFileRoute('/share/$shareId/folders/$folderId')({
  component: PublicShareFolderPage,
})
