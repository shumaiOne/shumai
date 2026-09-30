import { describe, it, expect } from 'vitest'
import {
  getTargetHlsResolutions,
  resolutionToDimensions,
  getTargetVideoResolutions,
  isMimePsd,
} from './transcode-utils'

describe('transcode-utils', () => {
  describe('getTargetHlsResolutions', () => {
    it('uses default ladders when configuredLadders is undefined or empty', () => {
      // 1080p source video (1920x1080)
      const res1 = getTargetHlsResolutions(undefined, 1920, 1080)
      expect(res1).toEqual(['1080p', '720p', '480p'])

      const res2 = getTargetHlsResolutions([], 1920, 1080)
      expect(res2).toEqual(['1080p', '720p', '480p'])
    })

    it('caps ladders up to source resolution (no upscaling)', () => {
      // 1080p source with 4K configured ladders -> should cap to 1080p
      const res = getTargetHlsResolutions(['480p', '720p', '1080p', '1440p', '2160p'], 1920, 1080)
      expect(res).toEqual(['1080p', '720p', '480p'])
    })

    it('includes higher ladders when source resolution supports them', () => {
      // 4K source (3840x2160)
      const res = getTargetHlsResolutions(['480p', '720p', '1080p', '1440p', '2160p'], 3840, 2160)
      expect(res).toEqual(['2160p', '1440p', '1080p', '720p', '480p'])

      // 1440p source (2560x1440)
      const res1440 = getTargetHlsResolutions(
        ['480p', '720p', '1080p', '1440p', '2160p'],
        2560,
        1440,
      )
      expect(res1440).toEqual(['1440p', '1080p', '720p', '480p'])
    })

    it('handles vertical videos correctly by using the longest side', () => {
      // 1080x1920 (vertical 1080p)
      const res = getTargetHlsResolutions(['480p', '720p', '1080p', '1440p', '2160p'], 1080, 1920)
      expect(res).toEqual(['1080p', '720p', '480p'])
    })

    it('returns empty array when source is smaller than smallest ladder', () => {
      // 640x360 source is smaller than 480p (854 long side)
      const res = getTargetHlsResolutions(undefined, 640, 360)
      expect(res).toEqual([])
    })

    it('respects selective subset of configured ladders', () => {
      // User only selected 720p and 1440p
      const res = getTargetHlsResolutions(['720p', '1440p'], 2560, 1440)
      expect(res).toEqual(['1440p', '720p'])
    })
  })

  describe('resolutionToDimensions', () => {
    it('calculates dimensions correctly for 1440p and 480p', () => {
      const [w1440, h1440] = resolutionToDimensions('1440p', 3840, 2160)
      expect(w1440).toBe(2560)
      expect(h1440).toBe(1440)

      const [w480, h480] = resolutionToDimensions('480p', 1920, 1080)
      expect(w480).toBe(854)
      expect(h480).toBe(480)
    })

    it('ensures even dimensions for odd calculations', () => {
      const [w, h] = resolutionToDimensions('720p', 1921, 1081)
      expect(w % 2).toBe(0)
      expect(h % 2).toBe(0)
    })

    it('returns [0, 0] for unknown resolution', () => {
      expect(resolutionToDimensions('invalid', 1920, 1080)).toEqual([0, 0])
    })
  })

  describe('getTargetVideoResolutions', () => {
    it('returns best match resolution for standard video', () => {
      const resolutions = getTargetVideoResolutions('best_match', 1920, 1080)
      expect(resolutions).toEqual(['180p', '1080p'])
    })
  })

  describe('isMimePsd', () => {
    it('identifies PSD mime types', () => {
      expect(isMimePsd('image/vnd.adobe.photoshop')).toBe(true)
      expect(isMimePsd('image/x-photoshop')).toBe(true)
      expect(isMimePsd('image/psd')).toBe(true)
      expect(isMimePsd('image/png')).toBe(false)
    })
  })
})
