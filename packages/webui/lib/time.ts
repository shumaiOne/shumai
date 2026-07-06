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
