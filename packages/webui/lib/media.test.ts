import { describe, it, expect } from 'vitest'
import { isImageFileName, getBestTranscode } from './media'

describe('isImageFileName', () => {
  it('identifies web-supported image formats as images', () => {
    expect(isImageFileName('photo.png')).toBe(true)
    expect(isImageFileName('photo.jpg')).toBe(true)
    expect(isImageFileName('photo.jpeg')).toBe(true)
    expect(isImageFileName('photo.webp')).toBe(true)
    expect(isImageFileName('animation.gif')).toBe(true)
    expect(isImageFileName('icon.svg')).toBe(true)
    expect(isImageFileName('image.avif')).toBe(true)
    expect(isImageFileName('bitmap.bmp')).toBe(true)
    expect(isImageFileName('favicon.ico')).toBe(true)
  })

  it('handles uppercase extensions and paths/urls with query params', () => {
    expect(isImageFileName('PHOTO.PNG')).toBe(true)
    expect(isImageFileName('PHOTO.JPEG')).toBe(true)
    expect(isImageFileName('/path/to/my-image.webp')).toBe(true)
  })

  it('does not treat non-web-renderable or non-image files as images', () => {
    expect(isImageFileName('design.psd')).toBe(false)
    expect(isImageFileName('photo.raw')).toBe(false)
    expect(isImageFileName('document.pdf')).toBe(false)
    expect(isImageFileName('video.mp4')).toBe(false)
    expect(isImageFileName('archive.zip')).toBe(false)
    expect(isImageFileName('notes.txt')).toBe(false)
    expect(isImageFileName('')).toBe(false)
    expect(isImageFileName(null)).toBe(false)
    expect(isImageFileName(undefined)).toBe(false)
  })
})

describe('getBestTranscode', () => {
  it('returns null if transcodes array is empty or undefined', () => {
    expect(getBestTranscode(undefined, 800)).toBeNull()
    expect(getBestTranscode([], 800)).toBeNull()
  })

  it('picks smallest transcode >= screenWidth or falls back to largest', () => {
    const transcodes = [
      { id: '1', width: 400, height: 300, url: '', key: '', size: 100 },
      { id: '2', width: 800, height: 600, url: '', key: '', size: 200 },
      { id: '3', width: 1200, height: 900, url: '', key: '', size: 300 },
    ]
    expect(getBestTranscode(transcodes, 700)?.width).toBe(800)
    expect(getBestTranscode(transcodes, 1500)?.width).toBe(1200)
  })
})
