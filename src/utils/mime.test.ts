import { describe, it, expect } from 'vitest'
import { detectSupportedMimeType } from './mime'

describe('detectSupportedMimeType', () => {
  it('should detect JPEG', () => {
    const buffer = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
    expect(detectSupportedMimeType(buffer)).toBe('image/jpeg')
  })

  it('should detect PNG', () => {
    const buffer = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52,
    ])
    expect(detectSupportedMimeType(buffer)).toBe('image/png')
  })

  it('should detect GIF', () => {
    const buffer = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
    expect(detectSupportedMimeType(buffer)).toBe('image/gif')
  })

  it('should detect WEBP', () => {
    const buffer = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ])
    expect(detectSupportedMimeType(buffer)).toBe('image/webp')
  })

  it('should detect MP4', () => {
    const buffer = new Uint8Array([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
    ])
    expect(detectSupportedMimeType(buffer)).toBe('video/mp4')
  })

  it('should return null for unknown type', () => {
    const buffer = new Uint8Array([0x00, 0x00, 0x00, 0x00])
    expect(detectSupportedMimeType(buffer)).toBeNull()
  })
})
