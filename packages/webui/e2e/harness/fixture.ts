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

/**
 * Metadata variant reproducing the real-world case where the container/format
 * duration is LONGER than the actual video stream (audio padding / container
 * overhead). This mirrors an observed asset whose ffprobe reported:
 *   - video stream: nb_frames=268, duration=8.9333s
 *   - format:       duration=9.008s   (~2 frames longer than the stream)
 *
 * Here the backing file is still the real 150-frame sample.mp4 (video stream =
 * 5.0s, 150 real decodable frames), but the stored metadata reports a container
 * duration of 5.075s — i.e. ~2.25 frames longer than the 150-frame stream.
 *
 * `metadata.totalFrames` stays at the accurate stream frame count (150, from
 * ffprobe `nb_frames`), exactly as the backend stores it.
 */
export const CONTAINER_LONGER_DURATION = 5.075

/**
 * The frame count the player's current heuristic derives from the inflated
 * container duration: round(5.075 * 30) = 152, i.e. 2 frames MORE than the 150
 * frames that actually exist in the stream. Frames 150 and 151 are phantom.
 */
export const CONTAINER_LONGER_COMPUTED_TOTAL_FRAMES = Math.round(
  CONTAINER_LONGER_DURATION * SAMPLE_FRAME_RATE,
)

/** The last frame index that actually exists in the stream (0-based): 149. */
export const REAL_LAST_FRAME = SAMPLE_TOTAL_FRAMES - 1

export const containerLongerVideoAsset: AssetInfo = {
  ...sampleVideoAsset,
  id: 'e2e-container-longer-asset',
  media: {
    original: {
      downloadUrl: SAMPLE_VIDEO_URL,
      key: 'sample.mp4',
    },
    metadata: {
      duration: CONTAINER_LONGER_DURATION,
      originalWidth: SAMPLE_WIDTH,
      originalHeight: SAMPLE_HEIGHT,
      frameRate: SAMPLE_FRAME_RATE,
      totalFrames: SAMPLE_TOTAL_FRAMES,
    },
  },
}

/**
 * Metadata variant for the LARGE-gap ("videoB") case: the audio track is much
 * longer than the video track, so the container tail is long enough for the
 * playhead to actually traverse it during playback.
 *
 * Backed by the real committed fixture `sample-long-audio.mp4` (verified via
 * ffprobe):
 *   - video stream: nb_frames=150, duration=5.000s, 30fps
 *   - audio stream: duration=6.500s
 *   - format:       duration=6.500s  (1.5s / 45-frame tail — well above the
 *                                     ~100ms playback stall threshold)
 *
 * Because the tail exceeds the stall threshold, both the current code and the
 * fix derive the frame count from the container duration
 * (round(6.5 * 30) = 195). The playhead advances through the audio tail to the
 * container end, so at natural end the readout reaches its maximum (194).
 */
export const LONG_AUDIO_VIDEO_URL = '/sample-long-audio.mp4'
export const LONG_AUDIO_DURATION = 6.5

/** Container-derived frame count for the long-audio fixture: round(6.5 * 30). */
export const LONG_AUDIO_COMPUTED_TOTAL_FRAMES = Math.round(LONG_AUDIO_DURATION * SAMPLE_FRAME_RATE)

export const longAudioVideoAsset: AssetInfo = {
  ...sampleVideoAsset,
  id: 'e2e-long-audio-asset',
  name: 'sample-long-audio.mp4',
  media: {
    original: {
      downloadUrl: LONG_AUDIO_VIDEO_URL,
      key: 'sample-long-audio.mp4',
    },
    metadata: {
      duration: LONG_AUDIO_DURATION,
      originalWidth: SAMPLE_WIDTH,
      originalHeight: SAMPLE_HEIGHT,
      frameRate: SAMPLE_FRAME_RATE,
      totalFrames: SAMPLE_TOTAL_FRAMES,
    },
  },
}

export const SAMPLE_AUDIO_URL = '/sample-audio.mp4'
export const SAMPLE_AUDIO_DURATION = 3.0
export const SAMPLE_AUDIO_COMPUTED_TOTAL_FRAMES = Math.round(SAMPLE_AUDIO_DURATION * SAMPLE_FRAME_RATE)

export const sampleAudioAsset: AssetInfo = {
  ...sampleVideoAsset,
  id: 'e2e-sample-audio-asset',
  name: 'sample-audio.mp4',
  mediaType: 'audio/mp4',
  media: {
    original: {
      downloadUrl: SAMPLE_AUDIO_URL,
      key: 'sample-audio.mp4',
    },
    metadata: {
      duration: SAMPLE_AUDIO_DURATION,
      originalWidth: 0,
      originalHeight: 0,
      frameRate: SAMPLE_FRAME_RATE,
      totalFrames: SAMPLE_AUDIO_COMPUTED_TOTAL_FRAMES,
    },
  },
}
