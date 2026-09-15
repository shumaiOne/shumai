/**
 * Formats a byte count into a human-readable size string (e.g. 1.2 MB, 450 KB).
 */
export function formatBytes(bytes?: number | null): string {
  if (bytes == null || bytes === 0 || isNaN(bytes) || bytes < 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const safeIndex = Math.min(Math.max(0, i), units.length - 1)
  return `${(bytes / Math.pow(1024, safeIndex)).toFixed(safeIndex === 0 ? 0 : 1)} ${units[safeIndex]}`
}

/**
 * Formats duration in seconds into MM:SS or H:MM:SS format (e.g. 02:45, 1:12:30).
 * Returns null if duration is invalid, zero or negative.
 */
export function formatDuration(seconds?: number | null): string | null {
  if (seconds == null || isNaN(seconds) || seconds <= 0) return null
  const totalSecs = Math.round(seconds)
  const hours = Math.floor(totalSecs / 3600)
  const minutes = Math.floor((totalSecs % 3600) / 60)
  const secs = totalSecs % 60
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}
