import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { m } from '@/ui/paraglide/messages.js'
import { formatRemainingTime } from '@/ui/lib/time'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { Badge } from '@/ui/components/ui/badge'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { Progress } from '@/ui/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/components/ui/avatar'
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ui/components/ui/collapsible'
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  Clock,
  Gauge,
  Loader2,
  Search,
  Users,
  User,
  UserCheck,
} from 'lucide-react'
import type { QuotaRecordResponse, QuotaRuleResponse } from '@shumai/dtos'
import { toast } from 'sonner'
import {
  QUOTA_RESOURCE_META,
  formatQuotaResourceValue,
  getQuotaPeriodLabel,
} from '@/ui/components/quota/quota-display'

interface QuotaUsageDashboardProps {
  teamId: string
}

function getRoleLabel(role: string): string {
  switch (role.toLowerCase()) {
    case 'owner':
      return m.owner()
    case 'editor':
      return m.editor()
    case 'reviewer':
      return m.reviewer()
    default:
      return role
  }
}

function getErrorMessage(body: unknown, fallback: string): string {
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const message = body.message
    if (typeof message === 'string') return message
  }
  return fallback
}

function RuleTarget({ rule }: { rule: QuotaRuleResponse }) {
  const resourceData = rule.resourceData ?? {}

  if (rule.resource === 'agent_mcp_call_count') {
    return <span>{m.quota_target_server({ value: String(resourceData.id ?? '') })}</span>
  }
  if (rule.resource === 'agent_bash_call_count') {
    return <span>{m.quota_target_match({ value: String(resourceData.match ?? '*') })}</span>
  }
  if (rule.resource === 'agent_tool_call_count') {
    return (
      <span>
        {m.quota_target_tool({ value: String(resourceData.name ?? resourceData.toolName ?? '*') })}
      </span>
    )
  }
  return null
}

function ScopeBadge({ rule }: { rule: QuotaRuleResponse }) {
  if (rule.scopeMode === 'all_members') {
    return (
      <Badge variant="secondary" className="gap-1 text-xs">
        <Users className="h-3 w-3" />
        <span>
          {m.quota_scope_mode_all_members()}
          {rule.role ? ` (${getRoleLabel(rule.role)})` : ` (${m.quota_scope_team()})`}
        </span>
      </Badge>
    )
  }

  if (rule.scopeMode === 'each_member') {
    return (
      <Badge variant="secondary" className="gap-1 text-xs">
        <User className="h-3 w-3" />
        <span>
          {m.quota_scope_mode_each_member()}
          {rule.role ? ` (${getRoleLabel(rule.role)})` : ` (${m.quota_scope_team()})`}
        </span>
      </Badge>
    )
  }

  return (
    <Badge variant="secondary" className="gap-1 text-xs">
      <UserCheck className="h-3 w-3" />
      <span>
        {m.quota_scope_mode_selected_members()} ({rule.userIds?.length || 0})
      </span>
    </Badge>
  )
}

function QuotaUsageRecordCard({
  teamId,
  rule,
  record,
}: {
  teamId: string
  rule: QuotaRuleResponse
  record: QuotaRecordResponse
}) {
  const queryClient = useQueryClient()
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const meta = QUOTA_RESOURCE_META[rule.resource]
  const isSharedPool = rule.scopeMode === 'all_members'
  const isOverLimit = record.percent >= 100
  const target = isSharedPool
    ? rule.role
      ? `${m.quota_role_shared_pool()}: ${getRoleLabel(rule.role)}`
      : m.quota_team_shared_pool()
    : record.user?.name || record.userId || m.unknown()

  useEffect(() => {
    if (!record.isWindowActive || !record.periodEnd) return
    const interval = window.setInterval(() => setNow(new Date()), 60000)
    return () => window.clearInterval(interval)
  }, [record.isWindowActive, record.periodEnd])

  const resetMutation = useMutation({
    mutationFn: async () => {
      const response = await client.api.teams[':teamId'].quotas[':id'].records.reset.$post({
        param: { teamId, id: rule.id },
        json: { userId: record.userId ?? null },
      })
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null)
        throw new Error(getErrorMessage(body, m.failed_to_reset_quota()))
      }
      return await response.json()
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['teams', teamId, 'quotas', rule.id, 'records'],
      })
      void queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'quotas'] })
      setIsResetDialogOpen(false)
      toast.success(m.quota_reset_successfully())
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : m.failed_to_reset_quota()
      setIsResetDialogOpen(false)
      toast.error(message)
    },
  })

  return (
    <>
      <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4 text-card-foreground shadow-2xs">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {isSharedPool ? (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
            ) : (
              <Avatar className="h-9 w-9 shrink-0 border border-border/50">
                <AvatarImage src={record.user?.image || undefined} />
                <AvatarFallback className="text-xs font-semibold">
                  {record.user?.name?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">{target}</div>
              {!isSharedPool && record.user?.email && (
                <div className="truncate text-xs text-muted-foreground">{record.user.email}</div>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {record.isWindowActive && record.periodEnd ? (
              <Badge
                variant="outline"
                className="hidden gap-1 border-primary/30 bg-primary/5 text-xs text-primary sm:flex"
              >
                <Clock className="h-3 w-3" />
                <span>
                  {m.quota_refreshes_in({ time: formatRemainingTime(record.periodEnd, now) })}
                </span>
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="hidden gap-1 text-xs text-muted-foreground sm:flex"
              >
                <CheckCircle2 className="h-3 w-3 text-primary" />
                <span>{m.quota_available()}</span>
              </Badge>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setIsResetDialogOpen(true)}
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Activity className="h-3.5 w-3.5" />
              )}
              {m.quota_reset_usage()}
            </Button>
          </div>
        </div>

        <div className="space-y-1.5 pt-1">
          <Progress value={Math.min(100, Math.max(0, record.percent))} className="h-2" />
          <div className="flex items-center justify-between gap-2 text-xs font-medium">
            <span className={isOverLimit ? 'font-bold text-destructive' : 'text-foreground'}>
              {formatQuotaResourceValue(rule.resource, record.consumed)} /{' '}
              {formatQuotaResourceValue(rule.resource, rule.limit)} {meta?.unit}
            </span>
            <span className={isOverLimit ? 'font-bold text-destructive' : 'text-muted-foreground'}>
              {record.percent}%
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground sm:hidden">
          {record.isWindowActive && record.periodEnd ? (
            <span className="flex items-center gap-1 text-primary">
              <Clock className="h-3 w-3" />
              {m.quota_refreshes_in({ time: formatRemainingTime(record.periodEnd, now) })}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-primary" />
              {m.quota_available()}
            </span>
          )}
          <span>
            {m.quota_remaining()}: {formatQuotaResourceValue(rule.resource, record.remaining)}{' '}
            {meta?.unit}
          </span>
        </div>
      </div>

      <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.quota_reset_usage()}</AlertDialogTitle>
            <AlertDialogDescription>
              {m.quota_reset_usage_confirm({ target })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetMutation.isPending}>{m.cancel()}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                resetMutation.mutate()
              }}
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {m.confirm()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function QuotaRuleUsageItem({ teamId, rule }: { teamId: string; rule: QuotaRuleResponse }) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const meta = QUOTA_RESOURCE_META[rule.resource]
  const Icon = meta?.icon || Gauge

  const { data, isLoading, isError } = useQuery({
    queryKey: ['teams', teamId, 'quotas', rule.id, 'records'],
    queryFn: async () => {
      const response = await client.api.teams[':teamId'].quotas[':id'].records.$get({
        param: { teamId, id: rule.id },
      })
      if (!response.ok) throw new Error(m.failed_to_load_quota_usage())
      return await response.json()
    },
    enabled: isOpen,
    refetchInterval: isOpen ? 10000 : false,
  })

  const records = data?.records ?? []
  const filteredRecords = records.filter((record) => {
    if (!search.trim()) return true
    const query = search.toLowerCase()
    return (
      record.user?.name.toLowerCase().includes(query) ||
      record.user?.email.toLowerCase().includes(query)
    )
  })

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="rounded-xl border border-border/70"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          aria-label={isOpen ? m.quota_collapse_rule() : m.quota_expand_rule()}
          className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-muted/40"
        >
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-foreground">
                  {meta?.label() || rule.resource}
                </span>
                {!rule.enabled && <Badge variant="secondary">{m.quota_disabled()}</Badge>}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <ScopeBadge rule={rule} />
                <Badge variant="outline" className="gap-1 text-xs">
                  <Clock className="h-3 w-3" />
                  {formatQuotaResourceValue(rule.resource, rule.limit)} {meta?.unit} /{' '}
                  {getQuotaPeriodLabel(rule.period)}
                </Badge>
                <RuleTarget rule={rule} />
              </div>
            </div>
          </div>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="space-y-3 border-t border-border/60 bg-muted/10 p-4">
          {rule.scopeMode !== 'all_members' && records.length > 3 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={m.quota_search_members()}
                className="h-9 pl-9 text-sm"
              />
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : isError ? (
            <div className="py-8 text-center text-sm text-destructive">
              {m.failed_to_load_quota_usage()}
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {m.quota_no_usage_records()}
            </div>
          ) : (
            filteredRecords.map((record, index) => (
              <QuotaUsageRecordCard
                key={record.id || record.userId || `record-${index}`}
                teamId={teamId}
                rule={rule}
                record={record}
              />
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function QuotaUsageDashboard({ teamId }: QuotaUsageDashboardProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['teams', teamId, 'quotas'],
    queryFn: async () => {
      const response = await client.api.teams[':teamId'].quotas.$get({ param: { teamId } })
      if (!response.ok) throw new Error(m.failed_load_settings())
      return await response.json()
    },
    enabled: !!teamId,
  })

  const rules = data?.rules ?? []

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Gauge className="h-5 w-5 text-primary" />
          {m.quotas()}
        </CardTitle>
        <CardDescription>{m.quota_dashboard_description()}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="py-10 text-center text-sm text-destructive">
            {m.failed_load_settings()}
          </div>
        ) : rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-12 text-center">
            <Gauge className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-base font-medium text-foreground">{m.no_quotas_title()}</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {m.no_quotas_description()}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <QuotaRuleUsageItem key={rule.id} teamId={teamId} rule={rule} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
