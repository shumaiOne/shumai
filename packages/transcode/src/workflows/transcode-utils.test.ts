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

    it('falls back to lowest selected ladder when source is smaller than smallest ladder', () => {
      // 640x360 source is smaller than 480p (854 long side) -> falls back to lowest selected (480p)
      const res = getTargetHlsResolutions(undefined, 640, 360)
      expect(res).toEqual(['480p'])

      // When user selected 720p and 1440p, and source is 480p (854 long side) -> falls back to lowest selected (720p)
      const resCustom = getTargetHlsResolutions(['720p', '1440p'], 854, 480)
      expect(resCustom).toEqual(['720p'])
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
    describe('best_match strategy', () => {
      it('returns best match resolution for 4K video', () => {
        const resolutions = getTargetVideoResolutions('best_match', 3840, 2160)
        expect(resolutions).toEqual(['180p', '2160p'])
      })

      it('returns best match resolution for 1080p video', () => {
        const resolutions = getTargetVideoResolutions('best_match', 1920, 1080)
        expect(resolutions).toEqual(['180p', '1080p'])
      })

      it('returns best match resolution for 720p video', () => {
        const resolutions = getTargetVideoResolutions('best_match', 1280, 720)
        expect(resolutions).toEqual(['180p', '720p'])
      })

      it('falls back to 480p for smaller videos (460p and 230p)', () => {
        const res460 = getTargetVideoResolutions('best_match', 818, 460)
        expect(res460).toEqual(['180p', '480p'])

        const res230 = getTargetVideoResolutions('best_match', 408, 230)
        expect(res230).toEqual(['180p', '480p'])
      })
    })

    describe('multi strategy', () => {
      it('returns all supported resolutions up to source for 4K video', () => {
        const resolutions = getTargetVideoResolutions('multi', 3840, 2160)
        expect(resolutions).toEqual(['180p', '2160p', '1440p', '1080p', '720p', '480p'])
      })

      it('returns resolutions up to 720p for 1280x720 video', () => {
        const resolutions = getTargetVideoResolutions('multi', 1280, 720)
        expect(resolutions).toEqual(['180p', '720p', '480p'])
      })

      it('returns resolutions up to 1080p for 2276x1280 video', () => {
        const resolutions = getTargetVideoResolutions('multi', 2276, 1280)
        expect(resolutions).toEqual(['180p', '1080p', '720p', '480p'])
      })

      it('falls back to lowest selected resolution (480p) for 460p and 230p videos', () => {
        const res460 = getTargetVideoResolutions('multi', 818, 460)
        expect(res460).toEqual(['180p', '480p'])

        const res230 = getTargetVideoResolutions('multi', 408, 230)
        expect(res230).toEqual(['180p', '480p'])
      })

      it('respects user-selected ladders and falls back to lowest selected ladder', () => {
        const customLadders = ['720p', '1440p', '2160p'] as PrismaJson.VideoResolutionLadder[]

        // 4K video: matches 2160p, 1440p, 720p (1080p was not selected)
        const res4k = getTargetVideoResolutions('multi', 3840, 2160, customLadders)
        expect(res4k).toEqual(['180p', '2160p', '1440p', '720p'])

        // 230p video: nothing matches <= 408 -> falls back to lowest selected (720p)
        const res230 = getTargetVideoResolutions('multi', 408, 230, customLadders)
        expect(res230).toEqual(['180p', '720p'])
      })

      it('normalizes legacy "all" and "full" strategy values to multi', () => {
        const resAll = getTargetVideoResolutions(
          'all' as unknown as PrismaJson.VideoTranscodeStrategy,
          1280,
          720,
        )
        expect(resAll).toEqual(['180p', '720p', '480p'])

        const resFull = getTargetVideoResolutions(
          'full' as unknown as PrismaJson.VideoTranscodeStrategy,
          1280,
          720,
        )
        expect(resFull).toEqual(['180p', '720p', '480p'])
      })
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
