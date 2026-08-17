import { z } from 'zod'
import { QuotaScopeMode, QuotaPeriod, QuotaResourceType } from '@shumai/db/enums'

export { QuotaScopeMode, QuotaPeriod, QuotaResourceType }

export const quotaScopeModeSchema = z.nativeEnum(QuotaScopeMode)
export type QuotaScopeModeEnum = z.infer<typeof quotaScopeModeSchema>

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

export const quotaRecordResponseSchema = z.object({
  id: z.string().nullable(),
  ruleId: z.string(),
  teamId: z.string(),
  userId: z.string().nullable().optional(),
  user: z
    .object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      image: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  periodStart: z.string().nullable().optional(),
  periodEnd: z.string().nullable().optional(),
  consumed: z.number(),
  reserved: z.number(),
  remaining: z.number(),
  percent: z.number(),
  isWindowActive: z.boolean(),
})
export type QuotaRecordResponse = z.infer<typeof quotaRecordResponseSchema>

export const listQuotaRecordsResponseSchema = z.object({
  records: z.array(quotaRecordResponseSchema),
  total: z.number(),
})
export type ListQuotaRecordsResponse = z.infer<typeof listQuotaRecordsResponseSchema>

export const quotaRuleResponseSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  scopeMode: quotaScopeModeSchema,
  role: quotaRoleSchema.nullable().optional(),
  userIds: z.array(z.string()).nullable().optional(),
  resource: quotaResourceTypeSchema,
  resourceData: quotaResourceDataSchema.nullable().optional(),
  limit: z.number(),
  period: quotaPeriodSchema,
  enabled: z.boolean(),
  recordsCount: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type QuotaRuleResponse = z.infer<typeof quotaRuleResponseSchema>

export const listQuotaRulesResponseSchema = z.object({
  rules: z.array(quotaRuleResponseSchema),
  total: z.number(),
})
export type ListQuotaRulesResponse = z.infer<typeof listQuotaRulesResponseSchema>

export const createQuotaRuleRequestSchema = z
  .object({
    scopeMode: quotaScopeModeSchema,
    role: quotaRoleSchema.optional().nullable(),
    userIds: z.array(z.string()).optional().nullable(),
    resource: quotaResourceTypeSchema,
    resourceData: quotaResourceDataSchema.optional().nullable(),
    limit: z.number().positive('Limit must be greater than 0'),
    period: quotaPeriodSchema,
    enabled: z.boolean().optional().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.scopeMode === 'selected_members') {
      if (!data.userIds || data.userIds.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'userIds must contain at least one user when scopeMode is "selected_members"',
          path: ['userIds'],
        })
      }
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
export type CreateQuotaRuleRequest = z.input<typeof createQuotaRuleRequestSchema>

export const updateQuotaRuleRequestSchema = z
  .object({
    scopeMode: quotaScopeModeSchema.optional(),
    role: quotaRoleSchema.optional().nullable(),
    userIds: z.array(z.string()).optional().nullable(),
    resource: quotaResourceTypeSchema.optional(),
    resourceData: quotaResourceDataSchema.optional().nullable(),
    limit: z.number().positive('Limit must be greater than 0').optional(),
    period: quotaPeriodSchema.optional(),
    enabled: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.scopeMode === 'selected_members' && data.userIds !== undefined) {
      if (!data.userIds || data.userIds.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'userIds must contain at least one user when scopeMode is "selected_members"',
          path: ['userIds'],
        })
      }
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
export type UpdateQuotaRuleRequest = z.input<typeof updateQuotaRuleRequestSchema>
