export const isDropFrameRate = (fps: number): boolean => {
  const frameRateRound = Math.round(fps)
  const isFractional = fps !== frameRateRound
  return isFractional && (frameRateRound === 30 || frameRateRound === 60)
}

export const getEffectiveDropFrame = (
  fps: number,
  startTimecode?: string | null,
  forcedDropFrame?: boolean,
): boolean => {
  if (forcedDropFrame !== undefined) {
    return forcedDropFrame
  }
  if (startTimecode) {
    const parts = startTimecode.match(/^([012]\d):(\d\d):(\d\d)(:|;|\.)(\d+)$/)
    if (parts) {
      return parts[4] !== ':'
    }
  }
  return isDropFrameRate(fps)
}

export const secondToFrame = (second: number | null | undefined, fps: number): number => {
  if (second === null || second === undefined || isNaN(second)) {
    return 0
  }
  return Math.floor(second * fps)
}

export const frameToTimecode = (
  frameIndex: number,
  fps: number,
  forcedDropFrame?: boolean,
  startTimecode?: string | null,
): string => {
  const frameRateRound = Math.round(fps) || 24
  const dropFrame = getEffectiveDropFrame(fps, startTimecode, forcedDropFrame)

  let startFrameCount = 0
  if (startTimecode) {
    const parts = startTimecode.match(/^([012]\d):(\d\d):(\d\d)(:|;|\.)(\d+)$/)
    if (parts) {
      const hours = parseInt(parts[1], 10)
      const minutes = parseInt(parts[2], 10)
      const seconds = parseInt(parts[3], 10)
      const frames = parseInt(parts[5], 10)
      startFrameCount = (hours * 3600 + minutes * 60 + seconds) * frameRateRound + frames
      if (dropFrame) {
        const totalMinutes = hours * 60 + minutes
        const df = frameRateRound < 45 ? 2 : 4
        startFrameCount -= df * (totalMinutes - Math.floor(totalMinutes / 10))
      }
    }
  }

  let fc = frameIndex + startFrameCount

  if (dropFrame) {
    const df = frameRateRound < 45 ? 2 : 4
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

export const formatDateEdl = (date: Date, isReply = false): string => {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  const month = months[date.getUTCMonth()]
  const day = date.getUTCDate()
  const hours = date.getUTCHours()
  const minutes = date.getUTCMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'pm' : 'am'
  const hour12 = (hours % 12 || 12).toString().padStart(2, '0')
  const timeStr = `${hour12}:${minutes}${ampm}`

  if (isReply) {
    return `${month} ${day} ${timeStr}`
  }
  return `${month} ${day} ${day} ${timeStr}`
}

export const formatDateAvid = (date: Date): string => {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  const month = months[date.getUTCMonth()]
  const day = date.getUTCDate()
  const year = date.getUTCFullYear()
  const hours = date.getUTCHours().toString().padStart(2, '0')
  const minutes = date.getUTCMinutes().toString().padStart(2, '0')
  return `${month} ${day}, ${year} &#183; ${hours}:${minutes}`
}

export const formatDatePremiere = (date: Date): string => {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  const day = date.getUTCDate()
  const hours = date.getUTCHours().toString().padStart(2, '0')
  const minutes = date.getUTCMinutes().toString().padStart(2, '0')
  const seconds = date.getUTCSeconds().toString().padStart(2, '0')
  return `${year}-${month}-${day} ${hours}-${minutes}-${seconds}`
}
