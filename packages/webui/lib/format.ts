export function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  const k = 1000
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  let i = Math.floor(Math.log(bytes) / Math.log(k))
  if (i < 0) i = 0
  if (i >= sizes.length) i = sizes.length - 1

  const val = bytes / Math.pow(k, i)
  if (i === 0) {
    return `${Math.round(val)} B`
  }

  const formatted = parseFloat(val.toFixed(2))
  if (formatted >= 1000 && i < sizes.length - 1) {
    return parseFloat((bytes / Math.pow(k, i + 1)).toFixed(2)) + ' ' + sizes[i + 1]
  }

  return `${formatted} ${sizes[i]}`
}
