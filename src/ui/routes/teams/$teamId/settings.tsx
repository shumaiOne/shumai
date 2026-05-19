import { client } from '@/ui/api/client'
import { VideoTranscodeStrategy, ImageTranscodeStrategy } from '@/dtos/team'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { Switch } from '@/ui/components/ui/switch'
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Loader2, User, Film, Cpu, Puzzle } from 'lucide-react'
import { cn } from '@/ui/lib/utils'
import { useState } from 'react'
import { ProvidersSettings } from '@/ui/components/settings/ProvidersSettings'
import { SkillsConfigCard } from '@/ui/components/settings/SkillsConfigCard'
import { AgentsSettings } from '@/ui/components/settings/AgentsSettings'
import { Bot } from 'lucide-react'

type SettingsTab = 'general' | 'transcode' | 'skills' | 'providers' | 'agents'

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

  const handleImageStrategyChange = (value: ImageTranscodeStrategy) => {
    updateSettings({
      teamId,
      data: {
        key: 'transcode.imageStrategy',
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

  const currentVideoStrategy =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (settings as any)?.transcode?.videoStrategy || VideoTranscodeStrategy.single

  const currentImageStrategy =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (settings as any)?.transcode?.imageStrategy || ImageTranscodeStrategy.single

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans selection:bg-blue-100 dark:selection:bg-blue-900 transition-colors duration-300">
      <div className="flex flex-col md:flex-row min-h-screen">
        {/* Sidebar */}
        <aside className="w-full md:w-72 bg-white dark:bg-slate-900 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 flex-shrink-0 z-10 md:fixed md:inset-y-0 md:left-16 overflow-y-auto transition-colors duration-300">
          <nav className="p-4 space-y-1 mt-4">
            <div className="mb-2 px-4 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Settings
            </div>

            <button
              onClick={() => setActiveTab('general')}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all',
                activeTab === 'general'
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-800'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white',
              )}
            >
              <User className="w-5 h-5" />
              General
              {activeTab === 'general' && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('transcode')}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all',
                activeTab === 'transcode'
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-800'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white',
              )}
            >
              <Film className="w-5 h-5" />
              Media Processing
              {activeTab === 'transcode' && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
              )}
            </button>

            <div className="mt-6 mb-2 px-4 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider pt-4 border-t border-slate-100 dark:border-slate-800">
              AI
            </div>

            <button
              onClick={() => setActiveTab('providers')}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all',
                activeTab === 'providers'
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-800'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white',
              )}
            >
              <Cpu className="w-5 h-5" />
              Providers
              {activeTab === 'providers' && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('skills')}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all',
                activeTab === 'skills'
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-800'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white',
              )}
            >
              <Puzzle className="w-5 h-5" />
              Skills
              {activeTab === 'skills' && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('agents')}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all',
                activeTab === 'agents'
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-800'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white',
              )}
            >
              <Bot className="w-5 h-5" />
              Agents
              {activeTab === 'agents' && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
              )}
            </button>
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 bg-slate-50/50 dark:bg-slate-950 md:ml-72 h-screen flex flex-col transition-colors duration-300 overflow-hidden">
          <div className="flex-1 flex flex-col max-w-4xl w-full mx-auto p-6 md:p-10 overflow-hidden">
            <div className="flex-none flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {activeTab === 'general' && 'General Settings'}
                  {activeTab === 'transcode' && 'Media Processing'}
                  {activeTab === 'skills' && 'Skills Management'}
                  {activeTab === 'providers' && 'AI Providers'}
                  {activeTab === 'agents' && 'AI Agents'}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {activeTab === 'general' && 'View your personal information and team role.'}
                  {activeTab === 'transcode' &&
                    "Manage your team's media transcoding configurations."}
                  {activeTab === 'skills' && 'Add, update and configure AI skills for the team.'}
                  {activeTab === 'providers' &&
                    'Configure AI providers and their models for this team.'}
                  {activeTab === 'agents' && 'Manage AI agents and their personalities.'}
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

                  {me?.role === 'owner' && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Team Settings</CardTitle>
                        <CardDescription>Manage your team&apos;s general settings.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <h3 className="text-base font-medium">Enable Public Signup</h3>
                            <p className="text-sm text-muted-foreground">
                              Allow users to sign up without an invite code.
                            </p>
                          </div>
                          <Switch
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            checked={(settings as any)?.enablePublicSignup || false}
                            onCheckedChange={(checked) =>
                              updateSettings({
                                teamId,
                                data: {
                                  key: 'enablePublicSignup',
                                  value: checked,
                                },
                              })
                            }
                          />
                        </div>
                      </CardContent>
                    </Card>
                  )}
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
                              currentVideoStrategy === VideoTranscodeStrategy.single
                                ? 'border-primary bg-primary/5'
                                : 'border-border',
                            )}
                            onClick={() => handleVideoStrategyChange(VideoTranscodeStrategy.single)}
                          >
                            <div className="font-semibold">Best match</div>
                            <div className="text-sm text-muted-foreground">
                              Generates a single optimal resolution matching the source quality.
                            </div>
                          </div>

                          <div
                            className={cn(
                              'cursor-pointer rounded-lg border p-4 transition-all hover:border-primary',
                              currentVideoStrategy === VideoTranscodeStrategy.full
                                ? 'border-primary bg-primary/5'
                                : 'border-border',
                            )}
                            onClick={() => handleVideoStrategyChange(VideoTranscodeStrategy.full)}
                          >
                            <div className="font-semibold">All resolutions</div>
                            <div className="text-sm text-muted-foreground">
                              Generates all supported resolutions up to the source quality.
                            </div>
                          </div>

                          <div
                            className={cn(
                              'cursor-pointer rounded-lg border p-4 transition-all hover:border-primary',
                              currentVideoStrategy === VideoTranscodeStrategy.disable
                                ? 'border-primary bg-primary/5'
                                : 'border-border',
                            )}
                            onClick={() =>
                              handleVideoStrategyChange(VideoTranscodeStrategy.disable)
                            }
                          >
                            <div className="font-semibold">Disable</div>
                            <div className="text-sm text-muted-foreground">
                              Transcoding is disabled. Only system artifacts are generated.
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Image Strategy */}
                      <div className="space-y-3">
                        <h3 className="text-lg font-medium">Image Strategy</h3>
                        <div className="space-y-3">
                          <div
                            className={cn(
                              'cursor-pointer rounded-lg border p-4 transition-all hover:border-primary',
                              currentImageStrategy === ImageTranscodeStrategy.single
                                ? 'border-primary bg-primary/5'
                                : 'border-border',
                            )}
                            onClick={() => handleImageStrategyChange(ImageTranscodeStrategy.single)}
                          >
                            <div className="font-semibold">Best match</div>
                            <div className="text-sm text-muted-foreground">
                              Generates a single optimal resolution matching the source quality.
                            </div>
                          </div>

                          <div
                            className={cn(
                              'cursor-pointer rounded-lg border p-4 transition-all hover:border-primary',
                              currentImageStrategy === ImageTranscodeStrategy.disable
                                ? 'border-primary bg-primary/5'
                                : 'border-border',
                            )}
                            onClick={() =>
                              handleImageStrategyChange(ImageTranscodeStrategy.disable)
                            }
                          >
                            <div className="font-semibold">Disable</div>
                            <div className="text-sm text-muted-foreground">
                              Transcoding is disabled. Only system thumbnails are generated.
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
