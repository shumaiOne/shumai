import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { Button } from '@/ui/components/ui/button'
import { Badge } from '@/ui/components/ui/badge'
import { Switch } from '@/ui/components/ui/switch'
import { Progress } from '@/ui/components/ui/progress'
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
} from 'lucide-react'
import { toast } from 'sonner'
import { m } from '@/ui/paraglide/messages.js'
import type { QuotaPolicyResponse, QuotaResourceTypeEnum } from '@shumai/dtos'
import { formatQuotaPeriod } from '@shumai/dtos'
import { QuotaRuleDialog } from './QuotaRuleDialog'

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
  const [selectedPolicy, setSelectedPolicy] = useState<QuotaPolicyResponse | null>(null)
  const [deletingPolicy, setDeletingPolicy] = useState<QuotaPolicyResponse | null>(null)

  // Fetch policies
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

  // Delete policy mutation
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
      setDeletingPolicy(null)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : m.failed_to_delete_quota())
    },
  })

  const policies = data?.policies || []

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
            ) : policies.length === 0 ? (
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {policies.map((policy) => {
                  const meta = RESOURCE_META[policy.resource]
                  const Icon = meta?.icon || Activity
                  const consumed = policy.usage?.consumed ?? 0
                  const reserved = policy.usage?.reserved ?? 0
                  const totalUsed = consumed + reserved
                  const percent =
                    policy.usage?.percent ??
                    (policy.limit > 0 ? Number(((totalUsed / policy.limit) * 100).toFixed(1)) : 0)
                  const isOverLimit = percent >= 100
                  const resData = (policy.resourceData as Record<string, unknown> | null) || {}

                  return (
                    <div
                      key={policy.id}
                      onClick={() => setSelectedPolicy(policy)}
                      className={`group relative flex flex-col justify-between p-5 rounded-xl border bg-card text-card-foreground shadow-xs transition-all hover:border-primary/50 hover:shadow-md cursor-pointer ${
                        !policy.enabled ? 'opacity-60 bg-muted/20' : ''
                      }`}
                    >
                      {/* Top Row: Resource, Scope, Period & Switch */}
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                              <Icon className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="font-semibold text-base text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                                <span>{meta?.label ? meta.label() : policy.resource}</span>
                              </div>
                              {/* Subtitle / target details */}
                              <div className="text-xs text-muted-foreground line-clamp-1">
                                {policy.resource === 'agent_skill_call_count' && (
                                  <span>Skill: {String(resData.id || '')}</span>
                                )}
                                {policy.resource === 'agent_mcp_call_count' && (
                                  <span>Server: {String(resData.id || '')}</span>
                                )}
                                {policy.resource === 'agent_bash_call_count' && (
                                  <span>Match: {String(resData.match || '*')}</span>
                                )}
                                {policy.resource === 'agent_network_call_count' && (
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
                              checked={policy.enabled}
                              onCheckedChange={(checked) =>
                                toggleMutation.mutate({ id: policy.id, enabled: checked })
                              }
                              disabled={toggleMutation.isPending}
                            />
                            <DropdownMenu modal={false}>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setSelectedPolicy(policy)}>
                                  <Edit2 className="w-4 h-4 mr-2" />
                                  {m.edit()}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setDeletingPolicy(policy)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  {m.delete()}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* Badges Row */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {/* Scope badge */}
                          {policy.scopeType === 'team' && (
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <Users className="w-3 h-3" />
                              {m.quota_scope_team()}
                            </Badge>
                          )}
                          {policy.scopeType === 'role' && (
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <UserCheck className="w-3 h-3" />
                              {m.quota_scope_role()}: {policy.role}
                            </Badge>
                          )}
                          {policy.scopeType === 'user' && (
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <User className="w-3 h-3" />
                              {policy.user?.name || policy.userId}
                            </Badge>
                          )}

                          {/* Period badge */}
                          <Badge variant="outline" className="gap-1 text-xs">
                            <Clock className="w-3 h-3" />
                            {getPeriodLabel(policy.period)}
                          </Badge>
                        </div>
                      </div>

                      {/* Bottom Usage Section */}
                      <div className="mt-5 pt-4 border-t border-border/60 space-y-2">
                        {/* Shadcn Progress */}
                        <Progress value={Math.min(100, Math.max(0, percent))} className="h-2" />

                        {/* 123 / 456 Text under progress bar */}
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span
                            className={
                              isOverLimit ? 'text-destructive font-bold' : 'text-foreground'
                            }
                          >
                            {formatResourceValue(policy.resource, totalUsed)} /{' '}
                            {formatResourceValue(policy.resource, policy.limit)} {meta?.unit}
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
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create / Edit Rule Dialog */}
      {(isCreateOpen || !!selectedPolicy) && (
        <QuotaRuleDialog
          open={isCreateOpen || !!selectedPolicy}
          onOpenChange={(open) => {
            if (!open) {
              setIsCreateOpen(false)
              setSelectedPolicy(null)
            }
          }}
          teamId={teamId}
          policy={selectedPolicy}
        />
      )}

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={!!deletingPolicy}
        onOpenChange={(open) => {
          if (!open) setDeletingPolicy(null)
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
                if (deletingPolicy) {
                  deleteMutation.mutate(deletingPolicy.id)
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
