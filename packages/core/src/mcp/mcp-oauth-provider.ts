/**
 * MCP OAuth Provider (DB-backed)
 *
 * Implementation of the MCP SDK's OAuthClientProvider interface. Adapted from
 * pi-mcp-adapter's mcp-oauth-provider.ts, with two differences:
 *  1. All persisted state (tokens, client info, PKCE verifier, discovery
 *     state, CSRF state) is stored in the DB via McpDbStore instead of the OS
 *     keyring/files, so the flow survives across HTTP requests and processes.
 *  2. The redirect URI is shumai's own Hono callback endpoint
 *     (`${MCP_OAUTH_REDIRECT_BASE_URL}/api/mcp/oauth/callback`) instead of a
 *     localhost callback server.
 */

/* eslint-disable @typescript-eslint/naming-convention */
// The OAuth wire format (RFC 6749 / OAuth 2.1 client metadata) uses snake_case
// field names (client_id, access_token, grant_type, ...). These are dictated by
// the OAuth protocol and the MCP SDK's OAuthClientProvider interfaces, so they
// cannot be renamed to camelCase.

import {
  type AddClientAuthentication,
  type OAuthClientProvider,
  type OAuthClientInformationMixed,
  type OAuthClientMetadata,
  type OAuthDiscoveryState,
  type OAuthTokens,
} from '@modelcontextprotocol/client'
import type { McpDbStore, AuthEntry, StoredClientInfo, StoredTokens } from './mcp-db-store'

type IssuerBoundClientInformation = OAuthClientInformationMixed & { issuer?: string }
type IssuerBoundTokens = OAuthTokens & { issuer?: string }

function issuersMatch(first: string, second: string): boolean {
  return (
    first === second ||
    (first.endsWith('/') && first.slice(0, -1) === second) ||
    (second.endsWith('/') && second.slice(0, -1) === first)
  )
}

export function getOauthRedirectBaseUrl(): string {
  return (
    process.env.MCP_OAUTH_REDIRECT_BASE_URL?.trim() || process.env.BETTER_AUTH_URL?.trim() || ''
  )
}

/** The default redirect URI used when the server config does not set one. */
export function getDefaultOauthRedirectUri(): string | undefined {
  const base = getOauthRedirectBaseUrl()
  if (!base) return undefined
  return `${base.replace(/\/$/, '')}/api/mcp/oauth/callback`
}

/** Configuration options for OAuth. */
export interface McpOauthConfig {
  grantType?: 'authorization_code' | 'client_credentials'
  clientId?: string
  clientSecret?: string
  scope?: string
  authorizationParams?: Record<string, string>
  redirectUri?: string
  clientName?: string
  clientUri?: string
  skipIssuerMetadataValidation?: boolean
}

const reservedAuthorizationParams = new Set([
  'client_id',
  'code_challenge',
  'code_challenge_method',
  'redirect_uri',
  'resource',
  'response_type',
  'scope',
  'state',
])

function addAuthorizationParams(
  authorizationUrl: URL,
  params: Record<string, string> | undefined,
): URL {
  if (!params) return authorizationUrl
  const nextUrl = new URL(authorizationUrl.toString())
  for (const [key, value] of Object.entries(params)) {
    if (reservedAuthorizationParams.has(key) || nextUrl.searchParams.has(key)) {
      throw new Error(
        `OAuth authorizationParams.${key} cannot override an authorization flow parameter`,
      )
    }
    nextUrl.searchParams.set(key, value)
  }
  return nextUrl
}

/** Callbacks for OAuth flow interactions. */
export interface McpOauthCallbacks {
  onRedirect: (url: URL) => void | Promise<void>
}

/**
 * OAuth provider implementation for MCP servers backed by the DB store.
 */
export class McpOauthProvider implements OAuthClientProvider {
  private readonly redirectUrlSnapshot: string | undefined
  private active = true
  private flowIssuerMismatch = false

  constructor(
    private serverId: string,
    private serverUrl: string,
    private config: McpOauthConfig,
    private callbacks: McpOauthCallbacks,
    private store: McpDbStore,
  ) {
    this.redirectUrlSnapshot =
      config.grantType === 'client_credentials'
        ? undefined
        : (config.redirectUri ?? getDefaultOauthRedirectUri())
  }

  private get usesClientCredentials(): boolean {
    return this.config.grantType === 'client_credentials'
  }

  deactivate(): void {
    this.active = false
  }

  private throwIfInactive(): void {
    if (!this.active) throw new Error('OAuth flow is no longer active')
  }

  private assertStoredIssuerBindings(
    entry: AuthEntry | undefined,
    issuer: string | undefined,
  ): void {
    if (this.flowIssuerMismatch) {
      throw new Error(
        `OAuth authorization server issuer changed; clear credentials before authenticating again`,
      )
    }
    if (!entry || !issuer) return

    const storedIssuers = [entry.clientInfo?.issuer, entry.tokens?.issuer].filter(
      (storedIssuer): storedIssuer is string => storedIssuer !== undefined,
    )
    if (storedIssuers.some((storedIssuer) => !issuersMatch(storedIssuer, issuer))) {
      this.flowIssuerMismatch = true
      throw new Error(
        `OAuth authorization server issuer changed; clear credentials before authenticating again`,
      )
    }
  }

  /** The redirect URL for OAuth callbacks. */
  get redirectUrl(): string | undefined {
    return this.redirectUrlSnapshot
  }

  /** Client metadata for dynamic registration. */
  get clientMetadata(): OAuthClientMetadata {
    if (this.usesClientCredentials) {
      return {
        client_name: this.config.clientName ?? 'Shumai',
        client_uri: this.config.clientUri ?? 'https://shumai.ai',
        redirect_uris: [],
        grant_types: ['client_credentials'],
        token_endpoint_auth_method: this.config.clientSecret ? 'client_secret_post' : 'none',
      }
    }

    const redirectUrl = this.redirectUrl
    if (!redirectUrl) {
      throw new Error(
        'redirectUrl is required for authorization_code flow. Set MCP_OAUTH_REDIRECT_BASE_URL or BETTER_AUTH_URL, or configure authConfig.oauth.redirectUri.',
      )
    }

    return {
      redirect_uris: [redirectUrl],
      client_name: this.config.clientName ?? 'Shumai',
      client_uri: this.config.clientUri ?? 'https://shumai.ai',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: this.config.clientSecret ? 'client_secret_post' : 'none',
      ...(this.config.scope !== undefined ? { scope: this.config.scope } : {}),
    }
  }

  /** Get client information (pre-registered or dynamically registered). */
  async clientInformation(): Promise<OAuthClientInformationMixed | undefined> {
    const stored = await this.store.getAuthForUrl(this.serverId, this.serverUrl)
    this.assertStoredIssuerBindings(stored, undefined)

    // Config-first (pre-registered client). The secret stays in config.
    if (this.config.clientId) {
      const storedClient =
        stored?.clientInfo?.clientId === this.config.clientId ? stored.clientInfo : undefined
      if (storedClient?.issuer === undefined || storedClient.configPreRegistered !== true) {
        await this.store.updateClientInfo(
          this.serverId,
          { clientId: this.config.clientId, configPreRegistered: true },
          this.serverUrl,
        )
      }
      return {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      } as IssuerBoundClientInformation
    }

    const clientInfo = stored?.clientInfo
    if (clientInfo) {
      const isConfigStub =
        clientInfo.configPreRegistered === true ||
        (clientInfo.clientSecret === undefined &&
          clientInfo.clientIdIssuedAt === undefined &&
          clientInfo.clientSecretExpiresAt === undefined &&
          clientInfo.redirectUris === undefined)
      if (isConfigStub) return undefined
      if (
        clientInfo.clientSecretExpiresAt &&
        clientInfo.clientSecretExpiresAt < Date.now() / 1000
      ) {
        return undefined
      }
      return {
        client_id: clientInfo.clientId,
        client_secret: clientInfo.clientSecret,
        ...(clientInfo.clientIdIssuedAt !== undefined
          ? { client_id_issued_at: clientInfo.clientIdIssuedAt }
          : {}),
        ...(clientInfo.clientSecretExpiresAt !== undefined
          ? { client_secret_expires_at: clientInfo.clientSecretExpiresAt }
          : {}),
        ...(clientInfo.redirectUris !== undefined
          ? { redirect_uris: clientInfo.redirectUris }
          : {}),
      } as IssuerBoundClientInformation
    }

    // No client info - triggers dynamic registration.
    return undefined
  }

  /** Save client information from dynamic registration. */
  async saveClientInformation(info: OAuthClientInformationMixed): Promise<void> {
    this.throwIfInactive()
    if (this.config.clientId && info.client_id === this.config.clientId) {
      await this.store.updateClientInfo(
        this.serverId,
        { clientId: info.client_id, configPreRegistered: true },
        this.serverUrl,
      )
      return
    }

    const redirectUris =
      ('redirect_uris' in info ? info.redirect_uris : undefined) ??
      (this.redirectUrl ? [this.redirectUrl] : undefined)
    const clientInfo: StoredClientInfo = {
      clientId: info.client_id,
      ...(info.client_secret !== undefined ? { clientSecret: info.client_secret } : {}),
      ...(info.client_id_issued_at !== undefined
        ? { clientIdIssuedAt: info.client_id_issued_at }
        : {}),
      ...(info.client_secret_expires_at !== undefined
        ? { clientSecretExpiresAt: info.client_secret_expires_at }
        : {}),
      ...(redirectUris !== undefined ? { redirectUris } : {}),
    }
    await this.store.updateClientInfo(this.serverId, clientInfo, this.serverUrl)
  }

  /** Get stored OAuth tokens. */
  async tokens(): Promise<OAuthTokens | undefined> {
    const entry = await this.store.getAuthForUrl(this.serverId, this.serverUrl)
    if (!entry?.tokens) return undefined
    this.assertStoredIssuerBindings(entry, undefined)

    return {
      access_token: entry.tokens.accessToken,
      token_type: 'Bearer',
      refresh_token: entry.tokens.refreshToken,
      expires_in: entry.tokens.expiresAt
        ? Math.max(0, Math.floor(entry.tokens.expiresAt - Date.now() / 1000))
        : undefined,
      scope: entry.tokens.scope,
    } as IssuerBoundTokens
  }

  /** Save OAuth tokens. */
  async saveTokens(tokens: OAuthTokens): Promise<void> {
    const storedTokens: StoredTokens = {
      accessToken: tokens.access_token,
      ...(tokens.refresh_token !== undefined ? { refreshToken: tokens.refresh_token } : {}),
      ...(tokens.expires_in !== undefined
        ? { expiresAt: Date.now() / 1000 + tokens.expires_in }
        : {}),
      ...(tokens.scope !== undefined ? { scope: tokens.scope } : {}),
    }
    this.throwIfInactive()
    await this.store.updateTokens(this.serverId, storedTokens, this.serverUrl)
  }

  /** Redirect the user to the authorization URL. */
  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    if (this.usesClientCredentials) {
      throw new Error('redirectToAuthorization is not used for client_credentials flow')
    }
    this.throwIfInactive()
    await this.callbacks.onRedirect(
      addAuthorizationParams(authorizationUrl, this.config.authorizationParams),
    )
  }

  /** Save the PKCE code verifier (persisted so the callback leg can use it). */
  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    this.throwIfInactive()
    await this.store.updateCodeVerifier(this.serverId, codeVerifier, this.serverUrl)
  }

  async codeVerifier(): Promise<string> {
    if (this.usesClientCredentials) {
      throw new Error('codeVerifier is not used for client_credentials flow')
    }
    this.throwIfInactive()
    const entry = await this.store.getAuthForUrl(this.serverId, this.serverUrl)
    if (!entry?.codeVerifier) {
      throw new Error(`No code verifier saved for MCP server`)
    }
    return entry.codeVerifier
  }

  /** Keep discovery with the in-flight PKCE verifier. */
  async saveDiscoveryState(state: OAuthDiscoveryState): Promise<void> {
    this.throwIfInactive()
    // Persisted inside the pendingAuth row by mcpService after startAuth; also
    // kept on the credential row so the callback leg can re-read it.
    await this.store.saveDiscoverySnapshot(this.serverId, this.serverUrl, state)
  }

  async discoveryState(): Promise<OAuthDiscoveryState | undefined> {
    this.throwIfInactive()
    const snapshot = await this.store.getDiscoverySnapshot(this.serverId)
    return snapshot as unknown as OAuthDiscoveryState | undefined
  }

  /** Save the OAuth state parameter for CSRF protection. */
  async saveState(state: string): Promise<void> {
    this.throwIfInactive()
    await this.store.updateOauthState(this.serverId, state, this.serverUrl)
  }

  async state(): Promise<string> {
    if (this.usesClientCredentials) {
      throw new Error('state is not used for client_credentials flow')
    }
    this.throwIfInactive()
    let state = await this.store.getOauthState(this.serverId)
    if (!state) {
      state = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
      await this.store.updateOauthState(this.serverId, state, this.serverUrl)
    }
    return state
  }

  /** Invalidate credentials when authentication fails. */
  async invalidateCredentials(
    type: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery',
  ): Promise<void> {
    this.throwIfInactive()
    switch (type) {
      case 'all':
        this.flowIssuerMismatch = false
        await this.store.clearAllCredentials(this.serverId)
        break
      case 'client':
        await this.store.clearClientInfo(this.serverId)
        break
      case 'tokens':
        await this.store.clearTokens(this.serverId)
        break
      case 'verifier':
        await this.store.clearCodeVerifier(this.serverId)
        break
      case 'discovery':
        await this.store.clearDiscoverySnapshot(this.serverId)
        break
    }
  }

  /** Adds configured authorization-code scope and client authentication. */
  addClientAuthentication: AddClientAuthentication = async (headers, params, _url, metadata) => {
    this.throwIfInactive()
    if (
      params.get('grant_type') === 'authorization_code' &&
      !params.has('scope') &&
      this.config.scope
    ) {
      params.set('scope', this.config.scope)
    }

    const clientInfo = await this.clientInformation()
    this.throwIfInactive()
    if (!clientInfo) return

    const supportedMethods = metadata?.token_endpoint_auth_methods_supported ?? []
    const hasClientSecret = clientInfo.client_secret !== undefined
    let authMethod: 'client_secret_basic' | 'client_secret_post' | 'none'

    if (supportedMethods.length === 0) {
      authMethod = hasClientSecret ? 'client_secret_post' : 'none'
    } else if (hasClientSecret && supportedMethods.includes('client_secret_basic')) {
      authMethod = 'client_secret_basic'
    } else if (hasClientSecret && supportedMethods.includes('client_secret_post')) {
      authMethod = 'client_secret_post'
    } else if (supportedMethods.includes('none')) {
      authMethod = 'none'
    } else {
      authMethod = hasClientSecret ? 'client_secret_post' : 'none'
    }

    if (authMethod === 'client_secret_basic') {
      if (!clientInfo.client_secret) {
        throw new Error('client_secret_basic authentication requires a client_secret')
      }
      headers.set(
        'Authorization',
        `Basic ${Buffer.from(`${clientInfo.client_id}:${clientInfo.client_secret}`).toString('base64')}`,
      )
      return
    }

    if (!params.has('client_id')) {
      params.set('client_id', clientInfo.client_id)
    }
    if (
      authMethod === 'client_secret_post' &&
      clientInfo.client_secret &&
      !params.has('client_secret')
    ) {
      params.set('client_secret', clientInfo.client_secret)
    }
  }

  prepareTokenRequest(scope?: string): URLSearchParams | undefined {
    if (!this.usesClientCredentials) return undefined

    const params = new URLSearchParams({ grant_type: 'client_credentials' })
    const requestedScope = scope ?? this.config.scope
    if (requestedScope) {
      params.set('scope', requestedScope)
    }
    return params
  }
}
