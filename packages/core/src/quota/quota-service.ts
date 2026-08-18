import {
  prisma,
  Prisma,
  type QuotaPeriod,
  type QuotaRecord,
  type QuotaResourceType,
  type QuotaRule,
  type TeamMemberRole,
} from '@shumai/db'
import {
  type CreateQuotaRuleRequest,
  type ListQuotaRulesResponse,
  type QuotaRuleResponse,
  type ListQuotaRecordsResponse,
  type QuotaRecordResponse,
  type UpdateQuotaRuleRequest,
  normalizeQuotaPeriod,
  formatQuotaPeriod,
  skillResourceDataSchema,
  mcpResourceDataSchema,
  bashResourceDataSchema,
  toolResourceDataSchema,
} from '@shumai/dtos'
import { HTTPException } from 'hono/http-exception'

export class QuotaExceededError extends Error {
  public readonly policyId: string
  public readonly resource: string
  public readonly limit: number
  public readonly consumed: number
  public readonly periodEnd: Date

  constructor(params: {
    policyId: string
    resource: string
    limit: number
    consumed: number
    periodEnd: Date
    message?: string
  }) {
    const msg =
      params.message ||
      `Quota exceeded for ${params.resource}: limit of ${params.limit} reached (currently consumed: ${params.consumed}). Resets at ${params.periodEnd.toISOString()}.`
    super(msg)
    this.name = 'QuotaExceededError'
    this.policyId = params.policyId
    this.resource = params.resource
    this.limit = params.limit
    this.consumed = params.consumed
    this.periodEnd = params.periodEnd
  }
}

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

function matchesQuotaRule(rule: QuotaRule, event: QuotaEvent): boolean {
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
    const userIds = Array.isArray(rule.userIds) ? (rule.userIds as string[]) : null
    if (!userIds || !userIds.includes(event.userId)) return false
  }

  const resourceData = (rule.resourceData as Record<string, unknown> | null) ?? null

  // Resource data check
  if (rule.resource === 'agent_skill_call_count') {
    const targetId = resourceData?.id ?? resourceData?.skillId
    const eventSkillId = event.resourceData?.skillId ?? event.resourceData?.id
    if (targetId && eventSkillId !== targetId) return false
  } else if (rule.resource === 'agent_mcp_call_count') {
    const targetId = resourceData?.id ?? resourceData?.mcpServerId
    const eventMcpId = event.resourceData?.mcpServerId ?? event.resourceData?.id
    if (targetId && eventMcpId !== targetId) return false
  } else if (rule.resource === 'agent_bash_call_count' && resourceData?.match) {
    const bashMatcher = wildcardToRegex(String(resourceData.match))
    const command = event.resourceData?.command ?? ''
    if (!bashMatcher.test(command)) return false
  } else if (
    rule.resource === 'agent_tool_call_count' &&
    (resourceData?.name || resourceData?.toolName)
  ) {
    const toolMatcher = wildcardToRegex(String(resourceData.name ?? resourceData.toolName))
    const toolName = String(event.resourceData?.name ?? event.resourceData?.toolName ?? '')
    if (!toolMatcher.test(toolName)) return false
  }

  return true
}

function getQuotaRuleTargetUserId(rule: QuotaRule, event: QuotaEvent): string | null {
  if (rule.scopeMode === 'all_members') {
    return null
  }
  return event.userId ?? null
}

/* eslint-disable @typescript-eslint/naming-convention */
interface RawQuotaRecord {
  id: string
  rule_id: string
  team_id: string
  user_id: string | null
  period_start: Date | null
  period_end: Date | null
  consumed: number
}
/* eslint-enable @typescript-eslint/naming-convention */

export class QuotaService {
  constructor(private readonly prismaClient: typeof prisma = prisma) {}

  private mapRuleToResponse(rule: QuotaRule, recordsCount?: number): QuotaRuleResponse {
    const userIds = Array.isArray(rule.userIds) ? (rule.userIds as string[]) : undefined

    return {
      id: rule.id,
      teamId: rule.teamId,
      scopeMode: rule.scopeMode,
      role: rule.role ?? undefined,
      userIds,
      resource: rule.resource,
      resourceData: (rule.resourceData as Record<string, unknown> | null) ?? undefined,
      limit: rule.limit,
      period: formatQuotaPeriod(rule.period) as QuotaRuleResponse['period'],
      enabled: rule.enabled,
      recordsCount,
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString(),
    }
  }

  async createRule(teamId: string, req: CreateQuotaRuleRequest): Promise<QuotaRuleResponse> {
    if (req.scopeMode === 'selected_members') {
      if (!req.userIds || req.userIds.length === 0) {
        throw new HTTPException(400, {
          message: 'userIds must contain at least one user when scopeMode is "selected_members"',
        })
      }
      const members = await this.prismaClient.teamMember.findMany({
        where: {
          teamId,
          userId: { in: req.userIds },
          user: { type: 'human' },
        },
        select: { userId: true },
      })
      if (members.length !== req.userIds.length) {
        throw new HTTPException(400, {
          message: 'One or more selected users are not members of the team',
        })
      }
    }

    const rule = await this.prismaClient.quotaRule.create({
      data: {
        teamId,
        scopeMode: req.scopeMode,
        role: req.scopeMode !== 'selected_members' ? (req.role ?? null) : null,
        userIds:
          req.scopeMode === 'selected_members' && req.userIds ? req.userIds : Prisma.JsonNull,
        resource: req.resource,
        resourceData: req.resourceData ?? Prisma.JsonNull,
        limit: req.limit,
        period: normalizeQuotaPeriod(req.period),
        enabled: req.enabled ?? true,
      },
    })

    return this.mapRuleToResponse(rule, 0)
  }

  async updateRule(
    teamId: string,
    ruleId: string,
    req: UpdateQuotaRuleRequest,
  ): Promise<QuotaRuleResponse> {
    const existing = await this.prismaClient.quotaRule.findUnique({
      where: { id: ruleId },
    })

    if (!existing || existing.teamId !== teamId) {
      throw new HTTPException(404, { message: 'Quota rule not found' })
    }

    const effectiveScopeMode = req.scopeMode ?? existing.scopeMode
    const effectiveRole =
      effectiveScopeMode === 'selected_members'
        ? null
        : req.role !== undefined
          ? req.role
          : existing.role
    const effectiveUserIds =
      effectiveScopeMode === 'selected_members'
        ? req.userIds !== undefined
          ? req.userIds
          : Array.isArray(existing.userIds)
            ? (existing.userIds as string[])
            : []
        : null
    const effectiveResource = req.resource ?? existing.resource
    const effectiveResourceData =
      req.resourceData !== undefined
        ? req.resourceData
        : (existing.resourceData as Record<string, unknown> | null)
    const effectiveLimit = req.limit ?? existing.limit
    const effectivePeriod = req.period ? normalizeQuotaPeriod(req.period) : existing.period
    const effectiveEnabled = req.enabled ?? existing.enabled

    // Validate effective merged state
    if (effectiveScopeMode === 'selected_members') {
      if (!effectiveUserIds || effectiveUserIds.length === 0) {
        throw new HTTPException(400, {
          message: 'userIds must contain at least one user when scopeMode is "selected_members"',
        })
      }
      const members = await this.prismaClient.teamMember.findMany({
        where: {
          teamId,
          userId: { in: effectiveUserIds },
          user: { type: 'human' },
        },
        select: { userId: true },
      })
      if (members.length !== effectiveUserIds.length) {
        throw new HTTPException(400, {
          message: 'One or more selected users are not members of the team',
        })
      }
    }

    if (effectiveResource === 'agent_skill_call_count') {
      const res = skillResourceDataSchema.safeParse(effectiveResourceData)
      if (!res.success) {
        throw new HTTPException(400, {
          message: 'resourceData.id is required for agent_skill_call_count',
        })
      }
    } else if (effectiveResource === 'agent_mcp_call_count') {
      const res = mcpResourceDataSchema.safeParse(effectiveResourceData)
      if (!res.success) {
        throw new HTTPException(400, {
          message: 'resourceData.id is required for agent_mcp_call_count',
        })
      }
    } else if (effectiveResource === 'agent_bash_call_count') {
      const res = bashResourceDataSchema.safeParse(effectiveResourceData)
      if (!res.success) {
        throw new HTTPException(400, {
          message: 'resourceData.match is required for agent_bash_call_count',
        })
      }
    } else if (effectiveResource === 'agent_tool_call_count') {
      const res = toolResourceDataSchema.safeParse(effectiveResourceData)
      if (!res.success) {
        throw new HTTPException(400, {
          message: 'resourceData.name is required for agent_tool_call_count',
        })
      }
    }

    if (effectiveLimit <= 0) {
      throw new HTTPException(400, {
        message: 'Limit must be greater than 0',
      })
    }

    const isAccountingDimensionChanged =
      (req.resource !== undefined && req.resource !== existing.resource) ||
      (req.period !== undefined && normalizeQuotaPeriod(req.period) !== existing.period) ||
      (req.scopeMode !== undefined && req.scopeMode !== existing.scopeMode) ||
      (req.role !== undefined && req.role !== existing.role) ||
      (req.resourceData !== undefined &&
        JSON.stringify(req.resourceData) !== JSON.stringify(existing.resourceData))

    const updated = await this.prismaClient.$transaction(async (tx) => {
      if (isAccountingDimensionChanged) {
        // Reset all records when accounting dimensions change
        await tx.quotaRecord.deleteMany({
          where: { ruleId },
        })
      } else if (effectiveScopeMode === 'selected_members' && req.userIds !== undefined) {
        // Clean up records for removed users if updating userIds
        if (req.userIds && req.userIds.length > 0) {
          await tx.quotaRecord.deleteMany({
            where: {
              ruleId,
              userId: { notIn: req.userIds },
            },
          })
        }
      }

      const data: Prisma.QuotaRuleUpdateInput = {
        scopeMode: effectiveScopeMode,
        role: effectiveRole,
        userIds:
          effectiveScopeMode === 'selected_members' && effectiveUserIds
            ? effectiveUserIds
            : Prisma.JsonNull,
        resource: effectiveResource,
        resourceData: effectiveResourceData ?? Prisma.JsonNull,
        limit: effectiveLimit,
        period: effectivePeriod,
        enabled: effectiveEnabled,
      }

      return tx.quotaRule.update({
        where: { id: ruleId },
        data,
      })
    })

    const recordsCount = await this.prismaClient.quotaRecord.count({
      where: { ruleId },
    })

    return this.mapRuleToResponse(updated, recordsCount)
  }

  async deleteRule(teamId: string, ruleId: string): Promise<void> {
    const existing = await this.prismaClient.quotaRule.findUnique({
      where: { id: ruleId },
    })

    if (!existing || existing.teamId !== teamId) {
      throw new HTTPException(404, { message: 'Quota rule not found' })
    }

    await this.prismaClient.quotaRule.delete({
      where: { id: ruleId },
    })
  }

  async getRule(teamId: string, ruleId: string): Promise<QuotaRuleResponse> {
    const rule = await this.prismaClient.quotaRule.findUnique({
      where: { id: ruleId },
    })

    if (!rule || rule.teamId !== teamId) {
      throw new HTTPException(404, { message: 'Quota rule not found' })
    }

    const recordsCount = await this.prismaClient.quotaRecord.count({
      where: { ruleId },
    })

    return this.mapRuleToResponse(rule, recordsCount)
  }

  async listRules(teamId: string): Promise<ListQuotaRulesResponse> {
    const rules = await this.prismaClient.quotaRule.findMany({
      where: { teamId },
      orderBy: { id: 'desc' },
    })

    const ruleResponses = await Promise.all(
      rules.map(async (rule) => {
        const recordsCount = await this.prismaClient.quotaRecord.count({
          where: { ruleId: rule.id },
        })
        return this.mapRuleToResponse(rule, recordsCount)
      }),
    )

    return {
      rules: ruleResponses,
      total: ruleResponses.length,
    }
  }

  async listRuleRecords(teamId: string, ruleId: string): Promise<ListQuotaRecordsResponse> {
    const rule = await this.prismaClient.quotaRule.findUnique({
      where: { id: ruleId },
    })

    if (!rule || rule.teamId !== teamId) {
      throw new HTTPException(404, { message: 'Quota rule not found' })
    }

    const now = new Date()

    if (rule.scopeMode === 'all_members') {
      const record = await this.prismaClient.quotaRecord.findFirst({
        where: { ruleId: rule.id, userId: null },
      })

      const isWindowActive = Boolean(
        record?.periodStart &&
        record?.periodEnd &&
        now >= record.periodStart &&
        now < record.periodEnd,
      )

      const consumed = isWindowActive ? (record?.consumed ?? 0) : 0
      const remaining = Math.max(0, rule.limit - consumed)
      const percent =
        rule.limit > 0 ? Math.min(100, Number(((consumed / rule.limit) * 100).toFixed(2))) : 0

      const res: QuotaRecordResponse = {
        id: record?.id ?? null,
        ruleId: rule.id,
        teamId: rule.teamId,
        userId: null,
        user: null,
        periodStart:
          isWindowActive && record?.periodStart ? record.periodStart.toISOString() : null,
        periodEnd: isWindowActive && record?.periodEnd ? record.periodEnd.toISOString() : null,
        consumed,
        remaining,
        percent,
        isWindowActive,
      }

      return {
        records: [res],
        total: 1,
      }
    }

    // For each_member or selected_members
    type MemberTarget = { id: string; name: string; email: string; image?: string | null }
    let targetUsers: MemberTarget[] = []

    if (rule.scopeMode === 'selected_members') {
      const userIds = Array.isArray(rule.userIds) ? (rule.userIds as string[]) : []
      if (userIds.length > 0) {
        targetUsers = await this.prismaClient.user.findMany({
          where: { id: { in: userIds }, type: 'human' },
          select: { id: true, name: true, email: true, image: true },
        })
      }
    } else {
      // each_member
      const memberWhere: Prisma.TeamMemberWhereInput = {
        teamId,
        user: { type: 'human' },
      }
      if (rule.role) {
        memberWhere.role = rule.role
      }
      const members = await this.prismaClient.teamMember.findMany({
        where: memberWhere,
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      })
      targetUsers = members.map((m) => m.user)
    }

    const existingRecords = await this.prismaClient.quotaRecord.findMany({
      where: {
        ruleId: rule.id,
        userId: { in: targetUsers.map((u) => u.id) },
      },
    })

    const recordByUserId = new Map<string, QuotaRecord>()
    for (const r of existingRecords) {
      if (r.userId) recordByUserId.set(r.userId, r)
    }

    const records: QuotaRecordResponse[] = targetUsers.map((user) => {
      const record = recordByUserId.get(user.id)
      const isWindowActive = Boolean(
        record?.periodStart &&
        record?.periodEnd &&
        now >= record.periodStart &&
        now < record.periodEnd,
      )

      const consumed = isWindowActive ? (record?.consumed ?? 0) : 0
      const remaining = Math.max(0, rule.limit - consumed)
      const percent =
        rule.limit > 0 ? Math.min(100, Number(((consumed / rule.limit) * 100).toFixed(2))) : 0

      return {
        id: record?.id ?? null,
        ruleId: rule.id,
        teamId: rule.teamId,
        userId: user.id,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image ?? null,
        },
        periodStart:
          isWindowActive && record?.periodStart ? record.periodStart.toISOString() : null,
        periodEnd: isWindowActive && record?.periodEnd ? record.periodEnd.toISOString() : null,
        consumed,
        remaining,
        percent,
        isWindowActive,
      }
    })

    return {
      records,
      total: records.length,
    }
  }

  private async findMatchingRules(event: QuotaEvent): Promise<QuotaRule[]> {
    const rules = await this.prismaClient.quotaRule.findMany({
      where: {
        teamId: event.teamId,
        resource: event.resource,
        enabled: true,
      },
    })

    return rules.filter((rule) => matchesQuotaRule(rule, event))
  }

  /**
   * Evaluates whether an action is permitted under all active matching quota rules.
   * Performs an atomic pre-check with SELECT ... FOR UPDATE.
   * Throws QuotaExceededError if any matching rule is exceeded.
   */
  async checkQuota(
    event: QuotaEvent,
    amount: number = 0,
  ): Promise<{ allowed: boolean; matchedRules: QuotaRule[] }> {
    const rules = await this.findMatchingRules(event)
    if (rules.length === 0) {
      return { allowed: true, matchedRules: [] }
    }

    const now = new Date()

    for (const rule of rules) {
      const targetUserId = getQuotaRuleTargetUserId(rule, event)

      await this.prismaClient.$transaction(async (tx) => {
        if (targetUserId === null) {
          // Serialize all_members record checks/creations on the parent rule row
          await tx.$queryRaw`SELECT id FROM quota_rules WHERE id = ${rule.id} FOR UPDATE`
        }

        let rawRecord = targetUserId
          ? ((
              await tx.$queryRaw<RawQuotaRecord[]>`
                SELECT * FROM quota_records
                WHERE rule_id = ${rule.id} AND user_id = ${targetUserId}
                FOR UPDATE
              `
            )[0] ?? null)
          : ((
              await tx.$queryRaw<RawQuotaRecord[]>`
                SELECT * FROM quota_records
                WHERE rule_id = ${rule.id} AND user_id IS NULL
                FOR UPDATE
              `
            )[0] ?? null)

        if (!rawRecord && targetUserId !== null) {
          // Lock parent rule on first user record check and re-query
          await tx.$queryRaw`SELECT id FROM quota_rules WHERE id = ${rule.id} FOR UPDATE`
          rawRecord =
            (
              await tx.$queryRaw<RawQuotaRecord[]>`
              SELECT * FROM quota_records
              WHERE rule_id = ${rule.id} AND user_id = ${targetUserId}
              FOR UPDATE
            `
            )[0] ?? null
        }

        const isWindowActive = Boolean(
          rawRecord?.period_start &&
          rawRecord?.period_end &&
          now >= rawRecord.period_start &&
          now < rawRecord.period_end,
        )

        const consumed = isWindowActive ? (rawRecord?.consumed ?? 0) : 0
        const periodEnd = isWindowActive
          ? rawRecord!.period_end!
          : new Date(now.getTime() + periodToDurationMs(rule.period))

        if (consumed + amount > rule.limit) {
          throw new QuotaExceededError({
            policyId: rule.id,
            resource: rule.resource,
            limit: rule.limit,
            consumed,
            periodEnd,
          })
        }
      })
    }

    return { allowed: true, matchedRules: rules }
  }

  /**
   * Records consumed usage across all matching quota rules.
   * Lazy resets the period window in-place when previous window has expired.
   * Uses SELECT ... FOR UPDATE inside transactions for atomic concurrency protection.
   */
  async consumeQuota(event: QuotaEvent, amount: number): Promise<void> {
    if (amount <= 0) return

    const rules = await this.findMatchingRules(event)
    if (rules.length === 0) return

    const now = new Date()

    for (const rule of rules) {
      const targetUserId = getQuotaRuleTargetUserId(rule, event)

      await this.prismaClient.$transaction(async (tx) => {
        if (targetUserId === null) {
          // Serialize all_members (shared pool) creations and updates on the parent rule row
          await tx.$queryRaw`SELECT id FROM quota_rules WHERE id = ${rule.id} FOR UPDATE`
        }

        let rawRecord = targetUserId
          ? ((
              await tx.$queryRaw<RawQuotaRecord[]>`
                SELECT * FROM quota_records
                WHERE rule_id = ${rule.id} AND user_id = ${targetUserId}
                FOR UPDATE
              `
            )[0] ?? null)
          : ((
              await tx.$queryRaw<RawQuotaRecord[]>`
                SELECT * FROM quota_records
                WHERE rule_id = ${rule.id} AND user_id IS NULL
                FOR UPDATE
              `
            )[0] ?? null)

        if (!rawRecord && targetUserId !== null) {
          // Lock parent rule on first user record creation and re-query
          await tx.$queryRaw`SELECT id FROM quota_rules WHERE id = ${rule.id} FOR UPDATE`
          rawRecord =
            (
              await tx.$queryRaw<RawQuotaRecord[]>`
              SELECT * FROM quota_records
              WHERE rule_id = ${rule.id} AND user_id = ${targetUserId}
              FOR UPDATE
            `
            )[0] ?? null
        }

        const isWindowActive = Boolean(
          rawRecord?.period_start &&
          rawRecord?.period_end &&
          now >= rawRecord.period_start &&
          now < rawRecord.period_end,
        )

        if (isWindowActive && rawRecord) {
          await tx.quotaRecord.update({
            where: { id: rawRecord.id },
            data: {
              consumed: { increment: amount },
            },
          })
        } else {
          const periodStart = now
          const periodEnd = new Date(now.getTime() + periodToDurationMs(rule.period))

          if (rawRecord) {
            await tx.quotaRecord.update({
              where: { id: rawRecord.id },
              data: {
                periodStart,
                periodEnd,
                consumed: amount,
              },
            })
          } else {
            await tx.quotaRecord.create({
              data: {
                ruleId: rule.id,
                teamId: rule.teamId,
                userId: targetUserId,
                periodStart,
                periodEnd,
                consumed: amount,
              },
            })
          }
        }
      })
    }
  }
}

export const quotaService = new QuotaService()
