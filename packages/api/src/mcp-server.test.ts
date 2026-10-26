import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { teamService } from '@shumai/core/src/team/team'
import { createFolderOp, runOperation } from '@shumai/core/src/operations'
import mcpServerRoute, { MCP_SERVER_INSTRUCTIONS } from './mcp-server'

vi.mock('@shumai/core/src/operations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shumai/core/src/operations')>()),
  runOperation: vi.fn(),
}))

const app = new Hono<{ Variables: { user: { id: string } } }>()
  .use('*', async (c, next) => {
    c.set('user', { id: 'user1' })
    await next()
  })
  .route('/', mcpServerRoute)

/** Connects the real MCP client to the Hono route without opening a port. */
async function connect(): Promise<Client> {
  const transport = new StreamableHTTPClientTransport(new URL('http://shumai.test/mcp'), {
    fetch: async (input, init) => app.request(String(input), init),
  })
  const client = new Client({ name: 'mcp-server-test', version: '1.0.0' })
  await client.connect(transport)
  return client
}

describe('MCP server', () => {
  let client: Client

  beforeEach(async () => {
    vi.mocked(runOperation).mockReset()
    client = await connect()
  })

  afterEach(async () => {
    await client.close()
    vi.restoreAllMocks()
    delete process.env.SHUMAI_DEMO_MODE
  })

  it('identifies itself and shares usage instructions', () => {
    expect(client.getServerVersion()).toMatchObject({ name: 'shumai', title: 'Shumai' })
    expect(client.getInstructions()).toBe(MCP_SERVER_INSTRUCTIONS)
  })

  it('lists every mcp-surface Operation with schemas and annotations', async () => {
    const { tools } = await client.listTools()

    expect(tools.map((t) => t.name).sort()).toEqual([
      'create_folder',
      'delete_asset',
      'list_assets',
      'list_projects',
      'move_assets',
      'rename_asset',
    ])

    const createFolder = tools.find((t) => t.name === 'create_folder')!
    expect(createFolder.title).toBe('Create Folder')
    expect(createFolder.inputSchema).toMatchObject({
      type: 'object',
      properties: { parent: { type: 'string' }, name: { type: 'string' } },
      required: ['parent', 'name'],
    })
    expect(createFolder.outputSchema).toMatchObject({
      type: 'object',
      properties: { id: { type: 'string' } },
    })
    expect(createFolder.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    })

    const annotations = (name: string) => tools.find((t) => t.name === name)!.annotations
    expect(annotations('delete_asset')).toMatchObject({ destructiveHint: true })
    expect(annotations('list_assets')).toMatchObject({ readOnlyHint: true, idempotentHint: true })
  })

  it('does not expose agent-only capabilities', async () => {
    const names = (await client.listTools()).tools.map((t) => t.name)
    for (const agentOnly of ['bash', 'read_skill', 'read_asset', 'download_asset', 'mcp']) {
      expect(names).not.toContain(agentOnly)
    }
  })

  it('runs the Operation for the authenticated user with via mcp', async () => {
    const output = { id: 'f1', name: 'Renders', type: 'folder', size: 0, projectId: 'p1' }
    vi.mocked(runOperation).mockResolvedValue(output)

    const result = await client.callTool({
      name: 'create_folder',
      arguments: { parent: 'root', name: 'Renders' },
    })

    expect(runOperation).toHaveBeenCalledWith(
      createFolderOp,
      { userId: 'user1', via: 'mcp' },
      { parent: 'root', name: 'Renders' },
    )
    expect(result.isError).toBeFalsy()
    expect(result.structuredContent).toEqual(output)
    expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(output) }])
  })

  it('reports Operation failures as tool errors', async () => {
    vi.mocked(runOperation).mockRejectedValue(
      new HTTPException(403, { message: 'User is not a member of the team' }),
    )

    const result = await client.callTool({
      name: 'create_folder',
      arguments: { parent: 'root', name: 'Renders' },
    })

    expect(result.isError).toBe(true)
    expect(result.content).toEqual([{ type: 'text', text: 'User is not a member of the team' }])
  })

  it('rejects arguments that do not match the input schema before running', async () => {
    const result = await client.callTool({ name: 'create_folder', arguments: { parent: 'root' } })

    expect(result.isError).toBe(true)
    expect(runOperation).not.toHaveBeenCalled()
  })

  it('blocks data changes for read-only users in demo mode', async () => {
    process.env.SHUMAI_DEMO_MODE = '1'
    vi.spyOn(teamService, 'hasWritableRoleInAnyTeam').mockResolvedValue(false)

    const result = await client.callTool({
      name: 'create_folder',
      arguments: { parent: 'root', name: 'Renders' },
    })

    expect(result.isError).toBe(true)
    expect(result.content).toEqual([{ type: 'text', text: 'System is in read-only mode' }])
    expect(runOperation).not.toHaveBeenCalled()
  })
})
