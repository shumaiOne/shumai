import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createHash, randomBytes } from 'node:crypto'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { prisma, type User } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { projectService } from '@shumai/core/src/project/project'
import { apiTokenService } from '@shumai/core/src/user/api-token'
import { authBaseUrl, hashPassword, mcpResource } from '@shumai/core/src/auth/auth'
import app from './index'

function base64url(buffer: Buffer): string {
  return buffer.toString('base64url')
}

describe('MCP server OAuth 2.1 & Dual Auth', () => {
  setupTestDbHooks()

  let user: User
  let apiToken: string
  let teamId: string
  let projectId: string
  let rootFolderId: string
  const clients: Client[] = []

  beforeEach(async () => {
    user = await prisma.user.create({
      data: { name: 'OAuth User', email: 'oauth-user@test.com' },
    })
    await prisma.account.create({
      data: {
        userId: user.id,
        providerId: 'credential',
        accountId: user.id,
        password: await hashPassword('password123'),
      },
    })
    const team = await prisma.team.create({ data: { name: 'OAuth Team' } })
    teamId = team.id
    await prisma.teamMember.create({ data: { teamId, userId: user.id, role: 'owner' } })
    const project = await projectService.createProject(user, { teamId, name: 'OAuth Project' })
    projectId = project.id
    rootFolderId = project.rootFolder!

    apiToken = (await apiTokenService.createToken(user.id, 'dual-auth-test')).token
  })

  afterEach(async () => {
    await Promise.all(clients.splice(0).map((c) => c.close()))
  })

  it('serves RFC 8414 and RFC 9728 discovery endpoints', async () => {
    // RFC 9728 Protected Resource Metadata
    const resourceMetaRes = await app.request('/.well-known/oauth-protected-resource')
    expect(resourceMetaRes.status).toBe(200)
    const resourceMeta = await resourceMetaRes.json()
    expect(resourceMeta.resource).toBe(mcpResource)
    expect(resourceMeta.authorization_servers).toContain(`${authBaseUrl}/api/auth`)

    // RFC 9728 resource-specific metadata
    const resourcePathMetaRes = await app.request('/.well-known/oauth-protected-resource/mcp')
    expect(resourcePathMetaRes.status).toBe(200)
    const resourcePathMeta = await resourcePathMetaRes.json()
    expect(resourcePathMeta.resource).toBe(mcpResource)

    // RFC 8414 Authorization Server Metadata (supports both standard path-inserted and bare root paths)
    const authServerMetaRes = await app.request('/.well-known/oauth-authorization-server/api/auth')
    expect(authServerMetaRes.status).toBe(200)
    const authServerMeta = await authServerMetaRes.json()
    expect(authServerMeta.issuer).toBe(`${authBaseUrl}/api/auth`)
    expect(authServerMeta.authorization_endpoint).toBe(`${authBaseUrl}/api/auth/oauth2/authorize`)
    expect(authServerMeta.token_endpoint).toBe(`${authBaseUrl}/api/auth/oauth2/token`)
    expect(authServerMeta.registration_endpoint).toBe(`${authBaseUrl}/api/auth/oauth2/register`)
    expect(authServerMeta.jwks_uri).toBe(`${authBaseUrl}/api/auth/jwks`)

    const bareAuthServerMetaRes = await app.request('/.well-known/oauth-authorization-server')
    expect(bareAuthServerMetaRes.status).toBe(200)
    const bareAuthServerMeta = await bareAuthServerMetaRes.json()
    expect(bareAuthServerMeta.issuer).toBe(authServerMeta.issuer)
    expect(bareAuthServerMeta.authorization_endpoint).toBe(authServerMeta.authorization_endpoint)

    // JWKS
    const jwksRes = await app.request('/api/auth/jwks')
    expect(jwksRes.status).toBe(200)
    const jwks = await jwksRes.json()
    expect(Array.isArray(jwks.keys)).toBe(true)
    expect(jwks.keys.length).toBeGreaterThan(0)
  })

  it('returns 401 with RFC 9728 WWW-Authenticate header when unauthenticated', async () => {
    const initialize = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test', version: '1' },
      },
    })
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    }

    // Missing token
    const resNoToken = await app.request('/mcp', { method: 'POST', headers, body: initialize })
    expect(resNoToken.status).toBe(401)
    const authHeader = resNoToken.headers.get('WWW-Authenticate')
    expect(authHeader).toContain('Bearer')
    expect(authHeader).toContain('resource_metadata=')

    // Invalid JWT / OAuth token
    const resInvalidToken = await app.request('/mcp', {
      method: 'POST',
      headers: { ...headers, Authorization: 'Bearer invalid.jwt.token' },
      body: initialize,
    })
    expect(resInvalidToken.status).toBe(401)
    expect(resInvalidToken.headers.get('WWW-Authenticate')).toContain('Bearer')

    // Invalid Shumai API token
    const resInvalidApiKey = await app.request('/mcp', {
      method: 'POST',
      headers: { ...headers, Authorization: 'Bearer shumai_invalid' },
      body: initialize,
    })
    expect(resInvalidApiKey.status).toBe(401)
  })

  it('completes Dynamic Client Registration, PKCE authorization, and MCP tool calls via OAuth 2.1', async () => {
    // 1. Dynamic Client Registration (DCR)
    const registerRes = await app.request('/api/auth/oauth2/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // eslint-disable-next-line @typescript-eslint/naming-convention
        client_name: 'Test MCP Client',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        redirect_uris: ['http://127.0.0.1:9999/callback'],
        // eslint-disable-next-line @typescript-eslint/naming-convention
        grant_types: ['authorization_code', 'refresh_token'],
        // eslint-disable-next-line @typescript-eslint/naming-convention
        response_types: ['code'],
        // eslint-disable-next-line @typescript-eslint/naming-convention
        token_endpoint_auth_method: 'none',
      }),
    })
    expect(registerRes.status).toBe(201)
    const clientData = await registerRes.json()
    const clientId = clientData.client_id
    expect(clientId).toBeDefined()

    // 2. Sign in user to obtain session cookie
    const signInRes = await app.request('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'oauth-user@test.com', password: 'password123' }),
    })
    expect(signInRes.status).toBe(200)
    const cookieHeader = signInRes.headers.get('set-cookie')
    expect(cookieHeader).toBeDefined()

    // 3. Initiate PKCE Authorization
    const codeVerifier = base64url(randomBytes(32))
    const codeChallenge = base64url(createHash('sha256').update(codeVerifier).digest())

    const authUrl = new URL('/api/auth/oauth2/authorize', authBaseUrl)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', 'http://127.0.0.1:9999/callback')
    authUrl.searchParams.set('scope', 'openid profile email offline_access mcp')
    authUrl.searchParams.set('code_challenge', codeChallenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
    authUrl.searchParams.set('resource', mcpResource)

    const authorizeRes = await app.request(authUrl.pathname + authUrl.search, {
      method: 'GET',
      headers: {
        Cookie: cookieHeader!,
      },
      redirect: 'manual',
    })

    // Better Auth redirects either directly with `code` (if skip consent) or to `/consent`
    let code: string | null
    const location = authorizeRes.headers.get('location')
    expect(location).toBeDefined()

    if (location!.includes('/consent')) {
      // User consent step
      const consentUrl = new URL(location!, authBaseUrl)
      const consentRes = await app.request('/api/auth/oauth2/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookieHeader!,
        },
        body: JSON.stringify({
          accept: true,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          oauth_query: consentUrl.search.replace(/^\?/, ''),
        }),
      })
      expect(consentRes.status).toBe(200)
      const consentData = await consentRes.json()
      expect(consentData.redirect).toBe(true)
      const redirectUrl = new URL(consentData.url)
      code = redirectUrl.searchParams.get('code')
    } else {
      const redirectUrl = new URL(location!, 'http://127.0.0.1:9999')
      code = redirectUrl.searchParams.get('code')
    }

    expect(code).toBeDefined()

    // 4. Token exchange with PKCE code_verifier
    const tokenRes = await app.request('/api/auth/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams([
        ['grant_type', 'authorization_code'],
        ['code', code!],
        ['redirect_uri', 'http://127.0.0.1:9999/callback'],
        ['client_id', clientId],
        ['code_verifier', codeVerifier],
        ['resource', mcpResource],
      ]).toString(),
    })

    expect(tokenRes.status).toBe(200)
    const tokenData = await tokenRes.json()
    expect(tokenData.access_token).toBeDefined()
    expect(tokenData.token_type).toMatch(/Bearer/i)

    const oauthAccessToken = tokenData.access_token

    // 5. Connect official MCP Client using OAuth 2.1 access token
    const oauthTransport = new StreamableHTTPClientTransport(new URL('http://localhost:3000/mcp'), {
      requestInit: { headers: { Authorization: `Bearer ${oauthAccessToken}` } },
      fetch: async (input, init) => app.request(String(input), init),
    })
    const oauthMcpClient = new Client({ name: 'oauth-integration-client', version: '1.0.0' })
    await oauthMcpClient.connect(oauthTransport)
    clients.push(oauthMcpClient)

    // Call list_projects tool
    const projects = await oauthMcpClient.callTool({ name: 'list_projects', arguments: {} })
    expect(projects.structuredContent).toEqual({
      data: [{ id: projectId, name: 'OAuth Project', teamId, rootFolderId }],
    })

    // Call create_folder tool
    const createdFolder = await oauthMcpClient.callTool({
      name: 'create_folder',
      arguments: { parent: rootFolderId, name: 'From OAuth MCP' },
    })
    expect(createdFolder.isError).toBeFalsy()
    const folderId = (createdFolder.structuredContent as { id: string }).id
    const folder = await prisma.asset.findUniqueOrThrow({ where: { id: folderId } })
    expect(folder).toMatchObject({ name: 'From OAuth MCP', creatorId: user.id })

    // Verify audit log has via: 'mcp'
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'folder_create', itemId: folderId },
    })
    expect(audit).toMatchObject({ userId: user.id, via: 'mcp' })

    // 6. Verify static API token still works on the exact same endpoint simultaneously!
    const apiKeyTransport = new StreamableHTTPClientTransport(
      new URL('http://localhost:3000/mcp'),
      {
        requestInit: { headers: { Authorization: `Bearer ${apiToken}` } },
        fetch: async (input, init) => app.request(String(input), init),
      },
    )
    const apiKeyMcpClient = new Client({ name: 'api-key-client', version: '1.0.0' })
    await apiKeyMcpClient.connect(apiKeyTransport)
    clients.push(apiKeyMcpClient)

    const apiKeyCreated = await apiKeyMcpClient.callTool({
      name: 'create_folder',
      arguments: { parent: rootFolderId, name: 'From API Key MCP' },
    })
    expect(apiKeyCreated.isError).toBeFalsy()
  })

  it('starts OAuth authorization without a session, redirects to login, signs in, and completes authorization', async () => {
    // 1. Dynamic Client Registration
    const registerRes = await app.request('/api/auth/oauth2/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // eslint-disable-next-line @typescript-eslint/naming-convention
        client_name: 'Test Logged-Out Client',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        redirect_uris: ['http://127.0.0.1:9999/callback'],
        // eslint-disable-next-line @typescript-eslint/naming-convention
        grant_types: ['authorization_code'],
        // eslint-disable-next-line @typescript-eslint/naming-convention
        response_types: ['code'],
        // eslint-disable-next-line @typescript-eslint/naming-convention
        token_endpoint_auth_method: 'none',
      }),
    })
    expect(registerRes.status).toBe(201)
    const clientData = await registerRes.json()
    const clientId = clientData.client_id

    // 2. Initiate PKCE authorization without session cookie
    const codeVerifier = base64url(randomBytes(32))
    const codeChallenge = base64url(createHash('sha256').update(codeVerifier).digest())

    const authUrl = new URL('/api/auth/oauth2/authorize', authBaseUrl)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', 'http://127.0.0.1:9999/callback')
    authUrl.searchParams.set('scope', 'openid profile email offline_access mcp')
    authUrl.searchParams.set('code_challenge', codeChallenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
    authUrl.searchParams.set('resource', mcpResource)

    const unauthAuthorizeRes = await app.request(authUrl.pathname + authUrl.search, {
      method: 'GET',
      redirect: 'manual',
    })

    // Expect redirect to login page (/login)
    expect(unauthAuthorizeRes.status).toBe(302)
    const loginRedirect = unauthAuthorizeRes.headers.get('location')
    expect(loginRedirect).toBeDefined()
    expect(loginRedirect).toContain('/login')

    // 3. User signs in on the login page
    const signInRes = await app.request('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'oauth-user@test.com', password: 'password123' }),
    })
    expect(signInRes.status).toBe(200)
    const cookieHeader = signInRes.headers.get('set-cookie')
    expect(cookieHeader).toBeDefined()

    // 4. Verify server session is valid via /api/auth/get-session
    const sessionRes = await app.request('/api/auth/get-session', {
      headers: { Cookie: cookieHeader! },
    })
    expect(sessionRes.status).toBe(200)
    const sessionData = await sessionRes.json()
    expect(sessionData?.user?.id).toBe(user.id)

    // 5. User accesses the consent page / resumes authorize with the session cookie
    const authorizedRes = await app.request(authUrl.pathname + authUrl.search, {
      method: 'GET',
      headers: { Cookie: cookieHeader! },
      redirect: 'manual',
    })
    const consentLocation = authorizedRes.headers.get('location')
    expect(consentLocation).toBeDefined()

    let code: string | null
    if (consentLocation!.includes('/consent')) {
      // Grant consent
      const consentUrl = new URL(consentLocation!, authBaseUrl)
      const consentRes = await app.request('/api/auth/oauth2/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookieHeader!,
        },
        body: JSON.stringify({
          accept: true,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          oauth_query: consentUrl.search.replace(/^\?/, ''),
        }),
      })
      expect(consentRes.status).toBe(200)
      const consentData = await consentRes.json()
      expect(consentData.redirect).toBe(true)
      const redirectUrl = new URL(consentData.url)
      code = redirectUrl.searchParams.get('code')
    } else {
      const cbUrl = new URL(consentLocation!)
      code = cbUrl.searchParams.get('code')
    }

    expect(code).toBeDefined()

    // 6. Exchange code for OAuth 2.1 access token
    const tokenRes = await app.request('/api/auth/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        // eslint-disable-next-line @typescript-eslint/naming-convention
        grant_type: 'authorization_code',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        client_id: clientId,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        redirect_uri: 'http://127.0.0.1:9999/callback',
        code: code!,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        code_verifier: codeVerifier,
        resource: mcpResource,
      }).toString(),
    })
    expect(tokenRes.status).toBe(200)
    const tokenData = await tokenRes.json()
    expect(tokenData.access_token).toBeDefined()

    // 7. Verify MCP access with the issued token
    const oauthTransport = new StreamableHTTPClientTransport(new URL('http://localhost:3000/mcp'), {
      requestInit: { headers: { Authorization: `Bearer ${tokenData.access_token}` } },
      fetch: async (input, init) => app.request(String(input), init),
    })
    const oauthMcpClient = new Client({ name: 'oauth-logged-out-client', version: '1.0.0' })
    await oauthMcpClient.connect(oauthTransport)
    clients.push(oauthMcpClient)

    const projects = await oauthMcpClient.callTool({ name: 'list_projects', arguments: {} })
    expect(projects.structuredContent).toEqual({
      data: [{ id: projectId, name: 'OAuth Project', teamId, rootFolderId }],
    })
  })
})
