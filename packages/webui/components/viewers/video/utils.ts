export const formatTime = (seconds: number): string => {
  if (isNaN(seconds)) return '00:00'
  const date = new Date(seconds * 1000)
  const hh = date.getUTCHours()
  const mm = date.getUTCMinutes().toString().padStart(2, '0')
  const ss = date.getUTCSeconds().toString().padStart(2, '0')
  if (hh) {
    return `${hh}:${mm}:${ss}`
  }
  return `${mm}:${ss}`
}

export const formatTimecode = (
  frameIndex: number,
  frameRate: number,
  mode: 'standard' | 'frames' | 'timecode',
  startTimecode?: string | null,
): string => {
  if (mode === 'frames') {
    return `${frameIndex} fr`
  }

  if (mode === 'standard') {
    return formatTime(frameIndex / frameRate)
  }

  // Determine if drop-frame should be used (standard for NTSC 29.97 and 59.94)
  const frameRateRound = Math.round(frameRate)
  const isFractional = frameRate !== frameRateRound
  let dropFrame = false
  if (isFractional && (frameRateRound === 30 || frameRateRound === 60)) {
    dropFrame = true
  }

  // Parse start timecode if provided
  let startFrameCount = 0
  if (startTimecode) {
    const parts = startTimecode.match(/^([012]\d):(\d\d):(\d\d)(:|;|\.)(\d+)$/)
    if (parts) {
      const hours = parseInt(parts[1], 10)
      const minutes = parseInt(parts[2], 10)
      const seconds = parseInt(parts[3], 10)
      const frames = parseInt(parts[5], 10)

      // Timecode string format overrides the default dropFrame setting
      dropFrame = parts[4] !== ':'

      // Calculate frame count from timecode
      startFrameCount = (hours * 3600 + minutes * 60 + seconds) * frameRateRound + frames
      if (dropFrame) {
        const totalMinutes = hours * 60 + minutes
        const df = frameRate < 30 ? 2 : 4
        startFrameCount -= df * (totalMinutes - Math.floor(totalMinutes / 10))
      }
    }
  }

  // Calculate absolute frame count
  let fc = frameIndex + startFrameCount

  // Convert frame count to timecode using the exact smpte-timecode formula
  if (dropFrame) {
    const df = frameRate < 30 ? 2 : 4
    const d = Math.floor(fc / ((17982 * df) / 2))
    let m = fc % ((17982 * df) / 2)
    if (m < df) {
      m = m + df
    }
    fc += 9 * df * d + df * Math.floor((m - df) / ((1798 * df) / 2))
  }

  const frames = fc % frameRateRound
  const seconds = Math.floor(fc / frameRateRound) % 60
  const minutes = Math.floor(fc / (frameRateRound * 60)) % 60
  const hours = Math.floor(fc / (frameRateRound * 3600)) % 24

  const separator = dropFrame ? ';' : ':'
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}${separator}${frames.toString().padStart(2, '0')}`
}

export const formatTimestamp = (seconds: number, fps: number): string => {
  if (isNaN(seconds)) return '00:00:00:00'
  const frameIndex = Math.floor(seconds * fps + 0.45)
  return formatTimecode(frameIndex, fps, 'timecode')
}

export const formatFrame = (seconds: number, fps: number): number => {
  if (isNaN(seconds) || !fps) return 0
  return Math.floor(seconds * fps + 0.45)
}

export const calculateFrameCenterTime = (frameIndex: number, frameRate: number): number => {
  if (!frameRate) return 0
  const frameDuration = 1 / frameRate
  return frameIndex * frameDuration + frameDuration / 2
}

/**
 * The dynamic playback stall threshold, in milliseconds: the window of
 * `requestVideoFrameCallback` silence after which the playback loop's
 * `requestAnimationFrame` fallback begins driving the playhead from
 * `video.currentTime`.
 *
 * Shared by `useFramePlayer` (runtime stall detection) and `resolveTotalFrames`
 * (frame-count derivation) so the two stay in lockstep: the boundary at which a
 * container's audio-only tail becomes *reachable* by the playhead is exactly the
 * boundary at which we start counting those tail frames.
 */
export const stallThresholdMs = (frameRate: number): number =>
  Math.max(100, 3000 / (frameRate || 30))

interface ResolveTotalFramesArgs {
  /**
   * Physical video-stream frame count (ffprobe `nb_frames`), as stored in
   * `metadata.totalFrames`.
   */
  dbTotalFrames: number
  /**
   * Container/format duration in seconds (`metadata.duration`). May exceed the
   * video-stream duration when e.g. the audio track is longer.
   */
  containerDuration: number
  frameRate: number
}

/**
 * Derive the player's effective total frame count.
 *
 * A container's duration can exceed its video stream (commonly because the audio
 * track is slightly longer, or from container overhead). Deriving the frame count
 * from the container duration in that case invents phantom trailing frames the
 * video stream does not contain.
 *
 * We only trust the container-derived count when the extra tail is long enough
 * for the playhead to actually reach it during playback — i.e. longer than the
 * playback stall threshold (see `stallThresholdMs`). Below that threshold the
 * RAF fallback never activates, so those tail frames are unreachable and would
 * strand the readout short of its own maximum; we use the accurate video-stream
 * frame count instead.
 *
 * When `nb_frames` is unavailable (`dbTotalFrames <= 0`), fall back to the
 * container-derived count.
 */
export const resolveTotalFrames = ({
  dbTotalFrames,
  containerDuration,
  frameRate,
}: ResolveTotalFramesArgs): number => {
  const fps = frameRate || 30
  const containerFrames = Math.round(containerDuration * fps)
  if (dbTotalFrames <= 0) return containerFrames
  const videoDuration = dbTotalFrames / fps
  const tailSeconds = containerDuration - videoDuration
  const thresholdSeconds = stallThresholdMs(fps) / 1000
  return tailSeconds > thresholdSeconds ? containerFrames : dbTotalFrames
}
