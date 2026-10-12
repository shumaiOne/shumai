import { describe, expect, it } from 'vitest'
import {
  calculateTurntableFrameCenterTime,
  degreeToSecond,
  degreeToTurntableFrame,
  isValidTurntableDegree,
  secondToDegree,
  secondToTurntableFrame,
  TOTAL_TURNTABLE_FRAMES,
  TURNTABLE_FPS,
} from './model3d'

describe('model3d utils', () => {
  describe('secondToTurntableFrame', () => {
    it('converts playback seconds to frame indices (0..23)', () => {
      expect(secondToTurntableFrame(0)).toBe(0)
      expect(secondToTurntableFrame(0.167)).toBe(1)
      expect(secondToTurntableFrame(0.5)).toBe(3)
      expect(secondToTurntableFrame(2.0)).toBe(12)
      expect(secondToTurntableFrame(3.9)).toBe(23)
    })

    it('clamps out-of-range seconds', () => {
      expect(secondToTurntableFrame(-1)).toBe(0)
      expect(secondToTurntableFrame(10)).toBe(TOTAL_TURNTABLE_FRAMES - 1)
    })
  })

  describe('secondToDegree', () => {
    it('converts seconds to turntable degrees (0, 15, ..., 345)', () => {
      expect(secondToDegree(0)).toBe(0)
      expect(secondToDegree(1 / TURNTABLE_FPS)).toBe(15)
      expect(secondToDegree(0.5)).toBe(45)
      expect(secondToDegree(2.0)).toBe(180)
      expect(secondToDegree(3.9)).toBe(345)
    })
  })

  describe('degreeToTurntableFrame', () => {
    it('converts discrete degrees to frame indices', () => {
      expect(degreeToTurntableFrame(0)).toBe(0)
      expect(degreeToTurntableFrame(15)).toBe(1)
      expect(degreeToTurntableFrame(45)).toBe(3)
      expect(degreeToTurntableFrame(90)).toBe(6)
      expect(degreeToTurntableFrame(180)).toBe(12)
      expect(degreeToTurntableFrame(345)).toBe(23)
    })

    it('normalizes degrees outside [0, 360)', () => {
      expect(degreeToTurntableFrame(360)).toBe(0)
      expect(degreeToTurntableFrame(-15)).toBe(23)
      expect(degreeToTurntableFrame(720)).toBe(0)
    })
  })

  describe('calculateTurntableFrameCenterTime and degreeToSecond', () => {
    it('calculates frame center times within bounds', () => {
      const centerTime0 = calculateTurntableFrameCenterTime(0)
      expect(centerTime0).toBeCloseTo(0.5 / TURNTABLE_FPS)

      const centerTime23 = calculateTurntableFrameCenterTime(23)
      expect(centerTime23).toBeLessThan(TOTAL_TURNTABLE_FRAMES / TURNTABLE_FPS)
      expect(centerTime23).toBeGreaterThan(23 / TURNTABLE_FPS)

      expect(degreeToSecond(0)).toBeCloseTo(centerTime0)
      expect(degreeToSecond(45)).toBeCloseTo((3 + 0.5) / TURNTABLE_FPS)
      expect(degreeToSecond(345)).toBeCloseTo(centerTime23)
    })
  })

  describe('isValidTurntableDegree', () => {
    it('returns true for integer multiples of 15 from 0 to 345', () => {
      for (let deg = 0; deg < 360; deg += 15) {
        expect(isValidTurntableDegree(deg)).toBe(true)
      }
    })

    it('returns false for non-multiples of 15', () => {
      expect(isValidTurntableDegree(10)).toBe(false)
      expect(isValidTurntableDegree(44)).toBe(false)
      expect(isValidTurntableDegree(45.5)).toBe(false)
    })

    it('returns false for out of range or negative degrees', () => {
      expect(isValidTurntableDegree(-15)).toBe(false)
      expect(isValidTurntableDegree(360)).toBe(false)
      expect(isValidTurntableDegree(720)).toBe(false)
    })
  })
})
