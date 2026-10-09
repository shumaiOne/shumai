import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_STALE_SWEEP_MINUTES,
  DEFAULT_STALE_UPLOAD_HOURS,
  parseNumberEnv,
  staleSweepIntervalMs,
  staleUploadHours,
} from './upload-env'

describe('parseNumberEnv', () => {
  const spec = { name: 'X', fallback: 5, min: 1, max: 10 }

  it('returns the fallback quietly when unset or blank', () => {
    const warn = vi.fn()
    expect(parseNumberEnv({ ...spec, raw: undefined, warn })).toBe(5)
    expect(parseNumberEnv({ ...spec, raw: '   ', warn })).toBe(5)
    expect(warn).not.toHaveBeenCalled()
  })

  it('accepts numbers inside the range, including decimals and the bounds', () => {
    const warn = vi.fn()
    expect(parseNumberEnv({ ...spec, raw: '7', warn })).toBe(7)
    expect(parseNumberEnv({ ...spec, raw: ' 2.5 ', warn })).toBe(2.5)
    expect(parseNumberEnv({ ...spec, raw: '1', warn })).toBe(1)
    expect(parseNumberEnv({ ...spec, raw: '10', warn })).toBe(10)
    expect(warn).not.toHaveBeenCalled()
  })

  it.each(['abc', '0', '-3', '11', 'Infinity', 'NaN', '1e999'])(
    'falls back with a warning for %s',
    (raw) => {
      const warn = vi.fn()
      expect(parseNumberEnv({ ...spec, raw, warn })).toBe(5)
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0][0]).toContain('X')
      expect(warn.mock.calls[0][0]).toContain(`"${raw}"`)
    },
  )
})

describe('staleUploadHours', () => {
  it('defaults to 24 hours', () => {
    expect(staleUploadHours({})).toBe(DEFAULT_STALE_UPLOAD_HOURS)
    expect(DEFAULT_STALE_UPLOAD_HOURS).toBe(24)
  })

  it('reads UPLOAD_STALE_AFTER_HOURS', () => {
    expect(staleUploadHours({ UPLOAD_STALE_AFTER_HOURS: '6' })).toBe(6)
    expect(staleUploadHours({ UPLOAD_STALE_AFTER_HOURS: '0.5' })).toBe(0.5)
  })

  it('warns and falls back on an invalid value', () => {
    const warn = vi.fn()
    expect(staleUploadHours({ UPLOAD_STALE_AFTER_HOURS: 'soon' }, warn)).toBe(24)
    expect(staleUploadHours({ UPLOAD_STALE_AFTER_HOURS: '-1' }, warn)).toBe(24)
    expect(warn).toHaveBeenCalledTimes(2)
  })
})

describe('staleSweepIntervalMs', () => {
  it('defaults to 15 minutes', () => {
    expect(staleSweepIntervalMs({})).toBe(DEFAULT_STALE_SWEEP_MINUTES * 60_000)
    expect(staleSweepIntervalMs({})).toBe(900_000)
  })

  it('reads UPLOAD_STALE_SWEEP_INTERVAL_MINUTES', () => {
    expect(staleSweepIntervalMs({ UPLOAD_STALE_SWEEP_INTERVAL_MINUTES: '5' })).toBe(300_000)
  })

  it('rejects zero, negatives, junk and intervals over a day', () => {
    const warn = vi.fn()
    for (const raw of ['0', '-5', 'x', '1441']) {
      expect(staleSweepIntervalMs({ UPLOAD_STALE_SWEEP_INTERVAL_MINUTES: raw }, warn)).toBe(900_000)
    }
    expect(warn).toHaveBeenCalledTimes(4)
  })
})
