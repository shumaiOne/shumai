import { differenceInDays, format, isToday, isYesterday, parseISO } from 'date-fns'

export const formatTimeAgo = (dateString: string) => {
  const date = parseISO(dateString)
  const now = new Date()

  if (isNaN(date.getTime())) {
    return dateString
  }

  const time = format(date, 'HH:mm')

  if (isToday(date)) {
    return `Today ${time}`
  }
  if (isYesterday(date)) {
    return `Yesterday ${time}`
  }

  const daysAgo = differenceInDays(now, date)
  return `${daysAgo >= 0 ? daysAgo : 0} days ago`
}

export const formatDateAgo = (dateString: string) => {
  const date = parseISO(dateString)
  const now = new Date()

  if (isNaN(date.getTime())) {
    return dateString
  }

  if (isToday(date)) {
    return 'Today'
  }
  if (isYesterday(date)) {
    return 'Yesterday'
  }

  const daysAgo = differenceInDays(now, date)
  return `${daysAgo >= 0 ? daysAgo : 0} days ago`
}
