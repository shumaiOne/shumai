import type { z } from 'zod'

/**
 * Channels through which an Operation can be invoked by an agent.
 *
 * - `agent`: native tool of Shumai's built-in agent
 * - `mcp`: tool on Shumai's MCP server
 * - `cli`: command of `shumai-cli` (served by `POST /api/ops/:name`)
 *
 * REST routes are not a surface: they call Operations explicitly.
 */
export const SURFACES = ['agent', 'mcp', 'cli'] as const
export type Surface = (typeof SURFACES)[number]

/** Where an invocation came from: one of the surfaces, or a REST route (`api`). Recorded in audit logs. */
export type Via = Surface | 'api'

/** Behavioral hints, mapped to MCP tool annotations and surface-specific safety gates. */
export interface OperationAnnotations {
  /** The Operation does not modify any state. */
  readOnly: boolean
  /** The Operation may irreversibly remove data (e.g. delete). */
  destructive: boolean
  /** Repeating the call with the same input has no additional effect. */
  idempotent?: boolean
}

/** How an Operation is exposed as a `shumai-cli` command. */
export interface CliSpec<TInput, TOutput> {
  /** Command path, e.g. `['mkdir']` or `['project', 'ls']`. */
  command: readonly string[]
  /** Help text for the command; defaults to the Operation description (which is written for LLMs). */
  description?: string
  /** Alternative names for the last command segment, e.g. `['mv']`. */
  aliases?: readonly string[]
  /** Input fields taken from positional arguments, in order. An array field must be last (variadic). */
  positional?: readonly (keyof TInput & string)[]
  /** Flag spellings for input fields, e.g. `{ parent: ['-p', '--parent'] }`. */
  flags?: { readonly [K in keyof TInput & string]?: readonly string[] }
  /** Input values the CLI uses when the user does not pass them (e.g. a larger page size). */
  defaults?: { readonly [K in keyof TInput & string]?: TInput[K] }
  /** Human-friendly rendering of the output; the CLI falls back to a generic renderer. */
  format?(output: TOutput): string
}

/**
 * A single capability exposed to agents, defined once and shared by every surface.
 *
 * Definitions are pure metadata and schemas: they must not depend on server code so
 * that clients such as the CLI can import them. Implementations live in
 * `@shumai/core/src/operations`.
 */
export interface OperationDefinition<
  TName extends string = string,
  TInput extends z.ZodObject = z.ZodObject,
  TOutput extends z.ZodType = z.ZodType,
> {
  /** Unique snake_case name, used as the agent/MCP tool name and the `/api/ops/:name` path. */
  readonly name: TName
  /** Short human-readable label. */
  readonly title: string
  /** What the Operation does, written for an LLM choosing between tools. */
  readonly description: string
  readonly input: TInput
  readonly output: TOutput
  readonly surfaces: readonly Surface[]
  readonly annotations: OperationAnnotations
  readonly cli?: CliSpec<z.input<TInput>, z.output<TOutput>>
}

export type AnyOperationDefinition = OperationDefinition<string, z.ZodObject, z.ZodType>

const NAME_PATTERN = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/

/**
 * Define an Operation. Validates the metadata eagerly so mistakes fail at import time.
 */
export function defineOperation<
  const TName extends string,
  TInput extends z.ZodObject,
  TOutput extends z.ZodType,
>(def: OperationDefinition<TName, TInput, TOutput>): OperationDefinition<TName, TInput, TOutput> {
  if (!NAME_PATTERN.test(def.name)) {
    throw new Error(`Invalid operation name "${def.name}": expected snake_case`)
  }
  if (!def.title.trim() || !def.description.trim()) {
    throw new Error(`Operation "${def.name}" must have a title and a description`)
  }
  if (def.surfaces.length === 0 || new Set(def.surfaces).size !== def.surfaces.length) {
    throw new Error(`Operation "${def.name}" must list each surface at most once`)
  }
  if (def.annotations.readOnly && def.annotations.destructive) {
    throw new Error(`Operation "${def.name}" cannot be both readOnly and destructive`)
  }
  if (def.surfaces.includes('cli') && !def.cli) {
    throw new Error(`Operation "${def.name}" has the cli surface but no cli spec`)
  }
  if (def.cli) {
    const fields = new Set(Object.keys(def.input.shape))
    const referenced = [
      ...(def.cli.positional ?? []),
      ...Object.keys(def.cli.flags ?? {}),
      ...Object.keys(def.cli.defaults ?? {}),
    ]
    for (const field of referenced) {
      if (!fields.has(field)) {
        throw new Error(`Operation "${def.name}" cli spec references unknown input "${field}"`)
      }
    }
  }
  return Object.freeze(def)
}
