import { z } from 'zod'
import type { TSchema } from 'typebox'
import { Compile } from 'typebox/compile'
import { type AgentTool, type AgentToolResult } from '@earendil-works/pi-agent-core'
import { dropNullOptionals } from '@shumai/operations'
import {
  getOperationsForSurface,
  runOperation,
  type Operation,
  type OperationContext,
} from '@shumai/core/src/operations'

/** Context for agent-invoked Operations; `via` is always `agent`. */
export type AgentOperationContext = Omit<OperationContext, 'via'>

/**
 * Agent-specific presentation for an Operation. By default a tool returns the Operation output
 * as JSON text; an extension can add agent-only parameters, map them into the Operation input,
 * and render the output (e.g. as image blocks).
 */
export interface AgentToolExtension {
  /** Extra parameters only the agent sees; they are removed before the Operation runs. */
  extraParameters?: z.ZodObject
  /** Adjust the Operation input using the extra parameters. */
  toInput?(input: Record<string, unknown>, extra: Record<string, unknown>): Record<string, unknown>
  present(output: unknown, extra: Record<string, unknown>): Promise<AgentToolResult<unknown>>
}

const extensions = new Map<string, AgentToolExtension>()

/** Register agent presentation for an Operation (see `./operation-extensions`). */
export function registerAgentToolExtension(name: string, extension: AgentToolExtension): void {
  extensions.set(name, extension)
}

function toolInputSchema(op: Operation, extension?: AgentToolExtension): z.ZodObject {
  return extension?.extraParameters
    ? op.definition.input.extend(extension.extraParameters.shape)
    : op.definition.input
}

/**
 * Convert an Operation's Zod input schema into the JSON Schema the agent harness expects.
 * TypeBox schemas are plain JSON Schema at runtime, so the converted schema is used as-is.
 * Throws when the schema cannot be compiled, so a bad definition fails loudly in tests.
 */
export function toToolParameters(op: Operation, extension?: AgentToolExtension): TSchema {
  const schema: Record<string, unknown> = z.toJSONSchema(toolInputSchema(op, extension), {
    io: 'input',
  })
  // `$schema` is not understood by the harness validator or every model provider.
  delete schema.$schema
  Compile(schema)
  return schema as unknown as TSchema
}

/** Split agent-only parameters from the Operation input. */
export function splitAgentParams(
  op: Operation,
  extension: AgentToolExtension | undefined,
  params: unknown,
): { input: unknown; extra: Record<string, unknown> } {
  const cleaned = dropNullOptionals(toolInputSchema(op, extension), params)
  if (!extension?.extraParameters || !cleaned || typeof cleaned !== 'object') {
    return { input: cleaned, extra: {} }
  }
  const extraKeys = new Set(Object.keys(extension.extraParameters.shape))
  const input: Record<string, unknown> = {}
  const extra: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(cleaned)) {
    ;(extraKeys.has(key) ? extra : input)[key] = value
  }
  return { input: extension.toInput ? extension.toInput(input, extra) : input, extra }
}

/** Expose an Operation as a native agent tool that runs through `runOperation`. */
export function toAgentTool(op: Operation, ctx: AgentOperationContext): AgentTool {
  const { definition } = op
  const extension = extensions.get(definition.name)
  return {
    name: definition.name,
    label: definition.title,
    description: definition.description,
    parameters: toToolParameters(op, extension),
    execute: async (_toolCallId, params) => {
      const { input, extra } = splitAgentParams(op, extension, params)
      const output = await runOperation(op, { ...ctx, via: 'agent' }, input)
      if (extension) {
        return extension.present(output, extra)
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
        details: {},
      }
    },
  }
}

/** Agent tools for every Operation with the `agent` surface. */
export function buildOperationTools(ctx: AgentOperationContext): AgentTool[] {
  return getOperationsForSurface('agent').map((op) => toAgentTool(op, ctx))
}
