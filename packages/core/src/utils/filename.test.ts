import { describe, it, expect } from 'vitest'
import { sanitizeFilename, stemFromKey } from './filename'

describe('sanitizeFilename', () => {
  it('returns the filename unchanged when it is already safe', () => {
    expect(sanitizeFilename('foo.mp4')).toBe('foo.mp4')
    expect(sanitizeFilename('my-video_final.mov')).toBe('my-video_final.mov')
  })

  it('replaces slashes and backslashes with underscores', () => {
    expect(sanitizeFilename('path/to/file.mp4')).toBe('path_to_file.mp4')
    expect(sanitizeFilename('path\\to\\file.mp4')).toBe('path_to_file.mp4')
  })

  it('replaces NUL bytes and control characters', () => {
    expect(sanitizeFilename('foo\x00bar.mp4')).toBe('foo_bar.mp4')
    expect(sanitizeFilename('foo\x01bar.mp4')).toBe('foo_bar.mp4')
  })

  it('trims leading and trailing dots and whitespace', () => {
    expect(sanitizeFilename('.hidden')).toBe('hidden')
    expect(sanitizeFilename('...dotted...')).toBe('dotted')
    expect(sanitizeFilename('  spaced  ')).toBe('spaced')
    expect(sanitizeFilename('  .mixed. ')).toBe('mixed')
  })

  it('collapses multiple consecutive underscores', () => {
    expect(sanitizeFilename('a//b')).toBe('a_b')
    expect(sanitizeFilename('a///b')).toBe('a_b')
  })

  it('returns "file" for empty or whitespace-only input', () => {
    expect(sanitizeFilename('')).toBe('file')
    expect(sanitizeFilename('   ')).toBe('file')
    expect(sanitizeFilename('...')).toBe('file')
  })

  it('preserves unicode characters', () => {
    expect(sanitizeFilename('视频文件.mp4')).toBe('视频文件.mp4')
    expect(sanitizeFilename('café.png')).toBe('café.png')
  })

  it('preserves spaces within the filename', () => {
    expect(sanitizeFilename('my video file.mp4')).toBe('my video file.mp4')
  })
})

describe('stemFromKey', () => {
  it('extracts the stem from a key with extension', () => {
    expect(stemFromKey('files/01ABC/foo.mp4')).toBe('foo')
    expect(stemFromKey('files/01ABC/my-video.mov')).toBe('my-video')
  })

  it('extracts the stem from a key without extension', () => {
    expect(stemFromKey('files/01ABC/raw')).toBe('raw')
  })

  it('handles keys with multiple dots in filename', () => {
    expect(stemFromKey('files/01ABC/my.video.file.mp4')).toBe('my.video.file')
  })

  it('handles keys with no directory', () => {
    expect(stemFromKey('foo.mp4')).toBe('foo')
    expect(stemFromKey('raw')).toBe('raw')
  })
})
