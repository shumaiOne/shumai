import { describe, it, expect } from 'vitest'
import { getFileTypeCategory, type AssetSummary } from './FileItem'

describe('getFileTypeCategory', () => {
  it('identifies folder type', () => {
    const asset: AssetSummary = {
      id: 'f1',
      name: 'My Folder',
      type: 'folder',
    }
    expect(getFileTypeCategory(asset)).toBe('folder')
  })

  it('identifies video by mimeType', () => {
    const asset: AssetSummary = {
      id: 'v1',
      name: 'clip.dat',
      type: 'file',
      mimeType: 'video/mp4',
    }
    expect(getFileTypeCategory(asset)).toBe('video')
  })

  it('identifies video by extension', () => {
    const extensions = ['mp4', 'mov', 'avi', 'mkv', 'm4v', 'webm']
    for (const ext of extensions) {
      const asset: AssetSummary = {
        id: `v-${ext}`,
        name: `sample.${ext}`,
        type: 'file',
      }
      expect(getFileTypeCategory(asset)).toBe('video')
    }
  })

  it('identifies audio by mimeType or extension', () => {
    const asset1: AssetSummary = {
      id: 'a1',
      name: 'audio.raw',
      type: 'file',
      mimeType: 'audio/wav',
    }
    const asset2: AssetSummary = {
      id: 'a2',
      name: 'track.mp3',
      type: 'file',
    }
    expect(getFileTypeCategory(asset1)).toBe('audio')
    expect(getFileTypeCategory(asset2)).toBe('audio')
  })

  it('identifies image by mimeType or extension', () => {
    const asset1: AssetSummary = {
      id: 'i1',
      name: 'photo.bin',
      type: 'file',
      mimeType: 'image/png',
    }
    const asset2: AssetSummary = {
      id: 'i2',
      name: 'art.jpg',
      type: 'file',
    }
    expect(getFileTypeCategory(asset1)).toBe('image')
    expect(getFileTypeCategory(asset2)).toBe('image')
  })

  it('falls back to generic file', () => {
    const asset: AssetSummary = {
      id: 'doc1',
      name: 'notes.pdf',
      type: 'file',
      mimeType: 'application/pdf',
    }
    expect(getFileTypeCategory(asset)).toBe('file')
  })
})
