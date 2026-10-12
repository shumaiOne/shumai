export const TOTAL_TURNTABLE_FRAMES = 24
export const TURNTABLE_FPS = 6
export const TURNTABLE_FRAME_DURATION = 1 / TURNTABLE_FPS

/**
 * Converts a playback second into a turntable frame index (0..23), clamped.
 */
export function secondToTurntableFrame(second: number): number {
  return Math.min(
    Math.max(0, Math.floor(second * TURNTABLE_FPS + 1e-4)),
    TOTAL_TURNTABLE_FRAMES - 1,
  )
}

/**
 * Converts a turntable playback second to turntable degree (0, 15, 30, ..., 345).
 */
export function secondToDegree(second: number): number {
  const frameIndex = secondToTurntableFrame(second)
  return (frameIndex * 15) % 360
}

/**
 * Calculates the presentation time within a turntable frame.
 * Seeking near frame center avoids PTS boundary inaccuracies in video decoders.
 */
export function calculateTurntableFrameCenterTime(frameIndex: number): number {
  const normalizedFrame =
    ((frameIndex % TOTAL_TURNTABLE_FRAMES) + TOTAL_TURNTABLE_FRAMES) % TOTAL_TURNTABLE_FRAMES
  if (normalizedFrame === TOTAL_TURNTABLE_FRAMES - 1) {
    return normalizedFrame * TURNTABLE_FRAME_DURATION + TURNTABLE_FRAME_DURATION * 0.25
  }
  return (normalizedFrame + 0.5) * TURNTABLE_FRAME_DURATION
}

/**
 * Converts a rotation degree (0..345) to a turntable frame index (0..23).
 */
export function degreeToTurntableFrame(degree: number): number {
  const normalizedDegree = ((Math.round(degree) % 360) + 360) % 360
  return Math.round(normalizedDegree / 15) % TOTAL_TURNTABLE_FRAMES
}

/**
 * Converts a rotation degree into a turntable video playback second (center time of that frame).
 */
export function degreeToSecond(degree: number): number {
  const frameIndex = degreeToTurntableFrame(degree)
  return calculateTurntableFrameCenterTime(frameIndex)
}

/**
 * Validates whether a degree is a valid discrete turntable angle:
 * integer multiple of 15 between 0 and 345 inclusive (0, 15, 30, ..., 345).
 */
export function isValidTurntableDegree(degree: number): boolean {
  return Number.isInteger(degree) && degree >= 0 && degree <= 345 && degree % 15 === 0
}
