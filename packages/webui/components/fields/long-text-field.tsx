import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { FieldProps } from './field-types'

const LongTextField: React.FC<FieldProps<string>> = ({ value, onSave, readOnly }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [localValue, setLocalValue] = useState(value || '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement | HTMLTextAreaElement | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [expandedHeight, setExpandedHeight] = useState<number | null>(null)
  const [coords, setCoords] = useState<{
    top: number
    left: number
    width: number
    height: number
  } | null>(null)

  useEffect(() => {
    setLocalValue(value || '')
  }, [value])

  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setCoords({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      })
    }
  }

  useLayoutEffect(() => {
    if (expanded || isEditing) {
      updateCoords()
    }
  }, [expanded, isEditing])

  useLayoutEffect(() => {
    if (expanded && overlayRef.current) {
      const h = overlayRef.current.offsetHeight
      if (h > 0) {
        setExpandedHeight(h)
      }
    }
  }, [expanded])

  const adjustHeight = () => {
    if (textareaRef.current) {
      const baseHeight =
        expandedHeight && expandedHeight > 0 ? expandedHeight : Math.max(80, coords?.height || 0)
      textareaRef.current.style.height = `${baseHeight}px`
      const newHeight = Math.min(240, Math.max(baseHeight, textareaRef.current.scrollHeight))
      textareaRef.current.style.height = `${newHeight}px`
    }
  }

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      const len = textareaRef.current.value.length
      textareaRef.current.setSelectionRange(len, len)
      adjustHeight()
    }
  }, [isEditing])

  // Handle click outside and Escape to close expanded or editing state
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        overlayRef.current &&
        !overlayRef.current.contains(target)
      ) {
        if (isEditing) {
          handleBlur()
        } else {
          setExpanded(false)
          setExpandedHeight(null)
        }
      }
    }

    const handleKeyDownGlobal = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isEditing) {
          setIsEditing(false)
          setExpanded(false)
          setExpandedHeight(null)
          setLocalValue(value || '')
        } else {
          setExpanded(false)
          setExpandedHeight(null)
        }
      }
    }

    const handleScrollOrResize = (event: Event) => {
      if (overlayRef.current && overlayRef.current.contains(event.target as Node)) {
        return
      }
      updateCoords()
    }

    if (expanded || isEditing) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDownGlobal)
      window.addEventListener('scroll', handleScrollOrResize, true)
      window.addEventListener('resize', handleScrollOrResize)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDownGlobal)
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
    }
  }, [expanded, isEditing, localValue, value])

  const handleBlur = () => {
    setIsEditing(false)
    setExpanded(false)
    setExpandedHeight(null)
    if (localValue !== (value || '')) {
      onSave(localValue)
    }
  }

  const handlePlaceholderClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    updateCoords()
    if (!value && !readOnly) {
      setExpandedHeight(80)
      setIsEditing(true)
    } else {
      setExpanded(true)
    }
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!readOnly) {
      if (overlayRef.current) {
        const h = overlayRef.current.offsetHeight
        if (h > 0) {
          setExpandedHeight(h)
        }
      }
      setIsEditing(true)
      setExpanded(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.currentTarget.blur()
    }
  }

  const setTextareaRef = (el: HTMLTextAreaElement | null) => {
    textareaRef.current = el
    overlayRef.current = el
  }

  const targetHeight =
    expandedHeight && expandedHeight > 0 ? expandedHeight : Math.max(80, coords?.height || 0)

  return (
    <div
      ref={containerRef}
      className="relative w-full text-sm"
      onClick={(e) => e.stopPropagation()}
    >
      {/* In-card placeholder: fixed 48px height so card height never changes */}
      <div
        data-testid="long-text-placeholder"
        onClick={handlePlaceholderClick}
        className={`w-full text-foreground rounded border border-transparent transition-all px-2 py-1 h-[48px] line-clamp-2 whitespace-pre-wrap overflow-hidden ${
          expanded || isEditing ? 'invisible pointer-events-none select-none' : ''
        } ${!readOnly ? 'cursor-pointer hover:bg-accent hover:border-border' : 'cursor-pointer'}`}
        title={!expanded && !isEditing ? 'Click to expand' : undefined}
      >
        {value ? value : <span className="text-muted-foreground italic">Empty</span>}
      </div>

      {/* Expanded overlay or textarea: portaled to document.body so card border never clips it */}
      {(expanded || isEditing) &&
        coords &&
        typeof document !== 'undefined' &&
        createPortal(
          isEditing ? (
            <textarea
              ref={setTextareaRef}
              data-testid="long-text-editing-overlay"
              value={localValue}
              onChange={(e) => {
                setLocalValue(e.target.value)
                adjustHeight()
              }}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              style={{
                position: 'fixed',
                top: coords.top,
                left: coords.left,
                width: coords.width > 0 ? coords.width : 'auto',
                minWidth: coords.width > 0 ? coords.width : 200,
                height: targetHeight,
                minHeight: targetHeight,
                maxHeight: 240,
                zIndex: 50,
              }}
              className="bg-background border border-ring rounded shadow-lg px-2 py-1 text-sm outline-none resize-none overflow-y-auto"
            />
          ) : (
            <div
              ref={(el) => {
                overlayRef.current = el
              }}
              data-testid="long-text-expanded-overlay"
              onClick={handleOverlayClick}
              style={{
                position: 'fixed',
                top: coords.top,
                left: coords.left,
                width: coords.width > 0 ? coords.width : 'auto',
                minWidth: coords.width > 0 ? coords.width : 200,
                minHeight: Math.max(80, coords.height),
                maxHeight: 240,
                zIndex: 50,
              }}
              className={`min-h-[80px] bg-background border border-ring rounded shadow-lg px-2 py-1 whitespace-pre-wrap overflow-y-auto text-sm ${
                !readOnly ? 'cursor-text' : 'cursor-pointer'
              }`}
              title={!readOnly ? 'Click to edit' : undefined}
            >
              {value ? value : <span className="text-muted-foreground italic">Empty</span>}
            </div>
          ),
          document.body,
        )}
    </div>
  )
}

export default LongTextField
