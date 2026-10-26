import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { prisma, type User } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { projectService } from '@shumai/core/src/project/project'
import { apiTokenService } from '@shumai/core/src/user/api-token'
import app from './index'

/**
 * End-to-end through the composed API app: API token auth → /api/mcp and /api/ops →
 * runOperation → core services → database. Nothing is mocked.
 */
describe('MCP server and /api/ops (integration)', () => {
  setupTestDbHooks()

  let owner: User
  let ownerToken: string
  let reviewerToken: string
  let teamId: string
  let projectId: string
  let rootFolderId: string
  const clients: Client[] = []

  beforeEach(async () => {
    owner = await prisma.user.create({
      data: { name: 'MCP Owner', email: 'mcp-owner@test.com', password: 'pw' },
    })
    const reviewer = await prisma.user.create({
      data: { name: 'MCP Reviewer', email: 'mcp-reviewer@test.com', password: 'pw' },
    })
    const team = await prisma.team.create({ data: { name: 'MCP Team' } })
    teamId = team.id
    await prisma.teamMember.create({ data: { teamId, userId: owner.id, role: 'owner' } })
    await prisma.teamMember.create({ data: { teamId, userId: reviewer.id, role: 'reviewer' } })
    const project = await projectService.createProject(owner, { teamId, name: 'MCP Project' })
    projectId = project.id
    rootFolderId = project.rootFolder!

    ownerToken = (await apiTokenService.createToken(owner.id, 'mcp')).token
    reviewerToken = (await apiTokenService.createToken(reviewer.id, 'mcp')).token
  })

  afterEach(async () => {
    await Promise.all(clients.splice(0).map((c) => c.close()))
  })

  async function connect(token: string): Promise<Client> {
    const transport = new StreamableHTTPClientTransport(new URL('http://shumai.test/api/mcp'), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
      fetch: async (input, init) => app.request(String(input), init),
    })
    const client = new Client({ name: 'integration-test', version: '1.0.0' })
    await client.connect(transport)
    clients.push(client)
    return client
  }

  it('lets an MCP client find a project and create a folder in it', async () => {
    const client = await connect(ownerToken)

    const projects = await client.callTool({ name: 'list_projects', arguments: {} })
    expect(projects.structuredContent).toEqual({
      data: [{ id: projectId, name: 'MCP Project', teamId, rootFolderId }],
    })

    const created = await client.callTool({
      name: 'create_folder',
      arguments: { parent: rootFolderId, name: 'From MCP' },
    })
    expect(created.isError).toBeFalsy()
    const folderId = (created.structuredContent as { id: string }).id

    const folder = await prisma.asset.findUniqueOrThrow({ where: { id: folderId } })
    expect(folder).toMatchObject({ name: 'From MCP', parentId: rootFolderId, creatorId: owner.id })
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'folder_create', itemId: folderId },
    })
    expect(audit).toMatchObject({ userId: owner.id, teamId, projectId, via: 'mcp' })
  })

  it("enforces the token owner's permissions", async () => {
    const client = await connect(reviewerToken)

    const result = await client.callTool({
      name: 'create_folder',
      arguments: { parent: rootFolderId, name: 'Not allowed' },
    })

    expect(result.isError).toBe(true)
    expect(await prisma.asset.count({ where: { name: 'Not allowed' } })).toBe(0)
  })

  it('rejects MCP requests without a valid token', async () => {
    const initialize = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'x', version: '1' },
      },
    })
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    }

    const missing = await app.request('/api/mcp', { method: 'POST', headers, body: initialize })
    expect(missing.status).toBe(401)
    expect(missing.headers.get('WWW-Authenticate')).toContain('Bearer')

    const invalid = await app.request('/api/mcp', {
      method: 'POST',
      headers: { ...headers, Authorization: 'Bearer shumai_invalid' },
      body: initialize,
    })
    expect(invalid.status).toBe(401)
  })

  it('serves /api/ops for the CLI with via cli', async () => {
    const headers = {
      Authorization: `Bearer ${ownerToken}`,
      'Content-Type': 'application/json',
      'x-shumai-client': 'cli',
    }

    const created = await app.request('/api/ops/create_folder', {
      method: 'POST',
      headers,
      body: JSON.stringify({ parent: rootFolderId, name: 'From CLI' }),
    })
    expect(created.status).toBe(200)
    const { id } = (await created.json()) as { id: string }

    const listed = await app.request('/api/ops/list_assets', {
      method: 'POST',
      headers,
      body: JSON.stringify({ parent: rootFolderId }),
    })
    expect(listed.status).toBe(200)
    const listing = (await listed.json()) as { data: Array<{ id: string }>; total: number }
    expect(listing.data.map((a) => a.id)).toContain(id)

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'folder_create', itemId: id },
    })
    expect(audit.via).toBe('cli')

    const unauthenticated = await app.request('/api/ops/list_projects', { method: 'POST' })
    expect(unauthenticated.status).toBe(401)
  })

  it('leaves session-only MCP management routes behind session auth', async () => {
    const res = await app.request('/api/mcp/servers/some-id', {
      headers: { Authorization: `Bearer ${ownerToken}` },
    })

    expect(res.status).toBe(401)
  })
})
