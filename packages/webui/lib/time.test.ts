import { describe, it, expect } from 'vitest'
import { formatRemainingTime } from './time'

describe('formatRemainingTime', () => {
  const baseNow = new Date('2026-08-17T12:00:00Z')

  it('formats hours and minutes', () => {
    const target = new Date('2026-08-17T15:18:00Z')
    expect(formatRemainingTime(target, baseNow)).toBe('3h 18m')
  })

  it('formats exact hours', () => {
    const target = new Date('2026-08-17T15:00:00Z')
    expect(formatRemainingTime(target, baseNow)).toBe('3h')
  })

  it('formats minutes only', () => {
    const target = new Date('2026-08-17T12:45:00Z')
    expect(formatRemainingTime(target, baseNow)).toBe('45m')
  })

  it('formats days and hours', () => {
    const target = new Date('2026-08-19T16:00:00Z')
    expect(formatRemainingTime(target, baseNow)).toBe('2d 4h')
  })

  it('formats days only', () => {
    const target = new Date('2026-08-19T12:00:00Z')
    expect(formatRemainingTime(target, baseNow)).toBe('2d')
  })

  it('handles less than 1 minute', () => {
    const target = new Date('2026-08-17T12:00:30Z')
    expect(formatRemainingTime(target, baseNow)).toBe('< 1m')
  })

  it('handles past or equal dates', () => {
    const past = new Date('2026-08-17T11:00:00Z')
    expect(formatRemainingTime(past, baseNow)).toBe('< 1m')
    expect(formatRemainingTime(baseNow, baseNow)).toBe('< 1m')
  })

  it('accepts ISO strings', () => {
    expect(formatRemainingTime('2026-08-17T15:18:00Z', baseNow)).toBe('3h 18m')
  })
})
