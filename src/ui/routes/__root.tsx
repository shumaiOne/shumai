import { DualSidebar, DualSidebarItem } from '@/ui/components/dual-sidebar'
import { NotificationList } from '@/ui/components/notification-list'
import { NotificationFillIcon } from '@/ui/components/ui/icons'
import { Toaster } from '@/ui/components/ui/sonner'
import { UploadCloudIcon } from '@/ui/components/ui/upload-cloud'
import { UploadTasks } from '@/ui/components/upload-tasks'
import { useAuthStore } from '@/ui/stores/auth'
import { useTeamContextStore } from '@/ui/stores/team-context'
import { useUploadStore } from '@/ui/stores/upload'
import {
  createRootRouteWithContext,
  Outlet,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import { HomeIcon } from 'lucide-react'
import { useEffect } from 'react'
import { TopNav } from '@/ui/components/top-nav'

function RootComponent() {
  const user = useAuthStore((state) => state.user)
  const { uploading } = useUploadStore()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()

  const showSidebar = user && (pathname.startsWith('/teams/') || pathname.startsWith('/projects/'))

  if (!showSidebar) {
    return <Outlet />
  }

  // Extract teamId from pathname if possible
  // Matches /teams/:teamId
  const teamIdMatch = pathname.match(/^\/teams\/([^/]+)/)
  const teamId = teamIdMatch ? teamIdMatch[1] : null

  const projectIdMatch = pathname.match(/^\/projects\/([^/]+)/)
  const projectId = projectIdMatch ? projectIdMatch[1] : null

  const { teamId: storedTeamId, setTeamId, ensureTeamIdForProject } = useTeamContextStore()

  useEffect(() => {
    if (teamId) {
      setTeamId(teamId)
    } else if (projectId) {
      ensureTeamIdForProject(projectId)
    }
  }, [teamId, projectId, setTeamId, ensureTeamIdForProject])

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <Toaster />
      <DualSidebar>
        <DualSidebarItem
          icon={<HomeIcon />}
          label="Dashboard"
          onItemClick={() => {
            if (storedTeamId) {
              navigate({
                to: '/teams/$teamId',
                params: { teamId: storedTeamId },
              })
            }
          }}
        />
        <DualSidebarItem icon={<NotificationFillIcon />} label="Notifications">
          <NotificationList />
        </DualSidebarItem>
        <DualSidebarItem
          icon={
            <UploadCloudIcon
              uploading={uploading > 0}
              className={uploading > 0 ? 'text-blue-500' : ''}
            />
          }
          label="Uploads"
        >
          <UploadTasks />
        </DualSidebarItem>
      </DualSidebar>
      <div className="flex flex-col flex-1 md:pl-16 overflow-hidden relative">
        <TopNav />
        <main className="flex-1 overflow-hidden relative">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

import { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: RootComponent,
})
