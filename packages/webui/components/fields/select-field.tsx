import type { SelectOption } from '@shumai/dtos'
import { ChevronDown, X } from 'lucide-react'
import React, { useState } from 'react'
import type { FieldProps } from './field-types'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/components/ui/popover'
import { getOptionStyle } from '../fields-manager'

const SelectField: React.FC<FieldProps<string>> = ({ value, config, onSave, readOnly }) => {
  const selectConfig = config?.select
  const [isEditing, setIsEditing] = useState(false)

  const selectedOption = selectConfig?.options?.find((opt: SelectOption) => opt.id === value)

  const handleStartEdit = () => {
    if (!readOnly) {
      setIsEditing(true)
    }
  }

  const handleSelect = (optionId: string) => {
    onSave(optionId)
    setIsEditing(false)
  }

  const handleOpenChange = (open: boolean) => {
    if (readOnly) return
    setIsEditing(open)
  }

  const renderOptionBadge = (option: SelectOption | undefined) => {
    if (!option) return <span className="text-gray-400 italic">Select an option</span>
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
        style={getOptionStyle(option.color)}
      >
        {option.displayName}
      </span>
    )
  }

  return (
    <div className="relative w-full" onClick={(e) => e.stopPropagation()}>
      <Popover open={!readOnly && isEditing} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
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
        </PopoverTrigger>

        <PopoverContent
          className="p-1 w-[--radix-popover-trigger-width] min-w-[150px] max-h-60 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg"
          align="start"
        >
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
                style={getOptionStyle(option.color)}
              >
                {option.displayName}
              </span>
            </div>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  )
}

export default SelectField
