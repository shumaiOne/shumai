import type { FieldInfo, SelectOption } from '@shumai/dtos'
import { Check, Plus, Search } from 'lucide-react'
import React, { useLayoutEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { FieldProps } from './field-types'
import { client } from '@/ui/api/client'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/components/ui/popover'
import { m } from '@/ui/paraglide/messages.js'
import { useFieldStore } from '@/ui/stores/fields'
import { getOptionStyle, getRandomUnusedColor } from '../fields-manager'

const SelectMultiField: React.FC<FieldProps<string[]>> = ({
  value = [],
  config,
  onSave,
  readOnly,
  fieldId,
}) => {
  const selectConfig = config?.selectMulti
  const options: SelectOption[] = selectConfig?.options || []
  const containerRef = useRef<HTMLDivElement>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [visibleCount, setVisibleCount] = useState(value.length)
  const [searchQuery, setSearchQuery] = useState('')

  const selectedOptions =
    options.filter((opt: SelectOption) => (value || []).includes(opt.id)) || []

  const trimmedSearch = searchQuery.trim()
  const filteredOptions = options.filter((opt: SelectOption) =>
    opt.displayName.toLowerCase().includes(trimmedSearch.toLowerCase()),
  )
  const hasExactMatch = options.some(
    (opt: SelectOption) => opt.displayName.trim().toLowerCase() === trimmedSearch.toLowerCase(),
  )

  // Dynamic calculation for how many items fit in one line
  useLayoutEffect(() => {
    if (isEditing || expanded) {
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
        const maxAvailableWidth = containerWidth - moreBadgeWidth

        for (let i = 0; i < selectedOptions.length; i++) {
          const textWidth = context.measureText(selectedOptions[i].displayName).width
          const badgeWidth = textWidth + 16 + 4

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

  const handleAddOption = async () => {
    if (!trimmedSearch) return
    const newOption: SelectOption = {
      id: trimmedSearch.toLowerCase().replace(/\s+/g, '-'),
      displayName: trimmedSearch,
      color: getRandomUnusedColor(options),
    }
    const newOptions = [...options, newOption]
    const updatedConfig = {
      ...config,
      selectMulti: {
        ...selectConfig,
        options: newOptions,
      },
    }

    if (fieldId) {
      try {
        const res = await client.api.fields[':fieldId'].$put({
          param: { fieldId },
          json: { config: updatedConfig },
        })
        if (!res.ok) {
          toast.error(m.failed_update_field())
          return
        }
        const updatedField = (await res.json()) as FieldInfo
        const currentFields = useFieldStore.getState().fields
        const newFields = currentFields.map((f) =>
          f.id === updatedField.id
            ? { ...f, ...(updatedField as FieldInfo), visible: f.visible }
            : f,
        )
        useFieldStore.getState().updateFields(newFields)
      } catch {
        toast.error(m.failed_update_field())
        return
      }
    }

    onSave([...(value || []), newOption.id])
    setSearchQuery('')
  }

  const handlePlaceholderClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isEditing) return

    const hiddenCount = selectedOptions.length - visibleCount
    if (!expanded && hiddenCount > 0) {
      setExpanded(true)
    } else {
      if (!readOnly) {
        setIsEditing(true)
      }
    }
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    e.stopPropagation()
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
      setSearchQuery('')
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
          side="bottom"
          align="start"
          sideOffset={4}
          className={`p-1.5 bg-popover border rounded-lg shadow-xl max-h-72 flex flex-col ${
            expanded && !isEditing
              ? 'w-[--radix-popover-trigger-width] min-w-[200px] flex flex-wrap gap-1 border-ring min-h-[32px] h-auto cursor-pointer overflow-auto'
              : 'w-64 border-border'
          }`}
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
            <>
              <div
                className="relative pb-1.5 border-b border-border mb-1"
                onClick={(e) => e.stopPropagation()}
              >
                <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-muted-foreground" />
                <input
                  type="text"
                  className="w-full pl-7 pr-2 py-1 text-xs bg-muted/50 border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring text-foreground"
                  placeholder={m.search_options_placeholder()}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="overflow-y-auto max-h-48 min-h-[120px] space-y-0.5">
                {filteredOptions.map((option: SelectOption) => {
                  const isSelected = (value || []).includes(option.id)
                  return (
                    <div
                      key={option.id}
                      onClick={() => toggleOption(option.id)}
                      className={`px-2.5 py-1.5 hover:bg-accent rounded cursor-pointer flex items-center justify-between text-xs ${
                        isSelected ? 'bg-accent/30 font-medium' : ''
                      }`}
                    >
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                        style={getOptionStyle(option.color)}
                      >
                        {option.displayName}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                    </div>
                  )
                })}

                {filteredOptions.length === 0 && !trimmedSearch && (
                  <div className="px-2.5 py-2 text-xs text-muted-foreground italic text-center">
                    {m.no_options_found()}
                  </div>
                )}

                {trimmedSearch !== '' && !hasExactMatch && (
                  <div
                    onClick={handleAddOption}
                    className="px-2.5 py-1.5 text-xs text-primary hover:bg-accent rounded cursor-pointer flex items-center gap-1.5 font-medium border-t border-border mt-1 pt-1.5"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {m.add_option_with_name({ name: trimmedSearch })}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

export default SelectMultiField
