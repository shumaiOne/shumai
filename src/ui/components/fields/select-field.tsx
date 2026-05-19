import type { SelectOption } from '@/dtos/metadata'
import { ChevronDown, X } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import type { FieldProps } from './field-types'

const SelectField: React.FC<FieldProps<string>> = ({ value, config, onSave, readOnly }) => {
  const selectConfig = config?.select
  const [isEditing, setIsEditing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = selectConfig?.options?.find((opt: SelectOption) => opt.id === value)

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (isEditing) {
          setIsEditing(false)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isEditing])

  const handleStartEdit = () => {
    if (!readOnly) {
      setIsEditing(true)
    }
  }

  const handleSelect = (optionId: string) => {
    onSave(optionId)
    setIsEditing(false)
  }

  const renderOptionBadge = (option: SelectOption | undefined) => {
    if (!option) return <span className="text-gray-400 italic">Select an option</span>
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
        style={{
          backgroundColor: `${option.color}33`,
          color: option.color || undefined,
        }} // 33 is approx 20% opacity hex
      >
        {option.displayName}
      </span>
    )
  }

  return (
    <div className="relative w-full" ref={containerRef}>
      <div
        onClick={handleStartEdit}
        className={`flex items-center justify-between w-full min-h-[28px] px-2 py-1 rounded border border-transparent transition-colors ${
          !readOnly ? 'cursor-pointer hover:bg-gray-100 hover:border-gray-200 group' : ''
        }`}
      >
        {renderOptionBadge(selectedOption)}
        {!readOnly && (
          <ChevronDown className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100" />
        )}
      </div>

      {isEditing && (
        <div className="absolute z-50 top-full left-0 mt-1 w-full min-w-[150px] bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-60 overflow-auto">
          <div
            onClick={() => handleSelect('')}
            className="px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
          >
            <X className="w-3 h-3" /> Clear
          </div>
          {selectConfig?.options?.map((option: SelectOption) => (
            <div
              key={option.id}
              onClick={() => handleSelect(option.id)}
              className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center"
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default SelectField
