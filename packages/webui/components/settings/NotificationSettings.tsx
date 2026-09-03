import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { Switch } from '@/ui/components/ui/switch'
import {
  Loader2,
  MessageSquare,
  MessageCircle,
  AtSign,
  UploadCloud,
  Activity,
  Bell,
  LayoutDashboard,
} from 'lucide-react'
import { toast } from 'sonner'
import type { NotificationSettings as Settings } from '@shumai/dtos'
import { m } from '@/ui/paraglide/messages.js'

export function NotificationSettings({ teamId }: { teamId: string }) {
  const queryClient = useQueryClient()

  const { data: settings, isLoading } = useQuery({
    queryKey: ['teams', teamId, 'notification-settings'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].notifications.settings.$get({
        param: { teamId },
      })
      if (!res.ok) throw new Error(m.failed_load_settings())
      return (await res.json()) as Settings
    },
  })

  const { mutate: updateSettings, isPending: isUpdating } = useMutation({
    mutationFn: async (updated: Settings) => {
      const res = await client.api.teams[':teamId'].notifications.settings.$post({
        param: { teamId },
        json: updated,
      })
      if (!res.ok) throw new Error(m.failed_to_update_notification_settings())
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'notification-settings'] })
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'notifications'] })
      toast.success(m.notification_settings_updated())
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : m.failed_to_update_notification_settings())
    },
  })

  const handleToggle = (key: keyof Settings) => {
    if (!settings) return
    const updated = {
      ...settings,
      [key]: !settings[key],
    }
    updateSettings(updated)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 pr-4 pb-8">
        {/* Comments Settings */}
        <Card className="overflow-hidden gap-0 py-0">
          <CardHeader className="border-b border-border bg-muted/30 py-5">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">{m.comments_and_replies()}</CardTitle>
            </div>
            <CardDescription>{m.comments_notification_description()}</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {/* General Comments */}
            <div className="flex items-center justify-between p-6">
              <div className="flex gap-4">
                <div className="mt-1 flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-foreground">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-sm font-semibold text-foreground">{m.general_comments()}</h4>
                  <p className="text-sm text-muted-foreground">{m.when_someone_comments()}</p>
                </div>
              </div>
              <Switch
                checked={settings?.comments ?? true}
                onCheckedChange={() => handleToggle('comments')}
                disabled={isUpdating}
              />
            </div>

            {/* Comment Replies */}
            <div className="flex items-center justify-between p-6">
              <div className="flex gap-4">
                <div className="mt-1 flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-foreground">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-sm font-semibold text-foreground">{m.comment_replies()}</h4>
                  <p className="text-sm text-muted-foreground">{m.when_someone_replies()}</p>
                </div>
              </div>
              <Switch
                checked={settings?.replies ?? true}
                onCheckedChange={() => handleToggle('replies')}
                disabled={isUpdating}
              />
            </div>

            {/* Mentions */}
            <div className="flex items-center justify-between p-6">
              <div className="flex gap-4">
                <div className="mt-1 flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-foreground">
                  <AtSign className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-sm font-semibold text-foreground">{m.at_mentions()}</h4>
                  <p className="text-sm text-muted-foreground">{m.when_someone_mentions()}</p>
                </div>
              </div>
              <Switch
                checked={settings?.mentions ?? true}
                onCheckedChange={() => handleToggle('mentions')}
                disabled={isUpdating}
              />
            </div>
          </CardContent>
        </Card>

        {/* Assets Settings */}
        <Card className="overflow-hidden gap-0 py-0">
          <CardHeader className="border-b border-border bg-muted/30 py-5">
            <div className="flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">{m.assets_and_statuses()}</CardTitle>
            </div>
            <CardDescription>{m.assets_notification_description()}</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {/* Your Uploads */}
            <div className="flex items-center justify-between p-6">
              <div className="flex gap-4">
                <div className="mt-1 flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-foreground">
                  <Bell className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-sm font-semibold text-foreground">{m.your_uploads()}</h4>
                  <p className="text-sm text-muted-foreground">{m.when_you_upload_assets()}</p>
                </div>
              </div>
              <Switch
                checked={settings?.yourUploads ?? false}
                onCheckedChange={() => handleToggle('yourUploads')}
                disabled={isUpdating}
              />
            </div>

            {/* Other Uploads */}
            <div className="flex items-center justify-between p-6">
              <div className="flex gap-4">
                <div className="mt-1 flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-foreground">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-sm font-semibold text-foreground">{m.other_uploads()}</h4>
                  <p className="text-sm text-muted-foreground">
                    {m.when_other_users_upload_assets()}
                  </p>
                </div>
              </div>
              <Switch
                checked={settings?.otherUploads ?? true}
                onCheckedChange={() => handleToggle('otherUploads')}
                disabled={isUpdating}
              />
            </div>

            {/* Status Updates */}
            <div className="flex items-center justify-between p-6">
              <div className="flex gap-4">
                <div className="mt-1 flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-foreground">
                  <Activity className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-sm font-semibold text-foreground">{m.status_updates()}</h4>
                  <p className="text-sm text-muted-foreground">{m.when_someone_changes_status()}</p>
                </div>
              </div>
              <Switch
                checked={settings?.statusUpdates ?? true}
                onCheckedChange={() => handleToggle('statusUpdates')}
                disabled={isUpdating}
              />
            </div>
          </CardContent>
        </Card>

        {/* Kanban Settings */}
        <Card className="overflow-hidden gap-0 py-0">
          <CardHeader className="border-b border-border bg-muted/30 py-5">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">{m.kanban_notifications()}</CardTitle>
            </div>
            <CardDescription>{m.kanban_notification_description()}</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {/* Kanban Tasks */}
            <div className="flex items-center justify-between p-6">
              <div className="flex gap-4">
                <div className="mt-1 flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-foreground">
                  <LayoutDashboard className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-sm font-semibold text-foreground">{m.kanban_tasks()}</h4>
                  <p className="text-sm text-muted-foreground">{m.when_kanban_task_events()}</p>
                </div>
              </div>
              <Switch
                checked={settings?.kanbanTasks ?? true}
                onCheckedChange={() => handleToggle('kanbanTasks')}
                disabled={isUpdating}
              />
            </div>

            {/* Kanban Comments */}
            <div className="flex items-center justify-between p-6">
              <div className="flex gap-4">
                <div className="mt-1 flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-foreground">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-sm font-semibold text-foreground">{m.kanban_comments()}</h4>
                  <p className="text-sm text-muted-foreground">{m.when_kanban_task_commented()}</p>
                </div>
              </div>
              <Switch
                checked={settings?.kanbanComments ?? true}
                onCheckedChange={() => handleToggle('kanbanComments')}
                disabled={isUpdating}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  )
}
