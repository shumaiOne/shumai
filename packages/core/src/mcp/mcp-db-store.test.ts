import { describe, it, expect, beforeAll } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { McpDbStore } from './mcp-db-store'

describe('McpDbStore', () => {
  setupTestDbHooks()

  let store: McpDbStore
  let serverId: string

  beforeAll(async () => {
    store = new McpDbStore()
    const team = await prisma.team.create({ data: { name: 'MCP DB Store Team' } })
    const server = await prisma.mcpServer.create({
      data: {
        name: 'github',
        url: 'https://mcp.example.com/github',
        teamId: team.id,
      },
    })
    serverId = server.id
  })

  it('returns undefined when no credentials exist', async () => {
    expect(await store.getAuthForUrl(serverId, 'https://mcp.example.com/github')).toBeUndefined()
    expect(await store.hasStoredTokens(serverId)).toBe(false)
    expect(await store.isTokenExpired(serverId)).toBeNull()
  })

  it('saves and reads tokens bound to the URL', async () => {
    await store.updateTokens(
      serverId,
      { accessToken: 'tok-1', refreshToken: 'ref-1' },
      'https://mcp.example.com/github',
    )
    const entry = await store.getAuthForUrl(serverId, 'https://mcp.example.com/github')
    expect(entry?.tokens?.accessToken).toBe('tok-1')
    expect(entry?.tokens?.refreshToken).toBe('ref-1')
    expect(await store.hasStoredTokens(serverId)).toBe(true)
  })

  it('invalidates credentials when the URL changes', async () => {
    expect(await store.getAuthForUrl(serverId, 'https://other.example.com')).toBeUndefined()
    expect(await store.hasStoredTokens(serverId)).toBe(false)
  })

  it('saves and clears client info', async () => {
    await store.updateClientInfo(
      serverId,
      { clientId: 'client-1', clientSecret: 'secret-1' },
      'https://mcp.example.com/github',
    )
    let entry = await store.getAuthForUrl(serverId, 'https://mcp.example.com/github')
    expect(entry?.clientInfo?.clientId).toBe('client-1')

    await store.clearClientInfo(serverId)
    entry = await store.getAuthForUrl(serverId, 'https://mcp.example.com/github')
    expect(entry?.clientInfo).toBeUndefined()
  })

  it('saves/clears the PKCE code verifier', async () => {
    await store.updateCodeVerifier(serverId, 'verifier-abc', 'https://mcp.example.com/github')
    let entry = await store.getAuthForUrl(serverId, 'https://mcp.example.com/github')
    expect(entry?.codeVerifier).toBe('verifier-abc')

    await store.clearCodeVerifier(serverId)
    entry = await store.getAuthForUrl(serverId, 'https://mcp.example.com/github')
    expect(entry?.codeVerifier).toBeUndefined()
  })

  it('saves/clears the CSRF state', async () => {
    await store.updateOauthState(serverId, 'state-xyz', 'https://mcp.example.com/github')
    expect(await store.getOauthState(serverId)).toBe('state-xyz')

    await store.clearOauthState(serverId)
    expect(await store.getOauthState(serverId)).toBeUndefined()
  })

  it('detects expired tokens', async () => {
    await store.updateTokens(
      serverId,
      { accessToken: 'tok-expired', expiresAt: Math.floor(Date.now() / 1000) - 10 },
      'https://mcp.example.com/github',
    )
    expect(await store.isTokenExpired(serverId)).toBe(true)

    await store.updateTokens(
      serverId,
      { accessToken: 'tok-valid', expiresAt: Math.floor(Date.now() / 1000) + 3600 },
      'https://mcp.example.com/github',
    )
    expect(await store.isTokenExpired(serverId)).toBe(false)
  })

  it('treats tokens without an expiry as never-expiring', async () => {
    await store.updateTokens(
      serverId,
      { accessToken: 'tok-no-expiry' },
      'https://mcp.example.com/github',
    )
    expect(await store.isTokenExpired(serverId)).toBe(false)
  })

  it('clears tokens only', async () => {
    await store.updateTokens(serverId, { accessToken: 'tok-x' }, 'https://mcp.example.com/github')
    await store.clearTokens(serverId)
    expect(await store.hasStoredTokens(serverId)).toBe(false)
  })

  it('clears all credentials', async () => {
    await store.updateTokens(serverId, { accessToken: 'tok-y' }, 'https://mcp.example.com/github')
    await store.updateClientInfo(serverId, { clientId: 'c' }, 'https://mcp.example.com/github')
    await store.clearAllCredentials(serverId)
    expect(await store.getAuthForUrl(serverId, 'https://mcp.example.com/github')).toBeUndefined()
  })

  it('persists an in-flight pendingAuth with a TTL and expires it', async () => {
    const ttl = await store.getPendingAuthTtlSeconds()
    await store.savePendingAuth(serverId, {
      state: 'pending-state',
      authorizationUrl: 'https://auth.example.com/authorize?state=pending-state',
      discovery: { scope: 'read' },
      expiresAt: Math.floor(Date.now() / 1000) + ttl,
    })
    const pending = await store.getPendingAuth(serverId)
    expect(pending?.state).toBe('pending-state')
    expect(pending?.authorizationUrl).toContain('pending-state')

    // Expired pendingAuth is cleared on read.
    await store.savePendingAuth(serverId, {
      state: 'stale',
      authorizationUrl: 'https://auth.example.com/authorize',
      discovery: {},
      expiresAt: Math.floor(Date.now() / 1000) - 10,
    })
    expect(await store.getPendingAuth(serverId)).toBeUndefined()

    await store.clearPendingAuth(serverId)
    expect(await store.getPendingAuth(serverId)).toBeUndefined()
  })

  it('savePendingAuth does not clobber an in-flight discovery snapshot', async () => {
    // Simulates the SDK flow: the provider's saveDiscoveryState() stores a
    // snapshot inside the pendingAuth column, then startAuth() calls
    // savePendingAuth(). The snapshot MUST survive so the callback leg can
    // satisfy the SEP-2352 issuer check.
    await store.saveDiscoverySnapshot(serverId, 'https://mcp.example.com/github', {
      authorizationServerUrl: 'https://kling.ai/auth',
      authorizationServerMetadata: { issuer: 'https://kling.ai/auth' },
    })

    await store.savePendingAuth(serverId, {
      state: 'state-abc',
      authorizationUrl: 'https://kling.ai/authorize',
      discovery: {},
      expiresAt: Math.floor(Date.now() / 1000) + 300,
    })

    const snapshot = await store.getDiscoverySnapshot(serverId)
    expect(snapshot).toBeDefined()
    expect(snapshot?.['authorizationServerUrl']).toBe('https://kling.ai/auth')

    const pending = await store.getPendingAuth(serverId)
    expect(pending?.state).toBe('state-abc')
  })

  it('persists and clears the discovery snapshot', async () => {
    await store.saveDiscoverySnapshot(serverId, 'https://mcp.example.com/github', {
      authorizationServerUrl: 'https://issuer.example.com',
    })
    const snapshot = await store.getDiscoverySnapshot(serverId)
    expect(snapshot?.authorizationServerUrl).toBe('https://issuer.example.com')

    await store.clearDiscoverySnapshot(serverId)
    expect(await store.getDiscoverySnapshot(serverId)).toBeUndefined()
  })

  it('deletes the credential row when the server is deleted (cascade)', async () => {
    const team = await prisma.team.create({ data: { name: 'Cascade Team' } })
    const server = await prisma.mcpServer.create({
      data: { name: 'cascade-srv', url: 'https://mcp.example.com/cascade', teamId: team.id },
    })
    await store.updateTokens(
      server.id,
      { accessToken: 'tok-cascade' },
      'https://mcp.example.com/cascade',
    )
    await prisma.mcpServer.delete({ where: { id: server.id } })
    const leftover = await prisma.mcpServerCredential.findUnique({ where: { serverId: server.id } })
    expect(leftover).toBeNull()
  })
})
