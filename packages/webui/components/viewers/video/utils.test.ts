import { describe, it, expect } from 'vitest'
import {
  formatTimecode,
  calculateFrameCenterTime,
  resolveTotalFrames,
  stallThresholdMs,
} from './utils'

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

describe('stallThresholdMs', () => {
  it('is 100ms at 30fps and 60fps (floor of 100ms dominates)', () => {
    expect(stallThresholdMs(30)).toBe(100)
    expect(stallThresholdMs(60)).toBe(100)
  })

  it('is frame-rate dependent below 30fps', () => {
    // 3000 / 24 = 125ms
    expect(stallThresholdMs(24)).toBe(125)
    // 3000 / 25 = 120ms
    expect(stallThresholdMs(25)).toBe(120)
  })

  it('guards against a falsy frame rate by treating it as 30fps', () => {
    expect(stallThresholdMs(0)).toBe(100)
  })
})

describe('resolveTotalFrames', () => {
  describe('at 30fps (100ms stall threshold)', () => {
    it('uses the video-stream count when there is no container tail', () => {
      expect(resolveTotalFrames({ dbTotalFrames: 150, containerDuration: 5, frameRate: 30 })).toBe(
        150,
      )
    })

    it('uses the video-stream count for a sub-threshold tail (videoA / ~2 frames)', () => {
      // video 268 frames = 8.9333s, container 9.008s -> 0.0747s tail (< 100ms).
      // Must NOT inflate to round(9.008 * 30) = 270.
      expect(
        resolveTotalFrames({ dbTotalFrames: 268, containerDuration: 9.008, frameRate: 30 }),
      ).toBe(268)
    })

    it('uses the video-stream count for the container-longer e2e fixture tail', () => {
      // 150 frames = 5.0s, container 5.075s -> 0.075s tail (< 100ms).
      expect(
        resolveTotalFrames({ dbTotalFrames: 150, containerDuration: 5.075, frameRate: 30 }),
      ).toBe(150)
    })

    it('still uses the video-stream count just below the threshold', () => {
      // 300 frames = 10s, container 10.09s -> 0.09s tail (< 100ms).
      expect(
        resolveTotalFrames({ dbTotalFrames: 300, containerDuration: 10.09, frameRate: 30 }),
      ).toBe(300)
    })

    it('switches to the container count just above the threshold', () => {
      // 300 frames = 10s, container 10.11s -> 0.11s tail (> 100ms).
      // round(10.11 * 30) = 303.
      expect(
        resolveTotalFrames({ dbTotalFrames: 300, containerDuration: 10.11, frameRate: 30 }),
      ).toBe(303)
    })

    it('uses the container count for a large tail (videoB / long audio)', () => {
      // 150 frames = 5.0s, container 6.5s -> 1.5s tail. round(6.5 * 30) = 195.
      expect(
        resolveTotalFrames({ dbTotalFrames: 150, containerDuration: 6.5, frameRate: 30 }),
      ).toBe(195)
    })
  })

  describe('frame-rate dependence of the threshold', () => {
    it('treats a 100ms tail as below threshold at 24fps (threshold 125ms)', () => {
      // 240 frames = 10s, container 10.1s -> 0.1s tail (< 125ms at 24fps).
      expect(
        resolveTotalFrames({ dbTotalFrames: 240, containerDuration: 10.1, frameRate: 24 }),
      ).toBe(240)
    })

    it('treats a 130ms tail as above threshold at 24fps', () => {
      // 240 frames = 10s, container 10.13s -> 0.13s tail (> 125ms).
      // round(10.13 * 24) = 243.
      expect(
        resolveTotalFrames({ dbTotalFrames: 240, containerDuration: 10.13, frameRate: 24 }),
      ).toBe(243)
    })
  })

  describe('missing video-stream frame count', () => {
    it('falls back to the container-derived count when nb_frames is 0', () => {
      expect(resolveTotalFrames({ dbTotalFrames: 0, containerDuration: 5, frameRate: 30 })).toBe(
        150,
      )
      expect(resolveTotalFrames({ dbTotalFrames: 0, containerDuration: 6.5, frameRate: 30 })).toBe(
        195,
      )
    })
  })
})
