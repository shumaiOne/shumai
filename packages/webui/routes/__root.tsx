import { client } from '@/ui/api/client'
import { DualSidebar, DualSidebarItem } from '@/ui/components/dual-sidebar'
import { NotificationList } from '@/ui/components/notification-list'
import { TopNav } from '@/ui/components/top-nav'
import { HomeIcon, NotificationFillIcon, UploadCloudIcon } from '@/ui/components/ui/icons'
import { Toaster } from '@/ui/components/ui/sonner'
import { UploadTasks } from '@/ui/components/upload-tasks'
import { m } from '@/ui/paraglide/messages.js'
import { getLocale, setLocale } from '@/ui/paraglide/runtime.js'
import { useAuthStore } from '@/ui/stores/auth'
import { useTeamContextStore } from '@/ui/stores/team-context'
import { useUploadStore } from '@/ui/stores/upload'
import { useUserMetadataStore } from '@/ui/stores/user-metadata'
import { useQuery } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  Outlet,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import { useEffect } from 'react'
import { DragDropProvider, KeyboardSensor, PointerSensor } from '@dnd-kit/react'
import { PointerActivationConstraints, Feedback } from '@dnd-kit/dom'
import { SnapToPointer } from '@/ui/components/dnd-modifiers'
import { useDndStore } from '@/ui/stores/dnd'
import { AgentChatPanel } from '@/ui/components/chat/AgentChatPanel'
import { Bot } from 'lucide-react'

async function resolveTeamIdFromPath(pathname: string): Promise<string | null> {
  const teamIdMatch = pathname.match(/^\/teams\/([^/]+)/)
  const teamId = teamIdMatch ? teamIdMatch[1] : null
  if (teamId) return teamId

  const projectIdMatch = pathname.match(/^\/projects\/([^/]+)/)
  const projectId = projectIdMatch ? projectIdMatch[1] : null
  if (projectId) {
    const { ensureTeamIdForProject } = useTeamContextStore.getState()
    return await ensureTeamIdForProject(projectId)
  }

  return null
}

function RootComponent() {
  const user = useAuthStore((state) => state.user)
  const { uploading } = useUploadStore()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()
  const { teamId: storedTeamId, setTeamId } = useTeamContextStore()

  const { triggerDragStart, triggerDragEnd } = useDndStore()
  const { getMetadata } = useUserMetadataStore()
  const chatAgentId = getMetadata<string>('chat_agent_id') || ''

  const showSidebar = user && (pathname.startsWith('/teams/') || pathname.startsWith('/projects/'))

  useEffect(() => {
    resolveTeamIdFromPath(pathname).then((resolvedTeamId) => {
      if (resolvedTeamId && resolvedTeamId !== storedTeamId) {
        setTeamId(resolvedTeamId)
      }
    })
  }, [pathname, storedTeamId, setTeamId])

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

  if (!showSidebar) {
    return <Outlet />
  }

  const unreadCount = me?.unreadNotificationCount ?? 0
  const displayCount = unreadCount > 99 ? '99+' : unreadCount
  const badge =
    unreadCount > 0 ? (
      <span className="absolute justify-center top-0 -right-1 mt-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs leading-4 bg-red-400 dark:bg-red-500 text-white pointer-events-none h-5 min-w-5">
        {displayCount}
      </span>
    ) : null

  return (
    <DragDropProvider
      modifiers={[SnapToPointer.configure({ anchor: { x: 0, y: 0 } })]}
      plugins={(defaults) =>
        defaults.map((p) => {
          if (p === Feedback) {
            return Feedback.configure({ dropAnimation: null })
          }
          if (typeof p === 'object' && p !== null && 'plugin' in p && p.plugin === Feedback) {
            return Feedback.configure({ dropAnimation: null })
          }
          return p
        })
      }
      sensors={[
        PointerSensor.configure({
          activationConstraints: [new PointerActivationConstraints.Distance({ value: 10 })],
        }),
        KeyboardSensor,
      ]}
      onDragStart={triggerDragStart}
      onDragEnd={triggerDragEnd}
    >
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
          <DualSidebarItem
            icon={<Bot className="w-5 h-5" />}
            label={m.agent()}
            disabled={!chatAgentId}
            tooltipMessage={!chatAgentId ? m.configure_chat_agent_tooltip() : undefined}
            scrollable={false}
          >
            <AgentChatPanel />
          </DualSidebarItem>
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
    </DragDropProvider>
  )
}

import { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  beforeLoad: async ({ location }) => {
    if (typeof window !== 'undefined') {
      const pathname = location.pathname
      const teamId = await resolveTeamIdFromPath(pathname)

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
