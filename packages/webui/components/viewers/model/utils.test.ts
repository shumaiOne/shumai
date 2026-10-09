import { describe, it, expect } from 'vitest'
import {
  calculateFrameCenterTime,
  secondToFrame,
  secondToDegree,
  TOTAL_FRAMES,
  FPS,
  FRAME_DURATION,
} from './utils'

describe('model viewer utils', () => {
  describe('calculateFrameCenterTime', () => {
    it('calculates the center time for frame 0', () => {
      expect(calculateFrameCenterTime(0)).toBeCloseTo(0.5 / FPS)
    })

    it('calculates the center time for all frames 0 to 23', () => {
      for (let i = 0; i < TOTAL_FRAMES; i++) {
        const center = calculateFrameCenterTime(i)
        expect(center).toBeCloseTo((i + 0.5) * FRAME_DURATION)
      }
    })

    it('handles negative and wrapping frames properly', () => {
      expect(calculateFrameCenterTime(-1)).toBeCloseTo(calculateFrameCenterTime(23))
      expect(calculateFrameCenterTime(24)).toBeCloseTo(calculateFrameCenterTime(0))
    })
  })

  describe('secondToFrame', () => {
    it('correctly maps frame start times to frame index without float truncation', () => {
      for (let i = 0; i < TOTAL_FRAMES; i++) {
        const startSec = i * FRAME_DURATION
        expect(secondToFrame(startSec)).toBe(i)
      }
    })

    it('correctly maps frame center times to frame index', () => {
      for (let i = 0; i < TOTAL_FRAMES; i++) {
        const centerSec = calculateFrameCenterTime(i)
        expect(secondToFrame(centerSec)).toBe(i)
      }
    })

    it('clamps values below 0 and above total duration', () => {
      expect(secondToFrame(-1)).toBe(0)
      expect(secondToFrame(100)).toBe(TOTAL_FRAMES - 1)
    })
  })

  describe('secondToDegree', () => {
    it('returns 0 for 0s', () => {
      expect(secondToDegree(0)).toBe(0)
    })

    it('returns exact degrees (0..345) for every frame center', () => {
      for (let i = 0; i < TOTAL_FRAMES; i++) {
        const center = calculateFrameCenterTime(i)
        expect(secondToDegree(center)).toBe((i * 15) % 360)
      }
    })

    it('returns exact degrees for frame start times', () => {
      for (let i = 0; i < TOTAL_FRAMES; i++) {
        const start = i * FRAME_DURATION
        expect(secondToDegree(start)).toBe((i * 15) % 360)
      }
    })
  })
})
