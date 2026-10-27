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

/** Per-session settings for building tools, e.g. schemas that depend on the project. */
export interface AgentToolOptions {
  /**
   * Schema of the conversation project's Creation Context fields, for the `metadata`
   * parameter of tools that create files. Undefined when the project has none.
   */
  creationMetadataSchema?: TSchema
}

/** The JSON Schema of a tool's parameters (an object schema). */
export interface ToolParametersSchema {
  type?: string
  properties: Record<string, unknown>
  required?: string[]
  [key: string]: unknown
}

/**
 * Agent-specific presentation for an Operation. By default a tool returns the Operation output
 * as JSON text; an extension can add agent-only parameters, map them into the Operation input,
 * and render the output (e.g. as image blocks).
 */
export interface AgentToolExtension {
  /** Replaces the Operation description for the agent (e.g. where files end up). */
  description?: string
  /** Extra parameters only the agent sees; they are removed before the Operation runs. */
  extraParameters?: z.ZodObject
  /**
   * Agent-facing versions of Operation input fields, e.g. a required field made optional
   * because an extra parameter can be used instead. The Operation still validates its own
   * input when it runs.
   */
  parameterOverrides?: z.ZodObject
  /** Operation input fields the agent doesn't see because `toInput` fills them in. */
  hiddenParameters?: readonly string[]
  /** Adjust the parameters' JSON Schema for this session (e.g. a project-specific field). */
  adjustParameters?(schema: ToolParametersSchema, options: AgentToolOptions): void
  /** Adjust the Operation input using the extra parameters. */
  toInput?(input: Record<string, unknown>, extra: Record<string, unknown>): Record<string, unknown>
  /**
   * Handle an agent-only mode without running the Operation (e.g. a storage key instead of
   * an asset). Return undefined to run the Operation.
   */
  intercept?(
    input: Record<string, unknown>,
    extra: Record<string, unknown>,
    ctx: AgentOperationContext,
  ): Promise<AgentToolResult<unknown> | undefined>
  present(
    output: unknown,
    extra: Record<string, unknown>,
    ctx: AgentOperationContext,
  ): Promise<AgentToolResult<unknown>>
}

const extensions = new Map<string, AgentToolExtension>()

/** Register agent presentation for an Operation (see `./operation-extensions`). */
export function registerAgentToolExtension(name: string, extension: AgentToolExtension): void {
  extensions.set(name, extension)
}

function toolInputSchema(op: Operation, extension?: AgentToolExtension): z.ZodObject {
  let schema = op.definition.input
  if (extension?.parameterOverrides) schema = schema.extend(extension.parameterOverrides.shape)
  if (extension?.extraParameters) schema = schema.extend(extension.extraParameters.shape)
  return schema
}

/**
 * Convert an Operation's Zod input schema into the JSON Schema the agent harness expects.
 * TypeBox schemas are plain JSON Schema at runtime, so the converted schema is used as-is.
 * Throws when the schema cannot be compiled, so a bad definition fails loudly in tests.
 */
export function toToolParameters(
  op: Operation,
  extension?: AgentToolExtension,
  options: AgentToolOptions = {},
): TSchema {
  const schema = z.toJSONSchema(toolInputSchema(op, extension), {
    io: 'input',
  }) as unknown as ToolParametersSchema
  // `$schema` is not understood by the harness validator or every model provider.
  delete schema.$schema
  for (const name of extension?.hiddenParameters ?? []) {
    delete schema.properties[name]
    schema.required = schema.required?.filter((field) => field !== name)
  }
  extension?.adjustParameters?.(schema, options)
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
export function toAgentTool(
  op: Operation,
  ctx: AgentOperationContext,
  options: AgentToolOptions = {},
): AgentTool {
  const { definition } = op
  const extension = extensions.get(definition.name)
  return {
    name: definition.name,
    label: definition.title,
    description: extension?.description ?? definition.description,
    parameters: toToolParameters(op, extension, options),
    execute: async (_toolCallId, params) => {
      const { input, extra } = splitAgentParams(op, extension, params)
      if (extension?.intercept) {
        const handled = await extension.intercept(input as Record<string, unknown>, extra, ctx)
        if (handled) return handled
      }
      const output = await runOperation(op, { ...ctx, via: 'agent' }, input)
      if (extension) {
        return extension.present(output, extra, ctx)
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
        details: {},
      }
    },
  }
}

/** Agent tools for every Operation with the `agent` surface. */
export function buildOperationTools(
  ctx: AgentOperationContext,
  options: AgentToolOptions = {},
): AgentTool[] {
  return getOperationsForSurface('agent').map((op) => toAgentTool(op, ctx, options))
}
