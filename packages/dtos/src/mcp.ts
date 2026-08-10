import { z } from 'zod'

export const mcpServerAuthTypeSchema = z.enum(['auto', 'none', 'bearer', 'oauth'])
export type McpServerAuthType = z.infer<typeof mcpServerAuthTypeSchema>

export const mcpTransportSchema = z.enum(['streamable_http', 'sse'])
export type McpTransport = z.infer<typeof mcpTransportSchema>

export const mcpServerPermissionSchema = z.enum(['owner', 'editor', 'reviewer'])
export type McpServerPermission = z.infer<typeof mcpServerPermissionSchema>

export const mcpOauthConfigSchema = z.object({
  grantType: z.enum(['authorization_code', 'client_credentials']).optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  scope: z.string().optional(),
  authorizationParams: z.record(z.string(), z.string()).optional(),
  redirectUri: z.string().optional(),
  clientName: z.string().optional(),
  clientUri: z.string().optional(),
  skipIssuerMetadataValidation: z.boolean().optional(),
})
export type McpOauthConfig = z.infer<typeof mcpOauthConfigSchema>

export const mcpServerAuthConfigSchema = z.object({
  type: mcpServerAuthTypeSchema.optional(),
  bearerToken: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  oauth: mcpOauthConfigSchema.optional(),
})
export type McpServerAuthConfig = z.infer<typeof mcpServerAuthConfigSchema>

export const mcpServerConfigSchema = z.object({
  excludeTools: z.array(z.string()).optional(),
  requestTimeoutMs: z.number().int().positive().optional(),
  protocolVersion: z.enum(['legacy', 'auto', '2026-07-28']).optional(),
  directTools: z.boolean().optional(),
})
export type McpServerConfig = z.infer<typeof mcpServerConfigSchema>

export const mcpToolInfoSchema = z.object({
  name: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  inputSchema: z.unknown().optional(),
})
export type McpToolInfo = z.infer<typeof mcpToolInfoSchema>

export const createMcpServerRequestSchema = z.object({
  url: z.string().url(),
  transport: mcpTransportSchema.optional(),
  authConfig: mcpServerAuthConfigSchema.optional(),
  config: mcpServerConfigSchema.optional(),
  permission: mcpServerPermissionSchema.optional(),
})
export type CreateMcpServerRequest = z.infer<typeof createMcpServerRequestSchema>

export const updateMcpServerRequestSchema = z.object({
  transport: mcpTransportSchema.optional(),
  authConfig: mcpServerAuthConfigSchema.optional(),
  config: mcpServerConfigSchema.optional(),
  permission: mcpServerPermissionSchema.optional(),
  refreshTools: z.boolean().optional(),
})
export type UpdateMcpServerRequest = z.infer<typeof updateMcpServerRequestSchema>

export const updateMcpServerPermissionRequestSchema = z.object({
  permission: mcpServerPermissionSchema,
})
export type UpdateMcpServerPermissionRequest = z.infer<
  typeof updateMcpServerPermissionRequestSchema
>

export const mcpServerInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  url: z.string(),
  transport: mcpTransportSchema,
  authType: mcpServerAuthTypeSchema,
  config: mcpServerConfigSchema.optional(),
  permission: mcpServerPermissionSchema,
  status: z.string(),
  lastError: z.string().nullable().optional(),
  toolCount: z.number(),
  hasCredential: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type McpServerInfo = z.infer<typeof mcpServerInfoSchema>

export const listMcpServersResponseSchema = z.object({
  servers: z.array(mcpServerInfoSchema),
})
export type ListMcpServersResponse = z.infer<typeof listMcpServersResponseSchema>

export const refreshToolsRequestSchema = z.object({})
export type RefreshToolsRequest = z.infer<typeof refreshToolsRequestSchema>

export const refreshToolsResponseSchema = z.object({
  tools: z.array(mcpToolInfoSchema),
})
export type RefreshToolsResponse = z.infer<typeof refreshToolsResponseSchema>

export const mcpAuthStatusSchema = z.enum([
  'authenticated',
  'expired',
  'not_authenticated',
  'in_progress',
])
export type McpAuthStatus = z.infer<typeof mcpAuthStatusSchema>

export const mcpAuthStatusResponseSchema = z.object({
  status: mcpAuthStatusSchema,
})
export type McpAuthStatusResponse = z.infer<typeof mcpAuthStatusResponseSchema>

export const mcpAuthStartResponseSchema = z.object({
  authorizationUrl: z.string().optional(),
  status: mcpAuthStatusSchema,
})
export type McpAuthStartResponse = z.infer<typeof mcpAuthStartResponseSchema>

export const mcpAuthCompleteRequestSchema = z.object({
  code: z.string(),
  iss: z.string().optional(),
})
export type McpAuthCompleteRequest = z.infer<typeof mcpAuthCompleteRequestSchema>

export const mcpTestServerResponseSchema = z.object({
  ok: z.boolean(),
  toolCount: z.number(),
  message: z.string().optional(),
})
export type McpTestServerResponse = z.infer<typeof mcpTestServerResponseSchema>
