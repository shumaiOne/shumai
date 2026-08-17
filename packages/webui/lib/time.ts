import { differenceInDays, format, isToday, isYesterday, parseISO } from 'date-fns'
import { m } from '@/ui/paraglide/messages.js'

export const formatTimeAgo = (dateString: string) => {
  const date = parseISO(dateString)
  const now = new Date()

  if (isNaN(date.getTime())) {
    return dateString
  }

  const time = format(date, 'HH:mm')

  if (isToday(date)) {
    return m.today_with_time({ time })
  }
  if (isYesterday(date)) {
    return m.yesterday_with_time({ time })
  }

  const daysAgo = differenceInDays(now, date)
  const count = daysAgo >= 0 ? daysAgo : 0
  return count === 1 ? m.n_days_ago_singular({ count }) : m.n_days_ago_plural({ count })
}

export const formatDateAgo = (dateString: string) => {
  const date = parseISO(dateString)
  const now = new Date()

  if (isNaN(date.getTime())) {
    return dateString
  }

  if (isToday(date)) {
    return m.today()
  }
  if (isYesterday(date)) {
    return m.yesterday()
  }

  const daysAgo = differenceInDays(now, date)
  const count = daysAgo >= 0 ? daysAgo : 0
  return count === 1 ? m.n_days_ago_singular({ count }) : m.n_days_ago_plural({ count })
}

export const formatRemainingTime = (targetDate: string | Date, now: Date = new Date()): string => {
  const targetMs =
    typeof targetDate === 'string'
      ? parseISO(targetDate).getTime()
      : targetDate instanceof Date
        ? targetDate.getTime()
        : NaN
  if (isNaN(targetMs)) {
    return '< 1m'
  }
  const diffMs = targetMs - now.getTime()
  if (diffMs <= 0) {
    return '< 1m'
  }

  const totalSeconds = Math.floor(diffMs / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }
  return minutes > 0 ? `${minutes}m` : '< 1m'
}
