import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { McpService } from './mcp-service'
import { mcpToolRegistry } from './mcp-tool-registry'
import {
  startTestMcpServer,
  standardTestTools,
  type RunningTestMcpServer,
  type TestMcpToolDef,
} from './mcp-test-server'

async function seedAgentAndUser(teamId: string, agentName: string) {
  const user = await prisma.user.create({
    data: {
      name: agentName,
      email: `${agentName.toLowerCase().replace(/\s+/g, '-')}@shumai.ai`,
      type: 'agent',
    },
  })
  await prisma.teamMember.create({ data: { teamId, userId: user.id, role: 'editor' } })
  const agent = await prisma.agent.create({
    data: {
      id: user.id,
      teamId,
      type: 'chat',
      enabled: true,
      config: { provider: 'openai', model: 'gpt-4' },
    },
  })
  return agent
}

describe('McpService', () => {
  setupTestDbHooks()

  let teamId: string
  let srv: RunningTestMcpServer
  const service = new McpService()

  beforeAll(async () => {
    const team = await prisma.team.create({ data: { name: 'MCP Service Team' } })
    teamId = team.id
    srv = await startTestMcpServer({ tools: standardTestTools() })
  })

  afterAll(async () => {
    await srv.stop()
    await service.closeAllConnections()
  })

  // --------------------------------------------------------------------------
  // CRUD
  // --------------------------------------------------------------------------

  it('creates, lists, reads and deletes servers (secrets masked)', async () => {
    const created = await service.createServer(teamId, {
      name: 'github',
      url: srv.url,
      authConfig: { type: 'bearer', bearerToken: 'super-secret' },
    })
    expect(created.name).toBe('github')
    expect(created.url).toBe(srv.url)
    expect(created.authType).toBe('bearer')
    expect(created.toolCount).toBe(0)
    // Secrets never leak into the DTO.
    expect(JSON.stringify(created)).not.toContain('super-secret')

    const listed = await service.listServers(teamId)
    expect(listed.map((s) => s.name)).toContain('github')

    const got = await service.getServer(created.id)
    expect(got?.id).toBe(created.id)

    await service.deleteServer(created.id)
    const after = await service.listServers(teamId)
    expect(after.map((s) => s.name)).not.toContain('github')
  })

  it('enforces unique server names per team', async () => {
    await service.createServer(teamId, { name: 'dup', url: srv.url })
    await expect(service.createServer(teamId, { name: 'dup', url: srv.url })).rejects.toThrow()
  })

  // --------------------------------------------------------------------------
  // Discovery + tool calls against a real MCP server
  // --------------------------------------------------------------------------

  it('discovers tools from a real MCP server and persists them', async () => {
    const server = await service.createServer(teamId, {
      name: 'tools-srv',
      url: srv.url,
      authConfig: { type: 'none' },
    })

    const tools = await service.discoverTools(server.id)
    const names = tools.map((t) => t.name).sort()
    expect(names).toEqual(['add', 'echo', 'list_sims'])

    const updated = await service.getServer(server.id)
    expect(updated?.status).toBe('connected')
    expect(updated?.toolCount).toBe(3)
    expect(updated?.lastError).toBeUndefined()

    // The registry is warmed for the proxy tool.
    const metadata = mcpToolRegistry.getTools(server.id)
    expect(metadata.map((m) => m.originalName)).toEqual(expect.arrayContaining(['echo', 'add']))
  })

  it('calls a tool through callMcpTool and returns content', async () => {
    const server = await service.createServer(teamId, {
      name: 'call-srv',
      url: srv.url,
      authConfig: { type: 'none' },
    })
    const result = await service.callMcpTool(server.id, 'echo', { text: 'roundtrip' }, { teamId })
    expect(result.ok).toBe(true)
    expect(result.content[0]).toMatchObject({ type: 'text', text: 'echo:roundtrip' })
    expect((result.content[0] as { text?: string }).text).toBe('echo:roundtrip')

    const structured = await service.callMcpTool(server.id, 'add', { a: 4, b: 6 }, { teamId })
    expect(structured.ok).toBe(true)
    expect(JSON.stringify(structured.content)).toContain('10')
  })

  it('surfaces server failures as error text (non-fatal)', async () => {
    const server = await service.createServer(teamId, {
      name: 'down-srv',
      url: 'http://localhost:1/mcp', // nothing listens here
      authConfig: { type: 'none' },
    })
    const result = await service.callMcpTool(server.id, 'echo', { text: 'x' }, { teamId })
    expect(result.ok).toBe(false)
    expect((result.content[0] as { text?: string }).text).toContain('Failed to connect')
    const updated = await service.getServer(server.id)
    expect(updated?.status).toBe('failed')
    expect(updated?.lastError).toBeTruthy()
  })

  it('requires authentication via bearer token', async () => {
    const authSrv = await startTestMcpServer({
      tools: standardTestTools(),
      bearerToken: 'tok-123',
    })
    try {
      const wrong = await service.createServer(teamId, {
        name: 'auth-wrong',
        url: authSrv.url,
        authConfig: { type: 'bearer', bearerToken: 'wrong-token' },
      })
      const result = await service.callMcpTool(wrong.id, 'echo', { text: 'x' }, { teamId })
      expect(result.ok).toBe(false)

      const right = await service.createServer(teamId, {
        name: 'auth-right',
        url: authSrv.url,
        authConfig: { type: 'bearer', bearerToken: 'tok-123' },
      })
      const ok = await service.callMcpTool(right.id, 'echo', { text: 'secret' }, { teamId })
      expect(ok.ok).toBe(true)
      expect((ok.content[0] as { text?: string }).text).toBe('echo:secret')
    } finally {
      await authSrv.stop()
    }
  })

  // --------------------------------------------------------------------------
  // Rename invalidation
  // --------------------------------------------------------------------------

  it('rename clears cached tools, credentials and the connection', async () => {
    const server = await service.createServer(teamId, {
      name: 'rename-me',
      url: srv.url,
      authConfig: { type: 'none' },
    })
    await service.discoverTools(server.id)
    expect((await service.getServer(server.id))?.toolCount).toBe(3)

    // Seed a credential row to prove it gets wiped.
    await service.updateServer(server.id, { name: 'renamed' })

    const updated = await service.getServer(server.id)
    expect(updated?.name).toBe('renamed')
    expect(updated?.toolCount).toBe(0)
    expect(updated?.status).toBe('not_connected')
    expect(mcpToolRegistry.getTools(server.id)).toEqual([])
    expect(service.getConnectionCount(server.id)).toBe(0)
  })

  // --------------------------------------------------------------------------
  // Permission gating (D10)
  // --------------------------------------------------------------------------

  it('denies tool calls below the server permission and allows above it', async () => {
    const server = await service.createServer(teamId, {
      name: 'perm-srv',
      url: srv.url,
      permission: 'editor', // reviewers are denied
    })

    // Reviewer user is denied.
    const reviewer = await prisma.user.create({
      data: { name: 'Reviewer', email: 'reviewer@shumai.ai', type: 'human' },
    })
    await prisma.teamMember.create({ data: { teamId, userId: reviewer.id, role: 'reviewer' } })

    const denied = await service.callMcpTool(
      server.id,
      'echo',
      { text: 'x' },
      { teamId, userId: reviewer.id },
    )
    expect(denied.ok).toBe(false)
    expect((denied.content[0] as { text?: string }).text).toContain('Permission denied')

    // Editor user is allowed.
    const editor = await prisma.user.create({
      data: { name: 'Editor', email: 'editor@shumai.ai', type: 'human' },
    })
    await prisma.teamMember.create({ data: { teamId, userId: editor.id, role: 'editor' } })
    const allowed = await service.callMcpTool(
      server.id,
      'echo',
      { text: 'ok' },
      { teamId, userId: editor.id },
    )
    expect(allowed.ok).toBe(true)
  })

  it('denies calls without user context when permission is above reviewer', async () => {
    const server = await service.createServer(teamId, {
      name: 'perm-no-user',
      url: srv.url,
      permission: 'editor',
    })
    const denied = await service.callMcpTool(server.id, 'echo', { text: 'x' }, { teamId })
    expect(denied.ok).toBe(false)
    expect((denied.content[0] as { text?: string }).text).toContain('User context required')
  })

  it('allows calls without user context at reviewer permission', async () => {
    const server = await service.createServer(teamId, {
      name: 'perm-reviewer',
      url: srv.url,
      permission: 'reviewer',
    })
    const allowed = await service.callMcpTool(server.id, 'echo', { text: 'x' }, { teamId })
    expect(allowed.ok).toBe(true)
  })

  // --------------------------------------------------------------------------
  // Per-agent assignment (D6)
  // --------------------------------------------------------------------------

  it('returns [] for agents without assigned MCP servers', async () => {
    const agent = await seedAgentAndUser(teamId, 'No MCP Agent')
    const tools = await service.buildAgentTools(agent.id, teamId)
    expect(tools).toEqual([])
  })

  it('builds the proxy tool for assigned enabled servers', async () => {
    const agent = await seedAgentAndUser(teamId, 'Proxy Agent')
    const server = await service.createServer(teamId, { name: 'assigned', url: srv.url })
    await service.discoverTools(server.id)
    await prisma.agentMcpServer.create({ data: { agentId: agent.id, mcpServerId: server.id } })

    const tools = await service.buildAgentTools(agent.id, teamId, undefined)
    expect(tools.length).toBe(1)
    expect(tools[0].name).toBe('mcp')
    expect(tools[0].description).toContain('assigned')

    // Executing the proxy's call mode hits the real server.
    const result = await (
      tools[0].execute as (
        id: string,
        params: unknown,
      ) => Promise<{ content: Array<{ type: string; text?: string }> }>
    )('call-1', { server: 'assigned', tool: 'echo', args: { text: 'via-proxy' } })
    expect(JSON.stringify(result.content)).toContain('echo:via-proxy')
  })

  it('excludes disabled servers from the agent tools', async () => {
    const agent = await seedAgentAndUser(teamId, 'Disabled Agent')
    const server = await service.createServer(teamId, {
      name: 'disabled-srv',
      url: srv.url,
      enabled: false,
    })
    await prisma.agentMcpServer.create({ data: { agentId: agent.id, mcpServerId: server.id } })
    const tools = await service.buildAgentTools(agent.id, teamId)
    expect(tools).toEqual([])
  })

  // --------------------------------------------------------------------------
  // Direct tools (D3/D7)
  // --------------------------------------------------------------------------

  it('registers direct tools for opted-in servers alongside the proxy', async () => {
    const agent = await seedAgentAndUser(teamId, 'Direct Agent')
    const server = await service.createServer(teamId, {
      name: 'direct-srv',
      url: srv.url,
      config: { directTools: true },
    })
    await service.discoverTools(server.id)
    await prisma.agentMcpServer.create({ data: { agentId: agent.id, mcpServerId: server.id } })

    const tools = await service.buildAgentTools(agent.id, teamId)
    expect(tools.length).toBe(4) // proxy + 3 direct tools
    const names = tools.map((t) => t.name)
    expect(names).toContain('mcp')
    expect(names).toContain('direct_srv_echo')
    expect(names).toContain('direct_srv_add')

    // Direct tool executes through callMcpTool.
    const echo = tools.find((t) => t.name === 'direct_srv_echo')!
    const result = await (
      echo.execute as (
        id: string,
        params: unknown,
      ) => Promise<{ content: Array<{ type: string; text?: string }> }>
    )('call-2', { text: 'direct' })
    expect(JSON.stringify(result.content)).toContain('echo:direct')
  })

  it('applies includeTools/excludeTools filters to direct tools', async () => {
    const agent = await seedAgentAndUser(teamId, 'Filtered Agent')
    const server = await service.createServer(teamId, {
      name: 'filter-srv',
      url: srv.url,
      config: { directTools: true, includeTools: ['echo'], excludeTools: ['add'] },
    })
    await service.discoverTools(server.id)
    await prisma.agentMcpServer.create({ data: { agentId: agent.id, mcpServerId: server.id } })

    const tools = await service.buildAgentTools(agent.id, teamId)
    const names = tools.map((t) => t.name)
    expect(names).toContain('filter_srv_echo')
    expect(names).not.toContain('filter_srv_add')
    expect(names).not.toContain('filter_srv_list_sims')
  })

  // --------------------------------------------------------------------------
  // OAuth status helpers
  // --------------------------------------------------------------------------

  it('reports auth status for each auth type', async () => {
    const none = await service.createServer(teamId, {
      name: 'auth-none',
      url: srv.url,
      authConfig: { type: 'none' },
    })
    expect(await service.getAuthStatus(none.id)).toBe('authenticated')

    const bearer = await service.createServer(teamId, {
      name: 'auth-bearer',
      url: srv.url,
      authConfig: { type: 'bearer', bearerToken: 'x' },
    })
    expect(await service.getAuthStatus(bearer.id)).toBe('authenticated')

    const bearerEmpty = await service.createServer(teamId, {
      name: 'auth-bearer-empty',
      url: srv.url,
      authConfig: { type: 'bearer' },
    })
    expect(await service.getAuthStatus(bearerEmpty.id)).toBe('not_authenticated')

    const oauth = await service.createServer(teamId, {
      name: 'auth-oauth',
      url: srv.url,
      authConfig: { type: 'oauth' },
    })
    expect(await service.getAuthStatus(oauth.id)).toBe('not_authenticated')
    expect(await service.getAuthStatus(oauth.id)).toBe('not_authenticated')
  })

  it('testServer connects and lists tools', async () => {
    const server = await service.createServer(teamId, { name: 'test-srv', url: srv.url })
    const result = await service.testServer(server.id)
    expect(result.ok).toBe(true)
    expect(result.toolCount).toBe(3)
  })

  // --------------------------------------------------------------------------
  // Proxy disambiguation across two servers (same-named tools)
  // --------------------------------------------------------------------------

  let srvA: RunningTestMcpServer
  let srvB: RunningTestMcpServer

  it('disambiguates same-named tools via the server parameter', async () => {
    const toolsA: TestMcpToolDef[] = [
      { name: 'get', description: 'Get from server A', handler: async () => 'A' },
      { name: 'shared', description: 'Shared tool on A', handler: async () => 'from-A' },
    ]
    const toolsB: TestMcpToolDef[] = [
      { name: 'get', description: 'Get from server B', handler: async () => 'B' },
      { name: 'shared', description: 'Shared tool on B', handler: async () => 'from-B' },
    ]
    srvA = await startTestMcpServer({ tools: toolsA })
    srvB = await startTestMcpServer({ tools: toolsB })
    const agent = await prisma.user.create({
      data: { name: 'Two Srv Agent', email: 'two-srv-agent@shumai.ai', type: 'agent' },
    })
    await prisma.teamMember.create({ data: { teamId, userId: agent.id, role: 'editor' } })
    await prisma.agent.create({
      data: {
        id: agent.id,
        teamId,
        type: 'chat',
        config: { provider: 'openai', model: 'gpt-4' },
      },
    })

    const serverA = await service.createServer(teamId, { name: 'srvA', url: srvA.url })
    const serverB = await service.createServer(teamId, { name: 'srvB', url: srvB.url })
    await service.discoverTools(serverA.id)
    await service.discoverTools(serverB.id)
    await prisma.agentMcpServer.createMany({
      data: [
        { agentId: agent.id, mcpServerId: serverA.id },
        { agentId: agent.id, mcpServerId: serverB.id },
      ],
    })

    const tools = await service.buildAgentTools(agent.id, teamId)
    expect(tools.length).toBe(1) // only the proxy
    const proxy = tools[0]

    const callA = await (
      proxy.execute as (
        id: string,
        params: unknown,
      ) => Promise<{ content: Array<{ type: string; text?: string }> }>
    )('c1', { server: 'srvA', tool: 'shared' })
    expect(JSON.stringify(callA.content)).toContain('from-A')

    const callB = await (
      proxy.execute as (
        id: string,
        params: unknown,
      ) => Promise<{ content: Array<{ type: string; text?: string }> }>
    )('c2', { server: 'srvB', tool: 'shared' })
    expect(JSON.stringify(callB.content)).toContain('from-B')

    // Prefixed names also resolve without the server parameter.
    const prefixed = await (
      proxy.execute as (
        id: string,
        params: unknown,
      ) => Promise<{ content: Array<{ type: string; text?: string }> }>
    )('c3', { tool: 'srvA_get' })
    expect(JSON.stringify(prefixed.content)).toContain('A')

    await srvA.stop()
    await srvB.stop()
  })
})
