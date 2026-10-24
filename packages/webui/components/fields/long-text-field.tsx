import React, { useEffect, useRef, useState } from 'react'
import type { FieldProps } from './field-types'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/components/ui/popover'

const LongTextField: React.FC<FieldProps<string>> = ({ value, onSave, readOnly }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [localValue, setLocalValue] = useState(value || '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setLocalValue(value || '')
  }, [value])

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isEditing])

  const handleBlur = () => {
    setIsEditing(false)
    if (localValue !== (value || '')) {
      onSave(localValue)
    }
  }

  const handlePlaceholderClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded(true)
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!readOnly) {
      setIsEditing(true)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      if (isEditing) {
        setIsEditing(false)
        if (localValue !== (value || '')) {
          onSave(localValue)
        }
      }
      setExpanded(false)
    } else {
      setExpanded(true)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.currentTarget.blur()
    }
  }

  return (
    <div className="relative w-full text-sm" onClick={(e) => e.stopPropagation()}>
      <Popover open={expanded} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <div
            onClick={handlePlaceholderClick}
            className={`w-full text-foreground rounded border transition-all px-2 py-1 h-[48px] line-clamp-2 whitespace-pre-wrap overflow-hidden ${
              expanded ? 'border-ring bg-background shadow-sm' : 'border-transparent'
            } ${!readOnly ? 'cursor-pointer hover:bg-accent hover:border-border' : 'cursor-pointer'}`}
            title="Click to expand"
          >
            {value ? value : <span className="text-muted-foreground italic">Empty</span>}
          </div>
        </PopoverTrigger>

        <PopoverContent
          side="bottom"
          align="start"
          sideOffset={4}
          className="w-[--radix-popover-trigger-width] min-w-[280px] max-w-md p-2 bg-popover border border-border rounded-lg shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="w-full min-h-[100px] max-h-72 p-2 border border-ring rounded bg-background text-sm outline-none shadow-sm resize-y"
              autoFocus
            />
          ) : (
            <div
              onClick={handleOverlayClick}
              className={`w-full max-h-72 overflow-y-auto whitespace-pre-wrap break-words text-sm px-1 py-0.5 ${
                !readOnly ? 'cursor-text' : ''
              }`}
              title={!readOnly ? 'Click to edit' : undefined}
            >
              {value ? value : <span className="text-muted-foreground italic">Empty</span>}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

export default LongTextField
