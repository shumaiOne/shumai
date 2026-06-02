import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDate,
  getDay,
  getHours,
  getMinutes,
  getMonth,
  getYear,
  isValid,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import type { FieldProps } from './field-types'

const DateField: React.FC<FieldProps<string>> = ({ value, config, onSave, readOnly }) => {
  const dateConfig = config?.date
  const [isEditing, setIsEditing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Parse value or default to today
  // Replaced parseISO with new Date() to avoid import errors
  const parsedDate = value ? new Date(value) : new Date()
  const safeDate = isValid(parsedDate) ? parsedDate : new Date()

  // Calendar State
  const [viewDate, setViewDate] = useState(safeDate)

  useEffect(() => {
    if (isEditing && value) {
      const d = new Date(value)
      if (isValid(d)) setViewDate(d)
    }
  }, [isEditing, value])

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (isEditing) {
          setIsEditing(false)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isEditing])

  const handleStartEdit = () => {
    if (!readOnly) {
      setIsEditing(true)
    }
  }

  const getDisplayValue = (isoString: string) => {
    if (!isoString) return ''
    const date = new Date(isoString)
    if (!isValid(date)) return 'Invalid Date'

    let formatStr = 'PPP' // Default Friendly

    if (dateConfig?.displayFormat === 'usa') formatStr = 'MM/dd/yyyy'
    else if (dateConfig?.displayFormat === 'euro') formatStr = 'dd/MM/yyyy'
    else if (dateConfig?.displayFormat === 'iso') formatStr = 'yyyy-MM-dd'

    if (dateConfig?.includeTime) {
      if (dateConfig?.timeFormat === 'twenty_four_hour') {
        formatStr += ' HH:mm'
      } else {
        formatStr += ' p'
      }
    }

    let display = format(date, formatStr)
    if (dateConfig?.displayTimezone) {
      display += ` (${Intl.DateTimeFormat().resolvedOptions().timeZone})`
    }
    return display
  }

  // Calendar Logic
  // Replaced startOfMonth with native Date manipulation
  const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1)
  const monthEnd = endOfMonth(viewDate)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startDayOfWeek = getDay(monthStart) // 0 = Sunday

  const handleDateClick = (day: Date) => {
    // Preserve time from current value if exists
    const newDate = new Date(day)
    if (dateConfig?.includeTime) {
      // Replaced setHours/setMinutes with native methods
      newDate.setHours(getHours(safeDate))
      newDate.setMinutes(getMinutes(safeDate))
    }
    const isoString = newDate.toISOString()
    onSave(isoString)
    if (!dateConfig?.includeTime) {
      setIsEditing(false)
    }
  }

  const handleTimeChange = (type: 'hour' | 'minute', val: number) => {
    const newDate = value ? new Date(value) : new Date()
    if (!isValid(newDate)) newDate.setTime(new Date().getTime())

    if (type === 'hour') newDate.setHours(val)
    if (type === 'minute') newDate.setMinutes(val)

    const isoString = newDate.toISOString()
    onSave(isoString)
  }

  const hours = Array.from({ length: 24 }, (_, i) => i)
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5) // 0, 5, 10...

  if (isEditing) {
    return (
      <div className="relative w-full" ref={containerRef}>
        <div className="w-full px-2 py-1 border border-blue-500 rounded bg-white text-sm shadow-sm min-h-[28px] flex items-center">
          {value ? getDisplayValue(value) : <span className="text-gray-400">Select date...</span>}
        </div>

        <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl flex flex-col md:flex-row overflow-hidden min-w-[280px]">
          {/* Date Picker */}
          <div className="p-4 w-64">
            <div className="flex justify-between items-center mb-4">
              {/* Replaced subMonths with addMonths(-1) */}
              <button
                onClick={() => setViewDate(addMonths(viewDate, -1))}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-sm">{format(viewDate, 'MMMM yyyy')}</span>
              <button
                onClick={() => setViewDate(addMonths(viewDate, 1))}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2 text-gray-500">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-sm">
              {Array.from({ length: startDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {daysInMonth.map((date) => {
                const valDate = value ? new Date(value) : null
                const isSelected =
                  valDate &&
                  isValid(valDate) &&
                  getDate(valDate) === getDate(date) &&
                  getMonth(valDate) === getMonth(date) &&
                  getYear(valDate) === getYear(date)

                return (
                  <button
                    key={date.toString()}
                    onClick={() => handleDateClick(date)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center hover:bg-blue-50 transition-colors ${
                      isSelected ? 'bg-blue-50 text-white hover:bg-blue-600' : 'text-gray-700'
                    }`}
                  >
                    {getDate(date)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Time Picker */}
          {dateConfig?.includeTime && (
            <div className="border-l border-gray-200 bg-gray-50 w-32 flex flex-col">
              <div className="p-2 border-b border-gray-200 text-xs font-semibold text-gray-500 flex items-center justify-center gap-1">
                <Clock className="w-3 h-3" /> Time
              </div>
              <div className="flex flex-1 h-64">
                <div className="flex-1 overflow-y-auto scrollbar-hide border-r border-gray-200">
                  {hours.map((h) => (
                    <div
                      key={h}
                      onClick={() => handleTimeChange('hour', h)}
                      className={`px-2 py-1 text-center text-sm cursor-pointer hover:bg-gray-200 ${getHours(safeDate) === h ? 'bg-blue-100 font-medium text-blue-700' : ''}`}
                    >
                      {h.toString().padStart(2, '0')}
                    </div>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-hide">
                  {minutes.map((m) => (
                    <div
                      key={m}
                      onClick={() => handleTimeChange('minute', m)}
                      className={`px-2 py-1 text-center text-sm cursor-pointer hover:bg-gray-200 ${getMinutes(safeDate) === m ? 'bg-blue-100 font-medium text-blue-700' : ''}`}
                    >
                      {m.toString().padStart(2, '0')}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={handleStartEdit}
      className={`w-full min-h-[28px] px-2 py-1 text-sm text-gray-800 rounded border border-transparent transition-colors ${
        !readOnly ? 'cursor-pointer hover:bg-gray-100 hover:border-gray-200' : ''
      }`}
    >
      {value ? getDisplayValue(value) : <span className="text-gray-400 italic">Empty</span>}
    </div>
  )
}

export default DateField
