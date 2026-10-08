import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/ui/components/ui/card'
import { Input } from '@/ui/components/ui/input'
import { Button } from '@/ui/components/ui/button'
import { Badge } from '@/ui/components/ui/badge'
import { Loader2, CheckCircle2, XCircle, Info } from 'lucide-react'
import { toast } from 'sonner'
import { m } from '@/ui/paraglide/messages.js'

interface TurntableSettingsCardProps {
  teamId: string
}

export const TurntableSettingsCard: React.FC<TurntableSettingsCardProps> = ({ teamId }) => {
  const queryClient = useQueryClient()

  const [url, setUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [testResult, setTestResult] = useState<{
    ok: boolean
    version?: string
    blender?: string
    error?: string
  } | null>(null)
  const [isTesting, setIsTesting] = useState(false)

  const { data: turntableSettings, isLoading } = useQuery({
    queryKey: ['teams', teamId, 'turntable-settings'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId']['turntable-settings'].$get({
        param: { teamId },
      })
      if (!res.ok) throw new Error('Failed to load turntable settings')
      return await res.json()
    },
    enabled: !!teamId,
  })

  useEffect(() => {
    if (turntableSettings) {
      setUrl(turntableSettings.url || '')
      setUsername(turntableSettings.username || '')
      setPassword('')
      setTestResult(null)
    }
  }, [turntableSettings])

  const { mutateAsync: saveSettings, isPending: isSaving } = useMutation({
    mutationFn: async () => {
      const res = await client.api.teams[':teamId']['turntable-settings'].$put({
        param: { teamId },
        json: {
          url: url || undefined,
          username: username || undefined,
          password: password || undefined,
        },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(
          (err as { message?: string }).message || 'Failed to update turntable settings',
        )
      }
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['teams', teamId, 'turntable-settings'],
      })
      queryClient.invalidateQueries({
        queryKey: ['teams', teamId, 'settings'],
      })
      toast.success(m.settings_updated())
    },
    onError: (err: Error) => {
      toast.error(err.message || m.failed_update_settings())
    },
  })

  const handleTestConnection = async () => {
    setIsTesting(true)
    setTestResult(null)
    try {
      const res = await client.api.teams[':teamId']['turntable-settings'].test.$post({
        param: { teamId },
        json: {
          url: url || undefined,
          username: username || undefined,
          password: password || undefined,
        },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const errorMsg = (err as { message?: string }).message || 'Request failed'
        setTestResult({ ok: false, error: errorMsg })
        toast.error(m.turntable_connection_failed())
        return
      }
      const data = await res.json()
      setTestResult(data)
      if (data.ok) {
        toast.success(m.turntable_connection_success())
      } else {
        toast.error(data.error || m.turntable_connection_failed())
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setTestResult({ ok: false, error: msg })
      toast.error(m.turntable_connection_failed())
    } finally {
      setIsTesting(false)
    }
  }

  const isEnvConfigured = Boolean(turntableSettings?.isEnvConfigured)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{m.turntable_settings()}</CardTitle>
          {isEnvConfigured && (
            <Badge variant="secondary" className="gap-1">
              <Info className="w-3 h-3" />
              {m.turntable_env_configured()}
            </Badge>
          )}
        </div>
        <CardDescription>{m.turntable_settings_description()}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <label htmlFor="turntable-url" className="text-sm font-medium">
                {m.turntable_server_url()}
              </label>
              <Input
                id="turntable-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={m.turntable_server_url_placeholder()}
                disabled={isEnvConfigured || isSaving}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="turntable-username" className="text-sm font-medium">
                  {m.turntable_username()}
                </label>
                <Input
                  id="turntable-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  disabled={isEnvConfigured || isSaving}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="turntable-password" className="text-sm font-medium">
                  {m.turntable_password()}
                </label>
                <Input
                  id="turntable-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    turntableSettings?.hasPassword ? m.turntable_password_placeholder() : '••••••••'
                  }
                  disabled={isEnvConfigured || isSaving}
                />
              </div>
            </div>

            {testResult && (
              <div
                className={`flex items-center gap-2 p-3 rounded-lg border text-sm ${
                  testResult.ok
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'border-destructive/30 bg-destructive/10 text-destructive'
                }`}
              >
                {testResult.ok ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      {m.turntable_connection_success()} (v{testResult.version || 'unknown'}
                      {testResult.blender ? `, Blender ${testResult.blender}` : ''})
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 shrink-0" />
                    <span>
                      {m.turntable_connection_failed()}: {testResult.error}
                    </span>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
      <CardFooter className="flex justify-between border-t border-border pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleTestConnection}
          disabled={isLoading || isTesting || !url.trim()}
        >
          {isTesting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isTesting ? m.turntable_testing() : m.turntable_test_connection()}
        </Button>

        <Button
          type="button"
          onClick={() => saveSettings()}
          disabled={isEnvConfigured || isSaving || isLoading}
        >
          {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {m.save()}
        </Button>
      </CardFooter>
    </Card>
  )
}
