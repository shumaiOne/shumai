import { describe, it, expect } from 'vitest'
import { formatTimecode, calculateFrameCenterTime } from './utils'

describe('formatTimecode tests', () => {
  describe('non-drop-frame calculations', () => {
    it('formats non-drop-frame correctly at 25 fps', () => {
      // 2999 frames at 25 fps => 00:01:59:24
      expect(formatTimecode(2999, 25, 'timecode')).toBe('00:01:59:24')
      // 3000 frames at 25 fps => 00:02:00:00
      expect(formatTimecode(3000, 25, 'timecode')).toBe('00:02:00:00')
      // 15000 frames at 25 fps => 00:10:00:00
      expect(formatTimecode(15000, 25, 'timecode')).toBe('00:10:00:00')
      // 900000 frames at 25 fps => 10:00:00:00
      expect(formatTimecode(900000, 25, 'timecode')).toBe('10:00:00:00')
    })
  })

  describe('drop-frame calculations', () => {
    it('formats drop-frame correctly at 29.97 fps', () => {
      // 3597 frames at 29.97 fps => 00:01:59;29
      expect(formatTimecode(3597, 29.97, 'timecode')).toBe('00:01:59;29')
      // 17982 frames at 29.97 fps => 00:10:00;00
      expect(formatTimecode(17982, 29.97, 'timecode')).toBe('00:10:00;00')
      // 1078920 frames at 29.97 fps => 10:00:00;00
      expect(formatTimecode(1078920, 29.97, 'timecode')).toBe('10:00:00;00')
    })

    it('formats drop-frame correctly at 59.94 fps', () => {
      // 3597 * 2 + 1 = 7195 frames at 59.94 fps => 00:01:59;59
      expect(formatTimecode(7195, 59.94, 'timecode')).toBe('00:01:59;59')
      // 17982 * 2 = 35964 frames at 59.94 fps => 00:10:00;00
      expect(formatTimecode(35964, 59.94, 'timecode')).toBe('00:10:00;00')
      // 1078920 * 2 = 2157840 frames at 59.94 fps => 10:00:00;00
      expect(formatTimecode(2157840, 59.94, 'timecode')).toBe('10:00:00;00')
    })
  })

  describe('starting timecode offsets', () => {
    it('offsets timecode correctly based on startTimecode string', () => {
      // 0 frames at 29.97 fps with start '01:00:00:00' => 01:00:00:00
      expect(formatTimecode(0, 29.97, 'timecode', '01:00:00:00')).toBe('01:00:00:00')
      // 0 frames at 29.97 fps with start '01:00:00;00' => 01:00:00;00
      expect(formatTimecode(0, 29.97, 'timecode', '01:00:00;00')).toBe('01:00:00;00')
      // 30 frames at 30 fps with start '01:00:00:00' => 01:00:01:00
      expect(formatTimecode(30, 30, 'timecode', '01:00:00:00')).toBe('01:00:01:00')
    })
  })

  describe('other display modes', () => {
    it('formats as frames index', () => {
      expect(formatTimecode(150, 30, 'frames')).toBe('150 fr')
    })

    it('formats as standard MM:SS time', () => {
      expect(formatTimecode(150, 30, 'standard')).toBe('00:05')
    })
  })

  describe('calculateFrameCenterTime tests', () => {
    it('calculates frame center time correctly', () => {
      // frame 0 at 30 fps => 0 * 1/30 + 1/60 = 1/60 = 0.0166666...
      expect(calculateFrameCenterTime(0, 30)).toBeCloseTo(0.0166666, 5)
      // frame 251 at 30 fps => 251 * 1/30 + 1/60 = 251.5 / 30 = 8.3833333...
      expect(calculateFrameCenterTime(251, 30)).toBeCloseTo(8.3833333, 5)
      // frame rate 0 returns 0
      expect(calculateFrameCenterTime(10, 0)).toBe(0)
    })
  })
})
