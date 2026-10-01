import { describe, it, expect } from 'vitest'
import { isImageFileName, getBestTranscode, getVideoResolutionLabel } from './media'

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

describe('getVideoResolutionLabel', () => {
  it('preserves explicit resolution when present', () => {
    expect(getVideoResolutionLabel({ width: 854, height: 480, resolution: '480p' })).toBe('480p')
    expect(getVideoResolutionLabel({ width: 480, height: 854, resolution: '480p' })).toBe('480p')
    expect(getVideoResolutionLabel({ width: 1920, height: 1080, resolution: '1080p' })).toBe(
      '1080p',
    )
  })

  it('derives resolution from long side for portrait legacy transcodes without explicit resolution', () => {
    // 4K portrait
    expect(getVideoResolutionLabel({ width: 2160, height: 3840 })).toBe('2160p')
    // 2K / 1440p portrait
    expect(getVideoResolutionLabel({ width: 1440, height: 2560 })).toBe('1440p')
    // 1080p portrait
    expect(getVideoResolutionLabel({ width: 1080, height: 1920 })).toBe('1080p')
    // 720p portrait
    expect(getVideoResolutionLabel({ width: 720, height: 1280 })).toBe('720p')
    // 480p portrait
    expect(getVideoResolutionLabel({ width: 480, height: 854 })).toBe('480p')
    // 360p portrait
    expect(getVideoResolutionLabel({ width: 360, height: 640 })).toBe('360p')
    // 180p portrait
    expect(getVideoResolutionLabel({ width: 180, height: 320 })).toBe('180p')
  })

  it('derives resolution from long side for landscape legacy transcodes without explicit resolution', () => {
    expect(getVideoResolutionLabel({ width: 3840, height: 2160 })).toBe('2160p')
    expect(getVideoResolutionLabel({ width: 2560, height: 1440 })).toBe('1440p')
    expect(getVideoResolutionLabel({ width: 1920, height: 1080 })).toBe('1080p')
    expect(getVideoResolutionLabel({ width: 1280, height: 720 })).toBe('720p')
    expect(getVideoResolutionLabel({ width: 854, height: 480 })).toBe('480p')
    expect(getVideoResolutionLabel({ width: 640, height: 360 })).toBe('360p')
    expect(getVideoResolutionLabel({ width: 320, height: 180 })).toBe('180p')
  })

  it('falls back to short side or single dimension for non-standard sizes', () => {
    expect(getVideoResolutionLabel({ width: 200, height: 100 })).toBe('100p')
    expect(getVideoResolutionLabel({ height: 720 })).toBe('720p')
    expect(getVideoResolutionLabel({ width: 500 })).toBe('500p')
    expect(getVideoResolutionLabel(null)).toBe('')
    expect(getVideoResolutionLabel(undefined)).toBe('')
  })
})
