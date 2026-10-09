import { describe, it, expect } from 'vitest'
import {
  expandFileTypes,
  fileExtension,
  fileTypeFilterSchema,
  groupFileTypeCounts,
  isFileTypeFilterActive,
} from './file-types'
import { fileTypeCountsRequestSchema } from './search'

describe('groupFileTypeCounts', () => {
  it('rolls extensions up into their groups and zero-fills the rest', () => {
    const totals = groupFileTypeCounts([
      { extension: 'raf', count: 1000 },
      { extension: 'arw', count: 204 },
      { extension: 'jpg', count: 7 },
      { extension: 'JPEG', count: 3 },
      { extension: 'xmp', count: 5 },
      { extension: 'txt', count: 99 },
      { extension: '', count: 4 },
    ])
    expect(totals).toEqual({ raw: 1204, jpeg: 10, heif: 0, video: 0, editing: 5 })
  })

  it('handles missing data', () => {
    expect(groupFileTypeCounts(undefined)).toEqual({
      raw: 0,
      jpeg: 0,
      heif: 0,
      video: 0,
      editing: 0,
    })
  })
})

describe('fileTypeCountsRequestSchema', () => {
  it('defaults to a non-recursive, unconditioned count and drops the file-type filter', () => {
    expect(fileTypeCountsRequestSchema.parse({})).toEqual({
      operator: 'AND',
      conditions: [],
      recursively: false,
    })
    const parsed = fileTypeCountsRequestSchema.parse({
      recursively: true,
      fileTypes: { include: ['raf'] },
    })
    expect(parsed).not.toHaveProperty('fileTypes')
    expect(parsed.recursively).toBe(true)
  })
})

describe('expandFileTypes', () => {
  it('expands groups, lowercases, strips dots and de-duplicates', () => {
    expect(expandFileTypes(['group:jpeg', '.JPG', 'RAF'])).toEqual(['jpg', 'jpeg', 'raf'])
    expect(expandFileTypes(['group:raw'])).toContain('arw')
    expect(expandFileTypes(['group:editing'])).toContain('xmp')
  })

  it('drops unknown groups and handles undefined', () => {
    expect(expandFileTypes(['group:nope'])).toEqual([])
    expect(expandFileTypes(undefined)).toEqual([])
  })
})

describe('fileTypeFilterSchema', () => {
  it('accepts extensions and groups, normalising case', () => {
    expect(fileTypeFilterSchema.parse({ include: ['RAF', 'group:raw'] })).toEqual({
      include: ['raf', 'group:raw'],
    })
  })

  it('rejects anything that is not a plain extension or a group', () => {
    expect(() => fileTypeFilterSchema.parse({ include: ["raf'; drop table assets"] })).toThrow()
    expect(() => fileTypeFilterSchema.parse({ exclude: ['a.b'] })).toThrow()
  })
})

describe('helpers', () => {
  it('reads the last extension', () => {
    expect(fileExtension('DSCF5056.RAF.xmp')).toBe('xmp')
    expect(fileExtension('notes')).toBe('')
    expect(fileExtension('.hidden')).toBe('')
  })

  it('knows when a filter is active', () => {
    expect(isFileTypeFilterActive(undefined)).toBe(false)
    expect(isFileTypeFilterActive({ include: [], exclude: [] })).toBe(false)
    expect(isFileTypeFilterActive({ exclude: ['group:editing'] })).toBe(true)
  })
})
