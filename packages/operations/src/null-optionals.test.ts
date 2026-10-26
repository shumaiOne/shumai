import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { dropNullOptionals } from './null-optionals'

const schema = z.object({
  id: z.string(),
  note: z.string().optional(),
  config: z
    .object({
      mode: z.enum(['a', 'b']),
      start: z.number().optional(),
    })
    .optional(),
  tags: z.array(z.string()).optional(),
})

describe('dropNullOptionals', () => {
  it('drops nulls for optional fields, including inside nested objects', () => {
    expect(
      dropNullOptionals(schema, {
        id: 'x',
        note: null,
        config: { mode: 'a', start: null },
        tags: null,
      }),
    ).toEqual({ id: 'x', config: { mode: 'a' } })
  })

  it('drops a null nested object when the object is optional', () => {
    expect(dropNullOptionals(schema, { id: 'x', config: null })).toEqual({ id: 'x' })
  })

  it('keeps nulls for required fields so validation still fails', () => {
    const cleaned = dropNullOptionals(schema, { id: null, config: { mode: null } })
    expect(cleaned).toEqual({ id: null, config: { mode: null } })
    expect(schema.safeParse(cleaned).success).toBe(false)
  })

  it('leaves unknown keys and non-object values alone', () => {
    expect(dropNullOptionals(schema, { id: 'x', other: null })).toEqual({ id: 'x', other: null })
    expect(dropNullOptionals(schema, null)).toBeNull()
    expect(dropNullOptionals(schema, ['a'])).toEqual(['a'])
  })
})
