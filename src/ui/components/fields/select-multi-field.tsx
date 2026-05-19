import { Check } from 'lucide-react'
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { FieldProps } from './field-types'
import type { SelectOption } from '@/dtos/metadata'

const SelectMultiField: React.FC<FieldProps<string[]>> = ({
  value = [],
  config,
  onSave,
  readOnly,
}) => {
  const selectConfig = config?.selectMulti
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [visibleCount, setVisibleCount] = useState(value.length)

  const selectedOptions =
    selectConfig?.options?.filter((opt: SelectOption) => (value || []).includes(opt.id)) || []

  // Dynamic calculation for how many items fit in one line
  useLayoutEffect(() => {
    if (isEditing || expanded) {
      // When editing or expanded, we technically don't use visibleCount for rendering
      // (we render all), but keeping state clean is good.
      setVisibleCount(selectedOptions.length)
      return
    }

    if (containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (context) {
        context.font = '12px ui-sans-serif, system-ui, sans-serif'

        let currentWidth = 0
        let count = 0
        const moreBadgeWidth = 28
        // We use a small buffer to be safe
        const maxAvailableWidth = containerWidth - moreBadgeWidth

        for (let i = 0; i < selectedOptions.length; i++) {
          const textWidth = context.measureText(selectedOptions[i].displayName).width
          const badgeWidth = textWidth + 16 + 4 // 16px padding, 4px gap

          if (currentWidth + badgeWidth > maxAvailableWidth && i < selectedOptions.length - 1) {
            break
          }
          if (i === selectedOptions.length - 1) {
            if (currentWidth + badgeWidth <= containerWidth) {
              count++
            }
            break
          }

          currentWidth += badgeWidth
          count++
        }
        setVisibleCount(count)
      }
    }
  }, [selectedOptions, isEditing, expanded, value])

  // Click outside to close dropdown or expanded view
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is outside both the main container and the dropdown
      const isOutsideDropdown =
        !dropdownRef.current || !dropdownRef.current.contains(event.target as Node)
      const isOutsideContainer =
        !containerRef.current || !containerRef.current.contains(event.target as Node)

      if (isOutsideDropdown && isOutsideContainer) {
        if (isEditing) {
          setIsEditing(false)
        }
        if (expanded) {
          setExpanded(false)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isEditing, expanded])

  const toggleOption = (optionId: string) => {
    const currentVal = value || []
    let newVal
    if (currentVal.includes(optionId)) {
      newVal = currentVal.filter((id) => id !== optionId)
    } else {
      newVal = [...currentVal, optionId]
    }
    onSave(newVal)
  }

  const handlePlaceholderClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isEditing) return

    // "if there is hidden items, first click will expand"
    const hiddenCount = selectedOptions.length - visibleCount
    if (!expanded && hiddenCount > 0) {
      setExpanded(true)
    } else {
      // "if there is no hidden items, will change to edit mode"
      if (!readOnly) {
        setIsEditing(true)
      }
    }
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    // "second click (on expanded) will change to edit mode"
    if (!readOnly) {
      setIsEditing(true)
    }
  }

  const hiddenCount = selectedOptions.length - visibleCount

  return (
    <div className="relative w-full">
      {/* Placeholder Display Mode */}
      <div
        ref={containerRef}
        onClick={handlePlaceholderClick}
        className={`w-full px-1 py-1 flex flex-wrap gap-1 rounded border border-transparent transition-all box-border h-[32px] overflow-hidden ${
          !readOnly || hiddenCount > 0
            ? 'cursor-pointer hover:bg-gray-100 hover:border-gray-200'
            : ''
        }`}
      >
        {selectedOptions.length === 0 && (
          <span className="text-gray-400 text-sm italic px-1 pt-0.5">Empty</span>
        )}

        {/* Render visible items */}
        {selectedOptions.slice(0, visibleCount).map((option: SelectOption) => (
          <span
            key={option.id}
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border border-transparent whitespace-nowrap h-[22px]"
            style={{
              backgroundColor: `${option.color}33`,
              color: option.color || undefined,
            }}
          >
            {option.displayName}
          </span>
        ))}

        {hiddenCount > 0 && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600 h-[22px]">
            +{hiddenCount}
          </span>
        )}
      </div>

      {/* Expanded Overlay Mode */}
      {expanded && !isEditing && (
        <div
          onClick={handleOverlayClick}
          className={`absolute top-0 left-0 w-full px-1 py-1 flex flex-wrap gap-1 bg-white rounded border border-blue-500 shadow-lg z-50 min-h-[32px] h-auto ${
            !readOnly ? 'cursor-pointer' : ''
          }`}
        >
          {selectedOptions.length === 0 && (
            <span className="text-gray-400 text-sm italic px-1 pt-0.5">Empty</span>
          )}
          {selectedOptions.map((option: SelectOption) => (
            <span
              key={option.id}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border border-transparent whitespace-nowrap h-[22px]"
              style={{
                backgroundColor: `${option.color}33`,
                color: option.color || undefined,
              }}
            >
              {option.displayName}
            </span>
          ))}
        </div>
      )}

      {/* Edit Mode Dropdown */}
      {isEditing && (
        <div
          ref={dropdownRef}
          className="absolute z-50 top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-auto"
        >
          {selectConfig?.options?.map((option: SelectOption) => {
            const isSelected = (value || []).includes(option.id)
            return (
              <div
                key={option.id}
                onClick={() => toggleOption(option.id)}
                className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
              >
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: `${option.color}33`,
                    color: option.color || undefined,
                  }}
                >
                  {option.displayName}
                </span>
                {isSelected && <Check className="w-4 h-4 text-blue-500" />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default SelectMultiField
