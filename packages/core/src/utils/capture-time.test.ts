import { describe, expect, it } from 'vitest'
import { videoCaptureTime, wallClockFromLocalTimestamp } from './capture-time'

describe('wallClockFromLocalTimestamp', () => {
  it('keeps the wall-clock digits and drops the offset', () => {
    expect(wallClockFromLocalTimestamp('2026-09-06T23:30:12+0200')).toBe('2026-09-06T23:30:12.000Z')
    expect(wallClockFromLocalTimestamp('2026-09-06T23:30:12-04:00')).toBe(
      '2026-09-06T23:30:12.000Z',
    )
    expect(wallClockFromLocalTimestamp('2026-09-06 23:30:12.5')).toBe('2026-09-06T23:30:12.500Z')
  })

  it('rejects anything that is not a timestamp', () => {
    expect(wallClockFromLocalTimestamp(undefined)).toBeUndefined()
    expect(wallClockFromLocalTimestamp('yesterday')).toBeUndefined()
    expect(wallClockFromLocalTimestamp('2026-13-45T99:00:00')).toBeUndefined()
  })
})

describe('videoCaptureTime', () => {
  it('prefers the local creation date tag (wall clock) over the UTC creation_time', () => {
    expect(
      videoCaptureTime({
        localCreationDate: '2026-09-06T23:30:12+0200',
        creationTime: '2026-09-06T21:30:12.000000Z',
      }),
    ).toBe('2026-09-06T23:30:12.000Z')
  })

  it('falls back to the UTC creation_time without a local tag', () => {
    expect(videoCaptureTime({ creationTime: '2026-09-06T21:30:12.000000Z' })).toBe(
      '2026-09-06T21:30:12.000Z',
    )
  })

  it('ignores an unset clock and missing tags', () => {
    expect(videoCaptureTime({ creationTime: '1904-01-01T00:00:00.000000Z' })).toBeUndefined()
    expect(videoCaptureTime({ creationTime: 'junk' })).toBeUndefined()
    expect(videoCaptureTime({})).toBeUndefined()
  })
})
