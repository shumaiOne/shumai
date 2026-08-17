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
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/components/ui/popover'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import { Button } from '@/ui/components/ui/button'
import { Switch } from '@/ui/components/ui/switch'
import { Checkbox } from '@/ui/components/ui/checkbox'
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
  Trash2,
  Users,
  UserCheck,
  User,
  Clock,
  Search,
  ChevronDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { m } from '@/ui/paraglide/messages.js'
import type {
  QuotaRuleResponse,
  QuotaScopeModeEnum,
  QuotaResourceTypeEnum,
  QuotaPeriodEnum,
  QuotaRole,
} from '@shumai/dtos'
import { formatQuotaPeriod } from '@shumai/dtos'

interface QuotaRuleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
  rule?: QuotaRuleResponse | null
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

export const QuotaRuleDialog: React.FC<QuotaRuleDialogProps> = ({
  open,
  onOpenChange,
  teamId,
  rule,
  onSuccess,
}) => {
  const queryClient = useQueryClient()
  const isEditing = !!rule

  const [scopeMode, setScopeMode] = useState<QuotaScopeModeEnum>('each_member')
  const [roleScope, setRoleScope] = useState<string>('team') // 'team' | 'owner' | 'editor' | 'reviewer'
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [resource, setResource] = useState<QuotaResourceTypeEnum>('agent_total_tokens')
  const [skillId, setSkillId] = useState<string>('')
  const [mcpServerId, setMcpServerId] = useState<string>('')
  const [bashMatch, setBashMatch] = useState<string>('*')
  const [networkDomain, setNetworkDomain] = useState<string>('*')
  const [limit, setLimit] = useState<number>(100000)
  const [period, setPeriod] = useState<QuotaPeriodEnum>('1day')
  const [enabled, setEnabled] = useState<boolean>(true)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false)
  const [memberSearch, setMemberSearch] = useState<string>('')

  // Fetch team members
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

  // Reset or populate form values on open/rule change
  useEffect(() => {
    if (rule) {
      setScopeMode(rule.scopeMode)
      setRoleScope(rule.role || 'team')
      setSelectedUserIds(rule.userIds || [])
      setResource(rule.resource)
      const resData = (rule.resourceData as Record<string, unknown> | null) || {}
      setSkillId(typeof resData.id === 'string' ? resData.id : '')
      setMcpServerId(typeof resData.id === 'string' ? resData.id : '')
      setBashMatch(typeof resData.match === 'string' ? resData.match : '*')
      setNetworkDomain(typeof resData.domain === 'string' ? resData.domain : '*')
      setLimit(rule.limit)
      setPeriod(formatQuotaPeriod(rule.period) as QuotaPeriodEnum)
      setEnabled(rule.enabled)
    } else {
      setScopeMode('each_member')
      setRoleScope('team')
      setSelectedUserIds([])
      setResource('agent_total_tokens')
      setSkillId('')
      setMcpServerId('')
      setBashMatch('*')
      setNetworkDomain('*')
      setLimit(RESOURCE_CONFIG.agent_total_tokens.defaultLimit)
      setPeriod('1day')
      setEnabled(true)
    }
  }, [rule, open])

  // Handle resource change limit defaults
  const handleResourceChange = (newRes: QuotaResourceTypeEnum) => {
    setResource(newRes)
    if (!isEditing) {
      setLimit(RESOURCE_CONFIG[newRes]?.defaultLimit || 100)
    }
  }

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const resourceData: Record<string, unknown> = {}
      if (resource === 'agent_skill_call_count') {
        resourceData.id = skillId
      } else if (resource === 'agent_mcp_call_count') {
        resourceData.id = mcpServerId
      } else if (resource === 'agent_bash_call_count') {
        resourceData.match = bashMatch.trim() || '*'
      } else if (resource === 'agent_network_call_count') {
        resourceData.domain = networkDomain.trim() || '*'
      }

      const res = await client.api.teams[':teamId'].quotas.$post({
        param: { teamId },
        json: {
          scopeMode,
          role:
            scopeMode !== 'selected_members' && roleScope !== 'team'
              ? (roleScope as QuotaRole)
              : null,
          userIds: scopeMode === 'selected_members' ? selectedUserIds : null,
          resource,
          resourceData: Object.keys(resourceData).length > 0 ? resourceData : null,
          limit: Number(limit),
          period,
          enabled,
        },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        throw new Error((err as any)?.message || m.failed_to_create_quota())
      }
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'quotas'] })
      toast.success(m.quota_created_successfully())
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err) => {
      console.error('CREATE MUTATION ERROR:', err)
      toast.error(err instanceof Error ? err.message : m.failed_to_create_quota())
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!rule) return
      const resourceData: Record<string, unknown> = {}
      if (resource === 'agent_skill_call_count') {
        resourceData.id = skillId
      } else if (resource === 'agent_mcp_call_count') {
        resourceData.id = mcpServerId
      } else if (resource === 'agent_bash_call_count') {
        resourceData.match = bashMatch.trim() || '*'
      } else if (resource === 'agent_network_call_count') {
        resourceData.domain = networkDomain.trim() || '*'
      }

      const res = await client.api.teams[':teamId'].quotas[':id'].$put({
        param: { teamId, id: rule.id },
        json: {
          scopeMode,
          role:
            scopeMode !== 'selected_members' && roleScope !== 'team'
              ? (roleScope as QuotaRole)
              : null,
          userIds: scopeMode === 'selected_members' ? selectedUserIds : null,
          resource,
          resourceData: Object.keys(resourceData).length > 0 ? resourceData : null,
          limit: Number(limit),
          period,
          enabled,
        },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        throw new Error((err as any)?.message || m.failed_to_update_quota())
      }
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'quotas'] })
      toast.success(m.quota_updated_successfully())
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : m.failed_to_update_quota())
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!rule) return
      const res = await client.api.teams[':teamId'].quotas[':id'].$delete({
        param: { teamId, id: rule.id },
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
    if (scopeMode === 'selected_members' && selectedUserIds.length === 0) {
      toast.error(m.select_user())
      return
    }
    if (resource === 'agent_skill_call_count' && !skillId.trim()) {
      toast.error(m.enter_skill_id())
      return
    }
    if (resource === 'agent_mcp_call_count' && !mcpServerId.trim()) {
      toast.error(m.enter_mcp_id())
      return
    }
    if (limit <= 0) {
      toast.error('Limit must be greater than 0')
      return
    }

    if (isEditing) {
      updateMutation.mutate()
    } else {
      createMutation.mutate()
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  const filteredMembers = members.filter((member) => {
    if (!memberSearch.trim()) return true
    const q = memberSearch.toLowerCase()
    return (
      member.name.toLowerCase().includes(q) ||
      (member.email && member.email.toLowerCase().includes(q))
    )
  })

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[540px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b border-border/60 shrink-0">
            <DialogTitle className="text-xl font-bold">
              {isEditing ? m.edit_quota_rule() : m.create_quota_rule()}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {isEditing ? m.edit_quota_rule_description() : m.create_quota_rule_description()}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="flex-1 overflow-y-auto min-h-0 p-6 space-y-5"
          >
            {/* Step 1: Scope Mode Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">{m.quota_scope_mode()}</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={scopeMode === 'each_member' ? 'default' : 'outline'}
                  size="sm"
                  disabled={isEditing || isPending}
                  onClick={() => setScopeMode('each_member')}
                  className="flex flex-col h-auto py-2.5 px-2 gap-1 items-center justify-center text-xs"
                >
                  <User className="w-4 h-4" />
                  <span className="font-semibold">{m.quota_scope_mode_each_member()}</span>
                </Button>
                <Button
                  type="button"
                  variant={scopeMode === 'all_members' ? 'default' : 'outline'}
                  size="sm"
                  disabled={isEditing || isPending}
                  onClick={() => setScopeMode('all_members')}
                  className="flex flex-col h-auto py-2.5 px-2 gap-1 items-center justify-center text-xs"
                >
                  <Users className="w-4 h-4" />
                  <span className="font-semibold">{m.quota_scope_mode_all_members()}</span>
                </Button>
                <Button
                  type="button"
                  variant={scopeMode === 'selected_members' ? 'default' : 'outline'}
                  size="sm"
                  disabled={isEditing || isPending}
                  onClick={() => setScopeMode('selected_members')}
                  className="flex flex-col h-auto py-2.5 px-2 gap-1 items-center justify-center text-xs"
                >
                  <UserCheck className="w-4 h-4" />
                  <span className="font-semibold">{m.quota_scope_mode_selected_members()}</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground pt-0.5">
                {scopeMode === 'each_member' && m.quota_scope_mode_each_member_desc()}
                {scopeMode === 'all_members' && m.quota_scope_mode_all_members_desc()}
                {scopeMode === 'selected_members' && m.quota_scope_mode_selected_members_desc()}
              </p>
            </div>

            {/* Step 2: Target Scope or Multi-Select Users */}
            {scopeMode !== 'selected_members' ? (
              <div className="space-y-2">
                <Label htmlFor="quota-role-scope" className="text-sm font-semibold">
                  {m.quota_scope()}
                </Label>
                <Select
                  value={roleScope}
                  onValueChange={setRoleScope}
                  disabled={isEditing || isPending}
                >
                  <SelectTrigger id="quota-role-scope" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="team">{m.quota_scope_team()}</SelectItem>
                    <SelectItem value="owner">{m.quota_scope_role()}: Owner</SelectItem>
                    <SelectItem value="editor">{m.quota_scope_role()}: Editor</SelectItem>
                    <SelectItem value="reviewer">{m.quota_scope_role()}: Reviewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">{m.select_members()}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      disabled={isPending}
                      className="w-full justify-between text-left font-normal h-10"
                    >
                      <span className="truncate">
                        {selectedUserIds.length === 0
                          ? m.select_members()
                          : m.quota_selected_users_count({ count: selectedUserIds.length })}
                      </span>
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-2" align="start">
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder={m.quota_search_members()}
                          value={memberSearch}
                          onChange={(e) => setMemberSearch(e.target.value)}
                          className="h-8 pl-8 text-xs"
                        />
                      </div>
                      <ScrollArea className="h-48">
                        <div className="space-y-1 pr-2">
                          {filteredMembers.map((member) => {
                            const isChecked = selectedUserIds.includes(member.id)
                            return (
                              <div
                                key={member.id}
                                onClick={() => toggleUserSelection(member.id)}
                                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted/60 cursor-pointer text-xs"
                              >
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={() => toggleUserSelection(member.id)}
                                />
                                <Avatar className="w-5 h-5">
                                  <AvatarImage src={member.image || undefined} />
                                  <AvatarFallback className="text-[10px]">
                                    {member.name?.[0]?.toUpperCase() || 'U'}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="truncate flex-1">
                                  <span className="font-medium text-foreground block truncate">
                                    {member.name}
                                  </span>
                                  {member.email && (
                                    <span className="text-[10px] text-muted-foreground block truncate">
                                      {member.email}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </ScrollArea>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Resource Type */}
            <div className="space-y-2">
              <Label htmlFor="quota-resource" className="text-sm font-semibold">
                {m.quota_resource()}
              </Label>
              <Select
                value={resource}
                onValueChange={(val) => handleResourceChange(val as QuotaResourceTypeEnum)}
                disabled={isEditing || isPending}
              >
                <SelectTrigger id="quota-resource" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent_total_tokens">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-primary" />
                      <span>{m.quota_resource_agent_total_tokens()}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="agent_cost">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-emerald-500" />
                      <span>{m.quota_resource_agent_cost()}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="agent_skill_call_count">
                    <div className="flex items-center gap-2">
                      <Puzzle className="w-4 h-4 text-amber-500" />
                      <span>{m.quota_resource_agent_skill_call_count()}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="agent_mcp_call_count">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-blue-500" />
                      <span>{m.quota_resource_agent_mcp_call_count()}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="agent_bash_call_count">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-purple-500" />
                      <span>{m.quota_resource_agent_bash_call_count()}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="agent_network_call_count">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-cyan-500" />
                      <span>{m.quota_resource_agent_network_call_count()}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Resource Specific Fields */}
            {resource === 'agent_skill_call_count' && (
              <div className="space-y-2">
                <Label htmlFor="quota-skill" className="text-sm font-semibold">
                  {m.select_skill()}
                </Label>
                {skills.length > 0 ? (
                  <Select
                    value={skillId}
                    onValueChange={setSkillId}
                    disabled={isEditing || isPending}
                  >
                    <SelectTrigger id="quota-skill" className="w-full">
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
                ) : (
                  <Input
                    id="quota-skill"
                    value={skillId}
                    onChange={(e) => setSkillId(e.target.value)}
                    placeholder={m.enter_skill_id()}
                    disabled={isEditing || isPending}
                  />
                )}
              </div>
            )}

            {resource === 'agent_mcp_call_count' && (
              <div className="space-y-2">
                <Label htmlFor="quota-mcp" className="text-sm font-semibold">
                  {m.select_mcp_server()}
                </Label>
                {mcpServers.length > 0 ? (
                  <Select
                    value={mcpServerId}
                    onValueChange={setMcpServerId}
                    disabled={isEditing || isPending}
                  >
                    <SelectTrigger id="quota-mcp" className="w-full">
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
                ) : (
                  <Input
                    id="quota-mcp"
                    value={mcpServerId}
                    onChange={(e) => setMcpServerId(e.target.value)}
                    placeholder={m.enter_mcp_id()}
                    disabled={isEditing || isPending}
                  />
                )}
              </div>
            )}

            {resource === 'agent_bash_call_count' && (
              <div className="space-y-1.5">
                <Label htmlFor="quota-bash" className="text-sm font-semibold">
                  {m.bash_command_pattern()}
                </Label>
                <Input
                  id="quota-bash"
                  value={bashMatch}
                  onChange={(e) => setBashMatch(e.target.value)}
                  placeholder={m.bash_command_pattern_placeholder()}
                  disabled={isPending}
                />
                <p className="text-xs text-muted-foreground">{m.quota_bash_hint()}</p>
              </div>
            )}

            {resource === 'agent_network_call_count' && (
              <div className="space-y-1.5">
                <Label htmlFor="quota-network" className="text-sm font-semibold">
                  {m.network_domain_pattern()}
                </Label>
                <Input
                  id="quota-network"
                  value={networkDomain}
                  onChange={(e) => setNetworkDomain(e.target.value)}
                  placeholder={m.network_domain_pattern_placeholder()}
                  disabled={isPending}
                />
                <p className="text-xs text-muted-foreground">{m.quota_network_hint()}</p>
              </div>
            )}

            {/* Limit and Period Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quota-limit" className="text-sm font-semibold">
                  {m.quota_limit()} ({RESOURCE_CONFIG[resource]?.unit || ''})
                </Label>
                <Input
                  id="quota-limit"
                  type="number"
                  min="0.01"
                  step={resource === 'agent_cost' ? '0.01' : '1'}
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  placeholder={m.quota_limit_placeholder()}
                  disabled={isPending}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="quota-period" className="text-sm font-semibold">
                  {m.quota_period()}
                </Label>
                <Select
                  value={period}
                  onValueChange={(val) => setPeriod(val as QuotaPeriodEnum)}
                  disabled={isPending}
                >
                  <SelectTrigger id="quota-period" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1hour">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{m.quota_period_1hour()}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="5hour">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{m.quota_period_5hour()}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="1day">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{m.quota_period_1day()}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="7day">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{m.quota_period_7day()}</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Enabled Switch */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
              <div className="space-y-0.5">
                <Label htmlFor="quota-enabled" className="text-sm font-medium cursor-pointer">
                  {enabled ? m.quota_enabled() : m.quota_disabled()}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {enabled
                    ? 'Active and enforcing limits'
                    : 'Inactive, requests will bypass this quota'}
                </p>
              </div>
              <Switch
                id="quota-enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
                disabled={isPending}
              />
            </div>

            <DialogFooter className="pt-4 flex items-center justify-between gap-2 sm:justify-between border-t border-border/60">
              {isEditing ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  disabled={isPending}
                  className="gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{m.delete_quota()}</span>
                </Button>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isPending}
                >
                  {m.cancel()}
                </Button>
                <Button type="submit" disabled={isPending} className="gap-2">
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isEditing ? m.save() : m.create()}
                </Button>
              </div>
            </DialogFooter>
          </form>
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
            <AlertDialogCancel disabled={isPending}>{m.cancel()}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                deleteMutation.mutate()
              }}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {m.delete()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
