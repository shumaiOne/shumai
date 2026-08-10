import { describe, it, expect } from 'vitest'
import { toToolParameters, formatSchema } from './mcp-tool-schema'
import { Compile } from 'typebox/compile'

describe('toToolParameters', () => {
  it('passes through a plain object schema', () => {
    const schema = {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    }
    const params = toToolParameters(schema)
    expect(params).toMatchObject({ type: 'object', properties: { query: { type: 'string' } } })
    // The resulting schema must compile with the same validator pi-ai uses.
    expect(() => Compile(params)).not.toThrow()
  })

  it('strips $schema / $id / $comment keywords', () => {
    const params = toToolParameters({
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'https://example.com/tool.json',
      $comment: 'strip me',
      type: 'object',
      properties: { a: { type: 'string' } },
    })
    expect(JSON.stringify(params)).not.toContain('$schema')
    expect(JSON.stringify(params)).not.toContain('$id')
    expect(JSON.stringify(params)).not.toContain('$comment')
  })

  it('supports $defs / $ref schemas', () => {
    const params = toToolParameters({
      type: 'object',
      properties: { q: { $ref: '#/$defs/query' } },
      $defs: { query: { type: 'string' } },
      required: ['q'],
    })
    const compiled = Compile(params)
    expect(compiled.Check({ q: 'hello' })).toBe(true)
  })

  it('supports anyOf and enums', () => {
    const params = toToolParameters({
      type: 'object',
      properties: {
        value: { anyOf: [{ type: 'string' }, { type: 'number' }] },
        color: { type: 'string', enum: ['red', 'blue'] },
      },
    })
    const compiled = Compile(params)
    expect(compiled.Check({ value: 42, color: 'red' })).toBe(true)
    expect(compiled.Check({ value: 'x', color: 'green' })).toBe(false)
  })

  it('supports additionalProperties and patternProperties', () => {
    const params = toToolParameters({
      type: 'object',
      properties: { a: { type: 'string' } },
      additionalProperties: false,
    })
    const compiled = Compile(params)
    expect(compiled.Check({ a: 'x' })).toBe(true)

    const patterned = toToolParameters({
      type: 'object',
      patternProperties: { '^x-': { type: 'string' } },
    })
    expect(() => Compile(patterned)).not.toThrow()
  })

  it('normalizes non-object roots to an object', () => {
    expect(toToolParameters({ type: 'string' })).toMatchObject({ type: 'object' })
  })

  it('falls back to a permissive record for invalid schemas', () => {
    const params = toToolParameters({ type: 'object', properties: { bad: { type: 'not-a-type' } } })
    const compiled = Compile(params)
    // Fallback must accept arbitrary arguments.
    expect(compiled.Check({ anything: 123, nested: { x: 1 } })).toBe(true)
  })

  it('handles undefined / empty input', () => {
    expect(toToolParameters(undefined)).toMatchObject({ type: 'object' })
    expect(toToolParameters(null)).toMatchObject({ type: 'object' })
  })
})

describe('formatSchema', () => {
  it('formats JSON Schema as indented text', () => {
    const text = formatSchema({ type: 'object', properties: { a: { type: 'string' } } })
    expect(text).toContain('"type": "object"')
    expect(text).toContain('"properties"')
  })

  it('returns empty string for non-objects', () => {
    expect(formatSchema(undefined)).toBe('')
    expect(formatSchema(42)).toBe('')
  })
})
