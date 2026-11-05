import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { prisma, type User } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { apiTokenService } from '@shumai/core/src/user/api-token'
import { projectService } from '@shumai/core/src/project/project'

describe('MCP server on remote HTTP BETTER_AUTH_URL', () => {
  setupTestDbHooks()

  const originalEnv = process.env.BETTER_AUTH_URL
  let user: User
  let token: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: Hono<any>
  let isMcpOauthEnabled: boolean

  beforeAll(async () => {
    process.env.BETTER_AUTH_URL = 'http://43.133.100.178:3000'
    vi.resetModules()

    const authModule = await import('@shumai/core/src/auth/auth')
    isMcpOauthEnabled = authModule.isMcpOauthEnabled
    const mcpServerModule = await import('./mcp-server')

    app = new Hono().route('/', mcpServerModule.default)

    user = await prisma.user.create({
      data: { name: 'Remote HTTP User', email: `remote-http-${Date.now()}@test.com` },
    })
    const team = await prisma.team.create({ data: { name: 'Remote HTTP Team' } })
    await prisma.teamMember.create({ data: { teamId: team.id, userId: user.id, role: 'owner' } })
    await projectService.createProject(user, { teamId: team.id, name: 'Remote HTTP Project' })

    const tokenRes = await apiTokenService.createToken(user.id, 'remote-http-test')
    token = tokenRes.token
  })

  afterAll(() => {
    if (originalEnv !== undefined) {
      process.env.BETTER_AUTH_URL = originalEnv
    } else {
      delete process.env.BETTER_AUTH_URL
    }
    vi.resetModules()
  })

  it('omits MCP OAuth plugin and disables isMcpOauthEnabled', () => {
    expect(isMcpOauthEnabled).toBe(false)
  })

  it('returns 503 Service Unavailable for unauthenticated requests to /mcp', async () => {
    const res = await app.request('/mcp', { method: 'POST' })
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body).toMatchObject({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: expect.stringContaining(
          'MCP OAuth 2.1 is disabled on this server because BETTER_AUTH_URL is not HTTPS',
        ),
      },
      id: null,
    })
  })

  it('allows valid API tokens to access /mcp and execute tools even when OAuth is disabled', async () => {
    const transport = new StreamableHTTPClientTransport(new URL('http://localhost/mcp'), {
      fetch: async (input, init) => {
        const headers = new Headers(init?.headers)
        headers.set('Authorization', `Bearer ${token}`)
        return app.request(String(input), {
          ...init,
          headers,
        })
      },
    })
    const client = new Client({ name: 'remote-http-client', version: '1.0.0' })
    await client.connect(transport)

    expect(client.getServerVersion()).toMatchObject({ name: 'shumai' })
    const { tools } = await client.listTools()
    expect(tools.length).toBeGreaterThan(0)
    expect(tools.map((t) => t.name)).toContain('list_projects')

    await client.close()
  })

  it('rejects invalid API tokens with 401 Unauthorized', async () => {
    const res = await app.request('/mcp', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer shumai_invalidtoken1234567890',
      },
    })
    expect(res.status).toBe(401)
  })
})
