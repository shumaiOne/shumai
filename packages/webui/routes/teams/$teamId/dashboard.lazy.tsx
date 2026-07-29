import { createLazyFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { cn } from '@/ui/lib/utils'
import { m } from '@/ui/paraglide/messages.js'
import { AiUsageDashboard } from '@/ui/components/dashboard/AiUsageDashboard'
import { AgentSessionsDashboard } from '@/ui/components/dashboard/AgentSessionsDashboard'
import { BarChart2, Loader2, MessagesSquare, ShieldAlert } from 'lucide-react'

type DashboardTab = 'ai-usage' | 'ai-sessions'

function TeamDashboardPage() {
  const { teamId } = Route.useParams()
  const [activeTab, setActiveTab] = useState<DashboardTab>('ai-usage')

  const { data: me, isLoading: isMeLoading } = useQuery({
    queryKey: ['teams', teamId, 'me'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].me.$get({
        param: { teamId: teamId },
      })
      if (!res.ok) throw new Error('Failed to fetch me')
      return await res.json()
    },
    enabled: !!teamId,
  })

  if (isMeLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (me?.role?.toLowerCase() !== 'owner') {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <ShieldAlert className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold tracking-tight mb-2">{m.access_denied()}</h2>
        <p className="text-sm text-muted-foreground max-w-md">{m.only_owner_dashboard()}</p>
      </div>
    )
  }

  return (
    <div className="h-full bg-background font-sans selection:bg-primary/20 transition-colors duration-300">
      <div className="flex flex-col md:flex-row h-full">
        {/* Sidebar */}
        <div className="w-full h-full md:w-72 bg-sidebar border-b md:border-b-0 md:border-r border-sidebar-border z-10 md:left-16 overflow-y-auto transition-colors duration-300">
          <nav className="p-4 space-y-1 mt-4">
            <div className="mb-2 px-4 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
              {m.dashboard()}
            </div>

            <div className="mt-4 mb-2 px-4 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider pt-4 border-t border-sidebar-border">
              {m.ai()}
            </div>

            <button
              onClick={() => setActiveTab('ai-usage')}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all',
                activeTab === 'ai-usage'
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-border'
                  : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              <BarChart2 className="w-5 h-5" />
              {m.usage()}
              {activeTab === 'ai-usage' && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('ai-sessions')}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all',
                activeTab === 'ai-sessions'
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-border'
                  : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              <MessagesSquare className="w-5 h-5" />
              {m.sessions()}
              {activeTab === 'ai-sessions' && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
              )}
            </button>
          </nav>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto space-y-8">
            {activeTab === 'ai-usage' && <AiUsageDashboard teamId={teamId} />}
            {activeTab === 'ai-sessions' && <AgentSessionsDashboard teamId={teamId} />}
          </div>
        </div>
      </div>
    </div>
  )
}

export const Route = createLazyFileRoute('/teams/$teamId/dashboard')({
  component: TeamDashboardPage,
})
