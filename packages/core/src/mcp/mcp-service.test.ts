import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import '@shumai/db/src/prisma-json-types'
import { McpService } from './mcp-service'
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

const TAVILY_TOOLS: TestMcpToolDef[] = [
  {
    name: 'tavily_search',
    description: 'Search the web for the latest information',
    handler: async () => 'tavily-search-result',
  },
  {
    name: 'tavily_research',
    description: 'Run deep multi-step research',
    handler: async () => 'tavily-research-result',
  },
]

const AIRTABLE_TOOLS: TestMcpToolDef[] = [
  {
    name: 'search_records',
    description: 'Search Airtable records',
    handler: async () => 'AIRTABLE-SECRET-DATA',
  },
  {
    name: 'search_bases',
    description: 'Search Airtable bases',
    handler: async () => 'airtable-bases',
  },
  {
    name: 'search_candidate_linked_records',
    description: 'Search candidate linked records',
    handler: async () => 'airtable-candidates',
  },
]

type ProxyExecute = (
  id: string,
  params: unknown,
) => Promise<{ content: Array<{ type: string; text?: string }> }>

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

  /** Seed an agent with one assigned server (tavily) and one discovered but unassigned server (airtable). */
  async function seedAgentWithUnassignedServer() {
    const agent = await seedAgentAndUser(teamId, 'Leak Guard Agent')
    const tavilySrv = await startTestMcpServer({
      tools: TAVILY_TOOLS,
      serverInfo: { name: 'tavily-mcp' },
    })
    const airtableSrv = await startTestMcpServer({
      tools: AIRTABLE_TOOLS,
      serverInfo: { name: 'airtable-mcp-server' },
    })
    const tavily = await service.createServer(teamId, { url: tavilySrv.url })
    const airtable = await service.createServer(teamId, { url: airtableSrv.url })
    await service.refreshServer(tavily.id)
    await service.refreshServer(airtable.id)
    await prisma.agentMcpServer.create({ data: { agentId: agent.id, mcpServerId: tavily.id } })
    const tools = await service.buildAgentTools(agent.id, teamId)
    return { agent, proxy: tools[0], tavily, airtable, tavilySrv, airtableSrv }
  }

  // --------------------------------------------------------------------------
  // CRUD
  // --------------------------------------------------------------------------

  it('creates, lists, reads and deletes servers (secrets masked)', async () => {
    const created = await service.createServer(teamId, {
      url: srv.url,
      authConfig: { type: 'bearer', bearerToken: 'super-secret' },
    })
    // Name is derived from the URL until the server self-reports on connect.
    expect(created.name).toBe('localhost')
    expect(created.url).toBe(srv.url)
    expect(created.authType).toBe('bearer')
    expect(created.toolCount).toBe(0)
    // Secrets never leak into the DTO.
    expect(JSON.stringify(created)).not.toContain('super-secret')

    const listed = await service.listServers(teamId)
    expect(listed.map((s) => s.name)).toContain('localhost')

    const got = await service.getServer(created.id)
    expect(got?.id).toBe(created.id)

    await service.deleteServer(created.id)
    const after = await service.listServers(teamId)
    expect(after.map((s) => s.name)).not.toContain('localhost')
  })

  it('allows duplicate server names per team (name is auto-derived)', async () => {
    const a = await service.createServer(teamId, { url: srv.url })
    const b = await service.createServer(teamId, { url: srv.url })
    expect(a.name).toBe(b.name)
    expect(a.id).not.toBe(b.id)
  })

  it('derives the name from the URL host when creating', async () => {
    const github = await service.createServer(teamId, { url: 'https://api.github.com/mcp' })
    expect(github.name).toBe('github')

    const example = await service.createServer(teamId, { url: 'https://mcp.example.com/sse' })
    expect(example.name).toBe('example')

    const raw = await service.createServer(teamId, { url: 'not-a-url' })
    expect(raw.name).toBe('mcp-server')
  })

  // --------------------------------------------------------------------------
  // Discovery + tool calls against a real MCP server
  // --------------------------------------------------------------------------

  it('refreshes a real MCP server and persists its tools', async () => {
    const server = await service.createServer(teamId, {
      url: srv.url,
      authConfig: { type: 'none' },
    })

    const refreshed = await service.refreshServer(server.id)
    expect(refreshed.status).toBe('connected')
    expect(refreshed.toolCount).toBe(3)

    const record = await service.getServerRecord(server.id)
    const names = ((record?.tools ?? []) as PrismaJson.McpToolInfo[]).map((t) => t.name).sort()
    expect(names).toEqual(['add', 'echo', 'list_sims'])

    const updated = await service.getServer(server.id)
    expect(updated?.status).toBe('connected')
    expect(updated?.toolCount).toBe(3)
    expect(updated?.lastError).toBeUndefined()
  })

  it('captures the server-reported name (title preferred) and description on discovery', async () => {
    const metaSrv = await startTestMcpServer({
      tools: standardTestTools(),
      serverInfo: {
        name: 'meta-srv',
        title: 'Meta Server',
        description: 'A server with rich metadata',
      },
    })
    try {
      const server = await service.createServer(teamId, { url: metaSrv.url })
      expect(server.name).toBe('localhost') // derived placeholder before discovery

      await service.refreshServer(server.id)

      const updated = await service.getServer(server.id)
      expect(updated?.name).toBe('Meta Server') // title wins over name
      expect(updated?.description).toBe('A server with rich metadata')

      // The display name (title) flows into tool-name prefixes used by the
      // proxy registry, which is warmed from the persisted DB cache.
      const agent = await seedAgentAndUser(teamId, 'Meta Name Agent')
      await prisma.agentMcpServer.create({ data: { agentId: agent.id, mcpServerId: server.id } })
      const agentTools = await service.buildAgentTools(agent.id, teamId)
      const search = await (agentTools[0].execute as ProxyExecute)('meta-1', { search: 'echo' })
      expect(JSON.stringify(search.content)).toContain('Meta_Server_echo')
    } finally {
      await metaSrv.stop()
    }
  })

  it('captures and persists server-reported instructions on discovery', async () => {
    const instSrv = await startTestMcpServer({
      tools: standardTestTools(),
      serverInfo: {
        name: 'inst-srv',
        instructions: 'Do not mutate production data. Always confirm destructive operations.',
      },
    })
    try {
      const server = await service.createServer(teamId, { url: instSrv.url })
      await service.refreshServer(server.id)

      const updated = await service.getServer(server.id)
      expect(updated?.instructions).toBe(
        'Do not mutate production data. Always confirm destructive operations.',
      )
    } finally {
      await instSrv.stop()
    }
  })

  it('clears persisted instructions when a reconnected server stops reporting them', async () => {
    const instSrv = await startTestMcpServer({
      tools: standardTestTools(),
      serverInfo: {
        name: 'clear-srv',
        instructions: 'Temporary guidance that will disappear.',
      },
    })
    try {
      const server = await service.createServer(teamId, { url: instSrv.url })
      await service.refreshServer(server.id)
      expect((await service.getServer(server.id))?.instructions).toBe(
        'Temporary guidance that will disappear.',
      )

      await service.closeAllConnections()
      await instSrv.stop()
      // Same URL, but the server now reports no instructions: the cached
      // value is cleared on the next successful connect.
      const bareSrv = await startTestMcpServer({
        tools: standardTestTools(),
        serverInfo: { name: 'clear-srv' },
        port: instSrv.port,
      })
      try {
        await service.refreshServer(server.id)
        expect((await service.getServer(server.id))?.instructions).toBeUndefined()
      } finally {
        await bareSrv.stop()
      }
    } finally {
      await instSrv.stop()
    }
  })

  it('refreshServer force-reconnects and picks up updated instructions', async () => {
    const instSrv = await startTestMcpServer({
      tools: standardTestTools(),
      serverInfo: { name: 'reload-srv', instructions: 'Old instructions.' },
    })
    try {
      const server = await service.createServer(teamId, { url: instSrv.url })
      await service.refreshServer(server.id)
      expect((await service.getServer(server.id))?.instructions).toBe('Old instructions.')
      expect(service.getConnectionCount(server.id)).toBe(1)

      // The server restarts on the same URL with different instructions: a
      // refresh must force a fresh connection and re-persist the new value.
      await instSrv.stop()
      const reloadedSrv = await startTestMcpServer({
        tools: standardTestTools(),
        serverInfo: { name: 'reload-srv', instructions: 'New instructions.' },
        port: instSrv.port,
      })
      try {
        const refreshed = await service.refreshServer(server.id)
        expect(refreshed.instructions).toBe('New instructions.')
        expect((await service.getServer(server.id))?.instructions).toBe('New instructions.')
      } finally {
        await reloadedSrv.stop()
      }
    } finally {
      await instSrv.stop()
    }
  })

  it('refreshServer re-populates tools that were cleared from the cache', async () => {
    const server = await service.createServer(teamId, { url: srv.url })
    await service.refreshServer(server.id)
    expect((await service.getServer(server.id))?.toolCount).toBe(3)

    // Simulate a cache wipe (e.g. an auth/transport invalidation).
    await prisma.mcpServer.update({
      where: { id: server.id },
      data: { tools: [], status: 'not_connected' },
    })
    expect((await service.getServer(server.id))?.toolCount).toBe(0)

    const refreshed = await service.refreshServer(server.id)
    expect(refreshed.toolCount).toBe(3)
    expect((await service.getServer(server.id))?.toolCount).toBe(3)
  })

  it('surfaces server instructions at all three levels (snippet, preview, full text)', async () => {
    const instructionsText =
      'Never run destructive queries against the production database. Always operate in the ' +
      'read-only sandbox environment by default. Confirm any irreversible operation with the ' +
      'user before executing. Use the internal staging mirror for heavy analytical workloads ' +
      'and keep result sets small to avoid timeouts. Rate limits apply per account, so batch ' +
      'requests conservatively and respect the 429 backoff guidance.'
    const instSrv = await startTestMcpServer({
      tools: standardTestTools(),
      serverInfo: { name: 'inst-srv', instructions: instructionsText },
    })
    try {
      const server = await service.createServer(teamId, { url: instSrv.url })
      await service.refreshServer(server.id)

      const agent = await seedAgentAndUser(teamId, 'Instructions Agent')
      await prisma.agentMcpServer.create({ data: { agentId: agent.id, mcpServerId: server.id } })
      const tools = await service.buildAgentTools(agent.id, teamId)
      const proxy = tools[0]

      // L1: truncated snippet in the proxy tool description (no call needed).
      expect(proxy.description).toContain('Server instructions (truncated')
      expect(proxy.description).toContain('inst-srv:')
      expect(proxy.description).toContain('mcp({ instructions: "name" })')
      expect(proxy.description).not.toContain(instructionsText)

      // L2: longer preview at the end of the server listing + full-text hint.
      const list = await (proxy.execute as ProxyExecute)('list-1', { server: 'inst-srv' })
      const listText = JSON.stringify(list.content)
      expect(listText).toContain('Server instructions:')
      expect(listText).toContain('for the full text')
      expect(listText).not.toContain(instructionsText)

      // L3: full text via the instructions mode.
      const full = await (proxy.execute as ProxyExecute)('inst-1', { instructions: 'inst-srv' })
      const fullText = JSON.stringify(full.content)
      expect(fullText).toContain(instructionsText)
      expect(fullText).toContain('inst-srv instructions:')
    } finally {
      await instSrv.stop()
    }
  })

  it('reports when a server provides no instructions', async () => {
    const agent = await seedAgentAndUser(teamId, 'No Instructions Agent')
    const server = await service.createServer(teamId, { url: srv.url })
    await service.refreshServer(server.id)
    await prisma.agentMcpServer.create({ data: { agentId: agent.id, mcpServerId: server.id } })

    const tools = await service.buildAgentTools(agent.id, teamId)
    const proxy = tools[0]

    // No L1 block, no L2 preview, and L3 says so explicitly.
    expect(proxy.description).not.toContain('Server instructions (truncated')
    const list = await (proxy.execute as ProxyExecute)('list-1', { server: 'test-mcp-server' })
    expect(JSON.stringify(list.content)).not.toContain('Server instructions:')
    const full = await (proxy.execute as ProxyExecute)('inst-1', {
      instructions: 'test-mcp-server',
    })
    expect(JSON.stringify(full.content)).toContain('does not provide instructions')
  })

  it('keeps instructions available without a live connection (DB cache)', async () => {
    const instSrv = await startTestMcpServer({
      tools: standardTestTools(),
      serverInfo: { name: 'cache-srv', instructions: 'Always use the read-only API.' },
    })
    try {
      const server = await service.createServer(teamId, { url: instSrv.url })
      await service.refreshServer(server.id)
      await service.closeAllConnections()
      expect(service.getConnectionCount(server.id)).toBe(0)

      const agent = await seedAgentAndUser(teamId, 'Cache Agent')
      await prisma.agentMcpServer.create({ data: { agentId: agent.id, mcpServerId: server.id } })
      const tools = await service.buildAgentTools(agent.id, teamId)
      const full = await (tools[0].execute as ProxyExecute)('inst-1', {
        instructions: 'cache-srv',
      })
      expect(JSON.stringify(full.content)).toContain('Always use the read-only API.')
    } finally {
      await instSrv.stop()
    }
  })

  it('falls back to the reported name when no title is provided', async () => {
    const server = await service.createServer(teamId, { url: srv.url })
    await service.refreshServer(server.id)
    const updated = await service.getServer(server.id)
    expect(updated?.name).toBe('test-mcp-server')
  })

  it('calls a tool through callMcpTool and returns content', async () => {
    const server = await service.createServer(teamId, {
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
        url: authSrv.url,
        authConfig: { type: 'bearer', bearerToken: 'wrong-token' },
      })
      const result = await service.callMcpTool(wrong.id, 'echo', { text: 'x' }, { teamId })
      expect(result.ok).toBe(false)

      const right = await service.createServer(teamId, {
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
  // URL invalidation
  // --------------------------------------------------------------------------

  it('transport change clears cached tools, credentials and the connection', async () => {
    const server = await service.createServer(teamId, {
      url: srv.url,
      authConfig: { type: 'none' },
    })
    await service.refreshServer(server.id)
    expect((await service.getServer(server.id))?.toolCount).toBe(3)

    // The endpoint URL is immutable; a transport change invalidates the
    // cached tools + connection (and would wipe credentials).
    await service.updateServer(server.id, { transport: 'sse' })

    const updated = await service.getServer(server.id)
    expect(updated?.transport).toBe('sse')
    expect(updated?.toolCount).toBe(0)
    expect(updated?.status).toBe('not_connected')
    expect(service.getConnectionCount(server.id)).toBe(0)
  })

  // --------------------------------------------------------------------------
  // Permission gating (D10)
  // --------------------------------------------------------------------------

  it('denies tool calls below the server permission and allows above it', async () => {
    const server = await service.createServer(teamId, {
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
      url: srv.url,
      permission: 'editor',
    })
    const denied = await service.callMcpTool(server.id, 'echo', { text: 'x' }, { teamId })
    expect(denied.ok).toBe(false)
    expect((denied.content[0] as { text?: string }).text).toContain('User context required')
  })

  it('allows calls without user context at reviewer permission', async () => {
    const server = await service.createServer(teamId, {
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

  it('builds the proxy tool for assigned servers', async () => {
    const agent = await seedAgentAndUser(teamId, 'Proxy Agent')
    const server = await service.createServer(teamId, { url: srv.url })
    await service.refreshServer(server.id)
    await prisma.agentMcpServer.create({ data: { agentId: agent.id, mcpServerId: server.id } })

    const tools = await service.buildAgentTools(agent.id, teamId, undefined)
    expect(tools.length).toBe(1)
    expect(tools[0].name).toBe('mcp')
    expect(tools[0].description).toContain('test-mcp-server')

    // Executing the proxy's call mode hits the real server.
    const result = await (
      tools[0].execute as (
        id: string,
        params: unknown,
      ) => Promise<{ content: Array<{ type: string; text?: string }> }>
    )('call-1', { server: 'test-mcp-server', tool: 'echo', args: { text: 'via-proxy' } })
    expect(JSON.stringify(result.content)).toContain('echo:via-proxy')
  })

  it('only includes assigned servers in the agent tools', async () => {
    const agent = await seedAgentAndUser(teamId, 'Assigned Only Agent')
    const assignedSrv = await startTestMcpServer({
      tools: standardTestTools(),
      serverInfo: { name: 'assigned-srv' },
    })
    const unassignedSrv = await startTestMcpServer({
      tools: standardTestTools(),
      serverInfo: { name: 'unassigned-srv' },
    })
    try {
      const assigned = await service.createServer(teamId, { url: assignedSrv.url })
      const unassigned = await service.createServer(teamId, { url: unassignedSrv.url })
      await service.refreshServer(assigned.id)
      await service.refreshServer(unassigned.id)
      await prisma.agentMcpServer.create({
        data: { agentId: agent.id, mcpServerId: assigned.id },
      })

      const tools = await service.buildAgentTools(agent.id, teamId)
      expect(tools.length).toBe(1)
      expect(tools[0].description).toContain('assigned-srv')
      expect(tools[0].description).not.toContain('unassigned-srv')
    } finally {
      await assignedSrv.stop()
      await unassignedSrv.stop()
    }
  })

  it('does not leak unassigned server tools in "Did you mean" suggestions', async () => {
    const { proxy, tavilySrv, airtableSrv } = await seedAgentWithUnassignedServer()
    try {
      // The agent only has tavily assigned. Asking for a tool that does not
      // exist on tavily must not surface airtable's tool names as suggestions.
      const result = await (proxy.execute as ProxyExecute)('leak-1', {
        server: 'tavily-mcp',
        tool: 'search',
      })
      const text = JSON.stringify(result.content)
      expect(text).toContain('Did you mean')
      expect(text).not.toContain('airtable')
      expect(text).not.toContain('search_records')
    } finally {
      await tavilySrv.stop()
      await airtableSrv.stop()
    }
  })

  it('does not resolve, search or describe tools of unassigned servers', async () => {
    const { proxy, tavilySrv, airtableSrv } = await seedAgentWithUnassignedServer()
    try {
      const execute = proxy.execute as ProxyExecute

      // 1. Direct tool call with the unassigned server's prefixed tool name
      //    (no server param) must not execute airtable's handler.
      const call = await execute('leak-2', { tool: 'airtable_mcp_server_search_records' })
      expect(JSON.stringify(call.content)).not.toContain('AIRTABLE-SECRET-DATA')

      // 2. Search must not surface unassigned server tools.
      const search = await execute('leak-3', { search: 'records' })
      expect(JSON.stringify(search.content)).not.toContain('airtable')

      // 3. Describe must not leak unassigned server tool schemas (the
      //    not-found reply may echo the tool name the model passed, but never
      //    its description or parameter schema).
      const describe = await execute('leak-4', { describe: 'airtable_mcp_server_search_records' })
      const describeText = JSON.stringify(describe.content)
      expect(describeText).toContain('not found')
      expect(describeText).not.toContain('Search Airtable records')
      expect(describeText).not.toContain('Parameters:')
    } finally {
      await tavilySrv.stop()
      await airtableSrv.stop()
    }
  })

  it('drops unassigned servers from a rebuilt agent tool set', async () => {
    const { agent, airtable, tavilySrv, airtableSrv } = await seedAgentWithUnassignedServer()
    try {
      // Assign airtable, then unassign it — a rebuilt tool set must forget it.
      await prisma.agentMcpServer.create({ data: { agentId: agent.id, mcpServerId: airtable.id } })
      let tools = await service.buildAgentTools(agent.id, teamId)
      expect(JSON.stringify(tools[0].description)).toContain('airtable-mcp-server')

      await prisma.agentMcpServer.deleteMany({
        where: { agentId: agent.id, mcpServerId: airtable.id },
      })
      tools = await service.buildAgentTools(agent.id, teamId)
      const search = await (tools[0].execute as ProxyExecute)('leak-5', { search: 'records' })
      expect(JSON.stringify(search.content)).not.toContain('airtable')

      const call = await (tools[0].execute as ProxyExecute)('leak-6', {
        tool: 'airtable_mcp_server_search_records',
      })
      expect(JSON.stringify(call.content)).not.toContain('AIRTABLE-SECRET-DATA')
    } finally {
      await tavilySrv.stop()
      await airtableSrv.stop()
    }
  })

  it('registers direct tools only for assigned servers', async () => {
    const agent = await seedAgentAndUser(teamId, 'Direct Assigned Only Agent')
    const [assignedSrv, unassignedSrv] = await Promise.all([
      startTestMcpServer({
        tools: TAVILY_TOOLS,
        serverInfo: { name: 'tavily-mcp' },
      }),
      startTestMcpServer({
        tools: AIRTABLE_TOOLS,
        serverInfo: { name: 'airtable-mcp-server' },
      }),
    ])
    try {
      const assigned = await service.createServer(teamId, {
        url: assignedSrv.url,
        config: { directTools: ['tavily_search'] },
      })
      const unassigned = await service.createServer(teamId, {
        url: unassignedSrv.url,
        config: { directTools: ['search_records'] },
      })
      await service.refreshServer(assigned.id)
      await service.refreshServer(unassigned.id)
      await prisma.agentMcpServer.create({ data: { agentId: agent.id, mcpServerId: assigned.id } })

      const tools = await service.buildAgentTools(agent.id, teamId)
      const names = tools.map((t) => t.name)
      expect(names).toContain('tavily_mcp_tavily_search')
      expect(names).not.toContain('airtable_mcp_server_search_records')
    } finally {
      await assignedSrv.stop()
      await unassignedSrv.stop()
    }
  }, 15000)

  // --------------------------------------------------------------------------
  // Direct tools (D3/D7)
  // --------------------------------------------------------------------------

  it('registers direct tools for opted-in servers alongside the proxy', async () => {
    const agent = await seedAgentAndUser(teamId, 'Direct Agent')
    const server = await service.createServer(teamId, {
      url: srv.url,
      config: { directTools: ['echo', 'add'] },
    })
    await service.refreshServer(server.id)
    await prisma.agentMcpServer.create({ data: { agentId: agent.id, mcpServerId: server.id } })

    const tools = await service.buildAgentTools(agent.id, teamId)
    expect(tools.length).toBe(3) // proxy + 2 direct tools ('echo', 'add')
    const names = tools.map((t) => t.name)
    expect(names).toContain('mcp')
    expect(names).toContain('test_mcp_server_echo')
    expect(names).toContain('test_mcp_server_add')
    expect(names).not.toContain('test_mcp_server_list_sims') // kept as proxy tool only

    // Dynamic proxy description shows direct summary and remaining proxy count.
    const proxy = tools.find((t) => t.name === 'mcp')!
    expect(proxy.description).toContain(
      'Direct tools available (call as normal tools): test-mcp-server (2)',
    )
    expect(proxy.description).toContain('test-mcp-server (1 tools, status:')

    // Direct tool executes through callMcpTool.
    const echo = tools.find((t) => t.name === 'test_mcp_server_echo')!
    const result = await (
      echo.execute as (
        id: string,
        params: unknown,
      ) => Promise<{ content: Array<{ type: string; text?: string }> }>
    )('call-2', { text: 'direct' })
    expect(JSON.stringify(result.content)).toContain('echo:direct')
  })

  it('applies excludeTools filters to direct tools and the proxy', async () => {
    const agent = await seedAgentAndUser(teamId, 'Filtered Agent')
    const server = await service.createServer(teamId, {
      url: srv.url,
      config: { directTools: ['echo', 'add'], excludeTools: ['add'] },
    })
    await service.refreshServer(server.id)
    await prisma.agentMcpServer.create({ data: { agentId: agent.id, mcpServerId: server.id } })

    const tools = await service.buildAgentTools(agent.id, teamId)
    const names = tools.map((t) => t.name)
    expect(names).toContain('test_mcp_server_echo')
    expect(names).not.toContain('test_mcp_server_add')

    // The excluded tool is also unreachable through the proxy: it is not
    // counted, listed, searched, or callable.
    const proxy = tools.find((t) => t.name === 'mcp')!
    expect(proxy.description).toContain(
      'Direct tools available (call as normal tools): test-mcp-server (1)',
    )
    expect(proxy.description).toContain('test-mcp-server (1 tools, status:')

    const list = await (proxy.execute as ProxyExecute)('excl-list-1', {
      server: 'test-mcp-server',
    })
    expect(JSON.stringify(list.content)).not.toContain('test_mcp_server_add')

    const search = await (proxy.execute as ProxyExecute)('excl-search-1', { search: 'add' })
    expect(JSON.stringify(search.content)).not.toContain('test_mcp_server_add')

    const call = await (proxy.execute as ProxyExecute)('excl-call-1', {
      server: 'test-mcp-server',
      tool: 'add',
      args: { a: 1, b: 2 },
    })
    expect(JSON.stringify(call.content)).toContain('not found')
  })

  it('matches directTools by prefixed name in the proxy description counts', async () => {
    const agent = await seedAgentAndUser(teamId, 'Prefixed Direct Agent')
    const server = await service.createServer(teamId, {
      url: srv.url,
      config: { directTools: ['test_mcp_server_echo'] },
    })
    await service.refreshServer(server.id)
    await prisma.agentMcpServer.create({ data: { agentId: agent.id, mcpServerId: server.id } })

    const tools = await service.buildAgentTools(agent.id, teamId)
    const names = tools.map((t) => t.name)
    expect(names).toContain('test_mcp_server_echo')
    expect(names).not.toContain('test_mcp_server_add')
    expect(names).not.toContain('test_mcp_server_list_sims')

    const proxy = tools.find((t) => t.name === 'mcp')!
    expect(proxy.description).toContain(
      'Direct tools available (call as normal tools): test-mcp-server (1)',
    )
    expect(proxy.description).toContain('test-mcp-server (2 tools, status:')
  })

  // --------------------------------------------------------------------------
  // OAuth status helpers
  // --------------------------------------------------------------------------

  it('reports auth status for each auth type', async () => {
    const none = await service.createServer(teamId, {
      url: srv.url,
      authConfig: { type: 'none' },
    })
    expect(await service.getAuthStatus(none.id)).toBe('authenticated')

    const bearer = await service.createServer(teamId, {
      url: srv.url,
      authConfig: { type: 'bearer', bearerToken: 'x' },
    })
    expect(await service.getAuthStatus(bearer.id)).toBe('authenticated')

    const bearerEmpty = await service.createServer(teamId, {
      url: srv.url,
      authConfig: { type: 'bearer' },
    })
    expect(await service.getAuthStatus(bearerEmpty.id)).toBe('not_authenticated')

    const oauth = await service.createServer(teamId, {
      url: srv.url,
      authConfig: { type: 'oauth' },
    })
    expect(await service.getAuthStatus(oauth.id)).toBe('not_authenticated')
    expect(await service.getAuthStatus(oauth.id)).toBe('not_authenticated')
  })

  it('testServer connects and lists tools', async () => {
    const server = await service.createServer(teamId, { url: srv.url })
    const result = await service.testServer(server.id)
    expect(result.ok).toBe(true)
    expect(result.toolCount).toBe(3)
  })

  // --------------------------------------------------------------------------
  // Proxy disambiguation across two servers (same-named tools)
  // --------------------------------------------------------------------------

  it('disambiguates same-named tools via the server parameter', async () => {
    const toolsA: TestMcpToolDef[] = [
      { name: 'get', description: 'Get from server A', handler: async () => 'A' },
      { name: 'shared', description: 'Shared tool on A', handler: async () => 'from-A' },
    ]
    const toolsB: TestMcpToolDef[] = [
      { name: 'get', description: 'Get from server B', handler: async () => 'B' },
      { name: 'shared', description: 'Shared tool on B', handler: async () => 'from-B' },
    ]
    const srvA = await startTestMcpServer({ tools: toolsA, serverInfo: { name: 'srvA' } })
    const srvB = await startTestMcpServer({ tools: toolsB, serverInfo: { name: 'srvB' } })
    try {
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

      const serverA = await service.createServer(teamId, { url: srvA.url })
      const serverB = await service.createServer(teamId, { url: srvB.url })
      await service.refreshServer(serverA.id)
      await service.refreshServer(serverB.id)
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
    } finally {
      await srvA.stop()
      await srvB.stop()
    }
  })

  describe('Idle connection and in-flight tracking', () => {
    it('tracks in-flight requests and safely prunes idle connections', async () => {
      // Deterministic synchronization with the server-side handler: the handler
      // signals when it starts executing and only then blocks on the release
      // gate. This avoids wall-clock guessing about when the HTTP round trip
      // has reached the server, which is slow and variable on CI.
      let slowToolStarted!: () => void
      const slowToolStartedPromise = new Promise<void>((resolve) => {
        slowToolStarted = resolve
      })
      let releaseSlowTool: () => void = () => {}
      const slowServer = await startTestMcpServer({
        tools: [
          {
            name: 'slow_tool',
            description: 'Slow tool',
            handler: async () => {
              slowToolStarted()
              await new Promise<void>((resolve) => {
                releaseSlowTool = resolve
              })
              return 'slow-done'
            },
          },
        ],
        serverInfo: { name: 'slow-mcp' },
      })

      try {
        const serverRecord = await service.createServer(teamId, {
          url: slowServer.url,
          config: { idleTimeoutMs: 50 },
        })

        // Connect to the server
        await service.refreshServer(serverRecord.id)
        expect(service.getConnectionCount(serverRecord.id)).toBe(1)

        // Start callTool in background
        const callPromise = service.callMcpTool(serverRecord.id, 'slow_tool', {})

        // Wait until the tool handler is actually executing on the server so
        // the request is guaranteed to be in-flight before we assert on it.
        await Promise.race([
          slowToolStartedPromise,
          callPromise.then(() => {
            throw new Error('slow_tool finished before its handler started')
          }),
        ])

        // Connection should NOT be idle while tool is in-flight
        const closedDuringCall = await service.closeIdleConnections(0)
        expect(closedDuringCall).not.toContain(serverRecord.id)
        expect(service.getConnectionCount(serverRecord.id)).toBe(1)

        // Complete tool execution
        releaseSlowTool()
        const toolResult = await callPromise
        expect(toolResult.ok).toBe(true)

        // Wait past idle timeout threshold
        await new Promise((r) => setTimeout(r, 60))

        // Now idle connection should be closed
        const closedAfterIdle = await service.closeIdleConnections(50)
        expect(closedAfterIdle).toContain(serverRecord.id)
        expect(service.getConnectionCount(serverRecord.id)).toBe(0)
      } finally {
        await slowServer.stop()
      }
    }, 10000)

    it('respects keepAlive setting when closing idle connections', async () => {
      const keepAliveServer = await startTestMcpServer({
        tools: standardTestTools(),
        serverInfo: { name: 'keep-alive-mcp' },
      })

      try {
        const serverRecord = await service.createServer(teamId, {
          url: keepAliveServer.url,
          config: { keepAlive: true },
        })

        await service.refreshServer(serverRecord.id)
        expect(service.getConnectionCount(serverRecord.id)).toBe(1)

        // Wait a bit
        await new Promise((r) => setTimeout(r, 20))

        // Should not close server marked with keepAlive even with 0 timeout
        const closed = await service.closeIdleConnections(0)
        expect(closed).not.toContain(serverRecord.id)
        expect(service.getConnectionCount(serverRecord.id)).toBe(1)
      } finally {
        await keepAliveServer.stop()
      }
    })

    it('can run periodic idle cleanup background timer', async () => {
      const timerServer = await startTestMcpServer({
        tools: standardTestTools(),
        serverInfo: { name: 'timer-mcp' },
      })

      try {
        const serverRecord = await service.createServer(teamId, {
          url: timerServer.url,
        })
        await service.refreshServer(serverRecord.id)
        expect(service.getConnectionCount(serverRecord.id)).toBe(1)

        // Start timer with very short interval (20ms) and 0ms idle timeout
        service.startIdleCleanupTimer(20, 0)

        // Wait for timer tick
        await new Promise((r) => setTimeout(r, 60))

        expect(service.getConnectionCount(serverRecord.id)).toBe(0)
      } finally {
        service.stopIdleCleanupTimer()
        await timerServer.stop()
      }
    })
  })
})
