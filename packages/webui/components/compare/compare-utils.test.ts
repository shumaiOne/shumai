import { describe, it, expect } from 'vitest'
import { kindOf, pickDefaultCompareVersions, clampFrame, isSameType } from './compare-utils'

describe('compare-utils', () => {
  describe('kindOf', () => {
    it('classifies image media types', () => {
      expect(kindOf('image/png')).toBe('image')
      expect(kindOf('image/webp')).toBe('image')
    })

    it('classifies video media types', () => {
      expect(kindOf('video/mp4')).toBe('video')
      expect(kindOf('video/quicktime')).toBe('video')
    })

    it('returns unsupported for missing or unknown types', () => {
      expect(kindOf(null)).toBe('unsupported')
      expect(kindOf(undefined)).toBe('unsupported')
      expect(kindOf('application/pdf')).toBe('unsupported')
    })
  })

  describe('pickDefaultCompareVersions', () => {
    it('picks latest and latest-1 regardless of input order', () => {
      const versions = [
        { id: 'a', version: 1 },
        { id: 'c', version: 3 },
        { id: 'b', version: 2 },
      ]
      const pair = pickDefaultCompareVersions(versions)
      expect(pair).not.toBeNull()
      expect(pair!.left.id).toBe('c') // v3 (latest)
      expect(pair!.right.id).toBe('b') // v2 (latest - 1)
    })

    it('returns null when fewer than two versions', () => {
      expect(pickDefaultCompareVersions([{ id: 'a', version: 1 }])).toBeNull()
      expect(pickDefaultCompareVersions([])).toBeNull()
      expect(pickDefaultCompareVersions(undefined)).toBeNull()
      expect(pickDefaultCompareVersions(null)).toBeNull()
    })

    it('does not mutate the input array', () => {
      const versions = [
        { id: 'a', version: 1 },
        { id: 'b', version: 2 },
      ]
      pickDefaultCompareVersions(versions)
      expect(versions.map((v) => v.id)).toEqual(['a', 'b'])
    })
  })

  describe('clampFrame', () => {
    it('clamps to the last frame when beyond total (shorter side holds last frame)', () => {
      expect(clampFrame(500, 100)).toBe(99)
    })

    it('clamps negative frames to zero', () => {
      expect(clampFrame(-5, 100)).toBe(0)
    })

    it('passes through in-range frames', () => {
      expect(clampFrame(42, 100)).toBe(42)
    })

    it('handles zero-length safely', () => {
      expect(clampFrame(10, 0)).toBe(0)
    })
  })

  describe('isSameType', () => {
    it('true only for matching, supported kinds', () => {
      expect(isSameType('video', 'video')).toBe(true)
      expect(isSameType('image', 'image')).toBe(true)
    })

    it('false for mismatched or unsupported kinds', () => {
      expect(isSameType('video', 'image')).toBe(false)
      expect(isSameType('unsupported', 'unsupported')).toBe(false)
    })
  })
})
