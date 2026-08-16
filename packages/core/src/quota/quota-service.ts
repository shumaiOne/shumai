import { prisma, Prisma, type QuotaPolicy, type QuotaUsage } from '@shumai/db'
import {
  type CreateQuotaPolicyRequest,
  type ListQuotaPoliciesResponse,
  type QuotaPolicyResponse,
  type QuotaUsageSummary,
  type UpdateQuotaPolicyRequest,
  normalizeQuotaPeriod,
  formatQuotaPeriod,
} from '@shumai/dtos'
import { HTTPException } from 'hono/http-exception'
import { quotaRuleCache, type CachedQuotaRule, type QuotaEvent } from './quota-cache'

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

type PolicyWithUser = QuotaPolicy & {
  user?: { id: string; name: string; email: string } | null
}

export class QuotaService {
  constructor(private readonly prismaClient: typeof prisma = prisma) {}

  private mapPolicyToResponse(
    policy: PolicyWithUser,
    latestUsage?: QuotaUsage | null,
  ): QuotaPolicyResponse {
    let usage: QuotaUsageSummary | null = null

    if (latestUsage) {
      const now = new Date()
      const isCurrent = now >= latestUsage.periodStart && now < latestUsage.periodEnd
      if (isCurrent) {
        const consumed = latestUsage.consumed
        const reserved = latestUsage.reserved
        const totalUsed = consumed + reserved
        const remaining = Math.max(0, policy.limit - totalUsed)
        const percent = policy.limit > 0 ? Math.min(100, (totalUsed / policy.limit) * 100) : 0

        usage = {
          periodStart: latestUsage.periodStart.toISOString(),
          periodEnd: latestUsage.periodEnd.toISOString(),
          consumed,
          reserved,
          remaining,
          percent: Number(percent.toFixed(2)),
        }
      }
    }

    return {
      id: policy.id,
      teamId: policy.teamId,
      scopeType: policy.scopeType,
      role: policy.role ?? undefined,
      userId: policy.userId ?? undefined,
      user: policy.user
        ? {
            id: policy.user.id,
            name: policy.user.name,
            email: policy.user.email,
          }
        : undefined,
      resource: policy.resource,
      resourceData: (policy.resourceData as Record<string, unknown> | null) ?? undefined,
      limit: policy.limit,
      period: formatQuotaPeriod(policy.period) as QuotaPolicyResponse['period'],
      enabled: policy.enabled,
      createdAt: policy.createdAt.toISOString(),
      updatedAt: policy.updatedAt.toISOString(),
      usage,
    }
  }

  async createPolicy(teamId: string, req: CreateQuotaPolicyRequest): Promise<QuotaPolicyResponse> {
    if (req.userId) {
      const user = await this.prismaClient.user.findUnique({
        where: { id: req.userId },
      })
      if (!user) {
        throw new HTTPException(404, { message: `User with ID ${req.userId} not found` })
      }
    }

    const policy = await this.prismaClient.quotaPolicy.create({
      data: {
        teamId,
        scopeType: req.scopeType,
        role: req.role ?? null,
        userId: req.userId ?? null,
        resource: req.resource,
        resourceData: req.resourceData ?? Prisma.JsonNull,
        limit: req.limit,
        period: normalizeQuotaPeriod(req.period),
        enabled: req.enabled ?? true,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    quotaRuleCache.invalidate(teamId)

    return this.mapPolicyToResponse(policy)
  }

  async updatePolicy(
    teamId: string,
    policyId: string,
    req: UpdateQuotaPolicyRequest,
  ): Promise<QuotaPolicyResponse> {
    const existing = await this.prismaClient.quotaPolicy.findUnique({
      where: { id: policyId },
    })

    if (!existing || existing.teamId !== teamId) {
      throw new HTTPException(404, { message: 'Quota policy not found' })
    }

    if (req.userId) {
      const user = await this.prismaClient.user.findUnique({
        where: { id: req.userId },
      })
      if (!user) {
        throw new HTTPException(404, { message: `User with ID ${req.userId} not found` })
      }
    }

    const data: Prisma.QuotaPolicyUpdateInput = {}
    if (req.scopeType !== undefined) data.scopeType = req.scopeType
    if (req.role !== undefined) data.role = req.role
    if (req.userId !== undefined) {
      data.user = req.userId ? { connect: { id: req.userId } } : { disconnect: true }
    }
    if (req.resource !== undefined) data.resource = req.resource
    if (req.resourceData !== undefined) {
      data.resourceData = req.resourceData ?? Prisma.JsonNull
    }
    if (req.limit !== undefined) data.limit = req.limit
    if (req.period !== undefined) data.period = normalizeQuotaPeriod(req.period)
    if (req.enabled !== undefined) data.enabled = req.enabled

    const updated = await this.prismaClient.quotaPolicy.update({
      where: { id: policyId },
      data,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    quotaRuleCache.invalidate(teamId)

    const latestUsage = await this.prismaClient.quotaUsage.findFirst({
      where: { policyId },
      orderBy: { periodEnd: 'desc' },
    })

    return this.mapPolicyToResponse(updated, latestUsage)
  }

  async deletePolicy(teamId: string, policyId: string): Promise<void> {
    const existing = await this.prismaClient.quotaPolicy.findUnique({
      where: { id: policyId },
    })

    if (!existing || existing.teamId !== teamId) {
      throw new HTTPException(404, { message: 'Quota policy not found' })
    }

    await this.prismaClient.quotaPolicy.delete({
      where: { id: policyId },
    })

    quotaRuleCache.invalidate(teamId)
  }

  async getPolicy(teamId: string, policyId: string): Promise<QuotaPolicyResponse> {
    const policy = await this.prismaClient.quotaPolicy.findUnique({
      where: { id: policyId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!policy || policy.teamId !== teamId) {
      throw new HTTPException(404, { message: 'Quota policy not found' })
    }

    const latestUsage = await this.prismaClient.quotaUsage.findFirst({
      where: { policyId },
      orderBy: { periodEnd: 'desc' },
    })

    return this.mapPolicyToResponse(policy, latestUsage)
  }

  async listPolicies(teamId: string): Promise<ListQuotaPoliciesResponse> {
    const policies = await this.prismaClient.quotaPolicy.findMany({
      where: { teamId },
      orderBy: { id: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    const policyResponses = await Promise.all(
      policies.map(async (policy) => {
        const latestUsage = await this.prismaClient.quotaUsage.findFirst({
          where: { policyId: policy.id },
          orderBy: { periodEnd: 'desc' },
        })
        return this.mapPolicyToResponse(policy, latestUsage)
      }),
    )

    return {
      policies: policyResponses,
      total: policyResponses.length,
    }
  }

  /**
   * Evaluates whether an action is permitted under all active matching quota policies.
   * Performs an "add 0" or "add amount" pre-check.
   * Throws QuotaExceededError if any matching policy is exceeded.
   */
  async checkQuota(
    event: QuotaEvent,
    amount: number = 0,
  ): Promise<{ allowed: boolean; matchedRules: CachedQuotaRule[] }> {
    const rules = await quotaRuleCache.findMatchingRules(event)
    if (rules.length === 0) {
      return { allowed: true, matchedRules: [] }
    }

    const now = new Date()

    for (const rule of rules) {
      const targetUserId = rule.scopeType === 'team' ? null : (event.userId ?? null)

      const latestUsage = await this.prismaClient.quotaUsage.findFirst({
        where: {
          policyId: rule.id,
          userId: targetUserId,
        },
        orderBy: { periodEnd: 'desc' },
      })

      if (latestUsage && now >= latestUsage.periodStart && now < latestUsage.periodEnd) {
        if (latestUsage.consumed + latestUsage.reserved + amount > rule.limit) {
          throw new QuotaExceededError({
            policyId: rule.id,
            resource: rule.resource,
            limit: rule.limit,
            consumed: latestUsage.consumed,
            periodEnd: latestUsage.periodEnd,
          })
        }
      } else {
        // Window expired or not started yet: usage in fresh window is 0 + amount
        if (amount > rule.limit) {
          const periodEnd = new Date(now.getTime() + rule.periodDurationMs)
          throw new QuotaExceededError({
            policyId: rule.id,
            resource: rule.resource,
            limit: rule.limit,
            consumed: 0,
            periodEnd,
          })
        }
      }
    }

    return { allowed: true, matchedRules: rules }
  }

  /**
   * Records consumed usage across all matching quota policies.
   * Creates a new period window if no active window exists or if the current window has expired.
   */
  async consumeQuota(event: QuotaEvent, amount: number): Promise<void> {
    if (amount <= 0) return

    const rules = await quotaRuleCache.findMatchingRules(event)
    if (rules.length === 0) return

    const now = new Date()

    for (const rule of rules) {
      const targetUserId = rule.scopeType === 'team' ? null : (event.userId ?? null)

      const latestUsage = await this.prismaClient.quotaUsage.findFirst({
        where: {
          policyId: rule.id,
          userId: targetUserId,
        },
        orderBy: { periodEnd: 'desc' },
      })

      if (latestUsage && now >= latestUsage.periodStart && now < latestUsage.periodEnd) {
        await this.prismaClient.quotaUsage.update({
          where: { id: latestUsage.id },
          data: {
            consumed: { increment: amount },
          },
        })
      } else {
        const periodStart = now
        const periodEnd = new Date(now.getTime() + rule.periodDurationMs)

        await this.prismaClient.quotaUsage.create({
          data: {
            policyId: rule.id,
            teamId: rule.teamId,
            userId: targetUserId,
            periodStart,
            periodEnd,
            consumed: amount,
            reserved: 0,
          },
        })
      }
    }
  }
}

export const quotaService = new QuotaService()
