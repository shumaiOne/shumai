import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TeamSettingsResponse } from '@shumai/dtos'
import { client } from '@/ui/api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { NativeSelect, NativeSelectOption } from '@/ui/components/ui/native-select'
import { Switch } from '@/ui/components/ui/switch'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { m } from '@/ui/paraglide/messages.js'
import { useUserMetadataStore } from '@/ui/stores/user-metadata'
import { useChatbotStore } from '@/ui/stores/chatbot'

/** Default expiry choices for new share links, in days (0 = never). */
const SHARE_EXPIRY_CHOICES = [0, 1, 3, 7, 14, 30]

type ShareSettingChange =
  | { key: 'share.hideInternalComments'; value: boolean }
  | { key: 'share.defaultExpiryDays'; value: number }

interface AppearanceSettingsProps {
  teamId: string
}

export function AppearanceSettings({ teamId }: AppearanceSettingsProps) {
  const queryClient = useQueryClient()

  const { data: settings, isLoading } = useQuery<TeamSettingsResponse>({
    queryKey: ['teams', teamId, 'settings'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].settings.$get({
        param: { teamId },
      })
      if (!res.ok) throw new Error(m.failed_load_settings())
      return (await res.json()) as TeamSettingsResponse
    },
    enabled: !!teamId,
  })

  const { mutate: updateSettings, isPending: isUpdating } = useMutation({
    mutationFn: async (hideAgent: boolean) => {
      const res = await client.api.teams[':teamId'].settings.$patch({
        param: { teamId },
        json: {
          key: 'appearance.hideAgent',
          value: hideAgent,
        },
      })
      if (!res.ok) throw new Error(m.failed_update_appearance_settings())
      return await res.json()
    },
    onSuccess: async (_, hideAgent) => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'settings'] })
      await useUserMetadataStore.getState().fetchMetadata(teamId)
      if (hideAgent) {
        useChatbotStore.getState().setIsChatbotOpen(false)
      }
      toast.success(m.appearance_settings_updated())
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : m.failed_update_appearance_settings())
    },
  })

  const hideAgent = Boolean(settings?.appearance?.hideAgent)

  const handleToggleHideAgent = (checked: boolean) => {
    updateSettings(checked)
  }

  const hideInternalComments = settings?.share?.hideInternalComments === true
  const defaultExpiryDays = settings?.share?.defaultExpiryDays ?? 0

  const { mutate: updateShareSetting, isPending: isUpdatingShare } = useMutation({
    mutationFn: async (change: ShareSettingChange) => {
      const res = await client.api.teams[':teamId'].settings.$patch({
        param: { teamId },
        json: change,
      })
      if (!res.ok) throw new Error(m.failed_update_settings())
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'settings'] })
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : m.failed_update_settings())
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto pr-1">
      <Card>
        <CardHeader>
          <CardTitle>{m.appearance_settings()}</CardTitle>
          <CardDescription>{m.appearance_settings_description()}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between space-x-4 rounded-lg border border-border p-4">
            <div className="space-y-1">
              <label
                htmlFor="hide-agent-switch"
                className="text-sm font-medium leading-none cursor-pointer"
              >
                {m.hide_agent()}
              </label>
              <p className="text-xs text-muted-foreground">{m.hide_agent_description()}</p>
            </div>
            <Switch
              id="hide-agent-switch"
              checked={hideAgent}
              onCheckedChange={handleToggleHideAgent}
              disabled={isUpdating}
            />
          </div>
        </CardContent>
      </Card>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{m.share_links()}</CardTitle>
          <CardDescription>{m.share_link_settings_description()}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between space-x-4 rounded-lg border border-border p-4">
            <div className="space-y-1">
              <label
                htmlFor="hide-internal-comments-switch"
                className="text-sm font-medium leading-none cursor-pointer"
              >
                {m.hide_internal_comments()}
              </label>
              <p className="text-xs text-muted-foreground">
                {m.hide_internal_comments_description()}
              </p>
            </div>
            <Switch
              id="hide-internal-comments-switch"
              checked={hideInternalComments}
              onCheckedChange={(checked) =>
                updateShareSetting({ key: 'share.hideInternalComments', value: checked })
              }
              disabled={isUpdatingShare}
            />
          </div>
          <div className="flex items-center justify-between space-x-4 rounded-lg border border-border p-4">
            <div className="space-y-1">
              <label
                htmlFor="share-default-expiry-select"
                className="text-sm font-medium leading-none cursor-pointer"
              >
                {m.share_default_expiry()}
              </label>
              <p className="text-xs text-muted-foreground">
                {m.share_default_expiry_description()}
              </p>
            </div>
            <NativeSelect
              id="share-default-expiry-select"
              size="sm"
              value={defaultExpiryDays}
              disabled={isUpdatingShare}
              onChange={(e) =>
                updateShareSetting({
                  key: 'share.defaultExpiryDays',
                  value: Number(e.target.value),
                })
              }
            >
              {SHARE_EXPIRY_CHOICES.map((days) => (
                <NativeSelectOption key={days} value={days}>
                  {days === 0 ? m.share_expiry_never() : m.share_expiry_days({ days })}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
