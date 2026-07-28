import { describe, it, expect } from 'vitest'
import { fieldsToTypeBoxSchema, type AutofillField } from './index'

describe('fieldsToTypeBoxSchema', () => {
  it('converts text fields', () => {
    const fields: AutofillField[] = [
      { id: 'f1', config: { name: 'Title', type: 'text' }, description: 'The title' },
      { id: 'f2', config: { name: 'Desc', type: 'longText' } },
    ]
    const schema = fieldsToTypeBoxSchema(fields)
    expect(schema.properties.f1.type).toBe('string')
    expect(schema.properties.f1.description).toBe('Title: The title')
    expect(schema.properties.f2.type).toBe('string')
    expect(schema.properties.f2.description).toBe('Desc')
  })

  it('converts numeric fields', () => {
    const fields: AutofillField[] = [
      { id: 'f1', config: { name: 'Price', type: 'number' } },
      { id: 'f2', config: { name: 'Rating', type: 'rating' } },
    ]
    const schema = fieldsToTypeBoxSchema(fields)
    expect(schema.properties.f1.type).toBe('number')
    expect(schema.properties.f2.type).toBe('number')
  })

  it('converts toggle fields', () => {
    const fields: AutofillField[] = [{ id: 'f1', config: { name: 'Active', type: 'toggle' } }]
    const schema = fieldsToTypeBoxSchema(fields)
    expect(schema.properties.f1.type).toBe('boolean')
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
    expect(schema.properties.f1.type).toBe('string')
    expect(schema.properties.f1.enum).toEqual(['opt1', 'opt2'])
    expect(schema.properties.f1.description).toBe(
      'Species: Species of animal [Allowed options: "opt1" (Option 1), "opt2" (Option 2)]',
    )
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
    expect(schema.properties.f1.type).toBe('array')
    expect(schema.properties.f1.items.enum).toEqual(['opt1', 'opt2'])
    expect(schema.properties.f1.description).toBe(
      'Tags [Allowed options: "opt1" (Tag 1), "opt2" (Tag 2)]',
    )
  })

  it('defaults to string for unknown types', () => {
    const fields: AutofillField[] = [
      // @ts-ignore
      { id: 'f1', config: { name: 'Unknown', type: 'invalid' } },
    ]
    const schema = fieldsToTypeBoxSchema(fields)
    expect(schema.properties.f1.type).toBe('string')
  })
})
