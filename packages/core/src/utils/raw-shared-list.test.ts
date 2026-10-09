import { FILE_TYPE_GROUPS, RAW_EXTENSIONS } from '@shumai/dtos'
import { describe, expect, it } from 'vitest'
import { isRawImage } from './raw'

describe('isRawImage', () => {
  it('recognises every extension in the shared RAW list, in any case', () => {
    for (const ext of RAW_EXTENSIONS) {
      expect(isRawImage(`DSC0001.${ext}`)).toBe(true)
      expect(isRawImage(`DSC0001.${ext.toUpperCase()}`)).toBe(true)
    }
  })

  it('keeps the 23 camera RAW formats it always had', () => {
    expect(RAW_EXTENSIONS).toHaveLength(23)
    for (const ext of ['dcr', 'erf', 'fff', 'kdc', 'raw', 'raf', 'x3f']) {
      expect(RAW_EXTENSIONS).toContain(ext)
    }
  })

  it('rejects other files', () => {
    expect(isRawImage('photo.jpg')).toBe(false)
    expect(isRawImage('DSC0001.RAF.xmp')).toBe(false)
    expect(isRawImage('raf')).toBe(false)
  })

  it('is the same list the file-type filter offers as RAW', () => {
    expect([...FILE_TYPE_GROUPS.raw].sort()).toEqual([...RAW_EXTENSIONS].sort())
  })
})
