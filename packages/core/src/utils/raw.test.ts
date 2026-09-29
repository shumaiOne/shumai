import { describe, it, expect } from 'vitest'
import { isRawImage } from './raw'

describe('isRawImage', () => {
  it('recognizes common RAW extensions (lowercase)', () => {
    expect(isRawImage('photo.cr2')).toBe(true)
    expect(isRawImage('photo.arw')).toBe(true)
    expect(isRawImage('photo.dng')).toBe(true)
    expect(isRawImage('photo.nef')).toBe(true)
    expect(isRawImage('photo.raf')).toBe(true)
    expect(isRawImage('photo.rw2')).toBe(true)
    expect(isRawImage('photo.orf')).toBe(true)
    expect(isRawImage('photo.pef')).toBe(true)
    expect(isRawImage('photo.cr3')).toBe(true)
    expect(isRawImage('photo.x3f')).toBe(true)
    expect(isRawImage('photo.raw')).toBe(true)
    expect(isRawImage('photo.3fr')).toBe(true)
    expect(isRawImage('photo.iiq')).toBe(true)
    expect(isRawImage('photo.kdc')).toBe(true)
    expect(isRawImage('photo.dcr')).toBe(true)
    expect(isRawImage('photo.erf')).toBe(true)
    expect(isRawImage('photo.fff')).toBe(true)
    expect(isRawImage('photo.crw')).toBe(true)
    expect(isRawImage('photo.nrw')).toBe(true)
    expect(isRawImage('photo.rwl')).toBe(true)
    expect(isRawImage('photo.sr2')).toBe(true)
    expect(isRawImage('photo.srf')).toBe(true)
    expect(isRawImage('photo.srw')).toBe(true)
  })

  it('recognizes RAW extensions case-insensitively', () => {
    expect(isRawImage('photo.CR2')).toBe(true)
    expect(isRawImage('IMG_1234.ARW')).toBe(true)
    expect(isRawImage('test.DNG')).toBe(true)
    expect(isRawImage('photo.Nef')).toBe(true)
  })

  it('rejects non-RAW image files', () => {
    expect(isRawImage('photo.jpg')).toBe(false)
    expect(isRawImage('photo.png')).toBe(false)
    expect(isRawImage('photo.webp')).toBe(false)
    expect(isRawImage('photo.gif')).toBe(false)
    expect(isRawImage('photo.svg')).toBe(false)
  })

  it('rejects non-image files', () => {
    expect(isRawImage('design.psd')).toBe(false)
    expect(isRawImage('video.mp4')).toBe(false)
    expect(isRawImage('doc.pdf')).toBe(false)
    expect(isRawImage('readme.txt')).toBe(false)
  })

  it('rejects files without extensions', () => {
    expect(isRawImage('photo')).toBe(false)
    expect(isRawImage('rawfile')).toBe(false)
  })

  it('handles filenames with multiple dots', () => {
    expect(isRawImage('my.photo.cr2')).toBe(true)
    expect(isRawImage('backup.2024.dng')).toBe(true)
    expect(isRawImage('my.photo.jpg')).toBe(false)
  })

  it('handles paths with directories', () => {
    expect(isRawImage('/home/user/photos/photo.cr2')).toBe(true)
    expect(isRawImage('C:\\Users\\photos\\photo.arw')).toBe(true)
  })
})
