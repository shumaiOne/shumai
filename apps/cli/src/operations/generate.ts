import { Command, InvalidArgumentError, Option } from 'commander'
import { z } from 'zod'
import type { AnyOperationDefinition } from '@shumai/operations'
import type { CallOperation } from './call-operation'
import { CliError } from './errors'
import { renderOutput, type Output } from './render'

export interface GenerateDeps {
  callOperation: CallOperation
  output: Output
  /** Whether destructive Operations are allowed (SHUMAI_ALLOW_DELETE). */
  allowDestructive: () => boolean
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
  const schema = definition.input.shape[name] as z.ZodType
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
    const options: Array<{ field: FieldInfo; option: Option }> = []
    for (const name of Object.keys(definition.input.shape)) {
      if (positionalNames.has(name)) continue
      const field = describeField(definition, name)
      const spellings = cli.flags?.[name] ?? [`--${kebab(name)}`]
      const valueHint =
        field.kind.type === 'boolean'
          ? ''
          : field.kind.type === 'array'
            ? ` <${name}...>`
            : ` <${name}>`
      const option = new Option(`${spellings.join(', ')}${valueHint}`, field.description)
      if (field.kind.type === 'number') option.argParser(parseNumber)
      if (field.kind.type === 'enum') option.choices(field.kind.values)
      if (field.required) option.makeOptionMandatory()
      const cliDefault = (cli.defaults as Record<string, unknown> | undefined)?.[name]
      if (cliDefault !== undefined) option.default(cliDefault)
      cmd.addOption(option)
      options.push({ field, option })
    }

    cmd.action(async (...args: unknown[]) => {
      const command = args[args.length - 1] as Command
      const input: Record<string, unknown> = { ...cli.defaults }
      positional.forEach((field, i) => {
        if (args[i] !== undefined) input[field.name] = args[i]
      })
      const opts = command.opts()
      for (const { field, option } of options) {
        const value = opts[option.attributeName()]
        if (value !== undefined) input[field.name] = value
      }

      if (definition.annotations.destructive && !deps.allowDestructive()) {
        throw new CliError(
          `${definition.title} is disabled in this environment. Set SHUMAI_ALLOW_DELETE=true to enable it.`,
        )
      }

      const parsed = definition.input.safeParse(input)
      if (!parsed.success) {
        throw new CliError(z.prettifyError(parsed.error))
      }

      const output = await deps.callOperation(definition, parsed.data)
      if (command.optsWithGlobals().json) {
        deps.output.out.write(`${JSON.stringify(output, null, 2)}\n`)
      } else {
        renderOutput(definition, output, deps.output)
      }
    })
  }
}
