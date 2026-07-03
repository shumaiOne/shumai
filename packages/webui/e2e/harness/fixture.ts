import type { AssetInfo } from '@shumai/dtos'

/**
 * Deterministic metadata for the committed fixture video
 * (packages/webui/e2e/fixtures/sample.mp4).
 *
 * Generated with:
 *   ffmpeg -f lavfi -i testsrc=size=16x16:rate=30 -t 5 -pix_fmt yuv420p sample.mp4
 *
 * Verified via ffprobe: 16x16, 30/1 fps, duration 5.0s, 150 frames.
 * These constants are shared by the harness and the Playwright specs so the
 * frame-accurate assertions have known-good expected values.
 */
export const SAMPLE_FRAME_RATE = 30
export const SAMPLE_TOTAL_FRAMES = 150
export const SAMPLE_DURATION = 5
export const SAMPLE_WIDTH = 16
export const SAMPLE_HEIGHT = 16

/**
 * The fixture video is served statically by the harness Vite server
 * (publicDir points at packages/webui/e2e/fixtures), so it is reachable at
 * the site root. No backend is involved.
 */
export const SAMPLE_VIDEO_URL = '/sample.mp4'

export const sampleVideoAsset: AssetInfo = {
  id: 'e2e-sample-asset',
  name: 'sample.mp4',
  sizeByte: 6170,
  fileCount: 1,
  type: 'file',
  status: 'ready',
  mediaType: 'video',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  media: {
    original: {
      downloadUrl: SAMPLE_VIDEO_URL,
      key: 'sample.mp4',
    },
    metadata: {
      duration: SAMPLE_DURATION,
      originalWidth: SAMPLE_WIDTH,
      originalHeight: SAMPLE_HEIGHT,
      frameRate: SAMPLE_FRAME_RATE,
      totalFrames: SAMPLE_TOTAL_FRAMES,
    },
  },
}
