import React, { useEffect, useRef, useState } from 'react'
import type { FieldProps } from './field-types'

const TextField: React.FC<FieldProps<string>> = ({ value, onSave, readOnly }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [localValue, setLocalValue] = useState(value || '')
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync with prop updates
  useEffect(() => {
    setLocalValue(value || '')
  }, [value])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isEditing])

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!readOnly) {
      setIsEditing(true)
    }
  }

  const handleBlur = () => {
    setIsEditing(false)
    if (localValue !== (value || '')) {
      onSave(localValue)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur()
    }
    if (e.key === 'Escape') {
      setIsEditing(false)
      setLocalValue(value || '')
    }
  }

  return (
    <div
      className="relative w-full"
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="w-full px-2 py-1 border border-ring rounded bg-background text-sm outline-none shadow-sm"
        />
      ) : (
        <div
          data-testid="text-field-display"
          onClick={handleStartEdit}
          className={`w-full min-h-[28px] px-2 py-1 text-sm text-foreground rounded truncate border border-transparent transition-colors ${
            !readOnly ? 'cursor-pointer hover:bg-accent hover:border-border' : ''
          }`}
        >
          {value || <span className="text-muted-foreground italic">Empty</span>}
        </div>
      )}
    </div>
  )
}

export default TextField
