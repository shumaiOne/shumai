/**
 * Direct MCP tools — per-server opt-in registration.
 *
 * When a server's config sets `directTools: true`, its allowed tools (after
 * excludeTools filters) are registered as native AgentTools with prefixed
 * names `{server}_{tool}`. The `mcp` proxy tool stays registered for
 * discovery/auth/status and for servers not in direct mode.
 */

import { Type } from '@sinclair/typebox'
import type { AgentTool, AgentToolResult } from '@earendil-works/pi-agent-core'
import '@shumai/db/src/prisma-json-types'
import type { ToolMetadata } from './mcp-tool-registry'
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

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
  return new RegExp(`^${escaped}$`)
}

function matchesToolPattern(name: string, patterns?: string[]): boolean {
  if (!Array.isArray(patterns) || patterns.length === 0) return false
  for (const pattern of patterns) {
    if (!pattern) continue
    if (!pattern.includes('*') && !pattern.includes('?') && name === pattern) return true
    if ((pattern.includes('*') || pattern.includes('?')) && globToRegExp(pattern).test(name)) {
      return true
    }
  }
  return false
}

/** Decide whether a tool is allowed by excludeTools (matches prefixed or original name). */
export function isToolAllowed(
  prefixedName: string,
  originalName: string,
  config?: PrismaJson.McpServerConfig,
): boolean {
  const exclude = config?.excludeTools
  if (matchesToolPattern(prefixedName, exclude) || matchesToolPattern(originalName, exclude)) {
    return false
  }
  return true
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
  if (config?.directTools !== true) return []

  const tools: AgentTool[] = []
  for (const tool of metadata) {
    if (!isToolAllowed(tool.name, tool.originalName, config)) continue
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
