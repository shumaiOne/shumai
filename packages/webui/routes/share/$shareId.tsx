import { createFileRoute, Outlet } from '@tanstack/react-router'
import { PublicShareViewProvider } from '@/ui/hooks/use-public-share-view'

function ShareLayout() {
  return (
    <PublicShareViewProvider>
      <Outlet />
    </PublicShareViewProvider>
  )
}

export const Route = createFileRoute('/share/$shareId')({
  component: ShareLayout,
})
