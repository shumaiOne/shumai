import { z } from 'zod'
import { AuditAction } from '@shumai/db'

export { AuditAction }

export const auditLogSchema = z.object({
  id: z.string(),
  action: z.nativeEnum(AuditAction),
  teamId: z.string(),
  userId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  itemId: z.string().nullable().optional(),
  createdAt: z.string(),
})

export type AuditLog = z.infer<typeof auditLogSchema>

export const listAuditLogsQuerySchema = z.object({
  first: z.coerce.number().optional(),
  after: z.string().optional(),
  actions: z
    .union([z.nativeEnum(AuditAction), z.array(z.nativeEnum(AuditAction))])
    .transform((val) => (Array.isArray(val) ? val : [val]))
    .optional(),
  userIds: z
    .union([z.string(), z.array(z.string())])
    .transform((val) => (Array.isArray(val) ? val : [val]))
    .optional(),
  itemId: z.string().optional(),
})

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>

export const listAuditLogsResponseSchema = z.object({
  nodes: z.array(auditLogSchema),
  pageInfo: z.object({
    hasNextPage: z.boolean(),
    endCursor: z.string().nullable(),
  }),
  total: z.number(),
})

export type ListAuditLogsResponse = z.infer<typeof listAuditLogsResponseSchema>
