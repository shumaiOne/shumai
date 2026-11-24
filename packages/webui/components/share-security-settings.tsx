import { client } from '@/ui/api/client'
import { DateTimePicker } from '@/ui/components/datetime-picker'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import { Switch } from '@/ui/components/ui/switch'
import { WatermarkEditorDialog } from '@/ui/components/watermark-editor-dialog'
import { cn } from '@/ui/lib/utils'
import { m } from '@/ui/paraglide/messages.js'
import type { ShareLinkInfo, UpdateShareLinkRequest } from '@shumai/dtos'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'

interface ShareSecuritySettingsProps {
  shareLink: ShareLinkInfo
  inDialog?: boolean
  className?: string
}

export function ShareSecuritySettings({
  shareLink,
  inDialog = false,
  className,
}: ShareSecuritySettingsProps) {
  const queryClient = useQueryClient()
  const [password, setPassword] = useState(shareLink.password || '')
  const [expireAt, setExpireAt] = useState<Date | undefined>(
    shareLink.expireAt ? new Date(shareLink.expireAt) : undefined,
  )
  const [isPasswordEnabled, setIsPasswordEnabled] = useState(shareLink.hasPassword)
  const [isExpireEnabled, setIsExpireEnabled] = useState(!!shareLink.expireAt)
  const [isWatermarkEditorOpen, setIsWatermarkEditorOpen] = useState(false)

  useEffect(() => {
    setPassword(shareLink.password || '')
  }, [shareLink.password])

  useEffect(() => {
    setIsPasswordEnabled(shareLink.hasPassword)
    setExpireAt(shareLink.expireAt ? new Date(shareLink.expireAt) : undefined)
    setIsExpireEnabled(!!shareLink.expireAt)
  }, [shareLink.id, shareLink.hasPassword, shareLink.expireAt])

  const { data: watermarkInfo, refetch: refetchWatermark } = useQuery({
    queryKey: ['share-watermark', shareLink.id],
    queryFn: async () => {
      const res = await client.api.shares[':shareId'].watermark.$get({
        param: { shareId: shareLink.id },
      })
      if (!res.ok) return null
      return await res.json()
    },
    refetchInterval: (query) => {
      const status = query.state.data?.watermarkStatus || shareLink.watermarkStatus
      return status === 'processing' ? 3000 : false
    },
  })

  const $updateWatermark = client.api.shares[':shareId'].watermark.$put
  const { mutate: disableWatermark } = useMutation({
    mutationFn: async () => {
      const res = await $updateWatermark({
        param: { shareId: shareLink.id },
        json: { enabled: false },
      })
      if (!res.ok) throw new Error(m.failed_update())
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shares', shareLink.projectId] })
      queryClient.invalidateQueries({ queryKey: ['share', shareLink.id] })
      queryClient.invalidateQueries({ queryKey: ['share-watermark', shareLink.id] })
      toast.success(m.watermark_disabled_msg())
    },
  })

  const $updateShare = client.api.shares[':shareId'].$put
  const { mutate: updateShare } = useMutation({
    mutationFn: async (json: UpdateShareLinkRequest) => {
      const res = await $updateShare({
        param: { shareId: shareLink.id },
        json,
      })
      if (!res.ok) throw new Error(m.failed_update())
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shares', shareLink.projectId] })
      queryClient.invalidateQueries({ queryKey: ['share', shareLink.id] })
      toast.success(m.settings_updated())
    },
  })

  const watermarkStatus =
    watermarkInfo?.watermarkStatus ??
    shareLink.watermarkStatus ??
    (shareLink.watermarkConfigId ? 'ready' : 'disabled')
  const watermarkConfig =
    watermarkInfo?.watermarkConfig?.config ?? shareLink.watermarkConfig?.config ?? null
  const isWatermarkEnabled = watermarkConfig !== null && watermarkStatus !== 'disabled'

  return (
    <>
      <div className={cn('space-y-4', className)}>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">{m.password()}</Label>
            <Switch
              checked={isPasswordEnabled}
              onCheckedChange={(checked) => {
                setIsPasswordEnabled(checked)
                if (!checked) updateShare({ password: null })
              }}
            />
          </div>
          {isPasswordEnabled && (
            <div className="flex gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <Input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={m.enter_password()}
                className="text-xs"
              />
              <Button size="sm" onClick={() => updateShare({ password })}>
                {m.save()}
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">{m.expiration_date()}</Label>
            <Switch
              checked={isExpireEnabled}
              onCheckedChange={(checked) => {
                setIsExpireEnabled(checked)
                if (!checked) {
                  setExpireAt(undefined)
                  updateShare({ expireAt: null })
                }
              }}
            />
          </div>
          {isExpireEnabled && (
            <div className="animate-in fade-in slide-in-from-top-1 duration-200">
              <DateTimePicker
                modal={inDialog}
                value={expireAt}
                onChange={(date) => {
                  setExpireAt(date)
                  updateShare({ expireAt: date ? date.toISOString() : null })
                }}
                className="text-xs"
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">{m.allow_download()}</Label>
            <Switch
              checked={shareLink.allowDownload}
              onCheckedChange={(checked) => updateShare({ allowDownload: checked })}
            />
          </div>
          <p className="text-xs text-muted-foreground">{m.allow_download_description()}</p>
        </div>

        <div className="space-y-2 pt-2 border-t border-border/50">
          <div className="flex items-center justify-between">
            <Label className="text-xs">{m.watermark()}</Label>
            <Switch
              checked={isWatermarkEnabled}
              disabled={watermarkStatus === 'processing'}
              onCheckedChange={(checked) => {
                if (!checked) {
                  disableWatermark()
                } else {
                  setIsWatermarkEditorOpen(true)
                }
              }}
            />
          </div>

          {isWatermarkEnabled && watermarkStatus === 'processing' && (
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-medium py-1 animate-pulse">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>{m.watermark_transcoding_processing()}</span>
            </div>
          )}

          {isWatermarkEnabled && watermarkStatus !== 'processing' && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs gap-1.5 mt-1"
              onClick={() => setIsWatermarkEditorOpen(true)}
            >
              {m.edit_watermark()}
            </Button>
          )}
        </div>
      </div>

      <WatermarkEditorDialog
        open={isWatermarkEditorOpen}
        onOpenChange={setIsWatermarkEditorOpen}
        initialConfig={watermarkConfig}
        shareId={shareLink.id}
        onSaveSuccess={() => {
          refetchWatermark()
          queryClient.invalidateQueries({ queryKey: ['share', shareLink.id] })
          queryClient.invalidateQueries({ queryKey: ['shares', shareLink.projectId] })
        }}
      />
    </>
  )
}
