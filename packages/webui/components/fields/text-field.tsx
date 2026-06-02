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

  const handleStartEdit = () => {
    if (!readOnly) {
      setIsEditing(true)
    }
  }

  const handleBlur = () => {
    setIsEditing(false)
    onSave(localValue)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur()
    }
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full px-2 py-1 border border-blue-500 rounded bg-white text-sm outline-none shadow-sm"
      />
    )
  }

  return (
    <div
      onClick={handleStartEdit}
      className={`w-full min-h-[28px] px-2 py-1 text-sm text-gray-800 rounded truncate border border-transparent transition-colors ${
        !readOnly ? 'cursor-pointer hover:bg-gray-100 hover:border-gray-200' : ''
      }`}
    >
      {value || <span className="text-gray-400 italic">Empty</span>}
    </div>
  )
}

export default TextField
