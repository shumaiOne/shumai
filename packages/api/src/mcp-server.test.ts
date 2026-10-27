import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { teamService } from '@shumai/core/src/team/team'
import { s3Service } from '@shumai/core/src/s3/s3'
import { createFolderOp, readAssetOp, runOperation } from '@shumai/core/src/operations'
import { MAX_INLINE_IMAGE_BYTES, MAX_INLINE_IMAGES } from './mcp-extensions/read-asset'
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
      'complete_upload',
      'copy_assets',
      'create_comment',
      'create_file',
      'create_folder',
      'create_version',
      'create_version_stack',
      'delete_asset',
      'download_asset',
      'get_asset_render',
      'get_folder_instructions',
      'list_assets',
      'list_comments',
      'list_metadata_fields',
      'list_projects',
      'list_versions',
      'move_assets',
      'read_asset',
      'remove_version',
      'rename_asset',
      'resolve_comment',
      'search_assets',
      'update_asset_metadata',
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

  it('advertises input schemas without nullable types', async () => {
    // Nullable types don't translate to every client's tool format (e.g. Gemini's)
    for (const tool of (await client.listTools()).tools) {
      const schema = JSON.stringify(tool.inputSchema)
      expect(schema, tool.name).not.toMatch(/"type":\[/)
      expect(schema, tool.name).not.toContain('"type":"null"')
    }
  })

  it('treats null optional arguments as omitted, including nested ones', async () => {
    vi.mocked(runOperation).mockResolvedValue({
      status: 'pending',
      summary: 'Rendering is still in progress for "deck.pdf".',
      asset: { id: 'doc-1', name: 'deck.pdf', kind: 'document', mediaType: 'application/pdf' },
      details: [],
      images: [],
      taskId: 'task-1',
      retryAfterSeconds: 5,
    })

    const result = await client.callTool({
      name: 'read_asset',
      arguments: {
        assetId: 'doc-1',
        annotationId: null,
        videoConfig: null,
        docConfig: { mode: 'pages', startPage: 1, endPage: null },
        inlineImages: null,
      },
    })

    expect(result.isError).toBeFalsy()
    expect(runOperation).toHaveBeenCalledWith(
      readAssetOp,
      { userId: 'user1', via: 'mcp' },
      { assetId: 'doc-1', docConfig: { mode: 'pages', startPage: 1 } },
    )
  })

  it('still rejects null for required arguments', async () => {
    const result = await client.callTool({
      name: 'create_folder',
      arguments: { parent: null, name: 'Renders' },
    })

    expect(result.isError).toBe(true)
    expect(runOperation).not.toHaveBeenCalled()
  })

  it('does not expose agent-only capabilities', async () => {
    const names = (await client.listTools()).tools.map((t) => t.name)
    for (const agentOnly of ['bash', 'read_skill', 'mcp']) {
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

  describe('read_asset', () => {
    const frame = (n: number) => ({
      label: `Frame at ${n}s`,
      mimeType: 'image/webp',
      url: `https://files.example/${n}.webp`,
      key: `shots/${n}.webp`,
    })
    const ready = (count: number) => ({
      status: 'ready',
      summary: `Extracted ${count} frame(s) from "clip.mp4" (0s - 10s):`,
      asset: { id: 'vid-1', name: 'clip.mp4', kind: 'video', mediaType: 'video/mp4' },
      details: [],
      images: Array.from({ length: count }, (_, i) => frame(i)),
    })

    beforeEach(() => {
      vi.spyOn(s3Service, 'getObjectSize').mockResolvedValue(1000)
      vi.spyOn(s3Service, 'getObject').mockImplementation(async (_bucket, key) => ({
        buffer: Buffer.from(`bytes of ${key}`),
        contentType: 'image/webp',
      }))
    })

    it('advertises inlineImages and keeps it out of the Operation input', async () => {
      const { tools } = await client.listTools()
      const read = tools.find((t) => t.name === 'read_asset')!
      expect(read.inputSchema.properties).toHaveProperty('inlineImages')
      expect(read.inputSchema.properties).toHaveProperty('videoConfig')
      expect(read.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false })
      expect(
        tools.find((t) => t.name === 'get_asset_render')!.inputSchema.properties,
      ).toHaveProperty('inlineImages')

      vi.mocked(runOperation).mockResolvedValue(ready(1))
      await client.callTool({
        name: 'read_asset',
        arguments: {
          assetId: 'vid-1',
          videoConfig: { start: 0, end: 10, count: 1 },
          inlineImages: true,
        },
      })
      expect(runOperation).toHaveBeenCalledWith(
        readAssetOp,
        { userId: 'user1', via: 'mcp' },
        { assetId: 'vid-1', videoConfig: { start: 0, end: 10, count: 1 } },
      )
    })

    it('attaches images inline and returns links without storage keys', async () => {
      vi.mocked(runOperation).mockResolvedValue(ready(2))

      const result = await client.callTool({ name: 'read_asset', arguments: { assetId: 'vid-1' } })

      expect(result.isError).toBeFalsy()
      expect(result.content).toEqual([
        {
          type: 'text',
          text: [
            'Extracted 2 frame(s) from "clip.mp4" (0s - 10s):',
            '- Frame at 0s (attached as image 1): https://files.example/0.webp',
            '- Frame at 1s (attached as image 2): https://files.example/1.webp',
            'Image links expire in about an hour.',
          ].join('\n'),
        },
        {
          type: 'image',
          data: Buffer.from('bytes of shots/0.webp').toString('base64'),
          mimeType: 'image/webp',
        },
        {
          type: 'image',
          data: Buffer.from('bytes of shots/1.webp').toString('base64'),
          mimeType: 'image/webp',
        },
      ])
      expect(result.structuredContent).toEqual({
        ...ready(2),
        images: [0, 1].map((n) => ({
          label: `Frame at ${n}s`,
          mimeType: 'image/webp',
          url: `https://files.example/${n}.webp`,
        })),
      })
      expect(JSON.stringify(result)).not.toContain('shots/0.webp"')
    })

    it(`attaches at most ${MAX_INLINE_IMAGES} images and skips large ones`, async () => {
      vi.mocked(runOperation).mockResolvedValue(ready(10))
      vi.mocked(s3Service.getObjectSize).mockImplementation(async (_bucket, key) =>
        key === 'shots/2.webp' ? MAX_INLINE_IMAGE_BYTES + 1 : 1000,
      )

      const result = await client.callTool({ name: 'read_asset', arguments: { assetId: 'vid-1' } })

      const content = result.content as Array<{ type: string; text?: string }>
      expect(content.filter((c) => c.type === 'image')).toHaveLength(MAX_INLINE_IMAGES - 1)
      const text = content[0].text!
      expect(text).toContain(
        '- Frame at 2s (not attached: larger than 2 MB): https://files.example/2.webp',
      )
      expect(text).toContain(
        `- Frame at 8s (not attached: only the first ${MAX_INLINE_IMAGES} images are attached)`,
      )
      expect(s3Service.getObject).not.toHaveBeenCalledWith(expect.anything(), 'shots/2.webp')
      expect(s3Service.getObject).not.toHaveBeenCalledWith(expect.anything(), 'shots/8.webp')
    })

    it('returns links only with inlineImages false', async () => {
      vi.mocked(runOperation).mockResolvedValue(ready(2))

      const result = await client.callTool({
        name: 'read_asset',
        arguments: { assetId: 'vid-1', inlineImages: false },
      })

      expect(result.content).toEqual([
        {
          type: 'text',
          text: [
            'Extracted 2 frame(s) from "clip.mp4" (0s - 10s):',
            '- Frame at 0s: https://files.example/0.webp',
            '- Frame at 1s: https://files.example/1.webp',
            'Image links expire in about an hour.',
          ].join('\n'),
        },
      ])
      expect(s3Service.getObject).not.toHaveBeenCalled()
    })

    it('includes text content without the source storage key', async () => {
      vi.mocked(runOperation).mockResolvedValue({
        ...ready(0),
        summary: 'Document "notes.md" (ID: d-1):',
        text: {
          content: '# Notes',
          truncated: false,
          size: 7,
          mimeType: 'text/markdown',
          key: 'raw/notes.md',
          url: 'https://files.example/notes.md?download',
        },
      })

      const result = await client.callTool({ name: 'read_asset', arguments: { assetId: 'd-1' } })

      expect(result.content).toEqual([
        { type: 'text', text: 'Document "notes.md" (ID: d-1):\n\n# Notes' },
      ])
      expect(result.structuredContent).toMatchObject({
        text: { content: '# Notes', truncated: false, size: 7, mimeType: 'text/markdown' },
      })
      expect((result.structuredContent as { text: object }).text).not.toHaveProperty('key')
      expect((result.structuredContent as { text: object }).text).not.toHaveProperty('url')
    })

    it('tells the model to call get_asset_render when rendering is pending', async () => {
      vi.mocked(runOperation).mockResolvedValue({
        ...ready(0),
        status: 'pending',
        summary: 'Rendering is still in progress for "clip.mp4".',
        taskId: 'task-1',
        retryAfterSeconds: 5,
      })

      const result = await client.callTool({
        name: 'read_asset',
        arguments: { assetId: 'vid-1', videoConfig: { start: 0, end: 10, count: 5 } },
      })

      expect(result.content).toEqual([
        {
          type: 'text',
          text: 'Rendering is still in progress for "clip.mp4". Call get_asset_render with taskId "task-1" in about 5 seconds to get the result.',
        },
      ])
      expect(result.structuredContent).toMatchObject({ status: 'pending', taskId: 'task-1' })
    })

    it('reports read errors as tool errors', async () => {
      vi.mocked(runOperation).mockRejectedValue(
        new HTTPException(400, { message: 'videoConfig with start, end, and count is required' }),
      )
      const result = await client.callTool({ name: 'read_asset', arguments: { assetId: 'vid-1' } })
      expect(result.isError).toBe(true)
      expect(result.content).toEqual([
        { type: 'text', text: 'videoConfig with start, end, and count is required' },
      ])
    })
  })
})
