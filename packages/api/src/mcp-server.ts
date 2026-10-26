import { Hono } from 'hono'
import { createMcpHandler, McpServer, type CallToolResult } from '@modelcontextprotocol/server'
import type { z } from 'zod'
import type { Prisma } from '@shumai/db'
import { dropNullOptionals } from '@shumai/operations'
import { getOperationsForSurface, runOperation, type Operation } from '@shumai/core/src/operations'
import { mcpExtensions, type McpToolExtension } from './mcp-extensions'
import { assertWritableInDemoMode, describeOperationError } from './operation-support'

type User = Prisma.UserGetPayload<Record<string, never>>

/** Implementation version reported to MCP clients (independent of the protocol version). */
export const MCP_SERVER_VERSION = '1.0.0'

export const MCP_SERVER_INSTRUCTIONS = [
  'Shumai is a media asset workspace organized as teams > projects > folders > files.',
  'Start with list_projects to find a project and its rootFolderId, then pass folder IDs as',
  '`parent` to list_assets and create_folder. list_assets is paginated: when',
  'pageInfo.hasNextPage is true, call it again with after = pageInfo.endCursor.',
  'Use read_asset to look at a file (image, video frames, PDF pages, 3D views, or text);',
  'if it returns status "pending", call get_asset_render with its taskId.',
].join(' ')

/**
 * The tool's input schema, with `null` for optional arguments treated as omitted. The SDK
 * validates arguments before calling the tool, so the nulls must be dropped here; the JSON
 * Schema shown to clients is unchanged (optional, not nullable, which more clients support).
 */
function toolInputSchema(schema: z.ZodObject): Pick<z.ZodObject, '~standard'> {
  const standard = schema['~standard']
  return {
    '~standard': {
      ...standard,
      validate: (value) => standard.validate(dropNullOptionals(schema, value)),
    },
  }
}

/** Separate MCP-only arguments (declared by an extension) from the Operation input. */
function splitArgs(
  extension: McpToolExtension | undefined,
  args: unknown,
): { input: unknown; extra: Record<string, unknown> } {
  if (!extension?.extraInput || !args || typeof args !== 'object') {
    return { input: args, extra: {} }
  }
  const extraKeys = new Set(Object.keys(extension.extraInput.shape))
  const input: Record<string, unknown> = {}
  const extra: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(args)) {
    ;(extraKeys.has(key) ? extra : input)[key] = value
  }
  return { input, extra }
}

async function callOperation(
  op: Operation,
  userId: string,
  args: unknown,
): Promise<CallToolResult> {
  const extension = mcpExtensions.get(op.definition.name)
  try {
    await assertWritableInDemoMode(op, userId)
    const { input, extra } = splitArgs(extension, args)
    const output = (await runOperation(op, { userId, via: 'mcp' }, input)) as Record<
      string,
      unknown
    >
    if (extension) {
      return await extension.present(output, extra)
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(output) }],
      structuredContent: output,
    }
  } catch (err) {
    return {
      content: [{ type: 'text', text: describeOperationError(op.definition.name, err).message }],
      isError: true,
    }
  }
}

/** A fresh MCP server exposing every `mcp`-surface Operation on behalf of one user. */
export function buildMcpServer(userId: string): McpServer {
  const server = new McpServer(
    { name: 'shumai', title: 'Shumai', version: MCP_SERVER_VERSION },
    { instructions: MCP_SERVER_INSTRUCTIONS },
  )
  for (const op of getOperationsForSurface('mcp')) {
    const { definition } = op
    const extension = mcpExtensions.get(definition.name)
    server.registerTool(
      definition.name,
      {
        title: definition.title,
        description: definition.description,
        inputSchema: toolInputSchema(
          extension?.extraInput
            ? definition.input.extend(extension.extraInput.shape)
            : definition.input,
        ),
        outputSchema: definition.output,
        annotations: {
          title: definition.title,
          readOnlyHint: definition.annotations.readOnly,
          destructiveHint: definition.annotations.destructive,
          idempotentHint: definition.annotations.idempotent ?? false,
          openWorldHint: false,
        },
      },
      (args) => callOperation(op, userId, args),
    )
  }
  return server
}

// Stateless serving: the factory builds a server per request for the authenticated user,
// so no state is shared between users or requests. The user is resolved by
// `requireApiTokenMiddleware` and handed to the factory through `authInfo`.
const mcpHandler = createMcpHandler(({ authInfo }) => {
  const userId = authInfo?.extra?.userId
  if (typeof userId !== 'string') {
    throw new Error('MCP request reached the handler without an authenticated user')
  }
  return buildMcpServer(userId)
})

/** Shumai's MCP server (Streamable HTTP). Mounted at `/api/mcp` behind API token auth. */
const route = new Hono<{ Variables: { user: User } }>().all('/mcp', (c) => {
  const user = c.get('user')
  return mcpHandler.fetch(c.req.raw, {
    authInfo: { token: '', clientId: user.id, scopes: [], extra: { userId: user.id } },
  })
})

export default route
