import { describe, expect, it } from 'vitest'
import {
  expandFileTypes,
  FILE_TYPE_GROUPS,
  fileTypeFilterSchema,
  RAW_EXTENSIONS,
  sanitizeFileTypeFilter,
} from './file-types'

describe('sanitizeFileTypeFilter', () => {
  it('drops tokens the search request would reject and normalises the rest', () => {
    expect(
      sanitizeFileTypeFilter({
        include: ['JPG', 'tar-gz', 'group:raw', 'averyveryverylongextension', ' raf '],
        exclude: ['group:editing', 'group:nope', 'group:constructor', 42, 'a.b'],
      }),
    ).toEqual({ include: ['jpg', 'group:raw', 'raf'], exclude: ['group:editing'] })
  })

  it('returns an empty filter for nothing usable', () => {
    expect(sanitizeFileTypeFilter(undefined)).toEqual({})
    expect(sanitizeFileTypeFilter('jpg')).toEqual({})
    expect(sanitizeFileTypeFilter({ include: ['tar-gz'], exclude: 'xmp' })).toEqual({})
  })

  it('always produces a filter the request schema accepts', () => {
    const cleaned = sanitizeFileTypeFilter({ include: ['tar-gz', 'jpg'], exclude: ['!!'] })
    expect(fileTypeFilterSchema.safeParse(cleaned).success).toBe(true)
  })
})

describe('the shared RAW list', () => {
  it('is the one list behind the RAW group, with 23 formats', () => {
    expect(FILE_TYPE_GROUPS.raw).toBe(RAW_EXTENSIONS)
    expect(RAW_EXTENSIONS).toHaveLength(23)
    expect(new Set(RAW_EXTENSIONS).size).toBe(23)
  })

  it('expands group:raw to all of them and ignores a made-up group', () => {
    expect(expandFileTypes(['group:raw'])).toHaveLength(23)
    expect(expandFileTypes(['group:constructor', 'group:toString'])).toEqual([])
  })
})
