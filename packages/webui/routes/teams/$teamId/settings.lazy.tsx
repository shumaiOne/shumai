import { createLazyFileRoute } from '@tanstack/react-router'
import {
  VideoTranscodeStrategy,
  HardwareAcceleration,
  UpdateTeamSettingsRequest,
} from '@shumai/dtos'
import { client } from '@/ui/api/client'
import { AgentsSettings } from '@/ui/components/settings/AgentsSettings'
import { ProvidersSettings } from '@/ui/components/settings/ProvidersSettings'
import { SandboxSettings } from '@/ui/components/settings/SandboxSettings'
import { SkillsConfigCard } from '@/ui/components/settings/SkillsConfigCard'
import { McpConfigCard } from '@/ui/components/settings/McpConfigCard'
import { NotificationSettings } from '@/ui/components/settings/NotificationSettings'
import { DeveloperSettings } from '@/ui/components/settings/DeveloperSettings'
import { QuotasSettings } from '@/ui/components/settings/QuotasSettings'
import { ImageVideoGenerationSettings } from '@/ui/components/settings/ImageVideoGenerationSettings'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { cn } from '@/ui/lib/utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bot,
  Cpu,
  Film,
  Loader2,
  Puzzle,
  Server,
  Shield,
  Sparkles,
  User,
  Bell,
  Key,
  Gauge,
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/components/ui/avatar'
import { Input } from '@/ui/components/ui/input'
import { Button } from '@/ui/components/ui/button'
import { AvatarCropDialog } from '@/ui/components/settings/AvatarCropDialog'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/ui/select'
import { useUserMetadataStore } from '@/ui/stores/user-metadata'
import { getLocale, setLocale } from '@/ui/paraglide/runtime.js'
import { m } from '@/ui/paraglide/messages.js'

type SettingsTab =
  | 'general'
  | 'transcode'
  | 'quotas'
  | 'skills'
  | 'mcp'
  | 'providers'
  | 'image-video'
  | 'agents'
  | 'sandbox'
  | 'notifications'
  | 'developer'

const VALID_SETTINGS_TABS: readonly SettingsTab[] = [
  'general',
  'transcode',
  'quotas',
  'skills',
  'mcp',
  'providers',
  'image-video',
  'agents',
  'sandbox',
  'notifications',
  'developer',
]

function getTabFromHash(): SettingsTab {
  if (typeof window === 'undefined') return 'general'
  const hash = window.location.hash.replace(/^#/, '')
  return (VALID_SETTINGS_TABS as readonly string[]).includes(hash)
    ? (hash as SettingsTab)
    : 'general'
}

function TeamSettingsPage() {
  const { teamId } = Route.useParams()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTabState] = useState<SettingsTab>(getTabFromHash)

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTabState(tab)
    const newHash = tab === 'general' ? '' : `#${tab}`
    if (window.location.hash !== newHash) {
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search + newHash,
      )
    }
  }

  useEffect(() => {
    const onHashChange = () => {
      setActiveTabState(getTabFromHash())
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])
  const [profileName, setProfileName] = useState('')
  const [isCropOpen, setIsCropOpen] = useState(false)
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)

  const { setMetadata, getMetadata } = useUserMetadataStore()
  const currentLocale = getMetadata<string>('locale') || getLocale()

  const handleLanguageChange = async (newLocale: string) => {
    if (newLocale === 'en' || newLocale === 'zh') {
      try {
        await setMetadata(teamId, 'locale', newLocale)
        setLocale(newLocale)
        toast.success(m.language_updated())
      } catch (e) {
        console.error(e)
        toast.error(m.failed_update_language())
      }
    }
  }

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

  useEffect(() => {
    if (me?.name) {
      setProfileName(me.name)
    }
  }, [me])

  useEffect(() => {
    const ownerOnlyTabs: SettingsTab[] = [
      'transcode',
      'quotas',
      'providers',
      'skills',
      'mcp',
      'agents',
      'sandbox',
    ]
    if (me && me.role !== 'owner' && ownerOnlyTabs.includes(activeTab)) {
      handleTabChange('general')
    }
  }, [me, activeTab])

  const getInitials = (name?: string) => {
    if (!name) return 'U'
    const names = name.split(' ')
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = () => {
        setCropImageSrc(reader.result as string)
        setIsCropOpen(true)
      }
      reader.readAsDataURL(file)
      e.target.value = ''
    }
  }

  const handleConfirmCrop = async (blob: Blob) => {
    setIsUpdatingProfile(true)
    try {
      const fileToUpload = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
      const uploadRes = await client.api.teams[':teamId'].files.$post({
        param: { teamId },
        form: { file: fileToUpload },
      })
      if (!uploadRes.ok) throw new Error('Failed to upload avatar')
      const uploadData = await uploadRes.json()
      const key = (uploadData as { key: string }).key

      const patchRes = await client.api.teams[':teamId'].me.$patch({
        param: { teamId },
        json: { imageKey: key },
      })
      if (!patchRes.ok) throw new Error('Failed to save profile')

      toast.success(m.avatar_updated())
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'me'] })
      setIsCropOpen(false)
    } catch (err) {
      console.error(err)
      toast.error(m.failed_update_avatar())
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const handleRemoveAvatar = async () => {
    setIsUpdatingProfile(true)
    try {
      const patchRes = await client.api.teams[':teamId'].me.$patch({
        param: { teamId },
        json: { imageKey: null },
      })
      if (!patchRes.ok) throw new Error('Failed to remove avatar')

      toast.success(m.avatar_removed())
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'me'] })
    } catch (err) {
      console.error(err)
      toast.error(m.failed_remove_avatar())
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const handleUpdateProfile = async () => {
    if (!profileName.trim()) return
    setIsUpdatingProfile(true)
    try {
      const patchRes = await client.api.teams[':teamId'].me.$patch({
        param: { teamId },
        json: { name: profileName.trim() },
      })
      if (!patchRes.ok) throw new Error('Failed to update name')

      toast.success(m.profile_updated())
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'me'] })
    } catch (err) {
      console.error(err)
      toast.error(m.failed_update_profile())
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const { mutate: updateSettings } = useMutation({
    mutationFn: async (data: { teamId: string; data: UpdateTeamSettingsRequest }) => {
      const res = await client.api.teams[':teamId'].settings.$patch({
        param: { teamId: data.teamId },
        json: data.data,
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

  const handleHardwareAccelerationChange = (value: HardwareAcceleration) => {
    updateSettings({
      teamId,
      data: {
        key: 'transcode.hardwareAcceleration',
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
    return <div className="p-8 text-center text-red-500">{m.failed_load_settings()}</div>
  }

  let currentVideoStrategy =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (settings as any)?.transcode?.videoStrategy || VideoTranscodeStrategy.best_match
  if (currentVideoStrategy === 'single' || currentVideoStrategy === 'disable') {
    currentVideoStrategy = VideoTranscodeStrategy.best_match
  } else if (currentVideoStrategy === 'full') {
    currentVideoStrategy = VideoTranscodeStrategy.all
  }

  const currentHardwareAcceleration =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (settings as any)?.transcode?.hardwareAcceleration || HardwareAcceleration.off

  return (
    <div className="h-full bg-background font-sans selection:bg-primary/20 transition-colors duration-300">
      <div className="flex flex-col md:flex-row h-full">
        {/* Sidebar */}
        <div className="w-full h-full md:w-72 bg-sidebar border-b md:border-b-0 md:border-r border-sidebar-border z-10 md:left-16 overflow-y-auto transition-colors duration-300">
          <nav className="p-4 space-y-1 mt-4">
            {/* Personal Settings */}
            <div className="mb-2 px-4 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
              {m.personal_settings()}
            </div>

            <button
              onClick={() => handleTabChange('general')}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all',
                activeTab === 'general'
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-border'
                  : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              <User className="w-5 h-5" />
              {m.general()}
              {activeTab === 'general' && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
              )}
            </button>

            <button
              onClick={() => handleTabChange('notifications')}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all',
                activeTab === 'notifications'
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-border'
                  : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              <Bell className="w-5 h-5" />
              {m.notifications()}
              {activeTab === 'notifications' && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
              )}
            </button>

            <button
              onClick={() => handleTabChange('developer')}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all',
                activeTab === 'developer'
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-border'
                  : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              <Key className="w-5 h-5" />
              {m.api_tokens()}
              {activeTab === 'developer' && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
              )}
            </button>

            {/* Team Settings */}
            {me?.role === 'owner' && (
              <>
                <div className="mt-6 mb-2 px-4 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider pt-4 border-t border-sidebar-border">
                  {m.team_settings()}
                </div>

                <button
                  onClick={() => handleTabChange('transcode')}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all',
                    activeTab === 'transcode'
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-border'
                      : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  )}
                >
                  <Film className="w-5 h-5" />
                  {m.media_processing()}
                  {activeTab === 'transcode' && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
                  )}
                </button>

                <button
                  onClick={() => handleTabChange('quotas')}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all',
                    activeTab === 'quotas'
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-border'
                      : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  )}
                >
                  <Gauge className="w-5 h-5" />
                  {m.quotas()}
                  {activeTab === 'quotas' && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
                  )}
                </button>
              </>
            )}

            {/* AI */}
            {me?.role === 'owner' && (
              <>
                <div className="mt-6 mb-2 px-4 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider pt-4 border-t border-sidebar-border">
                  {m.ai_settings()}
                </div>

                <button
                  onClick={() => handleTabChange('providers')}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all',
                    activeTab === 'providers'
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-border'
                      : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  )}
                >
                  <Cpu className="w-5 h-5" />
                  {m.providers()}
                  {activeTab === 'providers' && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
                  )}
                </button>

                <button
                  onClick={() => handleTabChange('image-video')}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all',
                    activeTab === 'image-video'
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-border'
                      : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  )}
                >
                  <Sparkles className="w-5 h-5" />
                  {m.image_video_generation()}
                  {activeTab === 'image-video' && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
                  )}
                </button>

                <button
                  onClick={() => handleTabChange('skills')}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all',
                    activeTab === 'skills'
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-border'
                      : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  )}
                >
                  <Puzzle className="w-5 h-5" />
                  {m.skills()}
                  {activeTab === 'skills' && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
                  )}
                </button>

                <button
                  onClick={() => handleTabChange('mcp')}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all',
                    activeTab === 'mcp'
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-border'
                      : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  )}
                >
                  <Server className="w-5 h-5" />
                  {m.mcp_servers()}
                  {activeTab === 'mcp' && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
                  )}
                </button>

                <button
                  onClick={() => handleTabChange('agents')}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all',
                    activeTab === 'agents'
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-border'
                      : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  )}
                >
                  <Bot className="w-5 h-5" />
                  {m.agents()}
                  {activeTab === 'agents' && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
                  )}
                </button>

                <button
                  onClick={() => handleTabChange('sandbox')}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all',
                    activeTab === 'sandbox'
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-border'
                      : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  )}
                >
                  <Shield className="w-5 h-5" />
                  {m.agent_sandbox()}
                  {activeTab === 'sandbox' && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
                  )}
                </button>
              </>
            )}
          </nav>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 bg-background/50 h-full flex flex-col transition-colors duration-300 overflow-y-hidden">
          <div className="flex-1 flex flex-col max-w-4xl w-full mx-auto p-6 md:p-10 overflow-hidden">
            <div className="flex-none flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  {activeTab === 'general' && m.general_settings()}
                  {activeTab === 'transcode' && m.media_processing()}
                  {activeTab === 'quotas' && m.resource_quotas()}
                  {activeTab === 'skills' && m.skills_management()}
                  {activeTab === 'mcp' && m.mcp_servers()}
                  {activeTab === 'providers' && m.ai_providers()}
                  {activeTab === 'agents' && m.ai_agents()}
                  {activeTab === 'sandbox' && m.agent_sandbox_settings()}
                  {activeTab === 'notifications' && m.notification_settings()}
                  {activeTab === 'developer' && m.developer_settings()}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {activeTab === 'general' && m.general_settings_description()}
                  {activeTab === 'transcode' && m.transcode_description()}
                  {activeTab === 'quotas' && m.resource_quotas_description()}
                  {activeTab === 'skills' && m.skills_description()}
                  {activeTab === 'mcp' && m.mcp_servers_description()}
                  {activeTab === 'providers' && m.providers_description()}
                  {activeTab === 'agents' && m.agents_description()}
                  {activeTab === 'sandbox' && m.sandbox_description()}
                  {activeTab === 'notifications' && m.notifications_description()}
                  {activeTab === 'developer' && m.developer_description()}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
              {activeTab === 'general' && (
                <div className="h-full overflow-y-auto space-y-6 pr-1">
                  <Card>
                    <CardHeader>
                      <CardTitle>{m.personal_info()}</CardTitle>
                      <CardDescription>{m.personal_info_description()}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex flex-col md:flex-row gap-8 items-start">
                        {/* Avatar Column */}
                        <div className="flex flex-col items-center gap-3">
                          <span className="text-sm font-medium text-muted-foreground">
                            {m.avatar()}
                          </span>
                          <div
                            className="group relative cursor-pointer overflow-hidden rounded-full w-24 h-24 border border-border/60 shadow-md transition-all hover:opacity-90"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Avatar className="w-24 h-24">
                              {me?.image && (
                                <AvatarImage
                                  src={me.image}
                                  alt={me.name}
                                  className="object-cover w-24 h-24"
                                />
                              )}
                              <AvatarFallback className="text-2xl bg-primary/40 text-foreground">
                                {getInitials(me?.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-white text-xs font-semibold">{m.change()}</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              {m.upload()}
                            </Button>
                            {me?.image && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-600"
                                onClick={handleRemoveAvatar}
                              >
                                {m.remove()}
                              </Button>
                            )}
                          </div>
                          <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleAvatarFileChange}
                          />
                        </div>

                        {/* Details Column */}
                        <div className="flex-1 space-y-4 w-full">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">
                              {m.name()}
                            </label>
                            <Input
                              value={profileName}
                              onChange={(e) => setProfileName(e.target.value)}
                              placeholder={m.enter_your_name()}
                              className="max-w-md"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">
                              {m.email()}
                            </label>
                            <Input
                              value={me?.email || ''}
                              disabled
                              className="max-w-md bg-muted/50 cursor-not-allowed"
                            />
                            <p className="text-xs text-muted-foreground">
                              {m.email_managed_by_auth()}
                            </p>
                          </div>
                          <Button
                            onClick={handleUpdateProfile}
                            disabled={isUpdatingProfile || !profileName.trim()}
                            className="mt-2"
                          >
                            {isUpdatingProfile && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            {m.save_changes()}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border border-slate-200 dark:border-slate-800 mt-6">
                    <CardHeader>
                      <CardTitle>{m.language_settings()}</CardTitle>
                      <CardDescription>{m.select_preferred_language()}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="max-w-xs">
                        <Select value={currentLocale} onValueChange={handleLanguageChange}>
                          <SelectTrigger>
                            <SelectValue placeholder={m.select_language()} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="en">{m.english()}</SelectItem>
                            <SelectItem value="zh">{m.chinese()}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>

                  <AvatarCropDialog
                    isOpen={isCropOpen}
                    onClose={() => setIsCropOpen(false)}
                    imageSrc={cropImageSrc}
                    onConfirm={handleConfirmCrop}
                  />
                </div>
              )}

              {activeTab === 'transcode' && (
                <div className="h-full overflow-y-auto pr-1">
                  <Card>
                    <CardHeader>
                      <CardTitle>{m.transcode_settings()}</CardTitle>
                      <CardDescription>
                        <span className="block mb-2">{m.transcode_description()}</span>
                        <span className="block">{m.transcode_strategy_note()}</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Video Strategy */}
                      <div className="space-y-3">
                        <h3 className="text-lg font-medium">{m.video_strategy()}</h3>
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
                            <div className="font-semibold">{m.best_match()}</div>
                            <div className="text-sm text-muted-foreground">
                              {m.best_match_description()}
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
                            <div className="font-semibold">{m.all_resolutions()}</div>
                            <div className="text-sm text-muted-foreground">
                              {m.all_resolutions_description()}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Hardware Acceleration */}
                      <div className="space-y-3 pt-6 border-t border-border">
                        <h3 className="text-lg font-medium">{m.hardware_acceleration()}</h3>
                        <div className="space-y-3">
                          <div
                            className={cn(
                              'cursor-pointer rounded-lg border p-4 transition-all hover:border-primary',
                              currentHardwareAcceleration === HardwareAcceleration.off
                                ? 'border-primary bg-primary/5'
                                : 'border-border',
                            )}
                            onClick={() =>
                              handleHardwareAccelerationChange(HardwareAcceleration.off)
                            }
                          >
                            <div className="font-semibold">{m.hardware_acceleration_off()}</div>
                            <div className="text-sm text-muted-foreground">
                              {m.hardware_acceleration_off_description()}
                            </div>
                          </div>

                          <div
                            className={cn(
                              'cursor-pointer rounded-lg border p-4 transition-all hover:border-primary',
                              currentHardwareAcceleration === HardwareAcceleration.auto
                                ? 'border-primary bg-primary/5'
                                : 'border-border',
                            )}
                            onClick={() =>
                              handleHardwareAccelerationChange(HardwareAcceleration.auto)
                            }
                          >
                            <div className="font-semibold">{m.hardware_acceleration_auto()}</div>
                            <div className="text-sm text-muted-foreground">
                              {m.hardware_acceleration_auto_description()}
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

              {activeTab === 'mcp' && (
                <div className="h-full overflow-y-auto pr-1">
                  <McpConfigCard teamId={teamId} />
                </div>
              )}

              {activeTab === 'providers' && <ProvidersSettings teamId={teamId} />}

              {activeTab === 'image-video' && <ImageVideoGenerationSettings teamId={teamId} />}

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

              {activeTab === 'developer' && <DeveloperSettings teamId={teamId} />}

              {activeTab === 'quotas' && <QuotasSettings teamId={teamId} />}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export const Route = createLazyFileRoute('/teams/$teamId/settings')({
  component: TeamSettingsPage,
})
