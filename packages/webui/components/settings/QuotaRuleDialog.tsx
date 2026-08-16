import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/ui/select'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import { Button } from '@/ui/components/ui/button'
import { Switch } from '@/ui/components/ui/switch'
import { Progress } from '@/ui/components/ui/progress'
import { Badge } from '@/ui/components/ui/badge'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import {
  Cpu,
  DollarSign,
  Puzzle,
  Server,
  Terminal,
  Globe,
  Loader2,
  Trash2,
  Users,
  UserCheck,
  User,
  Clock,
  Activity,
} from 'lucide-react'
import { toast } from 'sonner'
import { m } from '@/ui/paraglide/messages.js'
import type {
  QuotaPolicyResponse,
  QuotaScopeTypeEnum,
  QuotaResourceTypeEnum,
  QuotaPeriodEnum,
  QuotaRole,
} from '@shumai/dtos'
import { formatQuotaPeriod } from '@shumai/dtos'

interface QuotaRuleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
  policy?: QuotaPolicyResponse | null
  onSuccess?: () => void
}

/* eslint-disable @typescript-eslint/naming-convention */
const RESOURCE_CONFIG = {
  agent_total_tokens: {
    label: () => m.quota_resource_agent_total_tokens(),
    icon: Cpu,
    unit: 'tokens',
    defaultLimit: 100000,
  },
  agent_cost: {
    label: () => m.quota_resource_agent_cost(),
    icon: DollarSign,
    unit: '$',
    defaultLimit: 10,
  },
  agent_skill_call_count: {
    label: () => m.quota_resource_agent_skill_call_count(),
    icon: Puzzle,
    unit: 'calls',
    defaultLimit: 100,
  },
  agent_mcp_call_count: {
    label: () => m.quota_resource_agent_mcp_call_count(),
    icon: Server,
    unit: 'calls',
    defaultLimit: 100,
  },
  agent_bash_call_count: {
    label: () => m.quota_resource_agent_bash_call_count(),
    icon: Terminal,
    unit: 'calls',
    defaultLimit: 50,
  },
  agent_network_call_count: {
    label: () => m.quota_resource_agent_network_call_count(),
    icon: Globe,
    unit: 'requests',
    defaultLimit: 100,
  },
} as const
/* eslint-enable @typescript-eslint/naming-convention */

function formatResourceUsageValue(resource: QuotaResourceTypeEnum, val: number): string {
  if (resource === 'agent_cost') {
    return `$${val.toFixed(2)}`
  }
  if (resource === 'agent_total_tokens') {
    return val.toLocaleString()
  }
  return val.toLocaleString()
}

export const QuotaRuleDialog: React.FC<QuotaRuleDialogProps> = ({
  open,
  onOpenChange,
  teamId,
  policy,
  onSuccess,
}) => {
  const queryClient = useQueryClient()
  const isEditing = !!policy

  const [scopeType, setScopeType] = useState<QuotaScopeTypeEnum>('team')
  const [role, setRole] = useState<QuotaRole>('editor')
  const [userId, setUserId] = useState<string>('')
  const [resource, setResource] = useState<QuotaResourceTypeEnum>('agent_total_tokens')
  const [skillId, setSkillId] = useState<string>('')
  const [mcpServerId, setMcpServerId] = useState<string>('')
  const [bashMatch, setBashMatch] = useState<string>('*')
  const [networkDomain, setNetworkDomain] = useState<string>('*')
  const [limit, setLimit] = useState<number>(100000)
  const [period, setPeriod] = useState<QuotaPeriodEnum>('1day')
  const [enabled, setEnabled] = useState<boolean>(true)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false)

  // Fetch team members when needed
  const { data: members = [] } = useQuery({
    queryKey: ['teams', teamId, 'members'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].members.$get({
        param: { teamId },
        query: {},
      })
      if (!res.ok) return []
      return await res.json()
    },
    enabled: open,
  })

  // Fetch team skills when needed
  const { data: skillsData } = useQuery({
    queryKey: ['teams', teamId, 'skills'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].skills.$get({ param: { teamId } })
      if (!res.ok) return { skills: [] }
      return await res.json()
    },
    enabled: open && resource === 'agent_skill_call_count',
  })
  const skills = skillsData?.skills || []

  // Fetch team MCP servers when needed
  const { data: mcpData } = useQuery({
    queryKey: ['teams', teamId, 'mcp', 'servers'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].mcp.servers.$get({ param: { teamId } })
      if (!res.ok) return { servers: [] }
      return await res.json()
    },
    enabled: open && resource === 'agent_mcp_call_count',
  })
  const mcpServers = mcpData?.servers || []

  // Reset or populate form values on open/policy change
  useEffect(() => {
    if (policy) {
      setScopeType(policy.scopeType)
      setRole(policy.role || 'editor')
      setUserId(policy.userId || '')
      setResource(policy.resource)
      const resData = (policy.resourceData as Record<string, unknown> | null) || {}
      setSkillId(typeof resData.id === 'string' ? resData.id : '')
      setMcpServerId(typeof resData.id === 'string' ? resData.id : '')
      setBashMatch(typeof resData.match === 'string' ? resData.match : '*')
      setNetworkDomain(typeof resData.domain === 'string' ? resData.domain : '*')
      setLimit(policy.limit)
      setPeriod(formatQuotaPeriod(policy.period) as QuotaPeriodEnum)
      setEnabled(policy.enabled)
    } else {
      setScopeType('team')
      setRole('editor')
      setUserId('')
      setResource('agent_total_tokens')
      setSkillId('')
      setMcpServerId('')
      setBashMatch('*')
      setNetworkDomain('*')
      setLimit(100000)
      setPeriod('1day')
      setEnabled(true)
    }
  }, [policy, open])

  // Save / Update Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      let resourceData: Record<string, unknown> | null = null
      if (resource === 'agent_skill_call_count') {
        if (!skillId.trim()) throw new Error(m.enter_skill_id())
        resourceData = { id: skillId.trim() }
      } else if (resource === 'agent_mcp_call_count') {
        if (!mcpServerId.trim()) throw new Error(m.enter_mcp_id())
        resourceData = { id: mcpServerId.trim() }
      } else if (resource === 'agent_bash_call_count') {
        if (!bashMatch.trim()) throw new Error(m.bash_command_pattern())
        resourceData = { match: bashMatch.trim() }
      } else if (resource === 'agent_network_call_count') {
        if (!networkDomain.trim()) throw new Error(m.network_domain_pattern())
        resourceData = { domain: networkDomain.trim() }
      }

      if (scopeType === 'user' && !userId) {
        throw new Error(m.select_user())
      }

      if (limit <= 0 || isNaN(limit)) {
        throw new Error(m.quota_limit())
      }

      if (isEditing && policy) {
        const res = await client.api.teams[':teamId'].quotas[':id'].$put({
          param: { teamId, id: policy.id },
          json: {
            scopeType,
            role: scopeType === 'role' ? role : null,
            userId: scopeType === 'user' ? userId : null,
            resource,
            resourceData,
            limit: Number(limit),
            period,
            enabled,
          },
        })
        if (!res.ok) {
          const err = await res.json().catch(() => null)
          throw new Error((err as { message?: string })?.message || m.failed_to_update_quota())
        }
        return await res.json()
      } else {
        const res = await client.api.teams[':teamId'].quotas.$post({
          param: { teamId },
          json: {
            scopeType,
            role: scopeType === 'role' ? role : null,
            userId: scopeType === 'user' ? userId : null,
            resource,
            resourceData,
            limit: Number(limit),
            period,
            enabled,
          },
        })
        if (!res.ok) {
          const err = await res.json().catch(() => null)
          throw new Error((err as { message?: string })?.message || m.failed_to_create_quota())
        }
        return await res.json()
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'quotas'] })
      toast.success(isEditing ? m.quota_updated_successfully() : m.quota_created_successfully())
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : m.failed_to_update_quota())
    },
  })

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!policy) return
      const res = await client.api.teams[':teamId'].quotas[':id'].$delete({
        param: { teamId, id: policy.id },
      })
      if (!res.ok) throw new Error(m.failed_to_delete_quota())
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'quotas'] })
      toast.success(m.quota_deleted_successfully())
      setIsDeleteDialogOpen(false)
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : m.failed_to_delete_quota())
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveMutation.mutate()
  }

  // Calculate current usage display
  const consumed = policy?.usage?.consumed ?? 0
  const reserved = policy?.usage?.reserved ?? 0
  const totalUsed = consumed + reserved
  const currentLimit = policy?.limit ?? limit
  const percent =
    policy?.usage?.percent ??
    (currentLimit > 0 ? Number(((totalUsed / currentLimit) * 100).toFixed(1)) : 0)
  const remaining = policy?.usage ? policy.usage.remaining : Math.max(0, currentLimit - totalUsed)

  const isOverLimit = percent >= 100

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>{isEditing ? m.edit_quota_rule() : m.create_quota_rule()}</DialogTitle>
            <DialogDescription>
              {isEditing ? m.edit_quota_rule_description() : m.create_quota_rule_description()}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 px-6 py-2">
            <form id="quota-rule-form" onSubmit={handleSubmit} className="space-y-6">
              {/* Current Usage Section (Visible in Edit mode) */}
              {isEditing && policy && (
                <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold text-foreground">
                        {m.quota_current_usage()}
                      </span>
                    </div>
                    <Badge variant={policy.enabled ? 'default' : 'secondary'}>
                      {policy.enabled ? m.quota_enabled() : m.quota_disabled()}
                    </Badge>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1.5">
                    <Progress value={Math.min(100, Math.max(0, percent))} className="h-2" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                      <span
                        className={
                          isOverLimit ? 'text-destructive font-semibold' : 'text-foreground'
                        }
                      >
                        {formatResourceUsageValue(policy.resource, totalUsed)} /{' '}
                        {formatResourceUsageValue(policy.resource, policy.limit)}{' '}
                        {RESOURCE_CONFIG[policy.resource]?.unit}
                      </span>
                      <span>{percent}%</span>
                    </div>
                  </div>

                  {/* Window & Detailed Stats */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60 text-xs">
                    <div>
                      <span className="text-muted-foreground block">{m.quota_consumed()}</span>
                      <span className="font-semibold text-foreground">
                        {formatResourceUsageValue(policy.resource, consumed)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">{m.quota_reserved()}</span>
                      <span className="font-semibold text-foreground">
                        {formatResourceUsageValue(policy.resource, reserved)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">{m.quota_remaining()}</span>
                      <span className="font-semibold text-foreground">
                        {formatResourceUsageValue(policy.resource, remaining)}
                      </span>
                    </div>
                  </div>

                  {policy.usage?.periodEnd && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        {m.quota_period_resets()}:{' '}
                        {new Date(policy.usage.periodEnd).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Scope Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">{m.quota_scope()}</Label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setScopeType('team')}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs font-medium transition-all ${
                      scopeType === 'team'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card hover:bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    <Users className="w-4 h-4 mb-1.5" />
                    {m.quota_scope_team()}
                  </button>
                  <button
                    type="button"
                    onClick={() => setScopeType('role')}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs font-medium transition-all ${
                      scopeType === 'role'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card hover:bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    <UserCheck className="w-4 h-4 mb-1.5" />
                    {m.quota_scope_role()}
                  </button>
                  <button
                    type="button"
                    onClick={() => setScopeType('user')}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs font-medium transition-all ${
                      scopeType === 'user'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card hover:bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    <User className="w-4 h-4 mb-1.5" />
                    {m.quota_scope_user()}
                  </button>
                </div>
              </div>

              {/* Conditional Scope Target: Role */}
              {scopeType === 'role' && (
                <div className="space-y-2">
                  <Label htmlFor="role-select" className="text-sm font-medium">
                    {m.select_role()}
                  </Label>
                  <Select value={role} onValueChange={(val) => setRole(val as QuotaRole)}>
                    <SelectTrigger id="role-select">
                      <SelectValue placeholder={m.select_role()} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Owner</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="reviewer">Reviewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Conditional Scope Target: User */}
              {scopeType === 'user' && (
                <div className="space-y-2">
                  <Label htmlFor="user-select" className="text-sm font-medium">
                    {m.select_user()}
                  </Label>
                  <Select value={userId} onValueChange={setUserId}>
                    <SelectTrigger id="user-select">
                      <SelectValue placeholder={m.select_user()} />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map(
                        (member: {
                          user?: { id: string; name: string; email: string }
                          role: string
                        }) => (
                          <SelectItem key={member.user?.id} value={member.user?.id || ''}>
                            {member.user?.name} ({member.user?.email}) - {member.role}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Resource Type */}
              <div className="space-y-2">
                <Label htmlFor="resource-select" className="text-sm font-medium">
                  {m.quota_resource()}
                </Label>
                <Select
                  value={resource}
                  onValueChange={(val) => {
                    const newRes = val as QuotaResourceTypeEnum
                    setResource(newRes)
                    if (!isEditing) {
                      setLimit(RESOURCE_CONFIG[newRes]?.defaultLimit || 100)
                    }
                  }}
                >
                  <SelectTrigger id="resource-select">
                    <SelectValue placeholder={m.quota_resource()} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent_total_tokens">
                      {m.quota_resource_agent_total_tokens()}
                    </SelectItem>
                    <SelectItem value="agent_cost">{m.quota_resource_agent_cost()}</SelectItem>
                    <SelectItem value="agent_skill_call_count">
                      {m.quota_resource_agent_skill_call_count()}
                    </SelectItem>
                    <SelectItem value="agent_mcp_call_count">
                      {m.quota_resource_agent_mcp_call_count()}
                    </SelectItem>
                    <SelectItem value="agent_bash_call_count">
                      {m.quota_resource_agent_bash_call_count()}
                    </SelectItem>
                    <SelectItem value="agent_network_call_count">
                      {m.quota_resource_agent_network_call_count()}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Resource-Specific Configuration Fields */}
              {resource === 'agent_skill_call_count' && (
                <div className="space-y-2">
                  <Label htmlFor="skill-select" className="text-sm font-medium">
                    {m.select_skill()}
                  </Label>
                  <div className="space-y-2">
                    {skills.length > 0 && (
                      <Select value={skillId} onValueChange={setSkillId}>
                        <SelectTrigger id="skill-select">
                          <SelectValue placeholder={m.select_skill()} />
                        </SelectTrigger>
                        <SelectContent>
                          {skills.map((s: { id: string; name: string }) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name} ({s.id})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Input
                      placeholder={m.enter_skill_id()}
                      value={skillId}
                      onChange={(e) => setSkillId(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              {resource === 'agent_mcp_call_count' && (
                <div className="space-y-2">
                  <Label htmlFor="mcp-select" className="text-sm font-medium">
                    {m.select_mcp_server()}
                  </Label>
                  <div className="space-y-2">
                    {mcpServers.length > 0 && (
                      <Select value={mcpServerId} onValueChange={setMcpServerId}>
                        <SelectTrigger id="mcp-select">
                          <SelectValue placeholder={m.select_mcp_server()} />
                        </SelectTrigger>
                        <SelectContent>
                          {mcpServers.map((s: { id: string; name: string }) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name} ({s.id})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Input
                      placeholder={m.enter_mcp_id()}
                      value={mcpServerId}
                      onChange={(e) => setMcpServerId(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              {resource === 'agent_bash_call_count' && (
                <div className="space-y-2">
                  <Label htmlFor="bash-match" className="text-sm font-medium">
                    {m.bash_command_pattern()}
                  </Label>
                  <Input
                    id="bash-match"
                    placeholder={m.bash_command_pattern_placeholder()}
                    value={bashMatch}
                    onChange={(e) => setBashMatch(e.target.value)}
                    required
                  />
                </div>
              )}

              {resource === 'agent_network_call_count' && (
                <div className="space-y-2">
                  <Label htmlFor="network-domain" className="text-sm font-medium">
                    {m.network_domain_pattern()}
                  </Label>
                  <Input
                    id="network-domain"
                    placeholder={m.network_domain_pattern_placeholder()}
                    value={networkDomain}
                    onChange={(e) => setNetworkDomain(e.target.value)}
                    required
                  />
                </div>
              )}

              {/* Limit & Period */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quota-limit" className="text-sm font-medium">
                    {m.quota_limit()} ({RESOURCE_CONFIG[resource]?.unit})
                  </Label>
                  <Input
                    id="quota-limit"
                    type="number"
                    min="0.01"
                    step={resource === 'agent_cost' ? '0.01' : '1'}
                    value={limit}
                    onChange={(e) => setLimit(parseFloat(e.target.value) || 0)}
                    placeholder={m.quota_limit_placeholder()}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="period-select" className="text-sm font-medium">
                    {m.quota_period()}
                  </Label>
                  <Select value={period} onValueChange={(val) => setPeriod(val as QuotaPeriodEnum)}>
                    <SelectTrigger id="period-select">
                      <SelectValue placeholder={m.quota_period()} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1hour">{m.quota_period_1hour()}</SelectItem>
                      <SelectItem value="5hour">{m.quota_period_5hour()}</SelectItem>
                      <SelectItem value="1day">{m.quota_period_1day()}</SelectItem>
                      <SelectItem value="7day">{m.quota_period_7day()}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Enabled Switch */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                <div className="space-y-0.5">
                  <Label htmlFor="quota-enabled-switch" className="text-sm font-medium">
                    {m.quota_enabled()}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {enabled ? m.quota_enabled() : m.quota_disabled()}
                  </p>
                </div>
                <Switch id="quota-enabled-switch" checked={enabled} onCheckedChange={setEnabled} />
              </div>
            </form>
          </ScrollArea>

          <DialogFooter className="px-6 py-4 border-t border-border bg-muted/20 flex flex-row items-center justify-between sm:justify-between">
            {isEditing ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setIsDeleteDialogOpen(true)}
                disabled={deleteMutation.isPending || saveMutation.isPending}
                className="gap-1.5"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {m.delete_quota()}
              </Button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saveMutation.isPending}
              >
                {m.cancel()}
              </Button>
              <Button
                type="submit"
                form="quota-rule-form"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || (scopeType === 'user' && !userId)}
              >
                {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {isEditing ? m.save_changes() : m.create()}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
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
                deleteMutation.mutate()
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
    </>
  )
}
