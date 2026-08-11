/**
 * MCP tool registry — in-memory tool metadata + search
 *
 * Per-agent registry of discovered tool metadata keyed by server id, created
 * fresh by `McpService.buildAgentTools` and warmed from the persisted DB
 * cache (`McpServer.tools`). Scoping discovery to the agent's assigned
 * servers means unassigned/disabled servers can never be searched, suggested,
 * or called. (Adapted from pi-mcp-adapter's ToolMetadata + search-ranking.ts.)
 */

import type { McpTool } from './mcp-server-manager'

export interface ToolMetadata {
  /** Prefixed tool name (e.g. "xcodebuild_list_sims"). */
  name: string
  /** Original MCP tool name (e.g. "list_sims"). */
  originalName: string
  description: string
  inputSchema?: unknown
}

/**
 * Sanitize a server name into a safe tool-name prefix: any run of
 * non-alphanumeric characters becomes a single underscore. Server-reported
 * names/titles may contain spaces, dots or other punctuation.
 */
export function sanitizeServerPrefix(serverName: string): string {
  return serverName.replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '')
}

/** Format a tool name with the "{server}_{tool}" prefix (dots sanitized). */
export function formatToolName(serverName: string, toolName: string): string {
  const serverPart = sanitizeServerPrefix(serverName)
  const sanitized = toolName.replace(/\./g, '_')
  return serverPart ? `${serverPart}_${sanitized}` : sanitized
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

/**
 * Decide whether a tool is allowed by excludeTools (matches prefixed or
 * original name). Applied when building the per-agent registry so excluded
 * tools are invisible to both the proxy tool and direct registration.
 */
export function isToolAllowed(
  prefixedName: string,
  originalName: string,
  excludeTools?: string[],
): boolean {
  if (
    matchesToolPattern(prefixedName, excludeTools) ||
    matchesToolPattern(originalName, excludeTools)
  ) {
    return false
  }
  return true
}

const MIN_STEM_LENGTH = 4

const FIELD_WEIGHTS = {
  name: 12,
  originalName: 10,
  server: 8,
  description: 5,
} as const

export interface RankedToolMatch {
  server: string
  tool: ToolMetadata
  score: number
}

export function normalizeSearchText(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_./:-]+/g, ' ')
    .toLowerCase()
}

export function tokenize(value: string): string[] {
  return normalizeSearchText(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

export function scoreToolMatch(tool: ToolMetadata, server: string, query: string): number | null {
  const normalizedQuery = normalizeSearchText(query).trim()
  const queryTokens = tokenize(query)
  if (queryTokens.length === 0) return null

  const fields = {
    name: normalizeSearchText(tool.name),
    originalName: normalizeSearchText(tool.originalName),
    server: normalizeSearchText(server),
    description: normalizeSearchText(tool.description),
  }
  let score = 0
  let phraseMatched = false
  let wholeFieldExact = false
  const matchedTokens = new Set<string>()

  for (const [field, value] of Object.entries(fields) as Array<
    [keyof typeof FIELD_WEIGHTS, string]
  >) {
    const weight = FIELD_WEIGHTS[field]
    const fieldTokens = tokenize(value)
    if (value === normalizedQuery) {
      score += weight * 14
      phraseMatched = true
      wholeFieldExact = true
    } else if (value.startsWith(normalizedQuery)) {
      score += weight * 9
      phraseMatched = true
    } else if (value.includes(normalizedQuery)) {
      score += weight * 6
      phraseMatched = true
    }

    for (const token of queryTokens) {
      if (fieldTokens.includes(token)) {
        score += weight * 4
        matchedTokens.add(token)
      } else if (
        fieldTokens.some(
          (fieldToken) =>
            fieldToken.startsWith(token) ||
            (fieldToken.length >= MIN_STEM_LENGTH && token.startsWith(fieldToken)),
        )
      ) {
        score += weight * 2
        matchedTokens.add(token)
      } else if (value.includes(token)) {
        score += weight
        matchedTokens.add(token)
      }
    }
  }

  const coverage = matchedTokens.size / queryTokens.length
  if (!phraseMatched && (queryTokens.length <= 2 ? coverage !== 1 : coverage < 0.6)) return null

  score += coverage === 1 ? 25 : Math.round(coverage * 10)
  const firstQueryToken = queryTokens[0]
  if (firstQueryToken !== undefined && tokenize(fields.name).includes(firstQueryToken)) score += 8
  if (wholeFieldExact) score += 20
  return score
}

export function paginate<T>(
  items: T[],
  offset: number,
  limit: number,
): { items: T[]; total: number; hasMore: boolean; nextOffset: number | null } {
  const safeOffset = Number.isFinite(offset) ? Math.max(0, Math.trunc(offset)) : 0
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 1
  const total = items.length
  const page = items.slice(safeOffset, safeOffset + safeLimit)
  const nextOffset = safeOffset + page.length
  return {
    items: page,
    total,
    hasMore: nextOffset < total,
    nextOffset: nextOffset < total ? nextOffset : null,
  }
}

export class McpToolRegistry {
  private readonly metadataByServer = new Map<string, ToolMetadata[]>()

  /**
   * Rebuild the metadata for one server from its discovered tools, skipping
   * tools excluded via excludeTools so they are unreachable through the proxy.
   */
  setTools(
    serverId: string,
    serverName: string,
    tools: McpTool[],
    opts?: { excludeTools?: string[] },
  ): void {
    const metadata: ToolMetadata[] = []
    for (const tool of tools) {
      const name = formatToolName(serverName, tool.name)
      if (!isToolAllowed(name, tool.name, opts?.excludeTools)) continue
      metadata.push({
        name,
        originalName: tool.name,
        description: tool.description ?? '',
        ...(tool.inputSchema !== undefined ? { inputSchema: tool.inputSchema } : {}),
      })
    }
    metadata.sort((a, b) => a.name.localeCompare(b.name))
    this.metadataByServer.set(serverId, metadata)
  }

  getTools(serverId: string): ToolMetadata[] {
    return this.metadataByServer.get(serverId) ?? []
  }

  getAllTools(): Array<{ serverId: string; serverName: string; tool: ToolMetadata }> {
    const result: Array<{ serverId: string; serverName: string; tool: ToolMetadata }> = []
    for (const [serverId, metadata] of this.metadataByServer.entries()) {
      for (const tool of metadata) {
        result.push({ serverId, serverName: serverId, tool })
      }
    }
    return result
  }

  clear(serverId: string): void {
    this.metadataByServer.delete(serverId)
  }

  clearAll(): void {
    this.metadataByServer.clear()
  }

  /** Find a tool by prefixed or original name, optionally within one server. */
  findTool(name: string, serverId?: string): { serverId: string; tool: ToolMetadata } | undefined {
    for (const [sid, metadata] of this.metadataByServer.entries()) {
      if (serverId && sid !== serverId) continue
      const found = metadata.find((tool) => tool.name === name || tool.originalName === name)
      if (found) return { serverId: sid, tool: found }
    }
    return undefined
  }

  /** Ranked search across all (or one) server's tools. */
  searchTools(
    query: string,
    serverId?: string,
    serverNames: Map<string, string> = new Map(),
    limit = 12,
    offset = 0,
  ): { items: RankedToolMatch[]; total: number; hasMore: boolean; nextOffset: number | null } {
    const matches: RankedToolMatch[] = []
    for (const [sid, metadata] of this.metadataByServer.entries()) {
      if (serverId && sid !== serverId) continue
      const serverName = serverNames.get(sid) ?? sid
      for (const tool of metadata) {
        const score = scoreToolMatch(tool, serverName, query)
        if (score !== null) matches.push({ server: sid, tool, score })
      }
    }
    matches.sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name))
    return paginate(matches, offset, limit)
  }

  /** "Did you mean" suggestions for a tool name. */
  rankSuggestions(
    name: string,
    limit: number,
    serverNames: Map<string, string> = new Map(),
  ): string[] {
    return this.searchTools(name, undefined, serverNames, limit, 0).items.map((m) => m.tool.name)
  }
}
