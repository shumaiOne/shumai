import { Check } from 'lucide-react'
import React, { useLayoutEffect, useRef, useState } from 'react'
import type { FieldProps } from './field-types'
import type { SelectOption } from '@shumai/dtos'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/components/ui/popover'
import { getOptionStyle } from '../fields-manager'

const SelectMultiField: React.FC<FieldProps<string[]>> = ({
  value = [],
  config,
  onSave,
  readOnly,
}) => {
  const selectConfig = config?.selectMulti
  const containerRef = useRef<HTMLDivElement>(null)
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
  const isOpen = (expanded && !isEditing) || isEditing

  const handleOpenChange = (open: boolean) => {
    if (readOnly) return
    if (!open) {
      setExpanded(false)
      setIsEditing(false)
    }
  }

  return (
    <div className="relative w-full" onClick={(e) => e.stopPropagation()}>
      <Popover open={!readOnly && isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          {/* Placeholder Display Mode */}
          <div
            ref={containerRef}
            onClick={handlePlaceholderClick}
            className={`w-full px-1 py-1 flex flex-wrap gap-1 rounded border border-transparent transition-all box-border h-[32px] overflow-hidden ${
              !readOnly || hiddenCount > 0
                ? 'cursor-pointer hover:bg-accent hover:border-border'
                : ''
            }`}
          >
            {selectedOptions.length === 0 && (
              <span className="text-muted-foreground text-sm italic px-1 pt-0.5">Empty</span>
            )}

            {/* Render visible items */}
            {selectedOptions.slice(0, visibleCount).map((option: SelectOption) => (
              <span
                key={option.id}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border border-transparent whitespace-nowrap h-[22px]"
                style={getOptionStyle(option.color)}
              >
                {option.displayName}
              </span>
            ))}

            {hiddenCount > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground h-[22px]">
                +{hiddenCount}
              </span>
            )}
          </div>
        </PopoverTrigger>

        <PopoverContent
          className={`p-1 bg-popover border rounded-lg shadow-xl max-h-60 overflow-auto ${
            expanded && !isEditing
              ? 'w-[--radix-popover-trigger-width] min-w-[200px] flex flex-wrap gap-1 border-ring min-h-[32px] h-auto cursor-pointer'
              : 'w-64 border-border'
          }`}
          align="start"
          onClick={expanded && !isEditing ? handleOverlayClick : undefined}
        >
          {expanded && !isEditing ? (
            <>
              {selectedOptions.length === 0 && (
                <span className="text-muted-foreground text-sm italic px-1 pt-0.5">Empty</span>
              )}
              {selectedOptions.map((option: SelectOption) => (
                <span
                  key={option.id}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border border-transparent whitespace-nowrap h-[22px]"
                  style={getOptionStyle(option.color)}
                >
                  {option.displayName}
                </span>
              ))}
            </>
          ) : (
            selectConfig?.options?.map((option: SelectOption) => {
              const isSelected = (value || []).includes(option.id)
              return (
                <div
                  key={option.id}
                  onClick={() => toggleOption(option.id)}
                  className="px-3 py-2 hover:bg-accent cursor-pointer flex items-center justify-between"
                >
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    style={getOptionStyle(option.color)}
                  >
                    {option.displayName}
                  </span>
                  {isSelected && <Check className="w-4 h-4 text-primary" />}
                </div>
              )
            })
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

export default SelectMultiField
