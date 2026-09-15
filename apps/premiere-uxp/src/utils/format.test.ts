import { describe, it, expect } from 'vitest'
import { formatBytes, formatDuration } from './format'

describe('formatBytes', () => {
  it('handles null, undefined, 0 and invalid inputs', () => {
    expect(formatBytes(null)).toBe('0 B')
    expect(formatBytes(undefined)).toBe('0 B')
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(-100)).toBe('0 B')
    expect(formatBytes(NaN)).toBe('0 B')
  })

  it('formats bytes correctly', () => {
    expect(formatBytes(500)).toBe('500 B')
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(1048576)).toBe('1.0 MB')
    expect(formatBytes(1073741824)).toBe('1.0 GB')
  })
})

describe('formatDuration', () => {
  it('returns null for invalid or non-positive durations', () => {
    expect(formatDuration(null)).toBeNull()
    expect(formatDuration(undefined)).toBeNull()
    expect(formatDuration(0)).toBeNull()
    expect(formatDuration(-15)).toBeNull()
    expect(formatDuration(NaN)).toBeNull()
  })

  it('formats seconds into MM:SS format', () => {
    expect(formatDuration(5.4)).toBe('00:05')
    expect(formatDuration(59)).toBe('00:59')
    expect(formatDuration(60)).toBe('01:00')
    expect(formatDuration(65)).toBe('01:05')
    expect(formatDuration(3599)).toBe('59:59')
  })

  it('formats hours into H:MM:SS format', () => {
    expect(formatDuration(3600)).toBe('1:00:00')
    expect(formatDuration(3665)).toBe('1:01:05')
    expect(formatDuration(36665)).toBe('10:11:05')
  })
})
