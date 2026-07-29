import { describe, expect, it } from 'vitest'
import { formatSize } from './format'

describe('formatSize', () => {
  it('formats zero bytes', () => {
    expect(formatSize(0)).toBe('0 B')
  })

  it('formats bytes below 1 KB', () => {
    expect(formatSize(500)).toBe('500 B')
  })

  it('formats KB', () => {
    expect(formatSize(1000)).toBe('1 KB')
    expect(formatSize(1500)).toBe('1.5 KB')
  })

  it('formats MB', () => {
    expect(formatSize(1000000)).toBe('1 MB')
    expect(formatSize(2500000)).toBe('2.5 MB')
  })

  it('formats GB correctly using decimal standard', () => {
    expect(formatSize(4109222091)).toBe('4.11 GB')
  })
})
