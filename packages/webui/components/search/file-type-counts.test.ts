import { describe, expect, it } from 'vitest'
import { cleanPersistedFileTypes, formatFileCount } from './file-type-counts'

describe('formatFileCount', () => {
  it('groups thousands in the reader locale', () => {
    expect(formatFileCount(1204, 'en')).toBe('1,204')
    expect(formatFileCount(1204567, 'en-US')).toBe('1,204,567')
    expect(formatFileCount(1204, 'de')).toBe('1.204')
  })

  it('leaves small numbers alone', () => {
    expect(formatFileCount(0, 'en')).toBe('0')
    expect(formatFileCount(999, 'zh')).toBe('999')
  })

  it('falls back to the runtime default for a bad locale tag', () => {
    expect(formatFileCount(12, 'not a locale!!')).toBe('12')
  })
})

describe('cleanPersistedFileTypes', () => {
  it('drops tokens the server would reject and flags the change', () => {
    const stored = { include: ['jpg', 'tar-gz'], exclude: ['group:editing'] }
    expect(cleanPersistedFileTypes(stored)).toEqual({
      value: { include: ['jpg'], exclude: ['group:editing'] },
      changed: true,
    })
  })

  it('leaves a valid or missing filter alone', () => {
    const ok = { include: ['group:raw', 'jpg'] }
    expect(cleanPersistedFileTypes(ok)).toEqual({ value: ok, changed: false })
    expect(cleanPersistedFileTypes(undefined)).toEqual({ value: {}, changed: false })
  })

  it('resets garbage to an empty filter', () => {
    expect(cleanPersistedFileTypes('nonsense')).toEqual({ value: {}, changed: true })
  })
})
