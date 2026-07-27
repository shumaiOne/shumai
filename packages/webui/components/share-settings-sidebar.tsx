import { ShareLinkInfo, UpdateShareLinkRequest } from '@shumai/dtos'
import { type FieldInfo as MetadataFieldInfo } from '@shumai/dtos'
import { m } from '@/ui/paraglide/messages.js'
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
  Palette,
  ListFilter,
  SortAsc,
  LayoutGrid,
  List,
  ArrowDownUp,
} from 'lucide-react'
import React, { useState } from 'react'
import { toast } from 'sonner'
import { copyToClipboard as copyTextToClipboard } from '@/ui/lib/clipboard'
import { DateTimePicker } from '@/ui/components/datetime-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/ui/select'

interface ShareSettingsSidebarProps {
  shareLink: ShareLinkInfo
  viewMode: 'card' | 'list'
  onViewModeChange: (mode: 'card' | 'list') => void
  defaultSortOrder: string | null
  onSortOrderChange: (sortOrder: string | null) => void
}

export function ShareSettingsSidebar({
  shareLink,
  viewMode,
  onViewModeChange,
  defaultSortOrder,
  onSortOrderChange,
}: ShareSettingsSidebarProps) {
  const queryClient = useQueryClient()
  const [password, setPassword] = useState(shareLink.password || '')
  const [expireAt, setExpireAt] = useState<Date | undefined>(
    shareLink.expireAt ? new Date(shareLink.expireAt) : undefined,
  )

  React.useEffect(() => {
    setPassword(shareLink.password || '')
  }, [shareLink.password])
  const [isPasswordEnabled, setIsPasswordEnabled] = useState(shareLink.hasPassword)
  const [isExpireEnabled, setIsExpireEnabled] = useState(!!shareLink.expireAt)

  const { data: fields } = useQuery({
    queryKey: ['fields', shareLink.projectId],
    queryFn: async () => {
      const res = await client.api.projects[':projectId'].fields.$get({
        param: { projectId: shareLink.projectId },
      })
      if (!res.ok) throw new Error(m.failed_fetch_fields())
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
      if (!res.ok) throw new Error(m.failed_update())
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shares', shareLink.projectId] })
      queryClient.invalidateQueries({ queryKey: ['share', shareLink.id] })
      toast.success(m.settings_updated())
    },
  })

  const shareUrl = `${window.location.origin}/share/${shareLink.id}`

  const copyToClipboard = async (text: string) => {
    const ok = await copyTextToClipboard(text)
    if (ok) {
      toast.success(m.copied_to_clipboard())
    }
  }

  const toggleFieldVisibility = (fieldId: string) => {
    const current = shareLink.fieldVisibility || {}
    const next = { ...current, [fieldId]: !current[fieldId] }
    updateShare({ fieldVisibility: next })
  }

  // Parse current sort field and order
  let currentSortField = 'index'
  let currentSortOrder = 'asc'
  if (defaultSortOrder) {
    const parts = defaultSortOrder.split(':')
    currentSortField = parts[0]
    currentSortOrder = parts[1] || 'asc'
  }

  return (
    <div className="flex flex-col h-full bg-background border-l border-border">
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">{m.link_visibility()}</h3>
              <Switch
                checked={!shareLink.isDisabled}
                onCheckedChange={(checked) => updateShare({ isDisabled: !checked })}
              />
            </div>

            <div className="relative w-full">
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
          </div>

          <div className="space-y-1">
            <SidebarAccordionItem title={m.security()} icon={<Shield className="h-4 w-4" />}>
              <div className="p-3 space-y-4 pt-0">
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
            <SidebarAccordionItem title={m.appearance()} icon={<Palette className="h-4 w-4" />}>
              <div className="p-3 space-y-3 pt-0 flex gap-2">
                <Button
                  variant={viewMode === 'card' ? 'secondary' : 'outline'}
                  size="sm"
                  className="flex-1 gap-2 text-xs"
                  onClick={() => onViewModeChange('card')}
                >
                  <LayoutGrid className="h-4 w-4" />
                  {m.grid()}
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'outline'}
                  size="sm"
                  className="flex-1 gap-2 text-xs"
                  onClick={() => onViewModeChange('list')}
                >
                  <List className="h-4 w-4" />
                  {m.list()}
                </Button>
              </div>
            </SidebarAccordionItem>
            <SidebarAccordionItem title={m.fields()} icon={<ListFilter className="h-4 w-4" />}>
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
            <SidebarAccordionItem title={m.sort_by()} icon={<SortAsc className="h-4 w-4" />}>
              <div className="p-3 space-y-4 pt-0">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">{m.field()}</Label>
                  <Select
                    value={currentSortField}
                    onValueChange={(val) => {
                      if (val === 'index') {
                        onSortOrderChange(null)
                      } else {
                        onSortOrderChange(`${val}:${currentSortOrder}`)
                      }
                    }}
                  >
                    <SelectTrigger className="w-full text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="index">{m.sort_custom()}</SelectItem>
                      <SelectItem value="name">{m.sort_name()}</SelectItem>
                      <SelectItem value="createdAt">{m.sort_date_created()}</SelectItem>
                      <SelectItem value="size">{m.sort_size()}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">{m.order()}</Label>
                  <Button
                    variant="outline"
                    className="w-full justify-between font-normal text-xs h-9"
                    disabled={currentSortField === 'index'}
                    onClick={() => {
                      const nextOrder = currentSortOrder === 'asc' ? 'desc' : 'asc'
                      onSortOrderChange(`${currentSortField}:${nextOrder}`)
                    }}
                  >
                    <span>
                      {currentSortField === 'name'
                        ? currentSortOrder === 'asc'
                          ? m.sort_a_to_z()
                          : m.sort_z_to_a()
                        : currentSortField === 'createdAt'
                          ? currentSortOrder === 'asc'
                            ? m.sort_oldest_to_newest()
                            : m.sort_newest_to_oldest()
                          : currentSortField === 'size'
                            ? currentSortOrder === 'asc'
                              ? m.sort_smallest_to_largest()
                              : m.sort_largest_to_smallest()
                            : currentSortOrder === 'asc'
                              ? m.ascending()
                              : m.descending()}
                    </span>
                    <ArrowDownUp className="h-4 w-4 opacity-50" />
                  </Button>
                </div>
              </div>
            </SidebarAccordionItem>
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
          {m.open_share_link()}
        </Button>
        <Button
          className="w-full justify-center bg-blue-600 hover:bg-blue-700 text-white"
          onClick={() => copyToClipboard(shareUrl)}
        >
          <Copy className="h-4 w-4 mr-2" />
          {m.copy_link()}
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
