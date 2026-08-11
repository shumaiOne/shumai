/**
 * MCP Server Manager
 *
 * Manages MCP client connections to URL-based servers (Streamable HTTP with
 * SSE fallback, or pinned SSE). Simplified port of pi-mcp-adapter's
 * server-manager.ts: tools only, no stdio/sampling/elicitation/tracing.
 */

import {
  Client,
  SdkHttpError,
  SSEClientTransport,
  StreamableHTTPClientTransport,
  UnauthorizedError,
  type Implementation,
  type ListToolsResult,
  type RequestOptions,
  type VersionNegotiationOptions,
} from '@modelcontextprotocol/client'
import '@shumai/db/src/prisma-json-types'
import { logger } from '@shumai/core/src/logger'
import type { McpDbStore } from './mcp-db-store'
import { McpOauthProvider, type McpOauthConfig } from './mcp-oauth-provider'

export interface McpTool {
  name: string
  title?: string
  description?: string
  inputSchema?: unknown
  _meta?: Record<string, unknown>
}

export interface ServerConnection {
  client: Client
  definition: McpServerDefinition
  tools: McpTool[]
  status: 'connected' | 'needs-auth'
  /** Self-reported server name/title/version/description (from getServerVersion). */
  serverVersion?: Implementation
  /** Self-reported server usage instructions (from getInstructions). */
  instructions?: string
  lastUsedAt: number
  inFlight: number
}

export interface McpServerDefinition {
  name: string
  url: string
  transport: 'streamable_http' | 'sse'
  authConfig?: PrismaJson.McpServerAuthConfig
  config?: PrismaJson.McpServerConfig
}

function isUnauthorizedHttpError(error: unknown): boolean {
  return (
    error instanceof UnauthorizedError || (error instanceof SdkHttpError && error.status === 401)
  )
}

function shouldFallbackToSse(error: unknown, definition: McpServerDefinition): boolean {
  if (definition.config?.protocolVersion === '2026-07-28') return false
  return error instanceof SdkHttpError && [404, 405, 406, 415].includes(error.status)
}

function resolveVersionNegotiation(
  definition: McpServerDefinition,
): VersionNegotiationOptions | undefined {
  switch (definition.config?.protocolVersion) {
    case undefined:
    case 'legacy':
      return undefined
    case 'auto':
      return { mode: 'auto' }
    case '2026-07-28':
      return { mode: { pin: '2026-07-28' } }
    default:
      throw new Error(`Invalid MCP protocolVersion: ${String(definition.config?.protocolVersion)}`)
  }
}

export class McpServerManager {
  private connections = new Map<string, ServerConnection>()
  private connectPromises = new Map<string, Promise<ServerConnection>>()
  private stopped = false

  constructor(private readonly dbStore: McpDbStore) {}

  private getRequestTimeoutMs(definition: McpServerDefinition): number | undefined {
    const timeout = definition.config?.requestTimeoutMs
    return typeof timeout === 'number' && Number.isFinite(timeout) && timeout > 0
      ? timeout
      : undefined
  }

  private buildRequestOptions(definition: McpServerDefinition): RequestOptions | undefined {
    const timeout = this.getRequestTimeoutMs(definition)
    return timeout !== undefined ? { timeout } : undefined
  }

  /**
   * Connect to a server. Single-flight per server id. Returns a connection
   * with status 'connected' or 'needs-auth' (when the server returns 401 and
   * OAuth is configured / auto-detectable).
   */
  async connect(serverId: string, definition: McpServerDefinition): Promise<ServerConnection> {
    if (this.stopped) throw new Error('MCP server manager is closed')

    // Dedupe concurrent connection attempts.
    if (this.connectPromises.has(serverId)) {
      return this.connectPromises.get(serverId)!
    }

    const existing = this.connections.get(serverId)
    if (existing?.status === 'connected') {
      existing.lastUsedAt = Date.now()
      return existing
    }

    const promise = this.createConnection(serverId, definition).finally(() => {
      if (this.connectPromises.get(serverId) === promise) {
        this.connectPromises.delete(serverId)
      }
    })
    this.connectPromises.set(serverId, promise)

    try {
      const connection = await promise
      this.connections.set(serverId, connection)
      return connection
    } catch (error) {
      this.connectPromises.delete(serverId)
      throw error
    }
  }

  private async createConnection(
    serverId: string,
    definition: McpServerDefinition,
  ): Promise<ServerConnection> {
    const url = new URL(definition.url)
    const requestInit = this.buildRequestInit(definition)
    const authProvider = this.buildAuthProvider(serverId, definition)

    const attempt = async (
      kind: 'streamable-http' | 'sse',
    ): Promise<{
      status: 'connected' | 'needs-auth'
      client: Client
      error?: unknown
    }> => {
      const transportOptions = {
        ...(requestInit !== undefined ? { requestInit } : {}),
        ...(authProvider !== undefined ? { authProvider } : {}),
        ...(authProvider !== undefined &&
        definition.authConfig?.oauth?.skipIssuerMetadataValidation === true
          ? { skipIssuerMetadataValidation: true }
          : {}),
      }
      const transport =
        kind === 'streamable-http'
          ? new StreamableHTTPClientTransport(url, transportOptions)
          : new SSEClientTransport(url, transportOptions)
      const client = this.createClient(serverId, definition)

      try {
        await client.connect(transport, this.buildRequestOptions(definition))
        return { status: 'connected', client }
      } catch (error) {
        try {
          await client.close()
        } catch {
          // Ignore cleanup errors on a failed connect.
        }
        return { status: 'needs-auth', client, error }
      }
    }

    let kind: 'streamable-http' | 'sse' = definition.transport === 'sse' ? 'sse' : 'streamable-http'
    for (;;) {
      const result = await attempt(kind)
      if (result.status === 'connected') {
        const tools = await this.fetchAllTools(result.client, this.buildRequestOptions(definition))
        return {
          client: result.client,
          definition,
          tools,
          status: 'connected',
          serverVersion: result.client.getServerVersion(),
          instructions: result.client.getInstructions(),
          lastUsedAt: Date.now(),
          inFlight: 0,
        }
      }

      if (isUnauthorizedHttpError(result.error)) {
        if (this.supportsOauth(definition)) {
          return {
            client: result.client,
            definition,
            tools: [],
            status: 'needs-auth',
            lastUsedAt: Date.now(),
            inFlight: 0,
          }
        }
        throw result.error
      }

      if (
        kind === 'streamable-http' &&
        definition.transport !== 'sse' &&
        shouldFallbackToSse(result.error, definition)
      ) {
        kind = 'sse'
        continue
      }
      throw result.error
    }
  }

  private createClient(serverId: string, definition: McpServerDefinition): Client {
    const versionNegotiation = resolveVersionNegotiation(definition)
    return new Client(
      { name: `shumai-mcp-${serverId}`, version: '1.0.0' },
      {
        ...(versionNegotiation ? { versionNegotiation } : {}),
      },
    )
  }

  private buildAuthProvider(
    serverId: string,
    definition: McpServerDefinition,
  ): McpOauthProvider | undefined {
    if (this.supportsOauth(definition)) {
      return new McpOauthProvider(
        serverId,
        definition.url,
        this.extractOauthConfig(definition.authConfig ?? {}),
        { onRedirect: async () => {} },
        this.dbStore,
      )
    }
    return undefined
  }

  private supportsOauth(definition: McpServerDefinition): boolean {
    const auth = definition.authConfig
    if (auth?.type === 'none') return false
    if (auth?.type === 'bearer') return false
    // Explicit oauth, or auto-detect when no auth configured and no custom headers.
    if (auth?.type === 'oauth') return true
    if (auth?.headers && Object.keys(auth.headers).length > 0) return false
    return auth === undefined || auth.type === undefined
  }

  private extractOauthConfig(auth: PrismaJson.McpServerAuthConfig): McpOauthConfig {
    const oauth = auth.oauth
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

  private buildRequestInit(
    definition: McpServerDefinition,
  ): { headers: Record<string, string> } | undefined {
    const auth = definition.authConfig
    const headers: Record<string, string> = { ...(auth?.headers ?? {}) }
    if (auth?.type === 'bearer' && auth.bearerToken) {
      headers['Authorization'] = `Bearer ${auth.bearerToken}`
    }
    return Object.keys(headers).length > 0 ? { headers } : undefined
  }

  private async fetchAllTools(client: Client, requestOptions?: RequestOptions): Promise<McpTool[]> {
    const allTools: McpTool[] = []
    let cursor: string | undefined

    do {
      const result: ListToolsResult = await client.listTools(
        cursor ? { cursor } : undefined,
        requestOptions,
      )
      allTools.push(...(result.tools ?? []))
      cursor = result.nextCursor
    } while (cursor)

    return allTools
  }

  /** List tools for a connected server. */
  async listTools(serverId: string): Promise<McpTool[]> {
    const connection = this.connections.get(serverId)
    if (!connection || connection.status !== 'connected') {
      throw new Error(`Server is not connected`)
    }
    return connection.tools
  }

  /** Call a tool on a connected server. */
  async callTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<{
    content: McpContent[]
    structuredContent?: Record<string, unknown>
    isError?: boolean
  }> {
    const connection = this.connections.get(serverId)
    if (!connection || connection.status !== 'connected') {
      throw new Error(`Server is not connected`)
    }
    this.incrementInFlight(serverId)
    try {
      this.touch(serverId)
      const result = await connection.client.callTool(
        { name: toolName, arguments: args },
        this.buildRequestOptions(connection.definition),
      )
      return {
        content: (result.content ?? []) as McpContent[],
        structuredContent: result.structuredContent as Record<string, unknown> | undefined,
        isError: result.isError,
      }
    } finally {
      this.decrementInFlight(serverId)
      this.touch(serverId)
    }
  }

  incrementInFlight(serverId: string): void {
    const connection = this.connections.get(serverId)
    if (connection) {
      connection.inFlight = (connection.inFlight ?? 0) + 1
    }
  }

  decrementInFlight(serverId: string): void {
    const connection = this.connections.get(serverId)
    if (connection && connection.inFlight > 0) {
      connection.inFlight--
    }
  }

  isIdle(serverId: string, timeoutMs: number): boolean {
    const connection = this.connections.get(serverId)
    if (!connection || connection.status !== 'connected') return false
    if (connection.inFlight > 0) return false
    return Date.now() - connection.lastUsedAt > timeoutMs
  }

  async closeIdleConnections(defaultTimeoutMs = 10 * 60 * 1000): Promise<string[]> {
    const closedIds: string[] = []
    for (const [serverId, connection] of this.connections) {
      if (connection.definition.config?.keepAlive) continue
      const timeoutMs = connection.definition.config?.idleTimeoutMs ?? defaultTimeoutMs
      if (this.isIdle(serverId, timeoutMs)) {
        await this.close(serverId)
        closedIds.push(serverId)
      }
    }
    return closedIds
  }

  touch(serverId: string): void {
    const connection = this.connections.get(serverId)
    if (connection) {
      connection.lastUsedAt = Date.now()
    }
  }

  getConnection(serverId: string): ServerConnection | undefined {
    return this.connections.get(serverId)
  }

  getAllConnections(): Map<string, ServerConnection> {
    return new Map(this.connections)
  }

  async close(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId)
    if (!connection) {
      const pending = this.connectPromises.get(serverId)
      if (pending) {
        try {
          await pending
        } catch {
          // Ignore failed connect during close.
        }
      }
      return
    }
    this.connections.delete(serverId)
    try {
      await connection.client.close()
    } catch (error) {
      logger.debug({ serverId, error }, 'MCP client close failed')
    }
  }

  async closeAll(): Promise<void> {
    const ids = [...this.connections.keys()]
    await Promise.allSettled(ids.map((id) => this.close(id)))
    this.connections.clear()
    this.connectPromises.clear()
    // The manager stays usable afterwards (tests reset between suites);
    // `stopped` only guards against using a permanently-shut-down manager.
    this.stopped = false
  }

  isConnecting(serverId: string): boolean {
    return this.connectPromises.has(serverId)
  }
}

export interface McpContent {
  type: 'text' | 'image' | 'audio' | 'resource' | 'resource_link'
  text?: string
  data?: string
  mimeType?: string
  resource?: {
    uri: string
    text?: string
    blob?: string
  }
  uri?: string
  name?: string
  description?: string
}
