import { Hono } from 'hono'
import { createMcpHandler, McpServer, type CallToolResult } from '@modelcontextprotocol/server'
import type { Prisma } from '@shumai/db'
import { getOperationsForSurface, runOperation, type Operation } from '@shumai/core/src/operations'
import { assertWritableInDemoMode, describeOperationError } from './operation-support'

type User = Prisma.UserGetPayload<Record<string, never>>

/** Implementation version reported to MCP clients (independent of the protocol version). */
export const MCP_SERVER_VERSION = '1.0.0'

export const MCP_SERVER_INSTRUCTIONS = [
  'Shumai is a media asset workspace organized as teams > projects > folders > files.',
  'Start with list_projects to find a project and its rootFolderId, then pass folder IDs as',
  '`parent` to list_assets and create_folder. list_assets is paginated: when',
  'pageInfo.hasNextPage is true, call it again with after = pageInfo.endCursor.',
].join(' ')

async function callOperation(
  op: Operation,
  userId: string,
  args: unknown,
): Promise<CallToolResult> {
  try {
    await assertWritableInDemoMode(op, userId)
    const output = (await runOperation(op, { userId, via: 'mcp' }, args)) as Record<string, unknown>
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
    server.registerTool(
      definition.name,
      {
        title: definition.title,
        description: definition.description,
        inputSchema: definition.input,
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
