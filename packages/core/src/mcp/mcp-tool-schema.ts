/**
 * MCP tool schema conversion
 *
 * Normalizes an MCP tool's JSON Schema `inputSchema` into a TypeBox-compatible
 * `TSchema` that the pi-ai harness can validate and providers can serialize.
 *
 * - Ensures `type: 'object'` (MCP tool arguments are always objects).
 * - Strips keywords the harness does not understand (`$schema`, `$id`, `$comment`).
 * - Verifies the schema compiles with `typebox/compile`; if it does not, falls
 *   back to a permissive `Record<string, unknown>` so the tool still works
 *   (arguments pass through to `callTool`).
 */

import { Compile } from 'typebox/compile'
import { Type, type TSchema } from '@sinclair/typebox'

const STRIPPED_KEYS = new Set(['$schema', '$id', '$comment'])

function normalizeInputSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return { type: 'object' }
  }
  const source = schema as Record<string, unknown>
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(source)) {
    if (STRIPPED_KEYS.has(key)) continue
    if (value === undefined) continue
    result[key] = value
  }
  // MCP tool parameters are always a JSON object.
  if (result.type !== 'object' && result.type !== undefined) {
    result.type = 'object'
  }
  return result
}

/**
 * Convert an MCP `inputSchema` into an AgentTool `parameters` schema.
 */
export function toToolParameters(inputSchema: unknown): TSchema {
  const normalized = normalizeInputSchema(inputSchema)
  try {
    Compile(normalized)
    return normalized as TSchema
  } catch {
    // Fall back to a permissive object schema so the tool remains usable.
    return Type.Record(Type.String(), Type.Unknown())
  }
}

/** Format a JSON Schema as indented text (used by proxy describe/search). */
export function formatSchema(schema: unknown, indent = ''): string {
  if (!schema || typeof schema !== 'object') return ''
  try {
    return JSON.stringify(schema, null, 2)
      .split('\n')
      .map((line) => `${indent}${line}`)
      .join('\n')
  } catch {
    return String(schema)
  }
}
