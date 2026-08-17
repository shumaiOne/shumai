import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import { Input } from '@/ui/components/ui/input'
import { Badge } from '@/ui/components/ui/badge'
import { Progress } from '@/ui/components/ui/progress'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/components/ui/avatar'
import {
  Cpu,
  DollarSign,
  Puzzle,
  Server,
  Terminal,
  Globe,
  Loader2,
  Users,
  Search,
  CheckCircle2,
  Clock,
  Activity,
} from 'lucide-react'
import { m } from '@/ui/paraglide/messages.js'
import type { QuotaRuleResponse, QuotaResourceTypeEnum, QuotaRecordResponse } from '@shumai/dtos'
import { formatQuotaPeriod } from '@shumai/dtos'

interface QuotaUsageRecordsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
  rule: QuotaRuleResponse
}

/* eslint-disable @typescript-eslint/naming-convention */
const RESOURCE_META: Record<
  QuotaResourceTypeEnum,
  { label: () => string; icon: React.ElementType; unit: string }
> = {
  agent_total_tokens: {
    label: () => m.quota_resource_agent_total_tokens(),
    icon: Cpu,
    unit: 'tokens',
  },
  agent_cost: {
    label: () => m.quota_resource_agent_cost(),
    icon: DollarSign,
    unit: '$',
  },
  agent_skill_call_count: {
    label: () => m.quota_resource_agent_skill_call_count(),
    icon: Puzzle,
    unit: 'calls',
  },
  agent_mcp_call_count: {
    label: () => m.quota_resource_agent_mcp_call_count(),
    icon: Server,
    unit: 'calls',
  },
  agent_bash_call_count: {
    label: () => m.quota_resource_agent_bash_call_count(),
    icon: Terminal,
    unit: 'calls',
  },
  agent_network_call_count: {
    label: () => m.quota_resource_agent_network_call_count(),
    icon: Globe,
    unit: 'requests',
  },
}
/* eslint-enable @typescript-eslint/naming-convention */

function formatResourceValue(resource: QuotaResourceTypeEnum, val: number): string {
  if (resource === 'agent_cost') {
    return `$${val.toFixed(2)}`
  }
  return val.toLocaleString()
}

function getPeriodLabel(period: string): string {
  const norm = formatQuotaPeriod(period)
  switch (norm) {
    case '1hour':
      return m.quota_period_1hour()
    case '5hour':
      return m.quota_period_5hour()
    case '1day':
      return m.quota_period_1day()
    case '7day':
      return m.quota_period_7day()
    default:
      return norm
  }
}

export const QuotaUsageRecordsDialog: React.FC<QuotaUsageRecordsDialogProps> = ({
  open,
  onOpenChange,
  teamId,
  rule,
}) => {
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['teams', teamId, 'quotas', rule.id, 'records'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].quotas[':id'].records.$get({
        param: { teamId, id: rule.id },
      })
      if (!res.ok) return { records: [], total: 0 }
      return await res.json()
    },
    enabled: open,
    refetchInterval: 10000,
  })

  const records: QuotaRecordResponse[] = data?.records || []
  const meta = RESOURCE_META[rule.resource]
  const Icon = meta?.icon || Activity

  const filteredRecords = records.filter((r) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    if (r.user?.name.toLowerCase().includes(q)) return true
    if (r.user?.email.toLowerCase().includes(q)) return true
    return false
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <span>{m.quota_usage_records()}</span>
                <Badge variant="outline" className="text-xs font-normal">
                  {meta?.label ? meta.label() : rule.resource} -{' '}
                  {formatResourceValue(rule.resource, rule.limit)} {meta?.unit} /{' '}
                  {getPeriodLabel(rule.period)}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {m.quota_usage_records_description()}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {rule.scopeMode !== 'all_members' && records.length > 3 && (
            <div className="px-6 pt-4 pb-2 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={m.quota_search_members()}
                  className="pl-9 h-9 text-sm"
                />
              </div>
            </div>
          )}

          <ScrollArea className="flex-1 min-h-0 [&>div>div]:block!">
            <div className="p-6 pt-3 space-y-3">
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="text-center py-10 text-sm text-muted-foreground">
                  {records.length === 0 ? m.no_quotas_title() : 'No matching records found'}
                </div>
              ) : (
                filteredRecords.map((record, index) => {
                  const percent = record.percent
                  const isOverLimit = percent >= 100
                  const isSharedPool = rule.scopeMode === 'all_members'

                  return (
                    <div
                      key={record.id || record.userId || `record-${index}`}
                      className="p-4 rounded-xl border border-border/70 bg-card text-card-foreground shadow-2xs space-y-3"
                    >
                      {/* Top Row: User / Pool Info & Status Badge */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          {isSharedPool ? (
                            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                              <Users className="w-5 h-5" />
                            </div>
                          ) : (
                            <Avatar className="w-9 h-9 border border-border/50 shrink-0">
                              <AvatarImage src={record.user?.image || undefined} />
                              <AvatarFallback className="text-xs font-semibold">
                                {record.user?.name?.[0]?.toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-foreground truncate">
                              {isSharedPool
                                ? rule.role
                                  ? `${m.quota_role_shared_pool()}: ${rule.role}`
                                  : m.quota_team_shared_pool()
                                : record.user?.name || record.userId}
                            </div>
                            {!isSharedPool && record.user?.email && (
                              <div className="text-xs text-muted-foreground truncate">
                                {record.user.email}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0">
                          {record.isWindowActive && record.periodEnd ? (
                            <Badge
                              variant="outline"
                              className="gap-1 text-xs text-primary border-primary/30 bg-primary/5"
                            >
                              <Clock className="w-3 h-3" />
                              <span>
                                {m.quota_active()}:{' '}
                                {new Date(record.periodEnd).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="gap-1 text-xs text-muted-foreground bg-muted"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              <span>{m.quota_available()}</span>
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar & Details */}
                      <div className="space-y-1.5 pt-1">
                        <Progress value={Math.min(100, Math.max(0, percent))} className="h-2" />
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span
                            className={
                              isOverLimit ? 'text-destructive font-bold' : 'text-foreground'
                            }
                          >
                            {formatResourceValue(rule.resource, record.consumed)} /{' '}
                            {formatResourceValue(rule.resource, rule.limit)} {meta?.unit}
                          </span>
                          <span
                            className={
                              isOverLimit ? 'text-destructive font-bold' : 'text-muted-foreground'
                            }
                          >
                            {percent}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
