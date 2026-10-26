import { Command, InvalidArgumentError, Option } from 'commander'
import { z } from 'zod'
import type { AnyOperationDefinition } from '@shumai/operations'
import type { CallOperation } from './call-operation'
import { CliError } from './errors'
import { renderOutput, type Output } from './render'

/**
 * CLI-specific behavior for one Operation's command, for things a definition can't describe
 * (it must stay free of I/O): extra options, input mapping, and output that downloads files.
 */
export interface CliCommandExtension {
  /** Extra options only the CLI has; their values are passed to `toInput` and `present`. */
  options?(): Option[]
  /** Adjust the Operation input using the command's options. */
  toInput?(input: Record<string, unknown>, opts: Record<string, unknown>): Record<string, unknown>
  /** Writes the output, including in `--json` mode. Replaces the default rendering. */
  present(
    output: unknown,
    ctx: { opts: Record<string, unknown>; json: boolean; output: Output },
  ): Promise<void>
}

export interface GenerateDeps {
  callOperation: CallOperation
  output: Output
  /** Whether destructive Operations are allowed (SHUMAI_ALLOW_DELETE). */
  allowDestructive: () => boolean
  /** CLI extensions by Operation name. */
  extensions?: ReadonlyMap<string, CliCommandExtension>
}

type FieldKind =
  | { type: 'string' }
  | { type: 'number' }
  | { type: 'boolean' }
  | { type: 'enum'; values: string[] }
  | { type: 'array' }

interface FieldInfo {
  name: string
  kind: FieldKind
  required: boolean
  description: string
}

/** Strip optional/nullable/default wrappers to find the field's base schema. */
function unwrap(schema: z.ZodType): z.ZodType {
  let current = schema
  while (
    current instanceof z.ZodOptional ||
    current instanceof z.ZodNullable ||
    current instanceof z.ZodDefault
  ) {
    current = current.unwrap() as z.ZodType
  }
  return current
}

function describeField(definition: AnyOperationDefinition, name: string): FieldInfo {
  return describeSchema(definition, name, definition.input.shape[name] as z.ZodType)
}

function describeSchema(
  definition: AnyOperationDefinition,
  name: string,
  schema: z.ZodType,
): FieldInfo {
  const base = unwrap(schema)
  let kind: FieldKind
  if (base instanceof z.ZodNumber) kind = { type: 'number' }
  else if (base instanceof z.ZodBoolean) kind = { type: 'boolean' }
  else if (base instanceof z.ZodEnum) kind = { type: 'enum', values: base.options.map(String) }
  else if (base instanceof z.ZodArray) kind = { type: 'array' }
  else if (base instanceof z.ZodString) kind = { type: 'string' }
  else {
    throw new Error(`${definition.name}.${name}: unsupported input type for the CLI`)
  }
  return {
    name,
    kind,
    required: !schema.safeParse(undefined).success,
    description: schema.description ?? base.description ?? '',
  }
}

/**
 * Input errors name the input path (e.g. `videoConfig.end`). For flattened fields, name the
 * flag the user typed instead (e.g. `--video-end`).
 */
function formatInputError(
  error: z.ZodError,
  options: ReadonlyArray<{ path: [string] | [string, string]; option: Option }>,
): string {
  const flagFor = (path: PropertyKey[]): string | undefined =>
    options.find((o) => o.path.length === 2 && o.path[0] === path[0] && o.path[1] === path[1])
      ?.option.long
  if (!error.issues.some((issue) => flagFor(issue.path))) {
    return z.prettifyError(error)
  }
  return error.issues
    .map((issue) => {
      const flag = flagFor(issue.path)
      return flag ? `✖ ${flag}: ${issue.message}` : z.prettifyError(new z.ZodError([issue]))
    })
    .join('\n')
}

function parseNumber(value: string): number {
  const parsed = Number(value)
  if (value.trim() === '' || Number.isNaN(parsed)) {
    throw new InvalidArgumentError('Not a number.')
  }
  return parsed
}

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
}

/** Find or create the subcommand path, e.g. `project` for `project ls`. */
function ensureParent(program: Command, path: readonly string[]): Command {
  let parent = program
  for (const segment of path) {
    parent =
      parent.commands.find((c) => c.name() === segment) ??
      parent.command(segment).description(`Manage ${segment}s.`)
  }
  return parent
}

/** Registers one command for each definition with a `cli` spec. */
export function registerOperationCommands(
  program: Command,
  definitions: readonly AnyOperationDefinition[],
  deps: GenerateDeps,
): void {
  for (const definition of definitions) {
    const cli = definition.cli
    if (!cli || !definition.surfaces.includes('cli')) continue

    const parent = ensureParent(program, cli.command.slice(0, -1))
    const cmd = parent
      .command(cli.command[cli.command.length - 1])
      .description(cli.description ?? definition.description)
    if (cli.aliases) cmd.aliases([...cli.aliases])

    const positional = (cli.positional ?? []).map((name) => describeField(definition, name))
    for (const field of positional) {
      const placeholder = field.kind.type === 'array' ? `${field.name}...` : field.name
      cmd.argument(field.required ? `<${placeholder}>` : `[${placeholder}]`, field.description)
    }

    const positionalNames = new Set(positional.map((f) => f.name))
    const omitted = new Set<string>(cli.omit ?? [])
    const flatten = (cli.flatten ?? {}) as Record<string, string | undefined>
    // `path` is where the value goes in the input: `[field]` or `[field, subField]`.
    const options: Array<{ path: [string] | [string, string]; option: Option }> = []
    const addOption = (
      path: [string] | [string, string],
      field: FieldInfo,
      spellings: readonly string[],
    ) => {
      const valueHint =
        field.kind.type === 'boolean'
          ? ''
          : field.kind.type === 'array'
            ? ` <${field.name}...>`
            : ` <${field.name}>`
      const option = new Option(`${spellings.join(', ')}${valueHint}`, field.description)
      if (field.kind.type === 'number') option.argParser(parseNumber)
      if (field.kind.type === 'enum') option.choices(field.kind.values)
      if (field.required) option.makeOptionMandatory()
      cmd.addOption(option)
      options.push({ path, option })
      return option
    }

    for (const name of Object.keys(definition.input.shape)) {
      if (positionalNames.has(name) || omitted.has(name)) continue
      const prefix = flatten[name]
      if (prefix !== undefined) {
        const schema = definition.input.shape[name] as z.ZodType
        const base = unwrap(schema)
        if (!(base instanceof z.ZodObject)) {
          throw new Error(`${definition.name}.${name}: only object fields can be flattened`)
        }
        const parentRequired = !schema.safeParse(undefined).success
        for (const [subName, subSchema] of Object.entries(base.shape)) {
          const field = describeSchema(definition, `${name}.${subName}`, subSchema as z.ZodType)
          field.name = subName
          // Sub-fields are only mandatory when the object itself is.
          field.required = parentRequired && field.required
          const flag = prefix ? `--${prefix}-${kebab(subName)}` : `--${kebab(subName)}`
          addOption([name, subName], field, [flag])
        }
        continue
      }
      const field = describeField(definition, name)
      const option = addOption([name], field, cli.flags?.[name] ?? [`--${kebab(name)}`])
      const cliDefault = (cli.defaults as Record<string, unknown> | undefined)?.[name]
      if (cliDefault !== undefined) option.default(cliDefault)
    }

    const extension = deps.extensions?.get(definition.name)
    for (const option of extension?.options?.() ?? []) cmd.addOption(option)

    cmd.action(async (...args: unknown[]) => {
      const command = args[args.length - 1] as Command
      const input: Record<string, unknown> = { ...cli.defaults }
      positional.forEach((field, i) => {
        if (args[i] !== undefined) input[field.name] = args[i]
      })
      const opts = command.opts()
      for (const { path, option } of options) {
        const value = opts[option.attributeName()]
        if (value === undefined) continue
        if (path.length === 1) {
          input[path[0]] = value
        } else {
          const parent = (input[path[0]] ?? {}) as Record<string, unknown>
          input[path[0]] = { ...parent, [path[1]]: value }
        }
      }

      if (definition.annotations.destructive && !deps.allowDestructive()) {
        throw new CliError(
          `${definition.title} is disabled in this environment. Set SHUMAI_ALLOW_DELETE=true to enable it.`,
        )
      }

      const parsed = definition.input.safeParse(
        extension?.toInput ? extension.toInput(input, opts) : input,
      )
      if (!parsed.success) {
        throw new CliError(formatInputError(parsed.error, options))
      }

      const output = await deps.callOperation(definition, parsed.data)
      const json = Boolean(command.optsWithGlobals().json)
      if (extension) {
        await extension.present(output, { opts, json, output: deps.output })
      } else if (json) {
        deps.output.out.write(`${JSON.stringify(output, null, 2)}\n`)
      } else {
        renderOutput(definition, output, deps.output)
      }
    })
  }
}
