import { describe, expect, it } from 'vitest'
import {
  formatDateAvid,
  formatDateEdl,
  formatDatePremiere,
  frameToTimecode,
  isDropFrameRate,
  secondToFrame,
} from './timecode'

describe('Timecode and Frame utilities', () => {
  it('detects drop-frame frame rates correctly', () => {
    expect(isDropFrameRate(29.97)).toBe(true)
    expect(isDropFrameRate(59.94)).toBe(true)
    expect(isDropFrameRate(24)).toBe(false)
    expect(isDropFrameRate(23.976)).toBe(false)
    expect(isDropFrameRate(25)).toBe(false)
    expect(isDropFrameRate(30)).toBe(false)
    expect(isDropFrameRate(60)).toBe(false)
  })

  it('converts second to frame index with 0.45 offset', () => {
    expect(secondToFrame(null, 24)).toBe(0)
    expect(secondToFrame(undefined, 24)).toBe(0)
    expect(secondToFrame(0, 24)).toBe(0)
    // 2.168833s at 24000/1001 = 51.999992 -> +0.45 = 52.449992 -> 52 or 51?
    expect(secondToFrame(1.0, 24)).toBe(24)
    expect(secondToFrame(1.5, 24)).toBe(36)
  })

  it('formats non-drop-frame timecode correctly', () => {
    expect(frameToTimecode(0, 24)).toBe('00:00:00:00')
    expect(frameToTimecode(24, 24)).toBe('00:00:01:00')
    expect(frameToTimecode(51, 24)).toBe('00:00:02:03')
    expect(frameToTimecode(115, 24)).toBe('00:00:04:19')
    expect(frameToTimecode(408, 24)).toBe('00:00:17:00')
    expect(frameToTimecode(2496, 24)).toBe('00:01:44:00')
  })

  it('formats drop-frame timecode correctly for 29.97 fps', () => {
    expect(frameToTimecode(0, 29.97)).toBe('00:00:00;00')
    expect(frameToTimecode(30, 29.97)).toBe('00:00:01;00')
    // At minute 1, frames 0 and 1 are dropped in DF timecode
    expect(frameToTimecode(1799, 29.97)).toBe('00:00:59;29')
    expect(frameToTimecode(1800, 29.97)).toBe('00:01:00;02')
  })

  it('respects startTimecode offset', () => {
    expect(frameToTimecode(0, 24, false, '01:00:00:00')).toBe('01:00:00:00')
    expect(frameToTimecode(24, 24, false, '01:00:00:00')).toBe('01:00:01:00')
  })

  it('formats EDL dates matching expected reference patterns', () => {
    const testDate = new Date('2026-09-13T03:26:00Z')
    expect(formatDateEdl(testDate, false)).toBe('Sep 13 13 03:26am')
    expect(formatDateEdl(testDate, true)).toBe('Sep 13 03:26am')
  })

  it('formats Avid dates matching expected reference patterns', () => {
    const testDate = new Date('2026-09-13T03:24:00Z')
    expect(formatDateAvid(testDate)).toBe('Sep 13, 2026 &#183; 03:24')
  })

  it('formats Premiere date matching expected sequence name suffix', () => {
    const testDate = new Date('2026-09-13T03:26:31Z')
    expect(formatDatePremiere(testDate)).toBe('2026-9-13 03-26-31')
  })
})
