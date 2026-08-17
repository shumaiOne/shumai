import {
  prisma,
  type QuotaRule,
  type QuotaPeriod,
  type QuotaResourceType,
  type QuotaScopeMode,
  type TeamMemberRole,
} from '@shumai/db'

export interface QuotaEventResourceData {
  skillId?: string
  mcpServerId?: string
  command?: string
  name?: string
  toolName?: string
  [key: string]: unknown
}

export interface QuotaEvent {
  teamId: string
  userId?: string | null
  role?: TeamMemberRole | null
  resource: QuotaResourceType
  resourceData?: QuotaEventResourceData
}

export interface CachedQuotaRule {
  id: string
  teamId: string
  scopeMode: QuotaScopeMode
  role: TeamMemberRole | null
  userIds: string[] | null
  resource: QuotaResourceType
  resourceData: Record<string, unknown> | null
  limit: number
  period: QuotaPeriod
  periodDurationMs: number
  enabled: boolean
  matcher: (event: QuotaEvent) => boolean
  getTargetUserId: (event: QuotaEvent) => string | null
}

export function periodToDurationMs(period: QuotaPeriod | string): number {
  switch (period) {
    case 'one_hour':
    case '1hour':
      return 60 * 60 * 1000
    case 'five_hours':
    case '5hour':
      return 5 * 60 * 60 * 1000
    case 'one_day':
    case '1day':
      return 24 * 60 * 60 * 1000
    case 'seven_days':
    case '7day':
      return 7 * 24 * 60 * 60 * 1000
    default:
      return 60 * 60 * 1000
  }
}

/**
 * Converts a wildcard pattern (with * and ?) into a regular expression.
 */
export function wildcardToRegex(pattern: string): RegExp {
  const trimmed = pattern.trim()
  if (trimmed === '*' || trimmed === '') {
    return /^.*$/s
  }
  // Escape regex special chars except * and ?
  const escaped = trimmed.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const regexStr = '^' + escaped.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
  return new RegExp(regexStr, 's')
}

export function compileRule(rule: QuotaRule): CachedQuotaRule {
  const periodDurationMs = periodToDurationMs(rule.period)
  const resourceData = (rule.resourceData as Record<string, unknown> | null) ?? null
  const userIds = Array.isArray(rule.userIds) ? (rule.userIds as string[]) : null

  let bashMatcher: RegExp | null = null
  let toolMatcher: RegExp | null = null

  if (rule.resource === 'agent_bash_call_count' && resourceData?.match) {
    bashMatcher = wildcardToRegex(String(resourceData.match))
  } else if (
    rule.resource === 'agent_tool_call_count' &&
    (resourceData?.name || resourceData?.toolName)
  ) {
    const pattern = String(resourceData.name ?? resourceData.toolName)
    toolMatcher = wildcardToRegex(pattern)
  }

  const matcher = (event: QuotaEvent): boolean => {
    if (!rule.enabled) return false
    if (event.teamId !== rule.teamId) return false
    if (event.resource !== rule.resource) return false

    // Scope check
    if (rule.scopeMode === 'all_members') {
      if (rule.role && event.role !== rule.role) return false
    } else if (rule.scopeMode === 'each_member') {
      if (!event.userId) return false
      if (rule.role && event.role !== rule.role) return false
    } else if (rule.scopeMode === 'selected_members') {
      if (!event.userId) return false
      if (!userIds || !userIds.includes(event.userId)) return false
    }

    // Resource Data check
    if (rule.resource === 'agent_skill_call_count') {
      const targetId = resourceData?.id ?? resourceData?.skillId
      const eventSkillId = event.resourceData?.skillId ?? event.resourceData?.id
      if (targetId && eventSkillId !== targetId) return false
    } else if (rule.resource === 'agent_mcp_call_count') {
      const targetId = resourceData?.id ?? resourceData?.mcpServerId
      const eventMcpId = event.resourceData?.mcpServerId ?? event.resourceData?.id
      if (targetId && eventMcpId !== targetId) return false
    } else if (rule.resource === 'agent_bash_call_count' && bashMatcher) {
      const cmd = event.resourceData?.command ?? ''
      if (!bashMatcher.test(cmd)) return false
    } else if (rule.resource === 'agent_tool_call_count' && toolMatcher) {
      const toolName = String(event.resourceData?.name ?? event.resourceData?.toolName ?? '')
      if (!toolMatcher.test(toolName)) return false
    }

    return true
  }

  const getTargetUserId = (event: QuotaEvent): string | null => {
    if (rule.scopeMode === 'all_members') {
      return null
    }
    return event.userId ?? null
  }

  return {
    id: rule.id,
    teamId: rule.teamId,
    scopeMode: rule.scopeMode,
    role: rule.role,
    userIds,
    resource: rule.resource,
    resourceData,
    limit: rule.limit,
    period: rule.period,
    periodDurationMs,
    enabled: rule.enabled,
    matcher,
    getTargetUserId,
  }
}

export class QuotaRuleCache {
  private rulesByTeam = new Map<string, CachedQuotaRule[]>()
  private loadedTeams = new Set<string>()

  async getRules(teamId: string): Promise<CachedQuotaRule[]> {
    if (!this.loadedTeams.has(teamId)) {
      await this.loadTeamRules(teamId)
    }
    return this.rulesByTeam.get(teamId) ?? []
  }

  async loadTeamRules(teamId: string): Promise<void> {
    const rules = await prisma.quotaRule.findMany({
      where: { teamId, enabled: true },
    })
    this.rulesByTeam.set(teamId, rules.map(compileRule))
    this.loadedTeams.add(teamId)
  }

  async findMatchingRules(event: QuotaEvent): Promise<CachedQuotaRule[]> {
    const teamRules = await this.getRules(event.teamId)
    if (teamRules.length === 0) return []
    return teamRules.filter((rule) => rule.matcher(event))
  }

  invalidate(teamId: string): void {
    this.loadedTeams.delete(teamId)
    this.rulesByTeam.delete(teamId)
  }

  clear(): void {
    this.loadedTeams.clear()
    this.rulesByTeam.clear()
  }
}

export const quotaRuleCache = new QuotaRuleCache()
