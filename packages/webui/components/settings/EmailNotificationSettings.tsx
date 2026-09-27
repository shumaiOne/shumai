import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import { Card, CardContent, CardFooter } from '@/ui/components/ui/card'
import { Switch } from '@/ui/components/ui/switch'
import { Input } from '@/ui/components/ui/input'
import { Button } from '@/ui/components/ui/button'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { EmailNotificationSettings as Settings } from '@shumai/dtos'
import { m } from '@/ui/paraglide/messages.js'
import { TestEmailDialog } from '@/ui/components/settings/TestEmailDialog'

interface EmailNotificationSettingsProps {
  teamId: string
}

export function EmailNotificationSettings({ teamId }: EmailNotificationSettingsProps) {
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState<Settings>({
    enabled: false,
    host: '',
    port: 587,
    username: '',
    password: '',
    smtps: false,
    ignoreCert: false,
    from: '',
    replyTo: '',
    uploadDebounceSeconds: 300,
  })

  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false)

  const {
    data: settings,
    isLoading,
    error,
  } = useQuery<Settings>({
    queryKey: ['teams', teamId, 'email-settings'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].notifications.email.$get({
        param: { teamId },
      })
      if (!res.ok) throw new Error(m.failed_to_load_email_settings())
      return (await res.json()) as Settings
    },
    enabled: !!teamId,
  })

  useEffect(() => {
    if (settings) {
      setFormData({
        enabled: settings.enabled ?? false,
        host: settings.host ?? '',
        port: settings.port ?? 587,
        username: settings.username ?? '',
        password: '',
        smtps: settings.smtps ?? false,
        ignoreCert: settings.ignoreCert ?? false,
        from: settings.from ?? '',
        replyTo: settings.replyTo ?? '',
        uploadDebounceSeconds: settings.uploadDebounceSeconds ?? 300,
      })
    }
  }, [settings])

  const { mutateAsync: saveSettings, isPending: isSaving } = useMutation({
    mutationFn: async (dataToSave: Settings) => {
      const res = await client.api.teams[':teamId'].notifications.email.$put({
        param: { teamId },
        json: {
          enabled: dataToSave.enabled,
          host: dataToSave.host,
          port: dataToSave.port,
          username: dataToSave.username || '',
          password: dataToSave.password || '',
          smtps: dataToSave.smtps,
          ignoreCert: dataToSave.ignoreCert,
          from: dataToSave.from,
          replyTo: dataToSave.replyTo || '',
          uploadDebounceSeconds: dataToSave.uploadDebounceSeconds,
        },
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { message?: string } | null
        throw new Error(err?.message || m.failed_to_save_email_settings())
      }
      return (await res.json()) as Settings
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'email-settings'] })
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'settings'] })
    },
  })

  const handleSave = async () => {
    try {
      await saveSettings(formData)
      toast.success(m.email_settings_saved())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : m.failed_to_save_email_settings())
    }
  }

  const handleSaveAndTest = async () => {
    if (!formData.host.trim()) {
      toast.error(m.smtp_host_required())
      return
    }
    try {
      await saveSettings(formData)
      toast.success(m.email_settings_saved())
      setIsTestDialogOpen(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : m.failed_to_save_email_settings())
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center text-destructive">
        {error instanceof Error ? error.message : m.failed_to_load_email_settings()}
      </div>
    )
  }

  return (
    <>
      <ScrollArea className="h-full">
        <div className="space-y-6 pr-4 pb-8">
          <Card>
            <CardContent className="space-y-6 pt-6">
              {/* Enable Switch */}
              <div className="flex items-center justify-between space-x-4 rounded-lg border border-border p-4">
                <div className="space-y-1">
                  <label
                    htmlFor="enable-email-switch"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    {m.enable_email_notifications()}
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {m.enable_email_notifications_description()}
                  </p>
                </div>
                <Switch
                  id="enable-email-switch"
                  checked={formData.enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                />
              </div>

              {/* SMTP Server Settings */}
              <div className="space-y-4 pt-2">
                <h4 className="text-sm font-semibold text-foreground">{m.smtp_settings()}</h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <label
                      htmlFor="smtp-host-input"
                      className="text-sm font-medium text-foreground"
                    >
                      {m.smtp_host()}
                    </label>
                    <Input
                      id="smtp-host-input"
                      value={formData.host}
                      onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                      placeholder={m.smtp_host_placeholder()}
                      disabled={!formData.enabled}
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="smtp-port-input"
                      className="text-sm font-medium text-foreground"
                    >
                      {m.smtp_port()}
                    </label>
                    <Input
                      id="smtp-port-input"
                      type="number"
                      value={formData.port}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          port: parseInt(e.target.value, 10) || 587,
                        })
                      }
                      disabled={!formData.enabled}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="smtp-username-input"
                      className="text-sm font-medium text-foreground"
                    >
                      {m.smtp_username()}
                    </label>
                    <Input
                      id="smtp-username-input"
                      value={formData.username || ''}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder={m.smtp_username_placeholder()}
                      disabled={!formData.enabled}
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="smtp-password-input"
                      className="text-sm font-medium text-foreground"
                    >
                      {m.smtp_password()}
                    </label>
                    <Input
                      id="smtp-password-input"
                      type="password"
                      value={formData.password || ''}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder={
                        settings?.password
                          ? m.smtp_password_keep_placeholder()
                          : m.smtp_password_placeholder()
                      }
                      disabled={!formData.enabled}
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="flex items-center justify-between space-x-4 rounded-lg border border-border p-4">
                    <div className="space-y-1">
                      <label
                        htmlFor="smtps-switch"
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        {m.smtp_secure()}
                      </label>
                      <p className="text-xs text-muted-foreground">{m.smtp_secure_description()}</p>
                    </div>
                    <Switch
                      id="smtps-switch"
                      checked={formData.smtps}
                      onCheckedChange={(checked) => setFormData({ ...formData, smtps: checked })}
                      disabled={!formData.enabled}
                    />
                  </div>

                  <div className="flex items-center justify-between space-x-4 rounded-lg border border-border p-4">
                    <div className="space-y-1">
                      <label
                        htmlFor="ignore-cert-switch"
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        {m.smtp_ignore_cert()}
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {m.smtp_ignore_cert_description()}
                      </p>
                    </div>
                    <Switch
                      id="ignore-cert-switch"
                      checked={formData.ignoreCert}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, ignoreCert: checked })
                      }
                      disabled={!formData.enabled}
                    />
                  </div>
                </div>
              </div>

              {/* Sender Information */}
              <div className="space-y-4 pt-4 border-t border-border">
                <h4 className="text-sm font-semibold text-foreground">{m.sender_settings()}</h4>

                <div className="space-y-2">
                  <label
                    htmlFor="sender-from-input"
                    className="text-sm font-medium text-foreground"
                  >
                    {m.sender_from()}
                  </label>
                  <Input
                    id="sender-from-input"
                    value={formData.from}
                    onChange={(e) => setFormData({ ...formData, from: e.target.value })}
                    placeholder="Shumai <noreply@example.com>"
                    disabled={!formData.enabled}
                  />
                  <p className="text-xs text-muted-foreground">{m.sender_from_description()}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="sender-reply-to-input"
                      className="text-sm font-medium text-foreground"
                    >
                      {m.sender_reply_to()}
                    </label>
                    <Input
                      id="sender-reply-to-input"
                      value={formData.replyTo || ''}
                      onChange={(e) => setFormData({ ...formData, replyTo: e.target.value })}
                      placeholder="noreply@example.com"
                      disabled={!formData.enabled}
                    />
                    <p className="text-xs text-muted-foreground">
                      {m.sender_reply_to_description()}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="upload-debounce-input"
                      className="text-sm font-medium text-foreground"
                    >
                      {m.upload_debounce_seconds()}
                    </label>
                    <Input
                      id="upload-debounce-input"
                      type="number"
                      min={0}
                      max={3600}
                      value={formData.uploadDebounceSeconds}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          uploadDebounceSeconds: Math.max(
                            0,
                            Math.min(3600, parseInt(e.target.value, 10) || 0),
                          ),
                        })
                      }
                      disabled={!formData.enabled}
                    />
                    <p className="text-xs text-muted-foreground">
                      {m.upload_debounce_seconds_description()}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col sm:flex-row items-center justify-end gap-3 border-t border-border p-6 bg-muted/20">
              <Button variant="outline" onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {m.save()}
              </Button>
              <Button onClick={handleSaveAndTest} disabled={isSaving || !formData.enabled}>
                {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {m.save_and_send_test_email()}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </ScrollArea>

      <TestEmailDialog
        isOpen={isTestDialogOpen}
        onClose={() => setIsTestDialogOpen(false)}
        teamId={teamId}
        defaultFrom={formData.from}
      />
    </>
  )
}
