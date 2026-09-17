import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { Switch } from '@/ui/components/ui/switch'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { m } from '@/ui/paraglide/messages.js'
import { useUserMetadataStore } from '@/ui/stores/user-metadata'
import { useChatbotStore } from '@/ui/stores/chatbot'

interface AppearanceSettingsProps {
  teamId: string
}

export function AppearanceSettings({ teamId }: AppearanceSettingsProps) {
  const queryClient = useQueryClient()

  const { data: settings, isLoading } = useQuery({
    queryKey: ['teams', teamId, 'settings'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].settings.$get({
        param: { teamId },
      })
      if (!res.ok) throw new Error(m.failed_load_settings())
      return await res.json()
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

  const hideAgent =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Boolean((settings as any)?.appearance?.hideAgent)

  const handleToggleHideAgent = (checked: boolean) => {
    updateSettings(checked)
  }

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
    </div>
  )
}
