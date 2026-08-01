import { z } from 'zod'

export enum AuditAction {
  team_create = 'team_create',
  team_update = 'team_update',
  team_delete = 'team_delete',
  team_member_add = 'team_member_add',
  team_member_update = 'team_member_update',
  team_member_remove = 'team_member_remove',
  project_create = 'project_create',
  project_update = 'project_update',
  project_delete = 'project_delete',
  project_empty_trash = 'project_empty_trash',
  project_member_add = 'project_member_add',
  project_member_update = 'project_member_update',
  project_member_remove = 'project_member_remove',
  file_create = 'file_create',
  file_update = 'file_update',
  file_delete = 'file_delete',
  folder_create = 'folder_create',
  folder_update = 'folder_update',
  folder_delete = 'folder_delete',
  asset_reparent = 'asset_reparent',
  asset_copy = 'asset_copy',
  share_create = 'share_create',
  share_update = 'share_update',
  share_delete = 'share_delete',
  agent_create = 'agent_create',
  agent_update = 'agent_update',
  agent_delete = 'agent_delete',
  skill_create = 'skill_create',
  skill_update = 'skill_update',
  skill_delete = 'skill_delete',
  provider_create = 'provider_create',
  provider_update = 'provider_update',
  provider_delete = 'provider_delete',
  invite_create = 'invite_create',
  invite_revoke = 'invite_revoke',
  metadata_field_create = 'metadata_field_create',
  metadata_field_update = 'metadata_field_update',
  metadata_field_delete = 'metadata_field_delete',
  comment_create = 'comment_create',
  comment_update = 'comment_update',
  comment_delete = 'comment_delete',
  comment_complete = 'comment_complete',
}

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
