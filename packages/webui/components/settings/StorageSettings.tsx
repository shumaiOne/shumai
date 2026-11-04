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
import { Switch } from '@/ui/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/ui/select'
import { Loader2, HardDrive, CheckCircle2, AlertTriangle, Info, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { m } from '@/ui/paraglide/messages.js'
import type { TeamSettingsResponse, AutoArchiveMethod } from '@shumai/dtos'

interface StorageSettingsProps {
  teamId: string
}

function clampDays(val: string | number, defaultVal = 30): number {
  const parsed = typeof val === 'number' ? val : parseInt(val, 10)
  if (isNaN(parsed)) return defaultVal
  return Math.min(3650, Math.max(1, parsed))
}

export const StorageSettings: React.FC<StorageSettingsProps> = ({ teamId }) => {
  const queryClient = useQueryClient()

  const {
    data: settings,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<TeamSettingsResponse>({
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

  const [enabled, setEnabled] = useState(false)
  const [method, setMethod] = useState<AutoArchiveMethod>('not_updated')
  const [daysInput, setDaysInput] = useState('30')
  const [postRestoreGraceDaysInput, setPostRestoreGraceDaysInput] = useState('30')
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    if (settings?.autoArchive && !isDirty) {
      setEnabled(settings.autoArchive.enabled ?? false)
      setMethod(settings.autoArchive.method ?? 'not_updated')
      setDaysInput(String(settings.autoArchive.days ?? 30))
      setPostRestoreGraceDaysInput(String(settings.autoArchive.postRestoreGraceDays ?? 30))
    }
  }, [settings?.autoArchive, isDirty])

  const archiveStorage = settings?.archiveStorage
  const isArchiveConfigured = Boolean(archiveStorage?.enabled)

  const { mutate: saveAutoArchiveSettings, isPending: isSaving } = useMutation({
    mutationFn: async () => {
      const days = clampDays(daysInput, 30)
      const postRestoreGraceDays = clampDays(postRestoreGraceDaysInput, 30)

      const res = await client.api.teams[':teamId'].settings.$patch({
        param: { teamId },
        json: {
          key: 'autoArchive',
          value: {
            enabled,
            method,
            days,
            postRestoreGraceDays,
          },
        },
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { message?: string } | null
        throw new Error(err?.message || m.auto_archive_settings_save_failed())
      }
      return await res.json()
    },
    onSuccess: () => {
      setIsDirty(false)
      queryClient.invalidateQueries({
        queryKey: ['teams', teamId, 'settings'],
      })
      toast.success(m.auto_archive_settings_saved())
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : m.auto_archive_settings_save_failed())
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="h-full overflow-y-auto space-y-6 pr-1">
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {m.failed_to_load_storage_settings()}
            </CardTitle>
            <CardDescription>
              {error instanceof Error ? error.message : m.failed_load_settings()}
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" onClick={() => refetch()}>
              {m.retry()}
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto space-y-6 pr-1">
      {/* Read-only Archive Storage Config Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-primary" />
                {m.archive_storage_config_card()}
              </CardTitle>
              <CardDescription>{m.archive_storage_config_card_description()}</CardDescription>
            </div>
            {isArchiveConfigured ? (
              <Badge
                variant="outline"
                className="text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400 flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {m.archive_storage_configured()}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-400 flex items-center gap-1.5"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                {m.archive_storage_not_configured()}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isArchiveConfigured ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{m.archive_storage_not_configured()}</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  {m.archive_storage_not_configured_alert()}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1 rounded-lg border border-border p-3">
                <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  {m.archive_storage_backend()}
                </label>
                <p className="text-sm font-medium">
                  {archiveStorage?.backend === 's3'
                    ? m.archive_storage_backend_s3()
                    : m.archive_storage_backend_local()}
                </p>
              </div>

              {archiveStorage?.backend === 's3' ? (
                <>
                  <div className="space-y-1 rounded-lg border border-border p-3">
                    <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                      {m.archive_storage_bucket()}
                    </label>
                    <p className="text-sm font-medium font-mono">{archiveStorage?.bucket || '-'}</p>
                  </div>
                  <div className="space-y-1 rounded-lg border border-border p-3 md:col-span-2">
                    <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                      {m.archive_storage_endpoint()}
                    </label>
                    <p className="text-sm font-medium font-mono">
                      {archiveStorage?.endpoint || m.archive_storage_default_endpoint()}
                    </p>
                  </div>
                </>
              ) : (
                <div className="space-y-1 rounded-lg border border-border p-3 md:col-span-2">
                  <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    {m.archive_storage_local_root()}
                  </label>
                  <p className="text-sm font-medium font-mono">
                    {archiveStorage?.localRoot || '-'}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auto Archive Config Card */}
      <Card>
        <CardHeader>
          <CardTitle>{m.auto_archive_card()}</CardTitle>
          <CardDescription>{m.auto_archive_card_description()}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!isArchiveConfigured && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground flex items-center gap-2">
              <Info className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span>{m.auto_archive_disabled_hint()}</span>
            </div>
          )}

          {/* Toggle Auto Archive */}
          <div className="flex items-center justify-between space-x-4 rounded-lg border border-border p-4">
            <div className="space-y-1">
              <label
                htmlFor="enable-auto-archive-switch"
                className="text-sm font-medium leading-none cursor-pointer"
              >
                {m.enable_auto_archive()}
              </label>
              <p className="text-xs text-muted-foreground">{m.enable_auto_archive_description()}</p>
            </div>
            <Switch
              id="enable-auto-archive-switch"
              checked={enabled}
              onCheckedChange={(val) => {
                setIsDirty(true)
                setEnabled(val)
              }}
              disabled={!isArchiveConfigured || isSaving}
            />
          </div>

          {/* Method and Days Configuration */}
          <div className="space-y-4 rounded-lg border border-border p-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{m.auto_archive_method()}</label>
              <Select
                value={method}
                onValueChange={(val) => {
                  setIsDirty(true)
                  setMethod(val as AutoArchiveMethod)
                }}
                disabled={!isArchiveConfigured || isSaving}
              >
                <SelectTrigger id="auto-archive-method-trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_updated">{m.auto_archive_method_not_updated()}</SelectItem>
                  <SelectItem value="after_created">
                    {m.auto_archive_method_after_created()}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{m.auto_archive_method_description()}</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="auto-archive-days-input" className="text-sm font-medium">
                {m.auto_archive_days()}
              </label>
              <Input
                id="auto-archive-days-input"
                type="number"
                min={1}
                max={3650}
                value={daysInput}
                onChange={(e) => {
                  setIsDirty(true)
                  setDaysInput(e.target.value)
                }}
                onBlur={() => {
                  setDaysInput(String(clampDays(daysInput, 30)))
                }}
                disabled={!isArchiveConfigured || isSaving}
                className="w-full md:w-64"
              />
              <p className="text-xs text-muted-foreground">{m.auto_archive_days_description()}</p>
            </div>

            {method === 'after_created' && (
              <div className="space-y-2">
                <label
                  htmlFor="auto-archive-post-restore-grace-days-input"
                  className="text-sm font-medium"
                >
                  {m.auto_archive_post_restore_grace_days()}
                </label>
                <Input
                  id="auto-archive-post-restore-grace-days-input"
                  type="number"
                  min={1}
                  max={3650}
                  value={postRestoreGraceDaysInput}
                  onChange={(e) => {
                    setIsDirty(true)
                    setPostRestoreGraceDaysInput(e.target.value)
                  }}
                  onBlur={() => {
                    setPostRestoreGraceDaysInput(String(clampDays(postRestoreGraceDaysInput, 30)))
                  }}
                  disabled={!isArchiveConfigured || isSaving}
                  className="w-full md:w-64"
                />
                <p className="text-xs text-muted-foreground">
                  {m.auto_archive_post_restore_grace_days_description()}
                </p>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-end border-t border-border pt-4">
          <Button
            onClick={() => saveAutoArchiveSettings()}
            disabled={!isArchiveConfigured || isSaving}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {m.save()}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
