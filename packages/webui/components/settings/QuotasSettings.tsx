import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { Button } from '@/ui/components/ui/button'
import { Badge } from '@/ui/components/ui/badge'
import { Switch } from '@/ui/components/ui/switch'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui/components/ui/alert-dialog'
import {
  Gauge,
  Plus,
  Loader2,
  MoreVertical,
  Trash2,
  Edit2,
  Cpu,
  DollarSign,
  Puzzle,
  Server,
  Terminal,
  Globe,
  Users,
  UserCheck,
  User,
  Clock,
  Activity,
  Eye,
} from 'lucide-react'
import { toast } from 'sonner'
import { m } from '@/ui/paraglide/messages.js'
import type { QuotaRuleResponse, QuotaResourceTypeEnum } from '@shumai/dtos'
import { formatQuotaPeriod } from '@shumai/dtos'
import { QuotaRuleDialog } from './QuotaRuleDialog'
import { QuotaUsageRecordsDialog } from './QuotaUsageRecordsDialog'

interface QuotasSettingsProps {
  teamId: string
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

function formatResourceValue(resource: QuotaResourceTypeEnum, val: number): string {
  if (resource === 'agent_cost') {
    return `$${val.toFixed(2)}`
  }
  return val.toLocaleString()
}

export const QuotasSettings: React.FC<QuotasSettingsProps> = ({ teamId }) => {
  const queryClient = useQueryClient()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedRule, setSelectedRule] = useState<QuotaRuleResponse | null>(null)
  const [viewingUsageRule, setViewingUsageRule] = useState<QuotaRuleResponse | null>(null)
  const [deletingRule, setDeletingRule] = useState<QuotaRuleResponse | null>(null)

  // Fetch quota rules
  const { data, isLoading } = useQuery({
    queryKey: ['teams', teamId, 'quotas'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].quotas.$get({ param: { teamId } })
      if (!res.ok) throw new Error(m.failed_load_settings())
      return await res.json()
    },
  })

  // Quick toggle enabled mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const res = await client.api.teams[':teamId'].quotas[':id'].$put({
        param: { teamId, id },
        json: { enabled },
      })
      if (!res.ok) throw new Error(m.failed_to_update_quota())
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'quotas'] })
      toast.success(m.quota_status_updated())
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : m.failed_to_update_quota())
    },
  })

  // Delete rule mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await client.api.teams[':teamId'].quotas[':id'].$delete({
        param: { teamId, id },
      })
      if (!res.ok) throw new Error(m.failed_to_delete_quota())
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'quotas'] })
      toast.success(m.quota_deleted_successfully())
      setDeletingRule(null)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : m.failed_to_delete_quota())
    },
  })

  const rules: QuotaRuleResponse[] = data?.rules || []

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 pr-4 pb-10">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 text-primary rounded-lg">
                <Gauge className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">{m.resource_quotas()}</CardTitle>
                <CardDescription>{m.resource_quotas_description()}</CardDescription>
              </div>
            </div>
            <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" /> {m.add_quota()}
            </Button>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : rules.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
                <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4 text-muted-foreground">
                  <Gauge className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1">
                  {m.no_quotas_title()}
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                  {m.no_quotas_description()}
                </p>
                <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
                  <Plus className="w-4 h-4" /> {m.add_quota()}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {rules.map((rule) => {
                  const meta = RESOURCE_META[rule.resource]
                  const Icon = meta?.icon || Activity
                  const resData = (rule.resourceData as Record<string, unknown> | null) || {}

                  return (
                    <div
                      key={rule.id}
                      className={`group relative flex flex-col justify-between p-5 rounded-xl border bg-card text-card-foreground shadow-2xs transition-all hover:border-primary/40 hover:shadow-xs ${
                        !rule.enabled ? 'opacity-60 bg-muted/20' : ''
                      }`}
                    >
                      {/* Top Row: Resource, Details, Switch, Actions */}
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                              <Icon className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="font-semibold text-base text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                                <span>{meta?.label ? meta.label() : rule.resource}</span>
                              </div>
                              {/* Subtitle / target details */}
                              <div className="text-xs text-muted-foreground line-clamp-1">
                                {rule.resource === 'agent_skill_call_count' && (
                                  <span>Skill: {String(resData.id || '')}</span>
                                )}
                                {rule.resource === 'agent_mcp_call_count' && (
                                  <span>Server: {String(resData.id || '')}</span>
                                )}
                                {rule.resource === 'agent_bash_call_count' && (
                                  <span>Match: {String(resData.match || '*')}</span>
                                )}
                                {rule.resource === 'agent_network_call_count' && (
                                  <span>Domain: {String(resData.domain || '*')}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Quick Switch & Card Menu */}
                          <div
                            className="flex items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Switch
                              checked={rule.enabled}
                              onCheckedChange={(checked) =>
                                toggleMutation.mutate({ id: rule.id, enabled: checked })
                              }
                              disabled={toggleMutation.isPending}
                            />
                            <DropdownMenu modal={false}>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Quota actions"
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setSelectedRule(rule)}>
                                  <Edit2 className="w-4 h-4 mr-2" />
                                  {m.edit()}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setDeletingRule(rule)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  {m.delete()}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* Badges Row & View Usage Action */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {/* Scope Mode & Role badge */}
                            {rule.scopeMode === 'all_members' && (
                              <Badge variant="secondary" className="gap-1 text-xs">
                                <Users className="w-3 h-3" />
                                <span>
                                  {m.quota_scope_mode_all_members()}
                                  {rule.role ? ` (${rule.role})` : ` (${m.quota_scope_team()})`}
                                </span>
                              </Badge>
                            )}
                            {rule.scopeMode === 'each_member' && (
                              <Badge variant="secondary" className="gap-1 text-xs">
                                <User className="w-3 h-3" />
                                <span>
                                  {m.quota_scope_mode_each_member()}
                                  {rule.role ? ` (${rule.role})` : ` (${m.quota_scope_team()})`}
                                </span>
                              </Badge>
                            )}
                            {rule.scopeMode === 'selected_members' && (
                              <Badge variant="secondary" className="gap-1 text-xs">
                                <UserCheck className="w-3 h-3" />
                                <span>
                                  {m.quota_scope_mode_selected_members()} (
                                  {rule.userIds?.length || 0})
                                </span>
                              </Badge>
                            )}

                            {/* Limit & Period badge */}
                            <Badge variant="outline" className="gap-1 text-xs">
                              <Clock className="w-3 h-3" />
                              <span>
                                {formatResourceValue(rule.resource, rule.limit)} {meta?.unit} /{' '}
                                {getPeriodLabel(rule.period)}
                              </span>
                            </Badge>
                          </div>

                          {/* View Usage Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewingUsageRule(rule)}
                            className="gap-1.5 text-xs h-7 px-2.5"
                          >
                            <Eye className="w-3.5 h-3.5 text-primary" />
                            <span>{m.quota_view_usage()}</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create / Edit Rule Dialog */}
      {(isCreateOpen || !!selectedRule) && (
        <QuotaRuleDialog
          open={isCreateOpen || !!selectedRule}
          onOpenChange={(open) => {
            if (!open) {
              setIsCreateOpen(false)
              setSelectedRule(null)
            }
          }}
          teamId={teamId}
          rule={selectedRule}
        />
      )}

      {/* View Usage Records Dialog */}
      {!!viewingUsageRule && (
        <QuotaUsageRecordsDialog
          open={!!viewingUsageRule}
          onOpenChange={(open) => {
            if (!open) setViewingUsageRule(null)
          }}
          teamId={teamId}
          rule={viewingUsageRule}
        />
      )}

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={!!deletingRule}
        onOpenChange={(open) => {
          if (!open) setDeletingRule(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.delete_quota()}</AlertDialogTitle>
            <AlertDialogDescription>{m.delete_quota_confirm()}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>{m.cancel()}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                if (deletingRule) {
                  deleteMutation.mutate(deletingRule.id)
                }
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {m.delete()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScrollArea>
  )
}
