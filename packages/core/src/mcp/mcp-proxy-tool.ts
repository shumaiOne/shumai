/**
 * MCP proxy tool — the single `mcp` AgentTool registered per agent.
 *
 * One tool in the LLM context multiplexes all of the agent's assigned MCP
 * servers via `{ server, tool, args, search, describe, connect, action }`.
 * Mode precedence: action > tool(call) > connect > describe > search >
 * server(list) > status.
 */

import { Type } from '@sinclair/typebox'
import type { AgentTool, AgentToolResult } from '@earendil-works/pi-agent-core'
import type { McpToolRegistry, ToolMetadata } from './mcp-tool-registry'
import { formatSchema } from './mcp-tool-schema'

type ProxyToolResult = AgentToolResult<Record<string, unknown>>

/** Truncated instructions head baked into the proxy tool description (L1). */
const INSTRUCTIONS_SNIPPET_LENGTH = 150
/** Longer instructions preview appended to server listings (L2). */
const INSTRUCTIONS_PREVIEW_LENGTH = 300

/** Truncate at a word boundary (mirrors pi-mcp-adapter's truncateAtWord). */
function truncateInstruction(text: string, target: number): string {
  if (!text || text.length <= target) return text
  const truncated = text.slice(0, target)
  const lastSpace = truncated.lastIndexOf(' ')
  if (lastSpace > target * 0.6) {
    return `${truncated.slice(0, lastSpace)}...`
  }
  return `${truncated}...`
}

export interface ProxyServerInfo {
  id: string
  name: string
  toolCount: number
  status: string
  /** Self-reported server usage instructions (empty when the server provides none). */
  instructions?: string
}

export type ConnectionOutcome =
  | { status: 'connected' }
  | { status: 'needs-auth' }
  | { status: 'error'; message: string }

export interface CallToolOutcome {
  ok: boolean
  content: AgentToolResult<Record<string, unknown>>['content']
}

export interface McpProxyToolContext {
  teamId: string
  userId?: string
  servers: ProxyServerInfo[]
  serverNameById: Map<string, string>
  serverIdByName: Map<string, string>
  registry: McpToolRegistry
  /** Resolve the server id for a (possibly prefixed) tool name. */
  resolveServerForTool?(toolName: string): string | undefined
  ensureConnected(serverId: string): Promise<ConnectionOutcome>
  callTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<CallToolOutcome>
  authStatus(serverId: string): Promise<string>
  startAuth(
    serverId: string,
  ): Promise<{ authorizationUrl?: string; alreadyAuthenticated?: boolean }>
  /** Server-reported usage instructions (DB cache, works without a live connection). */
  getInstructions(serverId: string): Promise<string | null>
}

/**
 * Resolve a tool, lazily connecting the owning server first when the registry
 * has no cached metadata for it yet (first call in a fresh process).
 */
async function resolveToolWithLazyConnect(
  ctx: McpProxyToolContext,
  toolName: string,
  serverId?: string,
): Promise<{ ok: true; serverId: string; tool: ToolMetadata } | { ok: false }> {
  const firstResolve = ctx.registry.findTool(toolName, serverId)
  if (firstResolve) return { ok: true, ...firstResolve }

  const targetServerId = serverId ?? ctx.resolveServerForTool?.(toolName)
  if (!targetServerId) return { ok: false }

  const outcome = await ctx.ensureConnected(targetServerId)
  if (outcome.status !== 'connected') return { ok: false }

  const retried = ctx.registry.findTool(toolName, targetServerId)
  if (!retried) return { ok: false }
  return { ok: true, ...retried }
}

const proxyToolSchema = Type.Object(
  {
    server: Type.Optional(
      Type.String({
        description:
          'The MCP server name. Required to call a tool, list a server, or start auth. Omit to search across all servers.',
      }),
    ),
    tool: Type.Optional(
      Type.String({
        description:
          'The name of the tool to call on the server (prefixed "{server}_{tool}" or the original tool name).',
      }),
    ),
    args: Type.Optional(
      Type.Unknown({
        description: 'Arguments for the tool call: either a JSON object or a JSON-encoded string.',
      }),
    ),
    connect: Type.Optional(
      Type.String({
        description: 'Server name to (re)connect and refresh its tool list. Returns the tool list.',
      }),
    ),
    describe: Type.Optional(
      Type.String({
        description: 'Tool name to show its full parameter schema.',
      }),
    ),
    instructions: Type.Optional(
      Type.String({
        description: 'Server name to show its full usage instructions.',
      }),
    ),
    search: Type.Optional(
      Type.String({
        description: 'Search query to find tools across servers (camelCase/snake_case aware).',
      }),
    ),
    includeSchemas: Type.Optional(
      Type.Boolean({
        description: 'Include parameter schemas in search results (default true).',
      }),
    ),
    limit: Type.Optional(Type.Number({ description: 'Max results for search/list (default 12).' })),
    offset: Type.Optional(Type.Number({ description: 'Pagination offset for search/list.' })),
    action: Type.Optional(
      Type.Union([Type.Literal('status'), Type.Literal('auth-start')], {
        description:
          '"status" shows connection/auth state for all servers; "auth-start" begins OAuth for `server` (the user completes it in a browser, then you poll status).',
      }),
    ),
  },
  { additionalProperties: false },
)

function parseArgs(raw: unknown): Record<string, unknown> {
  if (raw === undefined || raw === null) return {}
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return {}
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
      return { value: parsed }
    } catch {
      return { value: raw }
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  return { value: raw }
}

function contentText(text: string): ProxyToolResult {
  return { content: [{ type: 'text', text }], details: {} }
}

/** Transform MCP content blocks into model content blocks. */
export function transformMcpContent(
  content: Array<{
    type: string
    text?: string
    data?: string
    mimeType?: string
    resource?: unknown
    uri?: string
    name?: string
  }>,
): AgentToolResult<Record<string, unknown>>['content'] {
  return content.map((c) => {
    if (c.type === 'text') {
      return { type: 'text', text: c.text ?? '' }
    }
    if (c.type === 'image') {
      return { type: 'image', data: c.data ?? '', mimeType: c.mimeType ?? 'image/png' }
    }
    if (c.type === 'resource') {
      const res = (c.resource ?? {}) as { uri?: string; text?: string }
      const resourceUri = res.uri ?? '(no URI)'
      const resourceContent = res.text ?? (c.resource ? JSON.stringify(c.resource) : '(no content)')
      return { type: 'text', text: `[Resource: ${resourceUri}]\n${resourceContent}` }
    }
    if (c.type === 'resource_link') {
      const linkName = c.name ?? c.uri ?? 'unknown'
      const linkUri = c.uri ?? '(no URI)'
      return { type: 'text', text: `[Resource Link: ${linkName}]\nURI: ${linkUri}` }
    }
    if (c.type === 'audio') {
      return { type: 'text', text: `[Audio content: ${c.mimeType ?? 'audio/*'}]` }
    }
    return { type: 'text', text: JSON.stringify(c) }
  })
}

function renderToolShape(tool: ToolMetadata, indent = ''): string {
  if (!tool.inputSchema) return 'No parameters defined.'
  const schemaText = formatSchema(tool.inputSchema, indent)
  return `Parameters:\n${schemaText}`
}

function notFoundResult(
  toolName: string,
  suggestions: string[],
  serverName?: string,
): ProxyToolResult {
  let msg = `Tool "${toolName}" not found.`
  if (serverName) {
    msg += ` Use mcp({ server: "${serverName}" }) to list its tools or mcp({ search: "..." }) to search.`
  } else {
    msg += ` Use mcp({ search: "..." }) to search.`
  }
  if (suggestions.length > 0) {
    msg += ` Did you mean: ${suggestions.join(', ')}`
  }
  return contentText(msg)
}

/**
 * Build the dynamic proxy tool description (server list + tool counts + usage).
 * Servers with instructions surface a truncated head so the model sees the
 * guidance without making a call; full text is available on demand.
 */
export function buildProxyDescription(servers: ProxyServerInfo[]): string {
  const lines: string[] = []
  lines.push('Call MCP (Model Context Protocol) tools exposed by the configured servers.')
  lines.push('')
  lines.push('Servers:')
  if (servers.length === 0) {
    lines.push('  (none assigned)')
  } else {
    for (const s of servers) {
      lines.push(`  - ${s.name} (${s.toolCount} tools, status: ${s.status})`)
    }
  }
  lines.push('')
  lines.push('Usage:')
  lines.push('  - mcp({})                          → connection/auth status of all servers')
  lines.push('  - mcp({ server: "name" })          → list that server\'s tools')
  lines.push('  - mcp({ search: "query" })         → search tools across servers')
  lines.push('  - mcp({ describe: "tool" })        → show one tool\'s parameter schema')
  lines.push('  - mcp({ server: "name", tool: "tool_name", args: {...} }) → call a tool')
  lines.push('  - mcp({ connect: "name" })         → (re)connect and refresh tools')
  lines.push('  - mcp({ instructions: "name" })    → show full server usage instructions')
  lines.push('  - mcp({ action: "auth-start", server: "name" }) → start OAuth for a server')
  lines.push('')
  const instructionLines: string[] = []
  for (const s of servers) {
    if (!s.instructions || s.instructions.trim() === '') continue
    const snippet = truncateInstruction(
      s.instructions.replace(/\s+/g, ' ').trim(),
      INSTRUCTIONS_SNIPPET_LENGTH,
    )
    instructionLines.push(`  - ${s.name}: ${snippet}`)
  }
  if (instructionLines.length > 0) {
    lines.push('Server instructions (truncated — full text via mcp({ instructions: "name" })):')
    lines.push(...instructionLines)
    lines.push('')
  }
  lines.push(
    'Tool names are prefixed "{server}_{tool}" (dots replaced by underscores). You may pass either the prefixed or the original name. ' +
      'If a call fails with "needs auth", tell the user to connect the server in Settings → MCP.',
  )
  return lines.join('\n')
}

/**
 * Render a server's tool listing with the L2 instructions preview appended
 * (mirrors pi-mcp-adapter's mcp({ server }) output). Shared by the `server`
 * list mode and the `connect` mode.
 */
function renderServerListing(
  serverName: string,
  tools: ToolMetadata[],
  instructions: string | null,
): string {
  const lines = [`${serverName} (${tools.length} tools):`, '']
  for (const t of tools) {
    lines.push(`- ${t.name}${t.description ? ` - ${t.description.slice(0, 60)}` : ''}`)
  }
  if (instructions && instructions.trim() !== '') {
    const preview = truncateInstruction(instructions, INSTRUCTIONS_PREVIEW_LENGTH)
    lines.push('', 'Server instructions:', preview)
    if (preview !== instructions) {
      lines.push(`Use mcp({ instructions: "${serverName}" }) for the full text.`)
    }
  }
  return lines.join('\n')
}

/**
 * Build the single `mcp` proxy AgentTool for a team/session.
 */
export function buildProxyTool(ctx: McpProxyToolContext): AgentTool<typeof proxyToolSchema> {
  return {
    name: 'mcp',
    label: 'MCP Tools',
    description: buildProxyDescription(ctx.servers),
    parameters: proxyToolSchema,
    execute: async (_toolCallId, params): Promise<ProxyToolResult> => {
      const action = params.action
      const server = params.server
      const tool = params.tool
      const search = params.search
      const describe = params.describe
      const instructions = params.instructions
      const connect = params.connect
      const limit = params.limit ?? 12
      const offset = params.offset ?? 0
      const includeSchemas = params.includeSchemas !== false

      // 1. action: status / auth-start
      if (action === 'status') {
        const lines: string[] = ['MCP status:']
        for (const s of ctx.servers) {
          const auth = await ctx.authStatus(s.id)
          lines.push(`  - ${s.name}: ${s.status} (${s.toolCount} tools, auth: ${auth})`)
        }
        lines.push('')
        lines.push('mcp({ server: "name" }) to list tools, mcp({ search: "..." }) to search')
        return contentText(lines.join('\n'))
      }
      if (action === 'auth-start') {
        const serverId = server ? ctx.serverIdByName.get(server) : undefined
        if (!serverId) {
          return contentText(
            `Server "${server ?? ''}" not found. Use mcp({ action: "status" }) to see available servers.`,
          )
        }
        const result = await ctx.startAuth(serverId)
        if (result.alreadyAuthenticated) {
          return contentText(`OAuth authentication already complete for "${server}".`)
        }
        if (!result.authorizationUrl) {
          return contentText(
            `OAuth authentication could not be started for "${server}". Ask an admin to check Settings → MCP.`,
          )
        }
        return contentText(
          `OAuth authentication required for "${server}". An admin must open this URL in a browser and approve access:\n\n${result.authorizationUrl}\n\nAfter approving, the browser redirects back to shumai automatically. Then poll mcp({ action: "status", server: "${server}" }) until it shows connected.`,
        )
      }

      // 2. tool call
      if (tool) {
        const serverId = server ? ctx.serverIdByName.get(server) : undefined
        if (server && !serverId) {
          return contentText(
            `Server "${server}" not found. Use mcp({ action: "status" }) to see available servers.`,
          )
        }
        const resolved = await resolveToolWithLazyConnect(ctx, tool, serverId)
        if (!resolved.ok) {
          const suggestions = ctx.registry.rankSuggestions(tool, 5, ctx.serverNameById).slice(0, 5)
          return notFoundResult(tool, suggestions, server)
        }
        const outcome = await ctx.callTool(
          resolved.serverId,
          resolved.tool.originalName,
          parseArgs(params.args),
        )
        if (outcome.ok) {
          return { content: outcome.content, details: {} }
        }
        return {
          content: outcome.content,
          details: { error: 'tool_call_failed', tool, server: resolved.serverId },
        }
      }

      // 3. connect
      if (connect) {
        const serverId = ctx.serverIdByName.get(connect)
        if (!serverId) {
          return contentText(
            `Server "${connect}" not found. Use mcp({ action: "status" }) to see available servers.`,
          )
        }
        const outcome = await ctx.ensureConnected(serverId)
        if (outcome.status === 'needs-auth') {
          return contentText(
            `Server "${connect}" requires authentication. Use mcp({ action: "auth-start", server: "${connect}" }) to start OAuth.`,
          )
        }
        if (outcome.status === 'error') {
          return contentText(`Failed to connect to "${connect}": ${outcome.message}`)
        }
        const tools = ctx.registry.getTools(serverId)
        if (tools.length === 0) {
          return contentText(`Server "${connect}" is connected but has no tools.`)
        }
        const instructionsText = await ctx.getInstructions(serverId)
        return contentText(renderServerListing(connect, tools, instructionsText))
      }

      // 4. describe
      if (describe) {
        const resolved = ctx.registry.findTool(
          describe,
          server ? ctx.serverIdByName.get(server) : undefined,
        )
        if (!resolved) {
          const suggestions = ctx.registry
            .rankSuggestions(describe, 5, ctx.serverNameById)
            .slice(0, 5)
          return notFoundResult(describe, suggestions, server)
        }
        const serverName = ctx.serverNameById.get(resolved.serverId) ?? resolved.serverId
        let text = `${resolved.tool.name}\nServer: ${serverName}\n\n${resolved.tool.description || '(no description)'}\n\n`
        text += renderToolShape(resolved.tool)
        return contentText(text.trim())
      }

      // 4.5 instructions
      if (instructions) {
        const serverId = ctx.serverIdByName.get(instructions)
        if (!serverId) {
          return contentText(
            `Server "${instructions}" not found. Use mcp({ action: "status" }) to see available servers.`,
          )
        }
        const text = await ctx.getInstructions(serverId)
        if (!text || text.trim() === '') {
          return contentText(`Server "${instructions}" does not provide instructions.`)
        }
        return contentText(`${instructions} instructions:\n\n${text}`)
      }

      // 5. search
      if (search) {
        if (search.trim().length === 0 && !server) {
          return contentText('Search query cannot be empty')
        }
        const serverId = server ? ctx.serverIdByName.get(server) : undefined
        if (server && !serverId) {
          return contentText(
            `Server "${server}" not found. Use mcp({ action: "status" }) to see available servers.`,
          )
        }
        const { items, total, hasMore, nextOffset } = ctx.registry.searchTools(
          search,
          serverId,
          ctx.serverNameById,
          limit,
          offset,
        )
        if (total === 0) {
          return contentText(
            `No tools matching "${search}"${server ? ` in "${server}"` : ''}. Use mcp({ action: "status" }) to check connection state.`,
          )
        }
        let text = `Found ${total} tool${total === 1 ? '' : 's'} matching "${search}":\n\n`
        for (const match of items) {
          const serverName = ctx.serverNameById.get(match.server) ?? match.server
          text += `${match.tool.name} (server: ${serverName})\n`
          text += `  ${match.tool.description || '(no description)'}\n`
          if (includeSchemas && match.tool.inputSchema) {
            text += `  ${renderToolShape(match.tool, '    ')}\n`
          }
          text += '\n'
        }
        if (hasMore) {
          text += `${items.length} of ${total} — offset: ${nextOffset} for more\n`
        }
        return contentText(text.trim())
      }

      // 6. server list
      if (server) {
        const serverId = ctx.serverIdByName.get(server)
        if (!serverId) {
          return contentText(
            `Server "${server}" not found. Use mcp({ action: "status" }) to see available servers.`,
          )
        }
        const tools = ctx.registry.getTools(serverId)
        if (tools.length === 0) {
          return contentText(
            `Server "${server}" has no cached tools. Use mcp({ connect: "${server}" }) to connect and refresh.`,
          )
        }
        const instructionsText = await ctx.getInstructions(serverId)
        return contentText(renderServerListing(server, tools, instructionsText))
      }

      // 7. default: status
      const lines: string[] = ['MCP status:']
      for (const s of ctx.servers) {
        const auth = await ctx.authStatus(s.id)
        lines.push(`  - ${s.name}: ${s.status} (${s.toolCount} tools, auth: ${auth})`)
      }
      lines.push('')
      lines.push('mcp({ server: "name" }) to list tools, mcp({ search: "..." }) to search')
      return contentText(lines.join('\n'))
    },
  }
}
