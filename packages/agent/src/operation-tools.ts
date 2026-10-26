import { z } from 'zod'
import type { TSchema } from 'typebox'
import { Compile } from 'typebox/compile'
import { type AgentTool } from '@earendil-works/pi-agent-core'
import {
  getOperationsForSurface,
  runOperation,
  type Operation,
  type OperationContext,
} from '@shumai/core/src/operations'

/** Context for agent-invoked Operations; `via` is always `agent`. */
export type AgentOperationContext = Omit<OperationContext, 'via'>

/**
 * Convert an Operation's Zod input schema into the JSON Schema the agent harness expects.
 * TypeBox schemas are plain JSON Schema at runtime, so the converted schema is used as-is.
 * Throws when the schema cannot be compiled, so a bad definition fails loudly in tests.
 */
export function toToolParameters(op: Operation): TSchema {
  const schema: Record<string, unknown> = z.toJSONSchema(op.definition.input, { io: 'input' })
  // `$schema` is not understood by the harness validator or every model provider.
  delete schema.$schema
  Compile(schema)
  return schema as unknown as TSchema
}

/**
 * Models sometimes send `null` for optional parameters they don't want to set. Drop those
 * so the Operation's input schema treats them as omitted; nulls for required fields still fail.
 */
function dropNullOptionalFields(op: Operation, params: unknown): unknown {
  if (!params || typeof params !== 'object' || Array.isArray(params)) return params
  const shape = op.definition.input.shape
  return Object.fromEntries(
    Object.entries(params).filter(
      ([key, value]) => !(value === null && shape[key]?.safeParse(undefined).success),
    ),
  )
}

/** Expose an Operation as a native agent tool that runs through `runOperation`. */
export function toAgentTool(op: Operation, ctx: AgentOperationContext): AgentTool {
  const { definition } = op
  return {
    name: definition.name,
    label: definition.title,
    description: definition.description,
    parameters: toToolParameters(op),
    execute: async (_toolCallId, params) => {
      const output = await runOperation(
        op,
        { ...ctx, via: 'agent' },
        dropNullOptionalFields(op, params),
      )
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
