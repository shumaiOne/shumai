import { ShareLinkInfo, UpdateShareLinkRequest } from '@/dtos/share'
import { type FieldInfo as MetadataFieldInfo } from '@/dtos/metadata'
import { client } from '@/ui/api/client'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import { Switch } from '@/ui/components/ui/switch'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronRight,
  Copy,
  ExternalLink,
  Shield,
  Settings2,
  Palette,
  ListFilter,
  SortAsc,
} from 'lucide-react'
import React, { useState } from 'react'
import { toast } from 'sonner'
import { DateTimePicker } from '@/ui/components/datetime-picker'
interface ShareSettingsSidebarProps {
  shareLink: ShareLinkInfo
}

export function ShareSettingsSidebar({ shareLink }: ShareSettingsSidebarProps) {
  const queryClient = useQueryClient()
  const [password, setPassword] = useState('')
  const [expireAt, setExpireAt] = useState<Date | undefined>(
    shareLink.expireAt ? new Date(shareLink.expireAt) : undefined,
  )
  const [isPasswordEnabled, setIsPasswordEnabled] = useState(shareLink.hasPassword)
  const [isExpireEnabled, setIsExpireEnabled] = useState(!!shareLink.expireAt)

  const { data: fields } = useQuery({
    queryKey: ['fields', shareLink.projectId],
    queryFn: async () => {
      const res = await client.api.projects[':projectId'].fields.$get({
        param: { projectId: shareLink.projectId },
      })
      if (!res.ok) throw new Error('Failed to fetch fields')
      return await res.json()
    },
    enabled: !!shareLink.projectId,
  })

  const $updateShare = client.api.shares[':shareId'].$put
  const { mutate: updateShare } = useMutation({
    mutationFn: async (json: UpdateShareLinkRequest) => {
      const res = await $updateShare({
        param: { shareId: shareLink.id },
        json,
      })
      if (!res.ok) throw new Error('Failed to update')
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shares', shareLink.projectId] })
      queryClient.invalidateQueries({ queryKey: ['share', shareLink.id] })
      toast.success('Settings updated')
    },
  })

  const shareUrl = `${window.location.origin}/share/${shareLink.id}`

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const toggleFieldVisibility = (fieldId: string) => {
    const current = shareLink.fieldVisibility || {}
    const next = { ...current, [fieldId]: !current[fieldId] }
    updateShare({ fieldVisibility: next })
  }

  return (
    <div className="flex flex-col h-full bg-background border-l border-border">
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Link Visibility</h3>
              <Switch
                checked={!shareLink.isDisabled}
                onCheckedChange={(checked) => updateShare({ isDisabled: !checked })}
              />
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input value={shareUrl} readOnly className="pr-10 bg-muted/50 text-xs" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => copyToClipboard(shareUrl)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" className="px-3">
                <Settings2 className="h-4 w-4 mr-2" />
                Public
              </Button>
            </div>

            <Input placeholder="Send to name or email" className="text-sm" />
          </div>

          <div className="space-y-1">
            <SidebarAccordionItem title="Permissions" icon={<Settings2 className="h-4 w-4" />} />
            <SidebarAccordionItem title="Security" icon={<Shield className="h-4 w-4" />}>
              <div className="p-3 space-y-4 pt-0">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Password</Label>
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
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={shareLink.hasPassword ? '••••••••' : 'Set password'}
                        className="text-xs"
                      />
                      <Button size="sm" onClick={() => updateShare({ password })}>
                        Save
                      </Button>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Expiration Date</Label>
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
              </div>
            </SidebarAccordionItem>
            <SidebarAccordionItem title="Appearance" icon={<Palette className="h-4 w-4" />} />
            <SidebarAccordionItem title="Fields" icon={<ListFilter className="h-4 w-4" />}>
              <div className="p-3 space-y-3 pt-0">
                {(fields as MetadataFieldInfo[])?.map((field) => (
                  <div key={field.id} className="flex items-center justify-between">
                    <Label className="text-xs">{field.config?.name}</Label>
                    <Switch
                      checked={shareLink.fieldVisibility?.[field.id] ?? false}
                      onCheckedChange={() => toggleFieldVisibility(field.id)}
                    />
                  </div>
                ))}
              </div>
            </SidebarAccordionItem>
            <SidebarAccordionItem title="Sort by" icon={<SortAsc className="h-4 w-4" />} />
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-border space-y-2">
        <Button
          variant="outline"
          className="w-full justify-center"
          onClick={() => window.open(shareUrl, '_blank')}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Open Share Link
        </Button>
        <Button
          className="w-full justify-center bg-blue-600 hover:bg-blue-700 text-white"
          onClick={() => copyToClipboard(shareUrl)}
        >
          <Copy className="h-4 w-4 mr-2" />
          Copy Link
        </Button>
      </div>
    </div>
  )
}

function SidebarAccordionItem({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children?: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-3 px-2 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          <span className="text-sm font-medium">{title}</span>
        </div>
        <ChevronRight className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-90')} />
      </button>
      {isOpen && children && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200">{children}</div>
      )}
    </div>
  )
}

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ')
}
