import { createFileRoute, Outlet } from '@tanstack/react-router'

function ShareLayout() {
  return <Outlet />
}

export const Route = createFileRoute('/share/$shareId')({
  component: ShareLayout,
})
