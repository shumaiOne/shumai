import { describe, it, expect, beforeAll } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { McpDbStore } from './mcp-db-store'
import { McpOauthProvider } from './mcp-oauth-provider'

/* eslint-disable @typescript-eslint/naming-convention */
// The OAuth wire format (RFC 6749 / OAuth 2.1) uses snake_case field names
// (client_id, access_token, grant_type, ...); the test fixtures must use the
// protocol's exact key names because they are passed to the MCP SDK's
// OAuthClientProvider interfaces.

const SERVER_URL = 'https://mcp.example.com/kling'
const ISSUER = 'https://kling.ai/auth'

describe('McpOauthProvider SEP-2352 issuer stamping', () => {
  setupTestDbHooks()

  let store: McpDbStore
  let serverId: string

  const makeProvider = () =>
    new McpOauthProvider(serverId, SERVER_URL, {}, { onRedirect: async () => {} }, store)

  beforeAll(async () => {
    store = new McpDbStore()
    const team = await prisma.team.create({ data: { name: 'OAuth Provider Team' } })
    const server = await prisma.mcpServer.create({
      data: { name: 'kling', url: SERVER_URL, teamId: team.id },
    })
    serverId = server.id
  })

  it('discoveryState() returns the snapshot saved by the start leg on the callback leg', async () => {
    const provider = makeProvider()
    // Start leg: the SDK saves the discovery state before redirecting.
    await provider.saveDiscoveryState({
      authorizationServerUrl: ISSUER,
      authorizationServerMetadata: { issuer: ISSUER },
      resourceMetadataUrl: `${SERVER_URL}/.well-known/oauth-protected-resource`,
    } as never)
    await provider.deactivate()

    // startAuth() persists the pending flow (must not clobber the snapshot).
    await store.savePendingAuth(serverId, {
      state: 'state-xyz',
      authorizationUrl: 'https://kling.ai/authorize',
      discovery: {},
      expiresAt: Math.floor(Date.now() / 1000) + 300,
    })

    // Callback leg: a fresh provider instance reads the same snapshot.
    const callbackProvider = makeProvider()
    const state = await callbackProvider.discoveryState()
    expect(state?.authorizationServerMetadata?.issuer).toBe(ISSUER)
    expect(state?.authorizationServerUrl).toBe(ISSUER)
  })

  it('saveClientInformation stamps the issuer and clientInformation round-trips it', async () => {
    const provider = makeProvider()
    await provider.saveDiscoveryState({
      authorizationServerUrl: ISSUER,
      authorizationServerMetadata: { issuer: ISSUER },
    } as never)

    await provider.saveClientInformation({
      client_id: 'dyn-client',
      client_secret: 'dyn-secret',
    } as never)

    const info = await makeProvider().clientInformation()
    expect(info?.client_id).toBe('dyn-client')
    expect((info as { issuer?: string }).issuer).toBe(ISSUER)
  })

  it('saveTokens stamps the issuer and tokens round-trips it', async () => {
    const provider = makeProvider()
    await provider.saveDiscoveryState({
      authorizationServerUrl: ISSUER,
      authorizationServerMetadata: { issuer: ISSUER },
    } as never)

    await provider.saveTokens({
      access_token: 'tok-1',
      token_type: 'Bearer',
      refresh_token: 'ref-1',
      expires_in: 3600,
    } as never)

    const tokens = await makeProvider().tokens()
    expect(tokens?.access_token).toBe('tok-1')
    expect((tokens as { issuer?: string }).issuer).toBe(ISSUER)
  })

  it('tokens() backfills a missing issuer stamp from the discovery snapshot', async () => {
    const provider = makeProvider()
    // Pre-existing tokens stored WITHOUT an issuer (pre-upgrade / buggy flow).
    await store.updateTokens(serverId, { accessToken: 'legacy-tok' }, SERVER_URL)
    // The discovery snapshot is present for the read.
    await provider.saveDiscoveryState({
      authorizationServerUrl: ISSUER,
      authorizationServerMetadata: { issuer: ISSUER },
    } as never)

    const tokens = await provider.tokens()
    expect(tokens?.access_token).toBe('legacy-tok')
    expect((tokens as { issuer?: string }).issuer).toBe(ISSUER)
    // The stamp is persisted, not just returned.
    const entry = await store.getAuthForUrl(serverId, SERVER_URL)
    expect(entry?.tokens?.issuer).toBe(ISSUER)
  })

  it('does not stamp an issuer when no discovery snapshot is available', async () => {
    const provider = makeProvider()
    await provider.saveClientInformation({ client_id: 'c2' } as never)
    const info = await makeProvider().clientInformation()
    expect((info as { issuer?: string }).issuer).toBeUndefined()
  })
})
