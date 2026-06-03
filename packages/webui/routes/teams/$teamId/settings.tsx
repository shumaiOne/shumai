import { VideoTranscodeStrategy } from '@shumai/dtos'
import { client } from '@/ui/api/client'
import { AgentsSettings } from '@/ui/components/settings/AgentsSettings'
import { ProvidersSettings } from '@/ui/components/settings/ProvidersSettings'
import { SandboxSettings } from '@/ui/components/settings/SandboxSettings'
import { SkillsConfigCard } from '@/ui/components/settings/SkillsConfigCard'
import { NotificationSettings } from '@/ui/components/settings/NotificationSettings'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { cn } from '@/ui/lib/utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Bot, Cpu, Film, Loader2, Puzzle, Shield, User, Bell } from 'lucide-react'
import { useState } from 'react'

type SettingsTab =
  | 'general'
  | 'transcode'
  | 'skills'
  | 'providers'
  | 'agents'
  | 'sandbox'
  | 'notifications'

function TeamSettingsPage() {
  const { teamId } = Route.useParams()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')

  const {
    data: settings,
    isLoading: isSettingsLoading,
    error: settingsError,
  } = useQuery({
    queryKey: ['teams', teamId, 'settings'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].settings.$get({
        param: { teamId: teamId },
      })
      if (!res.ok) throw new Error('Failed to fetch settings')
      return await res.json()
    },
  })

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

  const { mutate: updateSettings } = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: async (data: { teamId: string; data: { key: string; value: any } }) => {
      const res = await client.api.teams[':teamId'].settings.$patch({
        param: { teamId: data.teamId },
        json: { key: data.data.key, value: data.data.value },
      })
      if (!res.ok) throw new Error('Failed to update settings')
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['teams', teamId, 'settings'],
      })
    },
  })

  const handleVideoStrategyChange = (value: VideoTranscodeStrategy) => {
    updateSettings({
      teamId,
      data: {
        key: 'transcode.videoStrategy',
        value: value,
      },
    })
  }

  if (isSettingsLoading || isMeLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (settingsError) {
    return <div className="p-8 text-center text-red-500">Failed to load settings.</div>
  }

  let currentVideoStrategy =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (settings as any)?.transcode?.videoStrategy || VideoTranscodeStrategy.best_match
  if (currentVideoStrategy === 'single' || currentVideoStrategy === 'disable') {
    currentVideoStrategy = VideoTranscodeStrategy.best_match
  } else if (currentVideoStrategy === 'full') {
    currentVideoStrategy = VideoTranscodeStrategy.all
  }

  return (
    <div className="h-full bg-background font-sans selection:bg-primary/20 transition-colors duration-300">
      <div className="flex flex-col md:flex-row h-full">
        {/* Sidebar */}
        <div className="w-full h-full md:w-72 bg-sidebar border-b md:border-b-0 md:border-r border-sidebar-border z-10 md:left-16 overflow-y-auto transition-colors duration-300">
          <nav className="p-4 space-y-1 mt-4">
            <div className="mb-2 px-4 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
              Settings
            </div>

            <button
              onClick={() => setActiveTab('general')}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all',
                activeTab === 'general'
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-border'
                  : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              <User className="w-5 h-5" />
              General
              {activeTab === 'general' && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('transcode')}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all',
                activeTab === 'transcode'
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-border'
                  : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              <Film className="w-5 h-5" />
              Media Processing
              {activeTab === 'transcode' && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('notifications')}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all',
                activeTab === 'notifications'
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-border'
                  : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              <Bell className="w-5 h-5" />
              Notifications
              {activeTab === 'notifications' && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
              )}
            </button>

            <div className="mt-6 mb-2 px-4 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider pt-4 border-t border-sidebar-border">
              AI
            </div>

            <button
              onClick={() => setActiveTab('providers')}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all',
                activeTab === 'providers'
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-border'
                  : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              <Cpu className="w-5 h-5" />
              Providers
              {activeTab === 'providers' && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('skills')}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all',
                activeTab === 'skills'
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-border'
                  : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              <Puzzle className="w-5 h-5" />
              Skills
              {activeTab === 'skills' && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('agents')}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all',
                activeTab === 'agents'
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-border'
                  : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              <Bot className="w-5 h-5" />
              Agents
              {activeTab === 'agents' && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('sandbox')}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all',
                activeTab === 'sandbox'
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-border'
                  : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              <Shield className="w-5 h-5" />
              Agent Sandbox
              {activeTab === 'sandbox' && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
              )}
            </button>
          </nav>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 bg-background/50 h-full flex flex-col transition-colors duration-300 overflow-y-hidden">
          <div className="flex-1 flex flex-col max-w-4xl w-full mx-auto p-6 md:p-10 overflow-hidden">
            <div className="flex-none flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  {activeTab === 'general' && 'General Settings'}
                  {activeTab === 'transcode' && 'Media Processing'}
                  {activeTab === 'skills' && 'Skills Management'}
                  {activeTab === 'providers' && 'AI Providers'}
                  {activeTab === 'agents' && 'AI Agents'}
                  {activeTab === 'sandbox' && 'Agent Sandbox Settings'}
                  {activeTab === 'notifications' && 'Notification Settings'}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {activeTab === 'general' && 'View your personal information and team role.'}
                  {activeTab === 'transcode' &&
                    "Manage your team's media transcoding configurations."}
                  {activeTab === 'skills' && 'Add, update and configure AI skills for the team.'}
                  {activeTab === 'providers' &&
                    'Configure AI providers and their models for this team.'}
                  {activeTab === 'agents' && 'Manage AI agents and their personalities.'}
                  {activeTab === 'sandbox' &&
                    'Configure security and network restrictions for the AI agent.'}
                  {activeTab === 'notifications' &&
                    'Configure your personal notification preferences for this team.'}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
              {activeTab === 'general' && (
                <div className="h-full overflow-y-auto space-y-6 pr-1">
                  <Card>
                    <CardHeader>
                      <CardTitle>Personal Info</CardTitle>
                      <CardDescription>View your personal information.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col space-y-2">
                        <span className="text-sm font-medium text-muted-foreground">Name</span>
                        <span className="text-lg">{me?.name}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === 'transcode' && (
                <div className="h-full overflow-y-auto pr-1">
                  <Card>
                    <CardHeader>
                      <CardTitle>Transcode Settings</CardTitle>
                      <CardDescription>
                        <span className="block mb-2">
                          Manage your team&apos;s media transcoding configurations.
                        </span>
                        <span className="block">
                          Strategy: We select the best resolution from your list that supports the
                          input quality. Content is never upscaled.
                        </span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Video Strategy */}
                      <div className="space-y-3">
                        <h3 className="text-lg font-medium">Video Strategy</h3>
                        <div className="space-y-3">
                          <div
                            className={cn(
                              'cursor-pointer rounded-lg border p-4 transition-all hover:border-primary',
                              currentVideoStrategy === VideoTranscodeStrategy.best_match
                                ? 'border-primary bg-primary/5'
                                : 'border-border',
                            )}
                            onClick={() =>
                              handleVideoStrategyChange(VideoTranscodeStrategy.best_match)
                            }
                          >
                            <div className="font-semibold">Best match</div>
                            <div className="text-sm text-muted-foreground">
                              Generates a single optimal resolution matching the source quality.
                            </div>
                          </div>

                          <div
                            className={cn(
                              'cursor-pointer rounded-lg border p-4 transition-all hover:border-primary',
                              currentVideoStrategy === VideoTranscodeStrategy.all
                                ? 'border-primary bg-primary/5'
                                : 'border-border',
                            )}
                            onClick={() => handleVideoStrategyChange(VideoTranscodeStrategy.all)}
                          >
                            <div className="font-semibold">All resolutions</div>
                            <div className="text-sm text-muted-foreground">
                              Generates all supported resolutions up to the source quality.
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === 'skills' && (
                <div className="h-full overflow-y-auto pr-1">
                  <SkillsConfigCard teamId={teamId} />
                </div>
              )}

              {activeTab === 'providers' && <ProvidersSettings teamId={teamId} />}

              {activeTab === 'agents' && (
                <div className="h-full overflow-y-auto pr-1">
                  <AgentsSettings teamId={teamId} />
                </div>
              )}

              {activeTab === 'sandbox' && (
                <div className="h-full overflow-y-auto pr-1">
                  <SandboxSettings teamId={teamId} />
                </div>
              )}

              {activeTab === 'notifications' && <NotificationSettings teamId={teamId} />}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/teams/$teamId/settings')({
  component: TeamSettingsPage,
})
