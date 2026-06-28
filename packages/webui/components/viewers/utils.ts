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
  const frameIndex = Math.round(seconds * fps)
  return formatTimecode(frameIndex, fps, 'timecode')
}

export const formatFrame = (seconds: number, fps: number): number => {
  if (isNaN(seconds) || !fps) return 0
  return Math.floor(seconds * fps)
}
