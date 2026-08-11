/**
 * McpService — CRUD, discovery, OAuth, and agent integration for MCP servers.
 */

import { auth } from '@modelcontextprotocol/client'
import type { AgentTool, AgentToolResult } from '@earendil-works/pi-agent-core'
import { prisma } from '@shumai/db'
import '@shumai/db/src/prisma-json-types'
import type {
  CreateMcpServerRequest,
  McpAuthStatus,
  McpServerInfo,
  UpdateMcpServerRequest,
} from '@shumai/dtos'
import { logger } from '@shumai/core/src/logger'
import { mcpDbStore, type PendingAuth } from './mcp-db-store'
import { buildDirectTools, isDirectTool } from './mcp-direct-tools'
import { McpOauthProvider, type McpOauthConfig } from './mcp-oauth-provider'
import { buildProxyTool, transformMcpContent, type McpProxyToolContext } from './mcp-proxy-tool'
import {
  formatToolName,
  McpToolRegistry,
  sanitizeServerPrefix,
  type ToolMetadata,
} from './mcp-tool-registry'
import { McpServerManager, type McpServerDefinition } from './mcp-server-manager'

const ROLE_HIERARCHY: Record<string, number> = {
  owner: 3,
  editor: 2,
  reviewer: 1,
}

export interface McpToolCallContext {
  teamId: string
  userId?: string
}

export type McpToolCallContent = AgentToolResult<Record<string, unknown>>['content']

export interface McpToolCallResult {
  ok: boolean
  content: McpToolCallContent
}

export interface McpServerRecord {
  id: string
  name: string
  description: string | null
  instructions: string | null
  url: string
  transport: 'streamable_http' | 'sse'
  authConfig: PrismaJson.McpServerAuthConfig | null
  config: PrismaJson.McpServerConfig | null
  permission: 'owner' | 'editor' | 'reviewer'
  tools: PrismaJson.McpToolInfo[] | null
  status: string
  lastError: string | null
  lastConnectedAt: Date | null
  createdAt: Date
  updatedAt: Date
  teamId: string
  credential: { id: string } | null
}

/**
 * Derive a placeholder server name from its URL until the server self-reports
 * its name/title on first successful connection. Strips www/api/mcp prefixes
 * and sanitizes the remaining host label (used as the direct-tool prefix).
 */
function deriveServerName(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    const labels = hostname.split('.').filter(Boolean)
    let label = labels[0] ?? 'mcp-server'
    if (labels.length > 1 && ['www', 'api', 'mcp'].includes(label)) {
      label = labels[1]
    }
    const sanitized = label.replace(/[^a-z0-9_-]/g, '_').replace(/^[-_]+|[-_]+$/g, '')
    return sanitized || 'mcp-server'
  } catch {
    return 'mcp-server'
  }
}

function generateState(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function extractOauthConfig(authConfig?: PrismaJson.McpServerAuthConfig): McpOauthConfig {
  const oauth = authConfig?.oauth
  if (!oauth) return {}
  return {
    ...(oauth.grantType !== undefined ? { grantType: oauth.grantType } : {}),
    ...(oauth.clientId !== undefined ? { clientId: oauth.clientId } : {}),
    ...(oauth.clientSecret !== undefined ? { clientSecret: oauth.clientSecret } : {}),
    ...(oauth.scope !== undefined ? { scope: oauth.scope } : {}),
    ...(oauth.authorizationParams !== undefined
      ? { authorizationParams: oauth.authorizationParams }
      : {}),
    ...(oauth.redirectUri !== undefined ? { redirectUri: oauth.redirectUri } : {}),
    ...(oauth.clientName !== undefined ? { clientName: oauth.clientName } : {}),
    ...(oauth.clientUri !== undefined ? { clientUri: oauth.clientUri } : {}),
    ...(oauth.skipIssuerMetadataValidation !== undefined
      ? { skipIssuerMetadataValidation: oauth.skipIssuerMetadataValidation }
      : {}),
  }
}

export class McpService {
  private manager = new McpServerManager(mcpDbStore)

  // --------------------------------------------------------------------------
  // CRUD
  // --------------------------------------------------------------------------

  async createServer(teamId: string, req: CreateMcpServerRequest): Promise<McpServerInfo> {
    const server = await prisma.mcpServer.create({
      data: {
        name: deriveServerName(req.url),
        url: req.url,
        teamId,
        transport: req.transport ?? 'streamable_http',
        authConfig: (req.authConfig ?? {}) as PrismaJson.McpServerAuthConfig,
        config: (req.config ?? {}) as PrismaJson.McpServerConfig,
        permission: req.permission ?? 'reviewer',
      },
      include: { credential: true },
    })
    return this.toServerInfo(this.mapRecord(server))
  }

  async updateServer(id: string, req: UpdateMcpServerRequest): Promise<McpServerInfo> {
    const existing = await prisma.mcpServer.findUnique({ where: { id } })
    if (!existing) throw new Error('MCP server not found')

    const authChanged =
      req.authConfig !== undefined &&
      JSON.stringify(req.authConfig) !== JSON.stringify(existing.authConfig ?? {})
    const transportChanged = req.transport !== undefined && req.transport !== existing.transport

    // The endpoint URL is immutable (delete + re-add to change it).
    // Auth/transport changes invalidate credentials and cached tools.
    const invalidateAll = authChanged || transportChanged

    await prisma.$transaction(async (tx) => {
      if (invalidateAll) {
        await tx.mcpServerCredential.deleteMany({ where: { serverId: id } })
      }
      return tx.mcpServer.update({
        where: { id },
        data: {
          ...(req.transport !== undefined ? { transport: req.transport } : {}),
          ...(req.authConfig !== undefined
            ? { authConfig: req.authConfig as PrismaJson.McpServerAuthConfig }
            : {}),
          ...(req.config !== undefined ? { config: req.config as PrismaJson.McpServerConfig } : {}),
          ...(req.permission !== undefined ? { permission: req.permission } : {}),
          ...(invalidateAll ? { tools: [], status: 'not_connected', lastError: null } : {}),
        },
      })
    })

    if (invalidateAll) {
      await this.manager.close(id)
    }

    const record = await this.getServerRecord(id)
    if (!record) throw new Error('MCP server not found')
    return this.toServerInfo(record)
  }

  async updateServerPermission(
    id: string,
    permission: 'owner' | 'editor' | 'reviewer',
  ): Promise<McpServerInfo> {
    const server = await prisma.mcpServer.update({
      where: { id },
      data: { permission },
      include: { credential: true },
    })
    return this.toServerInfo(this.mapRecord(server))
  }

  async deleteServer(id: string): Promise<void> {
    await this.manager.close(id)
    const server = await prisma.mcpServer.findUnique({ where: { id } })
    if (!server) return
    await prisma.mcpServer.delete({ where: { id } })
  }

  async listServers(teamId: string): Promise<McpServerInfo[]> {
    const servers = await prisma.mcpServer.findMany({
      where: { teamId },
      orderBy: { id: 'desc' },
      include: { credential: true },
    })
    return servers.map((s) => this.toServerInfo(this.mapRecord(s)))
  }

  async getServerRecord(id: string): Promise<McpServerRecord | null> {
    const server = await prisma.mcpServer.findUnique({
      where: { id },
      include: { credential: true },
    })
    if (!server) return null
    return this.mapRecord(server)
  }

  async getServer(id: string): Promise<McpServerInfo | null> {
    const server = await this.getServerRecord(id)
    if (!server) return null
    return this.toServerInfo(server)
  }

  private mapRecord(server: {
    id: string
    name: string
    description: string | null
    instructions: string | null
    url: string
    transport: 'streamable_http' | 'sse'
    authConfig: unknown
    config: unknown
    permission: 'owner' | 'editor' | 'reviewer'
    tools: unknown
    status: string
    lastError: string | null
    lastConnectedAt: Date | null
    createdAt: Date
    updatedAt: Date
    teamId: string
    credential: { id: string } | null
  }): McpServerRecord {
    return {
      id: server.id,
      name: server.name,
      description: server.description,
      instructions: server.instructions,
      url: server.url,
      transport: server.transport,
      authConfig: (server.authConfig ?? null) as PrismaJson.McpServerAuthConfig | null,
      config: (server.config ?? null) as PrismaJson.McpServerConfig | null,
      permission: server.permission,
      tools: (server.tools ?? null) as PrismaJson.McpToolInfo[] | null,
      status: server.status,
      lastError: server.lastError,
      lastConnectedAt: server.lastConnectedAt,
      createdAt: server.createdAt,
      updatedAt: server.updatedAt,
      teamId: server.teamId,
      credential: server.credential,
    }
  }

  private toServerInfo(server: McpServerRecord): McpServerInfo {
    const tools = server.tools ?? []
    return {
      id: server.id,
      name: server.name,
      description: server.description ?? undefined,
      instructions: server.instructions ?? undefined,
      url: server.url,
      transport: server.transport,
      authType: server.authConfig?.type ?? 'auto',
      config: server.config ?? undefined,
      permission: server.permission,
      status: server.status,
      lastError: server.lastError ?? undefined,
      toolCount: Array.isArray(tools) ? tools.length : 0,
      hasCredential: server.credential !== null,
      createdAt: server.createdAt.toISOString(),
      updatedAt: server.updatedAt.toISOString(),
    }
  }

  // --------------------------------------------------------------------------
  // Discovery
  // --------------------------------------------------------------------------

  private toDefinition(server: McpServerRecord): McpServerDefinition {
    return {
      name: server.name,
      url: server.url,
      transport: server.transport,
      authConfig: server.authConfig ?? undefined,
      config: server.config ?? undefined,
    }
  }

  private async updateStatus(
    serverId: string,
    status: string,
    lastError: string | null,
    extra?: {
      tools?: PrismaJson.McpToolInfo[]
      lastConnectedAt?: Date
      name?: string
      description?: string | null
      instructions?: string | null
    },
  ): Promise<void> {
    await prisma.mcpServer.update({
      where: { id: serverId },
      data: {
        status,
        lastError,
        ...(extra?.tools !== undefined ? { tools: extra.tools } : {}),
        ...(extra?.lastConnectedAt !== undefined ? { lastConnectedAt: extra.lastConnectedAt } : {}),
        ...(extra?.name !== undefined ? { name: extra.name } : {}),
        ...(extra?.description !== undefined ? { description: extra.description } : {}),
        ...(extra?.instructions !== undefined ? { instructions: extra.instructions } : {}),
      },
    })
  }

  private toStoredTools(
    tools: Array<{ name: string; title?: string; description?: string; inputSchema?: unknown }>,
  ): PrismaJson.McpToolInfo[] {
    return tools.map((t) => ({
      name: t.name,
      ...(t.title !== undefined ? { title: t.title } : {}),
      ...(t.description !== undefined ? { description: t.description } : {}),
      ...(t.inputSchema !== undefined ? { inputSchema: t.inputSchema } : {}),
    }))
  }

  /**
   * Persist the server's self-reported metadata (name = title ?? name, plus
   * description and instructions) captured after a successful connect.
   * Description comes from getServerVersion(); instructions come from
   * getInstructions() (a sibling field of the initialize/discover result,
   * not part of Implementation).
   */
  private serverMetadata(
    server: McpServerRecord,
    connection: { serverVersion?: unknown; instructions?: string },
  ): {
    name?: string
    description?: string | null
    instructions?: string | null
  } {
    const metadata: {
      name?: string
      description?: string | null
      instructions?: string | null
    } = {}
    const impl = connection.serverVersion as
      | { name?: string; title?: string; description?: string }
      | undefined
    if (impl && typeof impl === 'object') {
      const reportedName = impl.title ?? impl.name
      if (typeof reportedName === 'string' && reportedName.trim() !== '') {
        metadata.name = reportedName.trim()
        metadata.description = typeof impl.description === 'string' ? impl.description : null
      }
    }
    if (typeof connection.instructions === 'string') {
      metadata.instructions = connection.instructions
    } else {
      // Sync-on-connect: a server that stops reporting instructions clears
      // the cached value (mirrors pi-mcp-adapter's set/delete behavior).
      metadata.instructions = null
    }
    return metadata
  }

  /**
   * Refresh a server: force a fresh connection (closing any existing one),
   * then re-discover and persist tools, instructions, name/description and
   * status. Returns the updated server record. Throws on connection failure
   * (after marking the server as failed). This is the single discovery
   * entry point: the refresh endpoint, Test Connection, and post-OAuth
   * completion all route through it.
   */
  async refreshServer(serverId: string): Promise<McpServerInfo> {
    const server = await this.getServerRecord(serverId)
    if (!server) throw new Error('MCP server not found')
    await this.manager.close(serverId)

    try {
      const connection = await this.manager.connect(serverId, this.toDefinition(server))
      if (connection.status === 'needs-auth') {
        await this.updateStatus(serverId, 'needs_auth', null)
      } else {
        const tools = this.toStoredTools(connection.tools)
        const metadata = this.serverMetadata(server, connection)
        await this.updateStatus(serverId, 'connected', null, {
          tools,
          lastConnectedAt: new Date(),
          ...metadata,
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.warn({ serverId, error }, 'MCP server refresh failed')
      await this.updateStatus(serverId, 'failed', message)
      throw error
    }

    const record = await this.getServerRecord(serverId)
    if (!record) throw new Error('MCP server not found')
    return this.toServerInfo(record)
  }

  /** Lazy connect used by the proxy/direct tools; never throws. */
  private async ensureConnected(
    serverId: string,
    registry?: McpToolRegistry,
  ): Promise<
    { status: 'connected' } | { status: 'needs-auth' } | { status: 'error'; message: string }
  > {
    const server = await this.getServerRecord(serverId)
    if (!server) return { status: 'error', message: 'server not found' }

    const existing = this.manager.getConnection(serverId)
    if (existing?.status === 'connected') return { status: 'connected' }

    try {
      const connection = await this.manager.connect(serverId, this.toDefinition(server))
      if (connection.status === 'needs-auth') {
        await this.updateStatus(serverId, 'needs_auth', null)
        return { status: 'needs-auth' }
      }
      const tools = this.toStoredTools(connection.tools)
      const metadata = this.serverMetadata(server, connection)
      const displayName = metadata.name ?? server.name
      registry?.setTools(serverId, displayName, connection.tools, {
        excludeTools: server.config?.excludeTools,
      })
      await this.updateStatus(serverId, 'connected', null, {
        tools,
        lastConnectedAt: new Date(),
        ...metadata,
      })
      return { status: 'connected' }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await this.updateStatus(serverId, 'failed', message)
      return { status: 'error', message }
    }
  }

  /**
   * Server-reported usage instructions. Prefers the persisted value (the
   * cache, so it works without a live connection), falling back to the live
   * connection's getInstructions() for a just-connected server.
   */
  private async getServerInstructions(serverId: string): Promise<string | null> {
    const server = await this.getServerRecord(serverId)
    if (!server) return null
    if (server.instructions && server.instructions.trim() !== '') return server.instructions
    const connection = this.manager.getConnection(serverId)
    const live = connection?.client.getInstructions?.()
    return typeof live === 'string' && live.trim() !== '' ? live : null
  }

  // --------------------------------------------------------------------------
  // Tool execution
  // --------------------------------------------------------------------------

  private async checkPermission(
    server: McpServerRecord,
    ctx?: McpToolCallContext,
  ): Promise<string | null> {
    const requiredLevel = ROLE_HIERARCHY[server.permission] || 1

    if (ctx?.userId) {
      const member = await prisma.teamMember.findUnique({
        where: {
          teamIdUserId: {
            teamId: server.teamId,
            userId: ctx.userId,
          },
        },
        select: { role: true },
      })
      const userLevel = member ? ROLE_HIERARCHY[member.role] || 0 : 0
      if (userLevel < requiredLevel) {
        return `Permission denied: Insufficient role to use MCP server "${server.name}". Minimum required role is "${server.permission}".`
      }
      return null
    }

    if (requiredLevel > 1) {
      return `Permission denied: User context required to use MCP server "${server.name}". Minimum required role is "${server.permission}".`
    }
    return null
  }

  private contentFromMcpResult(result: {
    content: unknown[]
    structuredContent?: Record<string, unknown>
    isError?: boolean
  }): McpToolCallContent {
    const blocks = transformMcpContent(
      (Array.isArray(result.content) ? result.content : []) as Parameters<
        typeof transformMcpContent
      >[0],
    )
    if (blocks.length > 0) return blocks
    if (result.structuredContent !== undefined && result.structuredContent !== null) {
      return [
        {
          type: 'text',
          text:
            JSON.stringify(result.structuredContent, null, 2) ?? String(result.structuredContent),
        },
      ]
    }
    return [{ type: 'text', text: '(empty result)' }]
  }

  /**
   * Execute an MCP tool (shared by the proxy and direct tools).
   * Permission gate (D10) first; never throws — failures become error text.
   */
  async callMcpTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>,
    ctx?: McpToolCallContext,
  ): Promise<McpToolCallResult> {
    const server = await this.getServerRecord(serverId)
    if (!server) {
      return { ok: false, content: [{ type: 'text', text: 'MCP server not found' }] }
    }

    const denied = await this.checkPermission(server, ctx)
    if (denied) {
      return { ok: false, content: [{ type: 'text', text: denied }] }
    }

    const outcome = await this.ensureConnected(serverId)
    if (outcome.status === 'needs-auth') {
      return {
        ok: false,
        content: [
          {
            type: 'text',
            text: `MCP server "${server.name}" requires authentication. Ask an admin to connect it in Settings → MCP.`,
          },
        ],
      }
    }
    if (outcome.status === 'error') {
      return {
        ok: false,
        content: [
          {
            type: 'text',
            text: `Failed to connect to MCP server "${server.name}": ${outcome.message}`,
          },
        ],
      }
    }

    try {
      const result = await this.manager.callTool(serverId, toolName, args)
      if (result.isError) {
        const text = result.content.map((c) => ('text' in c ? c.text : '[image]')).join('\n')
        return {
          ok: true,
          content: [{ type: 'text', text: text ? `Error: ${text}` : 'Tool execution failed' }],
        }
      }
      return { ok: true, content: this.contentFromMcpResult(result) }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await this.updateStatus(serverId, 'failed', message)
      return {
        ok: false,
        content: [
          {
            type: 'text',
            text: `Failed to call tool "${toolName}" on MCP server "${server.name}": ${message}`,
          },
        ],
      }
    }
  }

  // --------------------------------------------------------------------------
  // OAuth
  // --------------------------------------------------------------------------

  async startAuth(serverId: string): Promise<{
    authorizationUrl?: string
    alreadyAuthenticated?: boolean
  }> {
    const server = await this.getServerRecord(serverId)
    if (!server) throw new Error('MCP server not found')

    const config = extractOauthConfig(server.authConfig ?? undefined)
    if (config.grantType === 'client_credentials') {
      const provider = new McpOauthProvider(
        serverId,
        server.url,
        config,
        {
          onRedirect: async () => {
            throw new Error('Browser redirect is not used for client_credentials flow')
          },
        },
        mcpDbStore,
      )
      try {
        const result = await auth(provider, {
          serverUrl: server.url,
          ...(config.scope !== undefined ? { scope: config.scope } : {}),
          ...(config.skipIssuerMetadataValidation === true
            ? { skipIssuerMetadataValidation: true }
            : {}),
        })
        if (result !== 'AUTHORIZED') {
          throw new Error('Failed to authorize')
        }
        await mcpDbStore.clearPendingAuth(serverId)
        return { alreadyAuthenticated: true }
      } finally {
        provider.deactivate()
      }
    }

    let capturedUrl: URL | undefined
    const provider = new McpOauthProvider(
      serverId,
      server.url,
      config,
      {
        onRedirect: async (url) => {
          capturedUrl = url
        },
      },
      mcpDbStore,
    )

    try {
      const result = await auth(provider, {
        serverUrl: server.url,
        ...(config.scope !== undefined ? { scope: config.scope } : {}),
        ...(config.skipIssuerMetadataValidation === true
          ? { skipIssuerMetadataValidation: true }
          : {}),
      })
      if (result === 'AUTHORIZED') {
        await mcpDbStore.clearPendingAuth(serverId)
        return { alreadyAuthenticated: true }
      }
      if (!capturedUrl) {
        throw new Error('OAuth authorization URL was not provided')
      }

      const state = (await mcpDbStore.getOauthState(serverId)) ?? generateState()
      const discoveryState = await provider.discoveryState()
      const pending: PendingAuth = {
        state,
        authorizationUrl: capturedUrl.toString(),
        discovery: (discoveryState ?? {}) as Record<string, unknown>,
        expiresAt: Math.floor(Date.now() / 1000) + (await mcpDbStore.getPendingAuthTtlSeconds()),
        grantType: 'authorization_code',
        ...(provider.redirectUrl ? { redirectUri: provider.redirectUrl } : {}),
      }
      await mcpDbStore.savePendingAuth(serverId, pending)
      return { authorizationUrl: capturedUrl.toString() }
    } finally {
      provider.deactivate()
    }
  }

  /**
   * Complete an authorization_code flow. `state` is validated by the caller
   * (the API callback route) before delegating here.
   */
  async completeAuth(
    serverId: string,
    input: { code: string; iss?: string },
  ): Promise<McpAuthStatus> {
    const server = await this.getServerRecord(serverId)
    if (!server) throw new Error('MCP server not found')
    const pending = await mcpDbStore.getPendingAuth(serverId)
    if (!pending) throw new Error(`No pending OAuth flow for server: ${server.name}`)

    const config = extractOauthConfig(server.authConfig ?? undefined)
    const provider = new McpOauthProvider(
      serverId,
      server.url,
      config,
      { onRedirect: async () => {} },
      mcpDbStore,
    )

    try {
      const result = await auth(provider, {
        serverUrl: server.url,
        authorizationCode: input.code,
        ...(input.iss !== undefined ? { iss: input.iss } : {}),
        ...(pending.discovery as Record<string, unknown>),
        ...(config.skipIssuerMetadataValidation === true
          ? { skipIssuerMetadataValidation: true }
          : {}),
      })
      if (result !== 'AUTHORIZED') {
        throw new Error('Failed to authorize')
      }
      await mcpDbStore.clearPendingAuth(serverId)
      await mcpDbStore.clearDiscoverySnapshot(serverId)
      try {
        await this.refreshServer(serverId)
      } catch (err) {
        logger.warn(
          { serverId, err },
          'Post-auth server refresh failed, setting status to connected',
        )
        await this.updateStatus(serverId, 'connected', null)
      }
      return 'authenticated'
    } finally {
      provider.deactivate()
    }
  }

  /** Find a pending flow by its CSRF state and complete it. */
  async handleOauthCallback(
    code: string,
    state: string,
    iss?: string,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    const rows = await prisma.mcpServerCredential.findMany({
      select: { serverId: true, pendingAuth: true },
    })

    let serverId: string | undefined
    for (const row of rows) {
      const raw = row.pendingAuth as Partial<PendingAuth> | null
      if (raw && typeof raw.state === 'string' && raw.state === state) {
        serverId = row.serverId
        break
      }
    }
    if (!serverId) {
      return { ok: false, message: 'Invalid or expired OAuth state. Start authentication again.' }
    }

    try {
      const status = await this.completeAuth(serverId, { code, iss })
      return status === 'authenticated'
        ? { ok: true }
        : { ok: false, message: 'Authentication did not complete' }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error({ serverId, error }, 'MCP OAuth callback completion failed')
      await mcpDbStore.clearPendingAuth(serverId)
      return { ok: false, message }
    }
  }

  async getAuthStatus(serverId: string): Promise<McpAuthStatus> {
    const server = await this.getServerRecord(serverId)
    if (!server) throw new Error('MCP server not found')

    const authType = server.authConfig?.type
    if (authType === 'none') return 'authenticated'
    if (authType === 'bearer') {
      return server.authConfig?.bearerToken ? 'authenticated' : 'not_authenticated'
    }

    const pending = await mcpDbStore.getPendingAuth(serverId)
    if (pending) return 'in_progress'
    const hasTokens = await mcpDbStore.hasStoredTokens(serverId)
    if (!hasTokens) return 'not_authenticated'
    const expired = await mcpDbStore.isTokenExpired(serverId)
    return expired ? 'expired' : 'authenticated'
  }

  async removeAuth(serverId: string): Promise<void> {
    await mcpDbStore.clearAllCredentials(serverId)
    await mcpDbStore.clearPendingAuth(serverId)
    await mcpDbStore.clearDiscoverySnapshot(serverId)
    await this.manager.close(serverId)
    await this.updateStatus(serverId, 'needs_auth', null)
  }

  // --------------------------------------------------------------------------
  // Agent integration
  // --------------------------------------------------------------------------

  /**
   * Build the agent's MCP AgentTools: the single `mcp` proxy tool plus direct
   * tools for assigned servers in direct-tools mode. Returns [] when the agent
   * has no assigned servers (no proxy tool — don't waste LLM context).
   */
  async buildAgentTools(agentId: string, teamId: string, userId?: string): Promise<AgentTool[]> {
    const assignments = await prisma.agentMcpServer.findMany({
      where: { agentId },
      include: { mcpServer: true },
    })
    if (assignments.length === 0) return []

    // Per-agent tool registry: built fresh for this agent from the persisted
    // discovery cache (McpServer.tools). It only ever contains the agent's
    // assigned servers, so unassigned/disabled servers can neither be searched
    // nor called — no global mutable state to leak through.
    const registry = new McpToolRegistry()

    const servers = assignments
      .map((a) => a.mcpServer)
      .map((s) => {
        const storedTools = (s.tools ?? []) as PrismaJson.McpToolInfo[]
        if (storedTools.length > 0) {
          registry.setTools(
            s.id,
            s.name,
            storedTools.map((t) => ({
              name: t.name,
              description: t.description ?? '',
              ...(t.inputSchema !== undefined ? { inputSchema: t.inputSchema } : {}),
            })),
            { excludeTools: s.config?.excludeTools },
          )
        }
        return {
          id: s.id,
          name: s.name,
          instructions: s.instructions ?? null,
          url: s.url,
          transport: s.transport,
          authConfig: (s.authConfig ?? {}) as PrismaJson.McpServerAuthConfig,
          config: (s.config ?? {}) as PrismaJson.McpServerConfig,
          status: s.status,
        }
      })

    const serverNameById = new Map<string, string>()
    const serverIdByName = new Map<string, string>()
    const proxyServers = servers.map((s) => {
      serverNameById.set(s.id, s.name)
      serverIdByName.set(s.name, s.id)
      // Count direct tools from the same filtered registry metadata that
      // buildDirectTools consumes, so the proxy description can never drift
      // from what is actually registered as native tools.
      const metadata = registry.getTools(s.id)
      const directToolCount = metadata.filter((t) =>
        isDirectTool(t.originalName, t.name, s.config?.directTools),
      ).length

      return {
        id: s.id,
        name: s.name,
        toolCount: metadata.length,
        directToolCount,
        status: s.status,
        ...(s.instructions !== null && s.instructions !== undefined
          ? { instructions: s.instructions }
          : {}),
      }
    })

    const ctx: McpProxyToolContext = {
      teamId,
      userId,
      servers: proxyServers,
      serverNameById,
      serverIdByName,
      registry,
      resolveServerForTool: (toolName) => {
        // Longest {server}_ prefix match (dots/hyphens sanitized like the registry).
        let best: string | undefined
        let bestLen = 0
        for (const [sid, name] of serverNameById.entries()) {
          const prefix = sanitizeServerPrefix(name)
          if (toolName.startsWith(`${prefix}_`) && prefix.length > bestLen) {
            best = sid
            bestLen = prefix.length
          }
        }
        return best
      },
      ensureConnected: (serverId) => this.ensureConnected(serverId, registry),
      callTool: (serverId, toolName, args) =>
        this.callMcpTool(serverId, toolName, args, { teamId, userId }),
      authStatus: (serverId) => this.getAuthStatus(serverId),
      startAuth: (serverId) => this.startAuth(serverId),
      getInstructions: (serverId) => this.getServerInstructions(serverId),
    }

    const tools: AgentTool[] = [buildProxyTool(ctx)]

    for (const server of servers) {
      if (!Array.isArray(server.config?.directTools) || server.config.directTools.length === 0) {
        continue
      }
      const metadata: ToolMetadata[] = registry.getTools(server.id)
      tools.push(
        ...buildDirectTools(metadata, server.config, {
          serverId: server.id,
          serverName: server.name,
          callTool: (serverId, toolName, args) =>
            this.callMcpTool(serverId, toolName, args, { teamId, userId }),
        }),
      )
    }

    return tools
  }

  /** Test a server by refreshing it and reporting the tool count (UI validation). */
  async testServer(
    serverId: string,
  ): Promise<{ ok: boolean; toolCount: number; message?: string }> {
    try {
      const server = await this.refreshServer(serverId)
      return { ok: true, toolCount: server.toolCount }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { ok: false, toolCount: 0, message }
    }
  }

  /** Tool-name formatter ({server}_{tool}); exposed for tests. */
  getToolName(serverName: string, toolName: string): string {
    return formatToolName(serverName, toolName)
  }

  private idleCleanupInterval?: ReturnType<typeof setInterval>

  /** Start a periodic background timer to prune idle connections. Default check interval is 30 seconds. */
  startIdleCleanupTimer(intervalMs = 30 * 1000, defaultTimeoutMs?: number): void {
    if (this.idleCleanupInterval) return
    this.idleCleanupInterval = setInterval(() => {
      this.closeIdleConnections(defaultTimeoutMs).catch((error) => {
        logger.debug({ error }, 'Failed to close idle connections in background timer')
      })
    }, intervalMs)
    this.idleCleanupInterval.unref?.()
  }

  /** Stop the background idle cleanup timer. */
  stopIdleCleanupTimer(): void {
    if (this.idleCleanupInterval) {
      clearInterval(this.idleCleanupInterval)
      this.idleCleanupInterval = undefined
    }
  }

  /** Close all in-process MCP connections (used by tests/shutdown). */
  async closeAllConnections(): Promise<void> {
    this.stopIdleCleanupTimer()
    await this.manager.closeAll()
  }

  /** Close idle connections across all active server connections. */
  async closeIdleConnections(defaultTimeoutMs?: number): Promise<string[]> {
    return this.manager.closeIdleConnections(defaultTimeoutMs)
  }

  /** Number of live in-process connections (used by tests). */
  getConnectionCount(serverId: string): number {
    return this.manager.getConnection(serverId) ? 1 : 0
  }
}

export const mcpService = new McpService()
