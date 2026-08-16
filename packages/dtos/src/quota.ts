import { z } from 'zod'
import { QuotaScopeType, QuotaPeriod, QuotaResourceType } from '@shumai/db/enums'

export { QuotaScopeType, QuotaPeriod, QuotaResourceType }

export const quotaScopeTypeSchema = z.nativeEnum(QuotaScopeType)
export type QuotaScopeTypeEnum = z.infer<typeof quotaScopeTypeSchema>

export const quotaPeriodSchema = z.enum([
  '1hour',
  '5hour',
  '1day',
  '7day',
  'one_hour',
  'five_hours',
  'one_day',
  'seven_days',
])
export type QuotaPeriodEnum = z.infer<typeof quotaPeriodSchema>

export function normalizeQuotaPeriod(period: QuotaPeriodEnum | string): QuotaPeriod {
  switch (period) {
    case '1hour':
    case 'one_hour':
      return 'one_hour'
    case '5hour':
    case 'five_hours':
      return 'five_hours'
    case '1day':
    case 'one_day':
      return 'one_day'
    case '7day':
    case 'seven_days':
      return 'seven_days'
    default:
      return 'one_hour'
  }
}

export function formatQuotaPeriod(period: QuotaPeriod | string): string {
  switch (period) {
    case 'one_hour':
    case '1hour':
      return '1hour'
    case 'five_hours':
    case '5hour':
      return '5hour'
    case 'one_day':
    case '1day':
      return '1day'
    case 'seven_days':
    case '7day':
      return '7day'
    default:
      return period
  }
}

export const quotaResourceTypeSchema = z.nativeEnum(QuotaResourceType)
export type QuotaResourceTypeEnum = z.infer<typeof quotaResourceTypeSchema>

export const quotaRoleSchema = z.enum(['owner', 'editor', 'reviewer'])
export type QuotaRole = z.infer<typeof quotaRoleSchema>

export const skillResourceDataSchema = z.object({
  id: z.string().min(1, 'Skill ID is required'),
})

export const mcpResourceDataSchema = z.object({
  id: z.string().min(1, 'MCP server ID is required'),
})

export const bashResourceDataSchema = z.object({
  match: z.string().min(1, 'Bash match wildcard is required'),
})

export const networkResourceDataSchema = z.object({
  domain: z.string().min(1, 'Network domain wildcard is required'),
})

export const quotaResourceDataSchema = z.record(z.string(), z.unknown())
export type QuotaResourceData = z.infer<typeof quotaResourceDataSchema>

export const quotaUsageSummarySchema = z.object({
  periodStart: z.string(),
  periodEnd: z.string(),
  consumed: z.number(),
  reserved: z.number(),
  remaining: z.number(),
  percent: z.number(),
})
export type QuotaUsageSummary = z.infer<typeof quotaUsageSummarySchema>

export const quotaPolicyResponseSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  scopeType: quotaScopeTypeSchema,
  role: quotaRoleSchema.nullable().optional(),
  userId: z.string().nullable().optional(),
  user: z
    .object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    })
    .nullable()
    .optional(),
  resource: quotaResourceTypeSchema,
  resourceData: quotaResourceDataSchema.nullable().optional(),
  limit: z.number(),
  period: quotaPeriodSchema,
  enabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  usage: quotaUsageSummarySchema.nullable().optional(),
})
export type QuotaPolicyResponse = z.infer<typeof quotaPolicyResponseSchema>

export const listQuotaPoliciesResponseSchema = z.object({
  policies: z.array(quotaPolicyResponseSchema),
  total: z.number(),
})
export type ListQuotaPoliciesResponse = z.infer<typeof listQuotaPoliciesResponseSchema>

export const createQuotaPolicyRequestSchema = z
  .object({
    scopeType: quotaScopeTypeSchema,
    role: quotaRoleSchema.optional().nullable(),
    userId: z.string().optional().nullable(),
    resource: quotaResourceTypeSchema,
    resourceData: quotaResourceDataSchema.optional().nullable(),
    limit: z.number().positive('Limit must be greater than 0'),
    period: quotaPeriodSchema,
    enabled: z.boolean().optional().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.scopeType === 'role' && !data.role) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'role is required when scopeType is "role"',
        path: ['role'],
      })
    }
    if (data.scopeType === 'user' && !data.userId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'userId is required when scopeType is "user"',
        path: ['userId'],
      })
    }
    if (data.resource === 'agent_skill_call_count') {
      const res = skillResourceDataSchema.safeParse(data.resourceData)
      if (!res.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'resourceData.id is required for agent_skill_call_count',
          path: ['resourceData', 'id'],
        })
      }
    } else if (data.resource === 'agent_mcp_call_count') {
      const res = mcpResourceDataSchema.safeParse(data.resourceData)
      if (!res.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'resourceData.id is required for agent_mcp_call_count',
          path: ['resourceData', 'id'],
        })
      }
    } else if (data.resource === 'agent_bash_call_count') {
      const res = bashResourceDataSchema.safeParse(data.resourceData)
      if (!res.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'resourceData.match is required for agent_bash_call_count',
          path: ['resourceData', 'match'],
        })
      }
    } else if (data.resource === 'agent_network_call_count') {
      const res = networkResourceDataSchema.safeParse(data.resourceData)
      if (!res.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'resourceData.domain is required for agent_network_call_count',
          path: ['resourceData', 'domain'],
        })
      }
    }
  })
export type CreateQuotaPolicyRequest = z.input<typeof createQuotaPolicyRequestSchema>

export const updateQuotaPolicyRequestSchema = z
  .object({
    scopeType: quotaScopeTypeSchema.optional(),
    role: quotaRoleSchema.optional().nullable(),
    userId: z.string().optional().nullable(),
    resource: quotaResourceTypeSchema.optional(),
    resourceData: quotaResourceDataSchema.optional().nullable(),
    limit: z.number().positive('Limit must be greater than 0').optional(),
    period: quotaPeriodSchema.optional(),
    enabled: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.scopeType === 'role' && data.role === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'role cannot be null when scopeType is "role"',
        path: ['role'],
      })
    }
    if (data.scopeType === 'user' && data.userId === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'userId cannot be null when scopeType is "user"',
        path: ['userId'],
      })
    }
    if (data.resource === 'agent_skill_call_count' && data.resourceData !== undefined) {
      const res = skillResourceDataSchema.safeParse(data.resourceData)
      if (!res.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'resourceData.id is required for agent_skill_call_count',
          path: ['resourceData', 'id'],
        })
      }
    } else if (data.resource === 'agent_mcp_call_count' && data.resourceData !== undefined) {
      const res = mcpResourceDataSchema.safeParse(data.resourceData)
      if (!res.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'resourceData.id is required for agent_mcp_call_count',
          path: ['resourceData', 'id'],
        })
      }
    } else if (data.resource === 'agent_bash_call_count' && data.resourceData !== undefined) {
      const res = bashResourceDataSchema.safeParse(data.resourceData)
      if (!res.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'resourceData.match is required for agent_bash_call_count',
          path: ['resourceData', 'match'],
        })
      }
    } else if (data.resource === 'agent_network_call_count' && data.resourceData !== undefined) {
      const res = networkResourceDataSchema.safeParse(data.resourceData)
      if (!res.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'resourceData.domain is required for agent_network_call_count',
          path: ['resourceData', 'domain'],
        })
      }
    }
  })
export type UpdateQuotaPolicyRequest = z.input<typeof updateQuotaPolicyRequestSchema>
