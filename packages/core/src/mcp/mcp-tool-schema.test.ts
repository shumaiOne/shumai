import { describe, it, expect } from 'vitest'
import { toToolParameters, formatSchema } from './mcp-tool-schema'
import { compile } from '@earendil-works/pi-schema'

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
    expect(() => compile(params)).not.toThrow()
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
    const compiled = compile(params)
    expect(compiled.check({ q: 'hello' })).toBe(true)
  })

  it('supports anyOf and enums', () => {
    const params = toToolParameters({
      type: 'object',
      properties: {
        value: { anyOf: [{ type: 'string' }, { type: 'number' }] },
        color: { type: 'string', enum: ['red', 'blue'] },
      },
    })
    const compiled = compile(params)
    expect(compiled.check({ value: 42, color: 'red' })).toBe(true)
    expect(compiled.check({ value: 'x', color: 'green' })).toBe(false)
  })

  it('supports additionalProperties and patternProperties', () => {
    const params = toToolParameters({
      type: 'object',
      properties: { a: { type: 'string' } },
      additionalProperties: false,
    })
    const compiled = compile(params)
    expect(compiled.check({ a: 'x' })).toBe(true)

    const patterned = toToolParameters({
      type: 'object',
      patternProperties: { '^x-': { type: 'string' } },
    })
    expect(() => compile(patterned)).not.toThrow()
  })

  it('normalizes non-object roots to an object', () => {
    expect(toToolParameters({ type: 'string' })).toMatchObject({ type: 'object' })
  })

  it('falls back to a permissive record for invalid schemas', () => {
    const params = toToolParameters({ type: 'object', properties: { bad: { type: 'not-a-type' } } })
    const compiled = compile(params)
    // Fallback must accept arbitrary arguments.
    expect(compiled.check({ anything: 123, nested: { x: 1 } })).toBe(true)
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
