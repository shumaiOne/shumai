import { prisma, Prisma } from '@shumai/db'

export interface StoredTokens {
  accessToken: string
  refreshToken?: string
  expiresAt?: number // Unix timestamp in seconds
  scope?: string
  /** SEP-2352 authorization-server issuer binding */
  issuer?: string
}

export interface StoredClientInfo {
  clientId: string
  clientSecret?: string
  clientIdIssuedAt?: number
  clientSecretExpiresAt?: number
  redirectUris?: string[]
  issuer?: string
  configPreRegistered?: boolean
}

export interface AuthEntry {
  tokens?: StoredTokens
  clientInfo?: StoredClientInfo
  codeVerifier?: string
  oauthState?: string
  serverUrl?: string // Track the URL these credentials are for
}

export interface PendingAuth {
  state: string
  authorizationUrl: string
  discovery: Record<string, unknown>
  expiresAt: number // Unix timestamp in seconds
  grantType?: 'authorization_code' | 'client_credentials'
  redirectUri?: string
}

/** How long an in-flight authorization_code flow is kept in the DB (5 minutes). */
const PENDING_AUTH_TTL_SECONDS = 5 * 60

function rowToAuthEntry(row: {
  serverUrl: string
  tokens: unknown
  clientInfo: unknown
  codeVerifier: string | null
  oauthState: string | null
  pendingAuth: unknown
}): {
  entry: AuthEntry
  pendingAuth?: PendingAuth
} {
  const entry: AuthEntry = {
    serverUrl: row.serverUrl,
    ...(row.tokens ? { tokens: row.tokens as StoredTokens } : {}),
    ...(row.clientInfo ? { clientInfo: row.clientInfo as StoredClientInfo } : {}),
    ...(row.codeVerifier ? { codeVerifier: row.codeVerifier } : {}),
    ...(row.oauthState ? { oauthState: row.oauthState } : {}),
  }
  let pendingAuth: PendingAuth | undefined
  if (row.pendingAuth && typeof row.pendingAuth === 'object') {
    const raw = row.pendingAuth as Partial<PendingAuth>
    if (typeof raw.state === 'string' && typeof raw.expiresAt === 'number') {
      pendingAuth = {
        state: raw.state,
        authorizationUrl: raw.authorizationUrl ?? '',
        discovery: raw.discovery ?? {},
        expiresAt: raw.expiresAt,
        ...(raw.grantType ? { grantType: raw.grantType } : {}),
        ...(raw.redirectUri ? { redirectUri: raw.redirectUri } : {}),
      }
    }
  }
  return { entry, pendingAuth }
}

/**
 * DB-backed credential store for MCP OAuth state (port of pi-mcp-adapter's
 * mcp-auth.ts storage layer, replacing the OS keyring/files with an
 * `McpServerCredential` row per server).
 */
export class McpDbStore {
  constructor(private readonly prismaClient: typeof prisma = prisma) {}

  private async getRow(serverId: string) {
    return this.prismaClient.mcpServerCredential.findUnique({
      where: { serverId },
    })
  }

  private async ensureRow(serverId: string, serverUrl?: string) {
    const existing = await this.getRow(serverId)
    if (existing) return existing
    if (!serverUrl) throw new Error(`No credential row for MCP server ${serverId}`)
    return this.prismaClient.mcpServerCredential.create({
      data: {
        serverId,
        serverUrl,
      },
    })
  }

  /**
   * Get the auth entry for a server, validated against the current URL.
   * Returns undefined when no entry exists or the URL changed (credentials invalid).
   */
  async getAuthForUrl(serverId: string, serverUrl: string): Promise<AuthEntry | undefined> {
    const row = await this.getRow(serverId)
    if (!row) return undefined
    // If no serverUrl is stored or it changed, credentials are invalid.
    if (!row.serverUrl || row.serverUrl !== serverUrl) return undefined
    return rowToAuthEntry(row).entry
  }

  async getAuthEntry(serverId: string): Promise<AuthEntry | undefined> {
    const row = await this.getRow(serverId)
    if (!row) return undefined
    return rowToAuthEntry(row).entry
  }

  async saveAuthEntry(serverId: string, entry: AuthEntry, serverUrl?: string): Promise<void> {
    const row = await this.getRow(serverId)
    const serverUrlValue = serverUrl ?? entry.serverUrl ?? row?.serverUrl
    // Do NOT merge the row's credential fields back in: callers build `entry`
    // from getAuthEntry() (all current fields) and delete fields to clear
    // them. Re-adding row fields would leak cleared values.
    const merged: AuthEntry = { ...entry }
    if (serverUrlValue) {
      merged.serverUrl = serverUrlValue
      if (row && serverUrlValue !== row.serverUrl) {
        // URL changed: stale sub-credentials are dropped.
        delete merged.tokens
        delete merged.clientInfo
        delete merged.codeVerifier
        delete merged.oauthState
      }
    }
    const data = {
      serverUrl: merged.serverUrl ?? serverUrlValue ?? '',
      tokens: merged.tokens ?? undefined,
      clientInfo: merged.clientInfo ?? undefined,
      codeVerifier: merged.codeVerifier ?? undefined,
      oauthState: merged.oauthState ?? undefined,
    }
    if (row) {
      await this.prismaClient.mcpServerCredential.update({
        where: { serverId },
        data: {
          serverUrl: data.serverUrl,
          tokens:
            data.tokens === undefined
              ? Prisma.JsonNull
              : (data.tokens as PrismaJson.McpStoredTokens),
          clientInfo:
            data.clientInfo === undefined
              ? Prisma.JsonNull
              : (data.clientInfo as PrismaJson.McpStoredClientInfo),
          codeVerifier: data.codeVerifier ?? null,
          oauthState: data.oauthState ?? null,
        },
      })
    } else if (serverUrlValue) {
      await this.prismaClient.mcpServerCredential.create({
        data: {
          serverId,
          serverUrl: serverUrlValue,
          tokens: data.tokens as PrismaJson.McpStoredTokens | undefined,
          clientInfo: data.clientInfo as PrismaJson.McpStoredClientInfo | undefined,
          codeVerifier: data.codeVerifier,
          oauthState: data.oauthState,
        },
      })
    }
  }

  async updateTokens(serverId: string, tokens: StoredTokens, serverUrl?: string): Promise<void> {
    const entry = (await this.getAuthEntry(serverId)) ?? {}
    if (serverUrl && entry.serverUrl && entry.serverUrl !== serverUrl) {
      delete entry.clientInfo
      delete entry.codeVerifier
      delete entry.oauthState
    }
    entry.tokens = tokens
    await this.saveAuthEntry(serverId, entry, serverUrl)
  }

  async updateClientInfo(
    serverId: string,
    clientInfo: StoredClientInfo,
    serverUrl?: string,
  ): Promise<void> {
    const entry = (await this.getAuthEntry(serverId)) ?? {}
    if (serverUrl && entry.serverUrl && entry.serverUrl !== serverUrl) {
      delete entry.tokens
      delete entry.codeVerifier
      delete entry.oauthState
    }
    entry.clientInfo = clientInfo
    await this.saveAuthEntry(serverId, entry, serverUrl)
  }

  async updateCodeVerifier(
    serverId: string,
    codeVerifier: string,
    serverUrl?: string,
  ): Promise<void> {
    const entry = (await this.getAuthEntry(serverId)) ?? {}
    if (serverUrl && entry.serverUrl && entry.serverUrl !== serverUrl) {
      delete entry.tokens
      delete entry.clientInfo
      delete entry.oauthState
    }
    entry.codeVerifier = codeVerifier
    await this.saveAuthEntry(serverId, entry, serverUrl)
  }

  async clearCodeVerifier(serverId: string): Promise<void> {
    const entry = await this.getAuthEntry(serverId)
    if (entry) {
      delete entry.codeVerifier
      await this.saveAuthEntry(serverId, entry)
    }
  }

  async updateOauthState(serverId: string, state: string, serverUrl?: string): Promise<void> {
    const entry = (await this.getAuthEntry(serverId)) ?? {}
    if (serverUrl && entry.serverUrl && entry.serverUrl !== serverUrl) {
      delete entry.tokens
      delete entry.clientInfo
      delete entry.codeVerifier
    }
    entry.oauthState = state
    await this.saveAuthEntry(serverId, entry, serverUrl)
  }

  async getOauthState(serverId: string): Promise<string | undefined> {
    const row = await this.getRow(serverId)
    return row?.oauthState ?? undefined
  }

  async clearOauthState(serverId: string): Promise<void> {
    const entry = await this.getAuthEntry(serverId)
    if (entry) {
      delete entry.oauthState
      await this.saveAuthEntry(serverId, entry)
    }
  }

  /** Returns null when no tokens exist, false when valid, true when expired. */
  async isTokenExpired(serverId: string): Promise<boolean | null> {
    const row = await this.getRow(serverId)
    const tokens = row?.tokens as StoredTokens | null | undefined
    if (!tokens?.accessToken) return null
    if (!tokens.expiresAt) return false
    return tokens.expiresAt < Date.now() / 1000
  }

  async hasStoredTokens(serverId: string): Promise<boolean> {
    const row = await this.getRow(serverId)
    const tokens = row?.tokens as StoredTokens | null | undefined
    return !!tokens?.accessToken
  }

  async clearAllCredentials(serverId: string): Promise<void> {
    const row = await this.getRow(serverId)
    if (!row) return
    await this.prismaClient.mcpServerCredential.delete({ where: { serverId } })
  }

  async clearClientInfo(serverId: string): Promise<void> {
    const entry = await this.getAuthEntry(serverId)
    if (entry) {
      delete entry.clientInfo
      await this.saveAuthEntry(serverId, entry)
    }
  }

  async clearTokens(serverId: string): Promise<void> {
    const entry = await this.getAuthEntry(serverId)
    if (entry) {
      delete entry.tokens
      await this.saveAuthEntry(serverId, entry)
    }
  }

  // --------------------------------------------------------------------------
  // In-flight authorization_code flow (pendingAuth)
  // --------------------------------------------------------------------------

  async savePendingAuth(serverId: string, pending: PendingAuth): Promise<void> {
    const row = await this.getRow(serverId)
    if (!row) {
      const server = await this.prismaClient.mcpServer.findUnique({
        where: { id: serverId },
        select: { url: true },
      })
      if (!server) throw new Error(`MCP server ${serverId} not found`)
      await this.ensureRow(serverId, server.url)
    }
    // Preserve an in-flight discovery snapshot: the OAuth provider's
    // saveDiscoveryState() lives in the same JSON column, and the callback
    // leg needs it for the SEP-2352 issuer check.
    const existing = (row?.pendingAuth as Record<string, unknown> | null | undefined) ?? {}
    const discoverySnapshot = existing['discoverySnapshot']
    const data = discoverySnapshot !== undefined ? { ...pending, discoverySnapshot } : pending
    await this.prismaClient.mcpServerCredential.update({
      where: { serverId },
      data: { pendingAuth: data as unknown as PrismaJson.McpPendingAuth },
    })
  }

  async getPendingAuth(serverId: string): Promise<PendingAuth | undefined> {
    const row = await this.getRow(serverId)
    if (!row) return undefined
    const { pendingAuth } = rowToAuthEntry(row)
    if (!pendingAuth) return undefined
    if (pendingAuth.expiresAt < Date.now() / 1000) {
      await this.clearPendingAuth(serverId)
      return undefined
    }
    return pendingAuth
  }

  async clearPendingAuth(serverId: string): Promise<void> {
    const row = await this.getRow(serverId)
    if (!row) return
    await this.prismaClient.mcpServerCredential.update({
      where: { serverId },
      data: { pendingAuth: Prisma.JsonNull },
    })
  }

  async getPendingAuthTtlSeconds(): Promise<number> {
    return PENDING_AUTH_TTL_SECONDS
  }

  /** Ensure a credential row exists for a server (used when persisting any auth state). */
  async ensureCredentialRow(serverId: string, serverUrl: string): Promise<void> {
    await this.ensureRow(serverId, serverUrl)
  }

  // --------------------------------------------------------------------------
  // Discovery snapshot (survives from startAuth to the callback leg)
  // --------------------------------------------------------------------------

  async saveDiscoverySnapshot(serverId: string, serverUrl: string, state: unknown): Promise<void> {
    await this.ensureRow(serverId, serverUrl)
    const row = await this.getRow(serverId)
    const existing = (row?.pendingAuth as Record<string, unknown> | null | undefined) ?? {}
    await this.prismaClient.mcpServerCredential.update({
      where: { serverId },
      data: {
        pendingAuth: {
          ...existing,
          discoverySnapshot: state,
        } as unknown as PrismaJson.McpPendingAuth,
      },
    })
  }

  async getDiscoverySnapshot(serverId: string): Promise<Record<string, unknown> | undefined> {
    const row = await this.getRow(serverId)
    const pending = (row?.pendingAuth as Record<string, unknown> | null | undefined) ?? {}
    const snapshot = pending['discoverySnapshot']
    return snapshot && typeof snapshot === 'object'
      ? (snapshot as Record<string, unknown>)
      : undefined
  }

  async clearDiscoverySnapshot(serverId: string): Promise<void> {
    const row = await this.getRow(serverId)
    if (!row) return
    const pending = (row.pendingAuth as Record<string, unknown> | null | undefined) ?? {}
    const rest: Record<string, unknown> = { ...pending }
    delete rest['discoverySnapshot']
    await this.prismaClient.mcpServerCredential.update({
      where: { serverId },
      data: {
        pendingAuth:
          Object.keys(rest).length > 0
            ? (rest as unknown as PrismaJson.McpPendingAuth)
            : Prisma.JsonNull,
      },
    })
  }
}

export const mcpDbStore = new McpDbStore()
