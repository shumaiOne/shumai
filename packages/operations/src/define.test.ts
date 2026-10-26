import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { defineOperation, type OperationDefinition } from './define'

function baseDefinition(): OperationDefinition<string, z.ZodObject<{ id: z.ZodString }>> {
  return {
    name: 'get_thing',
    title: 'Get Thing',
    description: 'Get a thing by ID.',
    input: z.object({ id: z.string() }),
    output: z.object({ id: z.string() }),
    surfaces: ['agent', 'mcp'],
    annotations: { readOnly: true, destructive: false },
  }
}

describe('defineOperation', () => {
  it('returns a frozen definition', () => {
    const def = defineOperation(baseDefinition())
    expect(def.name).toBe('get_thing')
    expect(Object.isFrozen(def)).toBe(true)
  })

  it.each(['GetThing', 'get-thing', 'get thing', '_get', 'get__thing', '1get', 'get_'])(
    'rejects non snake_case name %s',
    (name) => {
      expect(() => defineOperation({ ...baseDefinition(), name })).toThrow('expected snake_case')
    },
  )

  it('requires a title and description', () => {
    expect(() => defineOperation({ ...baseDefinition(), title: ' ' })).toThrow(
      'must have a title and a description',
    )
    expect(() => defineOperation({ ...baseDefinition(), description: '' })).toThrow(
      'must have a title and a description',
    )
  })

  it('rejects empty or duplicated surfaces', () => {
    expect(() => defineOperation({ ...baseDefinition(), surfaces: [] })).toThrow('each surface')
    expect(() => defineOperation({ ...baseDefinition(), surfaces: ['agent', 'agent'] })).toThrow(
      'each surface',
    )
  })

  it('rejects contradictory annotations', () => {
    expect(() =>
      defineOperation({
        ...baseDefinition(),
        annotations: { readOnly: true, destructive: true },
      }),
    ).toThrow('cannot be both readOnly and destructive')
  })

  it('requires a cli spec for the cli surface', () => {
    expect(() => defineOperation({ ...baseDefinition(), surfaces: ['cli'] })).toThrow('no cli spec')
  })

  it('rejects cli specs that reference unknown input fields', () => {
    expect(() =>
      defineOperation({
        ...baseDefinition(),
        surfaces: ['cli'],
        // Cast simulates a definition built without type checking (e.g. from JS)
        cli: { command: ['get'], positional: ['missing' as 'id'] },
      }),
    ).toThrow('unknown input "missing"')
    expect(() =>
      defineOperation({
        ...baseDefinition(),
        surfaces: ['cli'],
        cli: { command: ['get'], flags: { ['other' as 'id']: ['-o'] } },
      }),
    ).toThrow('unknown input "other"')
    expect(() =>
      defineOperation({
        ...baseDefinition(),
        surfaces: ['cli'],
        cli: { command: ['get'], defaults: { ['extra' as 'id']: 'x' } },
      }),
    ).toThrow('unknown input "extra"')
  })

  it('validates flattened and omitted cli fields', () => {
    const input = z.object({
      id: z.string(),
      config: z.object({ size: z.number() }).optional(),
      verbose: z.boolean().optional(),
    })
    const withCli = (cli: Record<string, unknown>) =>
      defineOperation({
        ...baseDefinition(),
        input,
        surfaces: ['cli'],
        cli: { command: ['get'], ...cli },
      } as OperationDefinition<string, typeof input>)

    expect(() => withCli({ flatten: { config: 'config' }, omit: ['verbose'] })).not.toThrow()
    expect(() => withCli({ flatten: { nope: 'n' } })).toThrow('unknown input "nope"')
    expect(() => withCli({ omit: ['gone'] })).toThrow('unknown input "gone"')
    expect(() => withCli({ omit: ['id'] })).toThrow('omits required input "id"')
  })
})
