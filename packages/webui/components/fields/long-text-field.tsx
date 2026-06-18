import React, { useEffect, useRef, useState } from 'react'
import type { FieldProps } from './field-types'

const LongTextField: React.FC<FieldProps<string>> = ({ value, onSave, readOnly }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [localValue, setLocalValue] = useState(value || '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setLocalValue(value || '')
  }, [value])

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      setExpanded(false)
    }
  }, [isEditing])

  // Handle click outside to close expanded state
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        expanded &&
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setExpanded(false)
      }
    }

    if (expanded) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [expanded])

  const handleBlur = () => {
    setIsEditing(false)
    onSave(localValue)
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

  if (isEditing) {
    return (
      <textarea
        ref={textareaRef}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        className="w-full min-h-[80px] p-2 border border-ring rounded bg-background text-sm outline-none shadow-sm resize-none"
      />
    )
  }

  return (
    <div ref={containerRef} className="relative w-full text-sm">
      {/* Placeholder */}
      <div
        onClick={handlePlaceholderClick}
        className={`w-full text-foreground rounded border border-transparent transition-all px-2 py-1 line-clamp-2 max-h-[3rem] overflow-hidden ${
          !readOnly ? 'cursor-pointer hover:bg-accent hover:border-border' : 'cursor-pointer'
        }`}
        title="Click to expand"
      >
        {value ? value : <span className="text-muted-foreground italic">Empty</span>}
      </div>

      {/* Expanded Overlay */}
      {expanded && (
        <div
          onClick={handleOverlayClick}
          className={`absolute top-0 left-0 w-full min-h-full h-auto z-50 bg-background border border-ring rounded shadow-lg px-2 py-1 whitespace-pre-wrap ${
            !readOnly ? 'cursor-text' : ''
          }`}
        >
          {value ? value : <span className="text-muted-foreground italic">Empty</span>}
        </div>
      )}
    </div>
  )
}

export default LongTextField
