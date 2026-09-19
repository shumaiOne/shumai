import { describe, it, expect } from 'vitest'
import { formatRemainingTime, getTrashDaysLeft } from './time'

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

describe('getTrashDaysLeft', () => {
  const now = new Date('2026-08-17T12:00:00Z')

  it('returns the full retention window for a freshly deleted asset', () => {
    expect(getTrashDaysLeft('2026-08-17T12:00:00Z', now)).toBe(30)
  })

  it('counts down as days pass', () => {
    expect(getTrashDaysLeft('2026-08-16T12:00:00Z', now)).toBe(29)
    expect(getTrashDaysLeft('2026-08-06T12:00:00Z', now)).toBe(19)
  })

  it('rounds partial days up', () => {
    // Deleted 23h ago: 29d 1h remain, which rounds up to 30
    expect(getTrashDaysLeft('2026-08-16T13:00:00Z', now)).toBe(30)
  })

  it('never returns less than zero once the retention window has elapsed', () => {
    expect(getTrashDaysLeft('2026-07-01T12:00:00Z', now)).toBe(0)
  })

  it('returns null when there is no valid deletedAt', () => {
    expect(getTrashDaysLeft(null, now)).toBeNull()
    expect(getTrashDaysLeft(undefined, now)).toBeNull()
    expect(getTrashDaysLeft('', now)).toBeNull()
    expect(getTrashDaysLeft('not-a-date', now)).toBeNull()
  })
})
