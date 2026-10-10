import { describe, expect, it } from 'vitest'
import {
  listDuplicatesRequestSchema,
  MAX_RESOLVE_DELETE_IDS,
  resolveDuplicatesRequestSchema,
} from './duplicates'

describe('resolveDuplicatesRequestSchema', () => {
  it('accepts a keeper and the copies to delete', () => {
    const parsed = resolveDuplicatesRequestSchema.parse({ keepId: 'a', deleteIds: ['b', 'c'] })
    expect(parsed).toEqual({ keepId: 'a', deleteIds: ['b', 'c'] })
  })

  it('rejects a request that deletes the file it keeps', () => {
    expect(
      resolveDuplicatesRequestSchema.safeParse({ keepId: 'a', deleteIds: ['b', 'a'] }).success,
    ).toBe(false)
  })

  it('rejects an empty keeper, an empty delete list and empty ids', () => {
    expect(resolveDuplicatesRequestSchema.safeParse({ keepId: '', deleteIds: ['b'] }).success).toBe(
      false,
    )
    expect(resolveDuplicatesRequestSchema.safeParse({ keepId: 'a', deleteIds: [] }).success).toBe(
      false,
    )
    expect(resolveDuplicatesRequestSchema.safeParse({ keepId: 'a', deleteIds: [''] }).success).toBe(
      false,
    )
  })

  it('rejects more ids than the limit', () => {
    const deleteIds = Array.from({ length: MAX_RESOLVE_DELETE_IDS + 1 }, (_, i) => `id-${i}`)
    expect(resolveDuplicatesRequestSchema.safeParse({ keepId: 'a', deleteIds }).success).toBe(false)
  })
})

describe('listDuplicatesRequestSchema', () => {
  it('defaults the limit and coerces query strings', () => {
    expect(listDuplicatesRequestSchema.parse({}).limit).toBe(50)
    expect(listDuplicatesRequestSchema.parse({ limit: '20' }).limit).toBe(20)
  })

  it('rejects out of range limits', () => {
    expect(listDuplicatesRequestSchema.safeParse({ limit: '0' }).success).toBe(false)
    expect(listDuplicatesRequestSchema.safeParse({ limit: '201' }).success).toBe(false)
  })
})
