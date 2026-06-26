import { client } from '@/ui/api/client'
import { DualSidebar, DualSidebarItem } from '@/ui/components/dual-sidebar'
import { NotificationList } from '@/ui/components/notification-list'
import { TopNav } from '@/ui/components/top-nav'
import { HomeIcon, NotificationFillIcon, UploadCloudIcon } from '@/ui/components/ui/icons'
import { Toaster } from '@/ui/components/ui/sonner'
import { UploadTasks } from '@/ui/components/upload-tasks'
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
import { getLocale, setLocale } from '@/ui/src/paraglide/runtime.js'
import { m } from '@/ui/src/paraglide/messages.js'
import { useUserMetadataStore } from '@/ui/stores/user-metadata'

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
      <span className="absolute top-0 -right-1 mt-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs leading-4 bg-red-400 dark:bg-red-500 text-white pointer-events-none h-5 min-w-5">
        {displayCount}
      </span>
    ) : null

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <Toaster />
      <DualSidebar>
        <DualSidebarItem
          icon={<HomeIcon />}
          label={m.dashboard()}
          onItemClick={() => {
            if (storedTeamId) {
              navigate({
                to: '/teams/$teamId',
                params: { teamId: storedTeamId },
              })
            }
          }}
        />
        <DualSidebarItem icon={<NotificationFillIcon />} label={m.notifications()} badge={badge}>
          <NotificationList />
        </DualSidebarItem>
        <DualSidebarItem
          icon={
            <UploadCloudIcon
              uploading={uploading > 0}
              className={uploading > 0 ? 'text-blue-500' : ''}
            />
          }
          label={m.uploads()}
        >
          <UploadTasks />
        </DualSidebarItem>
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
  beforeLoad: async () => {
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname
      const teamIdMatch = pathname.match(/^\/teams\/([^/]+)/)
      const teamId = teamIdMatch ? teamIdMatch[1] : null

      if (teamId) {
        const { fetchMetadata, getMetadata } = useUserMetadataStore.getState()
        try {
          await fetchMetadata(teamId)
          const savedLocale = getMetadata<string>('locale')
          if ((savedLocale === 'en' || savedLocale === 'zh') && savedLocale !== getLocale()) {
            setLocale(savedLocale, { reload: false })
          }
        } catch (e) {
          console.error('Failed to load user locale metadata:', e)
        }
      }

      document.documentElement.setAttribute('lang', getLocale())
    }
  },
  component: RootComponent,
})
