import { describe, it, expect } from 'vitest'
import { type TSchema } from 'typebox'
import { Value } from 'typebox/value'
import { fieldsToTypeBoxSchema, type AutofillField } from './index'

interface AnyOfFieldSchema {
  type?: string
  enum?: string[]
  const?: string
  description?: string
  items?: { enum?: string[]; type?: string }
  anyOf?: AnyOfFieldSchema[]
}

function propsOf(schema: TSchema): Record<string, { anyOf?: AnyOfFieldSchema[] }> {
  return (schema as unknown as { properties: Record<string, { anyOf?: AnyOfFieldSchema[] }> })
    .properties
}

describe('fieldsToTypeBoxSchema', () => {
  it('converts text fields', () => {
    const fields: AutofillField[] = [
      { id: 'f1', config: { name: 'Title', type: 'text' }, description: 'The title' },
      { id: 'f2', config: { name: 'Desc', type: 'longText' } },
    ]
    const schema = fieldsToTypeBoxSchema(fields)
    const props = propsOf(schema)
    expect(props.f1.anyOf![0].type).toBe('string')
    expect(props.f1.anyOf![1].type).toBe('null')
    expect(props.f1.anyOf![0].description).toBe("The field 'Title' represents The title.")
    expect(props.f2.anyOf![0].type).toBe('string')
    expect(props.f2.anyOf![0].description).toBe("The field 'Desc' represents Desc.")
  })

  it('converts numeric fields', () => {
    const fields: AutofillField[] = [
      { id: 'f1', config: { name: 'Price', type: 'number' } },
      { id: 'f2', config: { name: 'Rating', type: 'rating' } },
    ]
    const schema = fieldsToTypeBoxSchema(fields)
    const props = propsOf(schema)
    expect(props.f1.anyOf![0].type).toBe('number')
    expect(props.f2.anyOf![0].type).toBe('number')
  })

  it('converts toggle fields', () => {
    const fields: AutofillField[] = [{ id: 'f1', config: { name: 'Active', type: 'toggle' } }]
    const schema = fieldsToTypeBoxSchema(fields)
    expect(propsOf(schema).f1.anyOf![0].type).toBe('boolean')
  })

  it('converts select fields with enums and option descriptions', () => {
    const fields: AutofillField[] = [
      {
        id: 'f1',
        description: 'Species of animal',
        config: {
          name: 'Species',
          type: 'select',
          select: {
            options: [
              { id: 'opt1', displayName: 'Option 1', color: 'red' },
              { id: 'opt2', displayName: 'Option 2', color: 'blue' },
            ],
          },
        },
      },
    ]
    const schema = fieldsToTypeBoxSchema(fields)
    const selectSchema = propsOf(schema).f1.anyOf![0]
    expect(selectSchema.type).toBe('string')
    expect(selectSchema.enum).toEqual(['opt1', 'opt2'])
    expect(selectSchema.description).toBe(
      "The field 'Species' represents Species of animal.\nSelect one option and return the option ID as the value.\n\nAvailable options:\n- Option 1 => opt1\n- Option 2 => opt2",
    )
    // Only the declared option IDs are valid (enforced by the typebox validator)
    expect(Value.Check(schema, { f1: 'opt1' })).toBe(true)
    expect(Value.Check(schema, { f1: null })).toBe(true)
    expect(Value.Check(schema, { f1: 'not-an-option' })).toBe(false)
  })

  it('converts selectMulti fields with array enums and option descriptions', () => {
    const fields: AutofillField[] = [
      {
        id: 'f1',
        config: {
          name: 'Tags',
          type: 'selectMulti',
          selectMulti: {
            options: [
              { id: 'opt1', displayName: 'Tag 1', color: 'red' },
              { id: 'opt2', displayName: 'Tag 2', color: 'blue' },
            ],
          },
        },
      },
    ]
    const schema = fieldsToTypeBoxSchema(fields)
    const selectMultiSchema = propsOf(schema).f1.anyOf![0]
    expect(selectMultiSchema.type).toBe('array')
    expect(selectMultiSchema.items!.enum).toEqual(['opt1', 'opt2'])
    expect(selectMultiSchema.description).toBe(
      "The field 'Tags' represents Tags.\nSelect applicable options and return the option IDs as the value.\n\nAvailable options:\n- Tag 1 => opt1\n- Tag 2 => opt2",
    )
    expect(Value.Check(schema, { f1: ['opt1', 'opt2'] })).toBe(true)
    expect(Value.Check(schema, { f1: null })).toBe(true)
    expect(Value.Check(schema, { f1: ['opt1', 'bad'] })).toBe(false)
  })

  it('defaults to string for unknown types', () => {
    const fields: AutofillField[] = [
      // @ts-ignore
      { id: 'f1', config: { name: 'Unknown', type: 'invalid' } },
    ]
    const schema = fieldsToTypeBoxSchema(fields)
    expect(propsOf(schema).f1.anyOf![0].type).toBe('string')
  })

  it('marks every property required (nullable) and rejects unknown keys', () => {
    const fields: AutofillField[] = [
      { id: 'f1', config: { name: 'Title', type: 'text' } },
      { id: 'f2', config: { name: 'Rating', type: 'rating' } },
    ]
    const schema = fieldsToTypeBoxSchema(fields)
    const props = propsOf(schema)
    // typebox v1 objects are strict by default: unknown keys are rejected
    expect(props.f1.anyOf![0].type).toBe('string')
    expect(props.f1.anyOf![1].type).toBe('null')
    expect(Value.Check(schema, { f1: 'x', f2: null })).toBe(true)
    expect(Value.Check(schema, { f1: null, f2: 3 })).toBe(true)
    expect(Value.Check(schema, { f1: 'x' })).toBe(false)
    expect(Value.Check(schema, { f1: 'x', f2: null, extra: 1 })).toBe(false)
  })
})
