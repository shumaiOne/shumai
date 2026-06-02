'use client'

import { Button } from '@/ui/components/ui/button'
import { Calendar } from '@/ui/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/components/ui/popover'
import { ScrollArea, ScrollBar } from '@/ui/components/ui/scroll-area'
import { Separator } from '@/ui/components/ui/separator'
import { cn } from '@/ui/lib/utils'
import { addHours, addWeeks, format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import * as React from 'react'

interface DateTimePickerProps {
  value?: Date
  onChange?: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  disabled,
  className,
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [tempValue, setTempValue] = React.useState<Date | undefined>(value)

  // Sync tempValue with value when popover opens
  React.useEffect(() => {
    if (isOpen) {
      setTempValue(value)
    }
  }, [isOpen, value])

  const hours = Array.from({ length: 24 }, (_, i) => i)
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5) // 5-minute increments

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      const newDate = tempValue ? new Date(tempValue) : new Date()
      newDate.setFullYear(selectedDate.getFullYear())
      newDate.setMonth(selectedDate.getMonth())
      newDate.setDate(selectedDate.getDate())
      setTempValue(newDate)
    } else {
      setTempValue(undefined)
    }
  }

  const handleTimeChange = (type: 'hour' | 'minute', timeValue: number) => {
    const newDate = tempValue ? new Date(tempValue) : new Date()
    if (type === 'hour') {
      newDate.setHours(timeValue)
    } else {
      newDate.setMinutes(timeValue)
    }
    setTempValue(newDate)
  }

  const handleQuickSelect = (type: '24h' | '1w' | '2w') => {
    let newDate = new Date()
    if (type === '24h') {
      newDate = addHours(newDate, 24)
    } else if (type === '1w') {
      newDate = addWeeks(newDate, 1)
    } else if (type === '2w') {
      newDate = addWeeks(newDate, 2)
    }
    setTempValue(newDate)
  }

  const handleSave = () => {
    onChange?.(tempValue)
    setIsOpen(false)
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal h-9',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, 'yyyy/MM/dd HH:mm') : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[22rem] p-0" align="start">
        <div className="flex flex-col w-full">
          <div className="flex w-full">
            <Calendar
              mode="single"
              selected={tempValue}
              onSelect={handleDateSelect}
              className="grow"
            />
            <div className="flex flex-col sm:flex-row sm:h-[300px] divide-y sm:divide-y-0 sm:divide-x border-t sm:border-t-0 border-l">
              {/* Hours Column */}
              <ScrollArea className="w-64 sm:w-auto [&_[data-orientation=vertical]]:hidden">
                <div className="flex sm:flex-col p-2">
                  {hours.map((hour) => (
                    <Button
                      key={hour}
                      size="icon"
                      variant={tempValue && tempValue.getHours() === hour ? 'default' : 'ghost'}
                      className="sm:w-full shrink-0 aspect-square text-xs h-8 w-8"
                      onClick={() => handleTimeChange('hour', hour)}
                    >
                      {hour.toString().padStart(2, '0')}
                    </Button>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" className="sm:hidden" />
              </ScrollArea>

              {/* Minutes Column */}
              <ScrollArea className="w-64 sm:w-auto [&_[data-orientation=vertical]]:hidden">
                <div className="flex sm:flex-col p-2">
                  {minutes.map((minute) => (
                    <Button
                      key={minute}
                      size="icon"
                      variant={tempValue && tempValue.getMinutes() === minute ? 'default' : 'ghost'}
                      className="sm:w-full shrink-0 aspect-square text-xs h-8 w-8"
                      onClick={() => handleTimeChange('minute', minute)}
                    >
                      {minute.toString().padStart(2, '0')}
                    </Button>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" className="sm:hidden" />
              </ScrollArea>
            </div>
          </div>
          <Separator />
          <div className="p-2 flex items-center justify-between bg-muted/50">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-[10px] h-7 px-2"
                onClick={() => handleQuickSelect('24h')}
              >
                24 Hours
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-[10px] h-7 px-2"
                onClick={() => handleQuickSelect('1w')}
              >
                1 Week
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-[10px] h-7 px-2"
                onClick={() => handleQuickSelect('2w')}
              >
                2 Weeks
              </Button>
            </div>
            <Button size="sm" className="h-7 px-4" onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
