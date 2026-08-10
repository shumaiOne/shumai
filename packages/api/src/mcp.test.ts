import { describe, expect, test, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import mcpRoute, { mcpOauthCallbackRoute } from './mcp'
import { mcpService } from '@shumai/core/src/mcp/mcp-service'
import { authMiddleware } from './middleware/auth'
import { authzService, ResourceType, Permission } from '@shumai/core/src/authz/authz'
import { auditLogService } from '@shumai/core/src/auditLog/auditLog'

vi.mock('@shumai/core/src/auditLog/auditLog', () => ({
  auditLogService: {
    logAction: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('@shumai/core/src/mcp/mcp-service', () => ({
  mcpService: {
    listServers: vi.fn(),
    createServer: vi.fn(),
    getServer: vi.fn(),
    getServerRecord: vi.fn(),
    updateServer: vi.fn(),
    updateServerPermission: vi.fn(),
    deleteServer: vi.fn(),
    discoverTools: vi.fn(),
    startAuth: vi.fn(),
    completeAuth: vi.fn(),
    getAuthStatus: vi.fn(),
    removeAuth: vi.fn(),
    testServer: vi.fn(),
    handleOauthCallback: vi.fn(),
  },
}))

vi.mock('./middleware/auth', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authMiddleware: async (c: any, next: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    c.set('user', { id: 'user1', name: 'Test User' } as any)
    await next()
  },
}))

vi.mock('@shumai/core/src/authz/authz', () => ({
  authzService: {
    hasPermission: vi.fn().mockResolvedValue(undefined),
  },
  Permission: {
    Read: 'Read',
    Edit: 'Edit',
    Admin: 'Admin',
  },
  ResourceType: {
    Team: 'team',
    McpServer: 'mcpServer',
  },
}))

import type { McpServerInfo } from '@shumai/dtos'

const serverInfo: McpServerInfo = {
  id: 'server1',
  name: 'github',
  url: 'https://mcp.example.com/github',
  transport: 'streamable_http',
  authType: 'bearer',
  enabled: true,
  permission: 'reviewer',
  status: 'not_connected',
  toolCount: 0,
  hasCredential: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe('MCP API', () => {
  const app = new Hono().use('*', authMiddleware).route('/', mcpRoute)

  beforeEach(() => {
    vi.restoreAllMocks()
    // Clear call history so per-test call assertions are isolated.
    vi.clearAllMocks()
    vi.mocked(authzService.hasPermission).mockResolvedValue(undefined)
    vi.mocked(mcpService.listServers).mockResolvedValue([serverInfo])
    vi.mocked(mcpService.getServer).mockResolvedValue(serverInfo)
    vi.mocked(mcpService.getServerRecord).mockResolvedValue({
      ...serverInfo,
      lastError: null,
      lastConnectedAt: null,
      teamId: 'team1',
      tools: [],
      credential: null,
      config: null,
      authConfig: { type: 'bearer', bearerToken: 'secret' },
    } as never)
  })

  test('lists servers with Admin permission on the team', async () => {
    const res = await app.request('/teams/team1/mcp/servers')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ servers: [serverInfo] })
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.anything(),
      permission: Permission.Admin,
      type: ResourceType.Team,
      id: 'team1',
    })
  })

  test('creates a server and audits it', async () => {
    vi.mocked(mcpService.createServer).mockResolvedValue(serverInfo)
    const res = await app.request('/teams/team1/mcp/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'github', url: 'https://mcp.example.com/github' }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(serverInfo)
    expect(auditLogService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'mcp_server_create', teamId: 'team1' }),
    )
  })

  test('rejects a server with an invalid URL', async () => {
    const res = await app.request('/teams/team1/mcp/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'bad', url: 'not-a-url' }),
    })
    expect(res.status).toBe(400)
    expect(mcpService.createServer).not.toHaveBeenCalled()
  })

  test('gets a single server with Admin on the McpServer resource', async () => {
    const res = await app.request('/mcp/servers/server1')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(serverInfo)
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: expect.anything(),
      permission: Permission.Admin,
      type: ResourceType.McpServer,
      id: 'server1',
    })
  })

  test('returns 404 when the server is missing', async () => {
    vi.mocked(mcpService.getServer).mockResolvedValue(null)
    const res = await app.request('/mcp/servers/missing')
    expect(res.status).toBe(404)
  })

  test('updates a server and audits it', async () => {
    vi.mocked(mcpService.updateServer).mockResolvedValue({ ...serverInfo, name: 'renamed' })
    const res = await app.request('/mcp/servers/server1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'renamed' }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ...serverInfo, name: 'renamed' })
    expect(auditLogService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'mcp_server_update', itemId: 'server1' }),
    )
  })

  test('updates the permission via the dedicated route', async () => {
    vi.mocked(mcpService.updateServerPermission).mockResolvedValue({
      ...serverInfo,
      permission: 'editor',
    })
    const res = await app.request('/mcp/servers/server1/permission', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permission: 'editor' }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ...serverInfo, permission: 'editor' })
    expect(mcpService.updateServerPermission).toHaveBeenCalledWith('server1', 'editor')
  })

  test('rejects an invalid permission value', async () => {
    const res = await app.request('/mcp/servers/server1/permission', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permission: 'superadmin' }),
    })
    expect(res.status).toBe(400)
  })

  test('deletes a server and audits it', async () => {
    const res = await app.request('/mcp/servers/server1', { method: 'DELETE' })
    expect(res.status).toBe(204)
    expect(auditLogService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'mcp_server_delete', itemId: 'server1' }),
    )
  })

  test('refreshes tools', async () => {
    vi.mocked(mcpService.discoverTools).mockResolvedValue([
      { name: 'echo', description: 'echo', inputSchema: { type: 'object' } },
    ])
    const res = await app.request('/mcp/servers/server1/tools/refresh', { method: 'POST' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      tools: [{ name: 'echo', description: 'echo', inputSchema: { type: 'object' } }],
    })
  })

  test('refresh failure returns 502 with the error message', async () => {
    vi.mocked(mcpService.discoverTools).mockRejectedValue(new Error('boom'))
    const res = await app.request('/mcp/servers/server1/tools/refresh', { method: 'POST' })
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: 'boom' })
  })

  test('lists cached tools', async () => {
    vi.mocked(mcpService.getServerRecord).mockResolvedValue({
      ...serverInfo,
      lastError: null,
      lastConnectedAt: null,
      teamId: 'team1',
      tools: [{ name: 'echo' }],
      credential: null,
      config: null,
      authConfig: null,
    } as never)
    const res = await app.request('/mcp/servers/server1/tools')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ tools: [{ name: 'echo' }] })
  })

  test('starts OAuth auth', async () => {
    vi.mocked(mcpService.startAuth).mockResolvedValue({
      authorizationUrl: 'https://auth.example.com/authorize',
    })
    const res = await app.request('/mcp/servers/server1/auth/start', { method: 'POST' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      authorizationUrl: 'https://auth.example.com/authorize',
      status: 'in_progress',
    })
  })

  test('completes OAuth auth', async () => {
    vi.mocked(mcpService.completeAuth).mockResolvedValue('authenticated')
    const res = await app.request('/mcp/servers/server1/auth/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'auth-code', iss: 'https://issuer.example.com' }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'authenticated' })
    expect(mcpService.completeAuth).toHaveBeenCalledWith('server1', {
      code: 'auth-code',
      iss: 'https://issuer.example.com',
    })
  })

  test('reports auth status', async () => {
    vi.mocked(mcpService.getAuthStatus).mockResolvedValue('not_authenticated')
    const res = await app.request('/mcp/servers/server1/auth/status')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'not_authenticated' })
  })

  test('removes auth', async () => {
    const res = await app.request('/mcp/servers/server1/auth', { method: 'DELETE' })
    expect(res.status).toBe(204)
    expect(mcpService.removeAuth).toHaveBeenCalledWith('server1')
  })

  test('tests the server connection', async () => {
    vi.mocked(mcpService.testServer).mockResolvedValue({ ok: true, toolCount: 3 })
    const res = await app.request('/mcp/servers/server1/test', { method: 'POST' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, toolCount: 3 })
  })
})

describe('MCP OAuth callback route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('completes a valid callback and renders an HTML page', async () => {
    vi.mocked(mcpService.handleOauthCallback).mockResolvedValue({ ok: true })
    const res = await mcpOauthCallbackRoute.request(
      '/mcp/oauth/callback?code=abc&state=xyz&iss=https%3A%2F%2Fissuer.example.com',
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    expect(mcpService.handleOauthCallback).toHaveBeenCalledWith(
      'abc',
      'xyz',
      'https://issuer.example.com',
    )
    const body = await res.text()
    expect(body).toContain('postMessage')
    expect(body).toContain('"ok":true')
  })

  test('rejects a callback missing code or state', async () => {
    const res = await mcpOauthCallbackRoute.request('/mcp/oauth/callback?code=abc')
    expect(res.status).toBe(400)
    expect(mcpService.handleOauthCallback).not.toHaveBeenCalled()
  })

  test('surfaces callback failures in the HTML page', async () => {
    vi.mocked(mcpService.handleOauthCallback).mockResolvedValue({
      ok: false,
      message: 'Invalid or expired OAuth state',
    })
    const res = await mcpOauthCallbackRoute.request('/mcp/oauth/callback?code=abc&state=bad')
    expect(res.status).toBe(200)
    const body = await res.text()
    expect(body).toContain('"ok":false')
    expect(body).toContain('Invalid or expired OAuth state')
  })

  test('accepts POST callbacks (form-encoded)', async () => {
    vi.mocked(mcpService.handleOauthCallback).mockResolvedValue({ ok: true })
    const res = await mcpOauthCallbackRoute.request('/mcp/oauth/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'code=abc&state=xyz',
    })
    expect(res.status).toBe(200)
    expect(mcpService.handleOauthCallback).toHaveBeenCalledWith('abc', 'xyz', undefined)
  })
})
