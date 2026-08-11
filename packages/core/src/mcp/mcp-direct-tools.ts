/**
 * Direct MCP tools — per-server opt-in registration.
 *
 * When a server's config sets `directTools` to an array of tool names, its
 * allowed tools (matching the original or `{server}_{tool}` prefixed name,
 * after excludeTools filters) are registered as native AgentTools with
 * prefixed names `{server}_{tool}`. The `mcp` proxy tool stays registered for
 * discovery/auth/status and for tools not in direct mode.
 */

import { Type } from '@sinclair/typebox'
import type { AgentTool, AgentToolResult } from '@earendil-works/pi-agent-core'
import '@shumai/db/src/prisma-json-types'
import type { ToolMetadata } from './mcp-tool-registry'
import { isToolAllowed } from './mcp-tool-registry'
import { toToolParameters } from './mcp-tool-schema'

export interface DirectToolCallOptions {
  serverId: string
  serverName: string
  callTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<{
    ok: boolean
    content: AgentToolResult<Record<string, unknown>>['content']
  }>
}

/**
 * Decide whether a tool is exposed as a native direct tool. Matches the
 * original MCP name or the `{server}_{tool}` prefixed name against the
 * configured directTools array. Shared by direct registration and the proxy
 * description counts so the two can never drift apart.
 */
export function isDirectTool(
  originalName: string,
  prefixedName: string,
  directTools?: string[],
): boolean {
  if (!Array.isArray(directTools)) return false
  return directTools.includes(originalName) || directTools.includes(prefixedName)
}

/**
 * Build direct AgentTools for a server in direct-tools mode.
 * Returns [] when directTools is not enabled or no tools pass the filters.
 */
export function buildDirectTools(
  metadata: ToolMetadata[],
  config: PrismaJson.McpServerConfig | undefined,
  opts: DirectToolCallOptions,
): AgentTool[] {
  const directTools = config?.directTools
  if (!Array.isArray(directTools) || directTools.length === 0) return []

  const tools: AgentTool[] = []
  for (const tool of metadata) {
    if (!isToolAllowed(tool.name, tool.originalName, config?.excludeTools)) continue

    if (!isDirectTool(tool.originalName, tool.name, directTools)) continue
    const parameters = toToolParameters(tool.inputSchema)
    tools.push({
      name: tool.name,
      label: tool.name,
      description:
        tool.description || `Call ${tool.originalName} on MCP server ${opts.serverName}.`,
      parameters: parameters as unknown as import('typebox').TSchema,
      execute: async (_toolCallId, args): Promise<AgentToolResult<Record<string, unknown>>> => {
        const result = await opts.callTool(
          opts.serverId,
          tool.originalName,
          args as Record<string, unknown>,
        )
        return {
          content: result.content,
          details: { server: opts.serverName, tool: tool.originalName },
        }
      },
    })
  }
  return tools
}

// Re-exported for tests that need a fallback parameter schema.
export { Type }
