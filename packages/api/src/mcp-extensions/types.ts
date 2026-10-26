import type { z } from 'zod'
import type { CallToolResult } from '@modelcontextprotocol/server'

/**
 * MCP-specific presentation for an Operation. By default an MCP tool returns the output as
 * JSON text plus `structuredContent`; an extension can add MCP-only arguments and build the
 * result content itself (e.g. image blocks). `structuredContent` must still match the
 * Operation's output schema.
 */
export interface McpToolExtension {
  /** Extra arguments only MCP clients see; they are removed before the Operation runs. */
  extraInput?: z.ZodObject
  present(output: unknown, extra: Record<string, unknown>): Promise<CallToolResult>
}
