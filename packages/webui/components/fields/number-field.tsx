import React, { useEffect, useRef, useState } from 'react'
import type { FieldProps } from './field-types'

const NumberField: React.FC<FieldProps<number | undefined>> = ({
  value,
  config,
  onSave,
  readOnly,
}) => {
  const numberConfig = config?.number
  const [isEditing, setIsEditing] = useState(false)
  // Store as string to allow intermediate states like "1." or empty
  const [localValue, setLocalValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLocalValue(value !== undefined && value !== null ? value.toString() : '')
  }, [value])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isEditing])

  const handleStartEdit = () => {
    if (!readOnly) {
      setIsEditing(true)
    }
  }

  const handleBlur = () => {
    setIsEditing(false)
    if (localValue === '') {
      onSave(undefined) // Handle empty
    } else {
      const num = parseFloat(localValue)
      onSave(isNaN(num) ? undefined : num)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.stopPropagation()
      inputRef.current?.blur()
    }
  }

  const formatNumber = (val: number | undefined) => {
    if (val === undefined || val === null || isNaN(val)) return ''
    return val.toFixed(numberConfig?.scale)
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="number"
        step={1 / Math.pow(10, numberConfig?.scale || 0)}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onDoubleClick={(e) => e.stopPropagation()}
        className="w-full px-2 py-1 border border-ring rounded bg-background text-sm outline-none shadow-sm text-left font-mono"
      />
    )
  }

  return (
    <div
      onClick={handleStartEdit}
      onDoubleClick={(e) => e.stopPropagation()}
      className={`w-full min-h-[28px] px-2 py-1 text-sm text-foreground rounded border border-transparent transition-colors text-left font-mono ${
        !readOnly ? 'cursor-pointer hover:bg-accent hover:border-border' : ''
      }`}
    >
      {value !== undefined && value !== null ? (
        formatNumber(value)
      ) : (
        <span className="text-muted-foreground italic font-sans text-left block">Empty</span>
      )}
    </div>
  )
}

export default NumberField
