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

export interface DateTimeParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

export const getDateTimeParts = (date: Date, timeZone?: string): DateTimeParts => {
  if (!timeZone || timeZone.toUpperCase() === 'UTC') {
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      second: date.getUTCSeconds(),
    }
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  let year = 0
  let month = 0
  let day = 0
  let hour = 0
  let minute = 0
  let second = 0

  for (const part of parts) {
    if (part.type === 'year') year = parseInt(part.value, 10)
    else if (part.type === 'month') month = parseInt(part.value, 10)
    else if (part.type === 'day') day = parseInt(part.value, 10)
    else if (part.type === 'hour') {
      const val = parseInt(part.value, 10)
      hour = val === 24 ? 0 : val
    } else if (part.type === 'minute') minute = parseInt(part.value, 10)
    else if (part.type === 'second') second = parseInt(part.value, 10)
  }

  return { year, month, day, hour, minute, second }
}

export const formatDateEdl = (date: Date, isReply = false, timeZone?: string): string => {
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
  const parts = getDateTimeParts(date, timeZone)
  const month = months[parts.month - 1]
  const day = parts.day
  const hours = parts.hour
  const minutes = parts.minute.toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'pm' : 'am'
  const hour12 = (hours % 12 || 12).toString().padStart(2, '0')
  const timeStr = `${hour12}:${minutes}${ampm}`

  if (isReply) {
    return `${month} ${day} ${timeStr}`
  }
  return `${month} ${day} ${day} ${timeStr}`
}

export const formatDateAvid = (date: Date, timeZone?: string): string => {
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
  const parts = getDateTimeParts(date, timeZone)
  const month = months[parts.month - 1]
  const day = parts.day
  const year = parts.year
  const hours = parts.hour.toString().padStart(2, '0')
  const minutes = parts.minute.toString().padStart(2, '0')
  return `${month} ${day}, ${year} &#183; ${hours}:${minutes}`
}

export const formatDatePremiere = (date: Date, timeZone?: string): string => {
  const parts = getDateTimeParts(date, timeZone)
  const hours = parts.hour.toString().padStart(2, '0')
  const minutes = parts.minute.toString().padStart(2, '0')
  const seconds = parts.second.toString().padStart(2, '0')
  return `${parts.year}-${parts.month}-${parts.day} ${hours}-${minutes}-${seconds}`
}
