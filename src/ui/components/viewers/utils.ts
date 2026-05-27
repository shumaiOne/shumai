export const formatTime = (seconds: number): string => {
  if (isNaN(seconds)) return '00:00'
  const date = new Date(seconds * 1000)
  const hh = date.getUTCHours()
  const mm = date.getUTCMinutes()
  const ss = date.getUTCSeconds().toString().padStart(2, '0')
  if (hh) {
    return `${hh}:${mm.toString().padStart(2, '0')}:${ss}`
  }
  return `${mm}:${ss}`
}

export const formatTimestamp = (seconds: number, fps: number): string => {
  if (isNaN(seconds)) return '00:00:00:00'
  const hh = Math.floor(seconds / 3600)
  const mm = Math.floor((seconds % 3600) / 60)
  const ss = Math.floor(seconds % 60)
  const ff = Math.floor((seconds % 1) * fps)

  return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}:${ff.toString().padStart(2, '0')}`
}

export const formatFrame = (seconds: number, fps: number): number => {
  if (isNaN(seconds) || !fps) return 0
  return Math.floor(seconds * fps)
}
