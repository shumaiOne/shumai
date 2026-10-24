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
import React, { useEffect, useState } from 'react'
import type { FieldProps } from './field-types'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/components/ui/popover'

const DateField: React.FC<FieldProps<string>> = ({ value, config, onSave, readOnly }) => {
  const dateConfig = config?.date
  const [isEditing, setIsEditing] = useState(false)

  // Parse value or default to today
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

  const handleStartEdit = () => {
    if (!readOnly) {
      setIsEditing(true)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (readOnly) return
    setIsEditing(open)
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
  const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1)
  const monthEnd = endOfMonth(viewDate)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startDayOfWeek = getDay(monthStart) // 0 = Sunday

  const handleDateClick = (day: Date) => {
    const newDate = new Date(day)
    if (dateConfig?.includeTime) {
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

  return (
    <div className="relative w-full" onClick={(e) => e.stopPropagation()}>
      <Popover open={!readOnly && isEditing} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <div
            onClick={handleStartEdit}
            className={`w-full min-h-[28px] px-2 py-1 text-sm text-foreground rounded truncate border transition-colors ${
              isEditing ? 'border-ring bg-background shadow-sm' : 'border-transparent'
            } ${!readOnly ? 'cursor-pointer hover:bg-accent hover:border-border' : ''}`}
          >
            {value ? (
              getDisplayValue(value)
            ) : (
              <span className="text-muted-foreground italic">Empty</span>
            )}
          </div>
        </PopoverTrigger>

        <PopoverContent
          side="bottom"
          align="start"
          sideOffset={4}
          className="p-0 w-auto bg-popover border border-border rounded-lg shadow-xl flex flex-col md:flex-row overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Date Picker */}
          <div className="p-4 w-64">
            <div className="flex justify-between items-center mb-4">
              <button
                type="button"
                onClick={() => setViewDate(addMonths(viewDate, -1))}
                className="p-1 hover:bg-accent rounded"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-sm">{format(viewDate, 'MMMM yyyy')}</span>
              <button
                type="button"
                onClick={() => setViewDate(addMonths(viewDate, 1))}
                className="p-1 hover:bg-accent rounded"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2 text-muted-foreground">
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
                    type="button"
                    key={date.toString()}
                    onClick={() => handleDateClick(date)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center hover:bg-accent transition-colors ${
                      isSelected
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'text-foreground'
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
            <div className="border-l border-border bg-muted w-32 flex flex-col">
              <div className="p-2 border-b border-border text-xs font-semibold text-muted-foreground flex items-center justify-center gap-1">
                <Clock className="w-3 h-3" /> Time
              </div>
              <div className="flex flex-1 h-64">
                <div className="flex-1 overflow-y-auto scrollbar-hide border-r border-border">
                  {hours.map((h) => (
                    <div
                      key={h}
                      data-testid={`hour-${h}`}
                      onClick={() => handleTimeChange('hour', h)}
                      className={`px-2 py-1 text-center text-sm cursor-pointer hover:bg-accent ${getHours(safeDate) === h ? 'bg-primary/10 font-medium text-primary' : ''}`}
                    >
                      {h.toString().padStart(2, '0')}
                    </div>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-hide">
                  {minutes.map((m) => (
                    <div
                      key={m}
                      data-testid={`minute-${m}`}
                      onClick={() => handleTimeChange('minute', m)}
                      className={`px-2 py-1 text-center text-sm cursor-pointer hover:bg-accent ${getMinutes(safeDate) === m ? 'bg-primary/10 font-medium text-primary' : ''}`}
                    >
                      {m.toString().padStart(2, '0')}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

export default DateField
