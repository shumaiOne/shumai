import { client } from '@/ui/api/client'
import { DualSidebar, DualSidebarItem } from '@/ui/components/dual-sidebar'
import { NotificationList } from '@/ui/components/notification-list'
import { TopNav } from '@/ui/components/top-nav'
import { HomeIcon, NotificationFillIcon, UploadCloudIcon } from '@/ui/components/ui/icons'
import { Toaster } from '@/ui/components/ui/sonner'
import { UploadTasks } from '@/ui/components/upload-tasks'
import { usePermissions } from '@/ui/hooks/use-permissions'
import { useAuthStore } from '@/ui/stores/auth'
import { useTeamContextStore } from '@/ui/stores/team-context'
import { useUploadStore } from '@/ui/stores/upload'
import { useQuery } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  Outlet,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import { useEffect } from 'react'

function RootComponent() {
  const user = useAuthStore((state) => state.user)
  const { uploading } = useUploadStore()
  const { canEdit } = usePermissions()
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

  const { data: me } = useQuery({
    queryKey: ['teams', storedTeamId, 'me'],
    queryFn: async () => {
      if (!storedTeamId) return null
      const res = await client.api.teams[':teamId'].me.$get({
        param: { teamId: storedTeamId },
      })
      if (!res.ok) throw new Error('Failed to fetch me')
      return await res.json()
    },
    enabled: !!storedTeamId,
  })

  const unreadCount = me?.unreadNotificationCount ?? 0
  const displayCount = unreadCount > 99 ? '99+' : unreadCount
  const badge =
    unreadCount > 0 ? (
      <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-slate-100 dark:border-slate-900 animate-pulse">
        {displayCount}
      </div>
    ) : null

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
        <DualSidebarItem icon={<NotificationFillIcon />} label="Notifications" badge={badge}>
          <NotificationList />
        </DualSidebarItem>
        {canEdit && (
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
        )}
      </DualSidebar>
      <div className="flex flex-col flex-1 md:pl-16 overflow-hidden relative">
        <TopNav />
        <main className="flex-1 overflow-hidden relative flex flex-col">
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
