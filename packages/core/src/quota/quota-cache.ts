import {
  prisma,
  type QuotaPolicy,
  type QuotaPeriod,
  type QuotaResourceType,
  type QuotaScopeType,
  type TeamMemberRole,
} from '@shumai/db'

export interface QuotaEventResourceData {
  skillId?: string
  mcpServerId?: string
  command?: string
  domain?: string
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
  scopeType: QuotaScopeType
  role: TeamMemberRole | null
  userId: string | null
  resource: QuotaResourceType
  resourceData: Record<string, unknown> | null
  limit: number
  period: QuotaPeriod
  periodDurationMs: number
  enabled: boolean
  matcher: (event: QuotaEvent) => boolean
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

/**
 * Converts a domain wildcard (e.g. *.googleapis.com, googleapis.com, *) into a RegExp.
 */
export function domainWildcardToRegex(pattern: string): RegExp {
  const trimmed = pattern.trim().toLowerCase()
  if (trimmed === '*' || trimmed === '') {
    return /^.*$/
  }
  if (trimmed.startsWith('*.')) {
    const base = trimmed.slice(2).replace(/[.+^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`^(?:.+\\.)?${base}$`, 'i')
  }
  const escaped = trimmed.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${escaped}$`, 'i')
}

export function compileRule(policy: QuotaPolicy): CachedQuotaRule {
  const periodDurationMs = periodToDurationMs(policy.period)
  const resourceData = (policy.resourceData as Record<string, unknown> | null) ?? null

  let bashMatcher: RegExp | null = null
  let domainMatcher: RegExp | null = null

  if (policy.resource === 'agent_bash_call_count' && resourceData?.match) {
    bashMatcher = wildcardToRegex(String(resourceData.match))
  } else if (policy.resource === 'agent_network_call_count' && resourceData?.domain) {
    domainMatcher = domainWildcardToRegex(String(resourceData.domain))
  }

  const matcher = (event: QuotaEvent): boolean => {
    if (!policy.enabled) return false
    if (event.teamId !== policy.teamId) return false
    if (event.resource !== policy.resource) return false

    // Scope check
    if (policy.scopeType === 'role') {
      if (!event.role || event.role !== policy.role) return false
    } else if (policy.scopeType === 'user') {
      if (!event.userId || event.userId !== policy.userId) return false
    }

    // Resource Data check
    if (policy.resource === 'agent_skill_call_count') {
      const targetId = resourceData?.id ?? resourceData?.skillId
      const eventSkillId = event.resourceData?.skillId ?? event.resourceData?.id
      if (targetId && eventSkillId !== targetId) return false
    } else if (policy.resource === 'agent_mcp_call_count') {
      const targetId = resourceData?.id ?? resourceData?.mcpServerId
      const eventMcpId = event.resourceData?.mcpServerId ?? event.resourceData?.id
      if (targetId && eventMcpId !== targetId) return false
    } else if (policy.resource === 'agent_bash_call_count' && bashMatcher) {
      const cmd = event.resourceData?.command ?? ''
      if (!bashMatcher.test(cmd)) return false
    } else if (policy.resource === 'agent_network_call_count' && domainMatcher) {
      const domain = event.resourceData?.domain ?? ''
      if (!domainMatcher.test(domain)) return false
    }

    return true
  }

  return {
    id: policy.id,
    teamId: policy.teamId,
    scopeType: policy.scopeType,
    role: policy.role,
    userId: policy.userId,
    resource: policy.resource,
    resourceData,
    limit: policy.limit,
    period: policy.period,
    periodDurationMs,
    enabled: policy.enabled,
    matcher,
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
    const policies = await prisma.quotaPolicy.findMany({
      where: { teamId, enabled: true },
    })
    this.rulesByTeam.set(teamId, policies.map(compileRule))
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
