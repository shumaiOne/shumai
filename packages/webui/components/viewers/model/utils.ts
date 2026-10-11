export const TOTAL_FRAMES = 24
export const FPS = 6
export const FRAME_DURATION = 1 / FPS

/**
 * Calculates the presentation time within a frame.
 * Seeking near the frame center avoids PTS boundary inaccuracies in browser video decoders.
 * For the final frame (TOTAL_FRAMES - 1), we use a safe offset inside the frame
 * to avoid grazing the EOF boundary (video duration) which can cause browser decoders
 * to trigger end-of-stream or loop behavior.
 */
export function calculateFrameCenterTime(frameIndex: number): number {
  const normalizedFrame = ((frameIndex % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES
  if (normalizedFrame === TOTAL_FRAMES - 1) {
    return normalizedFrame * FRAME_DURATION + FRAME_DURATION * 0.25
  }
  return (normalizedFrame + 0.5) * FRAME_DURATION
}

/**
 * Converts a playback second into a frame index (0..23), clamped.
 * Works with frame start times, frame center times, or continuous playback seconds.
 */
export function secondToFrame(second: number): number {
  return Math.min(Math.max(0, Math.floor(second * FPS + 1e-4)), TOTAL_FRAMES - 1)
}

/**
 * Converts a second to turntable degree (0, 15, 30, ..., 345).
 */
export function secondToDegree(second: number): number {
  const frameIndex = secondToFrame(second)
  return (frameIndex * 15) % 360
}
