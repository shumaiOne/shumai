import type { FieldInfo, SelectOption } from '@shumai/dtos'
import { ChevronDown, Plus, Search, X } from 'lucide-react'
import React, { useState } from 'react'
import { toast } from 'sonner'
import type { FieldProps } from './field-types'
import { client } from '@/ui/api/client'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/components/ui/popover'
import { m } from '@/ui/paraglide/messages.js'
import { useFieldStore } from '@/ui/stores/fields'
import { getOptionStyle, getRandomUnusedColor } from '../fields-manager'

const SelectField: React.FC<FieldProps<string>> = ({
  value,
  config,
  onSave,
  readOnly,
  fieldId,
}) => {
  const selectConfig = config?.select
  const options: SelectOption[] = selectConfig?.options || []
  const [isEditing, setIsEditing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const selectedOption = options.find((opt: SelectOption) => opt.id === value)

  const trimmedSearch = searchQuery.trim()
  const filteredOptions = options.filter((opt: SelectOption) =>
    opt.displayName.toLowerCase().includes(trimmedSearch.toLowerCase()),
  )
  const hasExactMatch = options.some(
    (opt: SelectOption) =>
      opt.displayName.trim().toLowerCase() === trimmedSearch.toLowerCase() ||
      opt.id.toLowerCase() === trimmedSearch.toLowerCase(),
  )

  const handleStartEdit = () => {
    if (!readOnly) {
      setIsEditing(true)
    }
  }

  const handleSelect = (optionId: string) => {
    onSave(optionId)
    setIsEditing(false)
    setSearchQuery('')
  }

  const handleOpenChange = (open: boolean) => {
    if (readOnly) return
    setIsEditing(open)
    if (!open) {
      setSearchQuery('')
    }
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
      select: {
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

    onSave(newOption.id)
    setSearchQuery('')
    setIsEditing(false)
  }

  const renderOptionBadge = (option: SelectOption | undefined) => {
    if (!option) return <span className="text-muted-foreground italic">Select an option</span>
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
              !readOnly ? 'cursor-pointer hover:bg-accent hover:border-border group' : ''
            }`}
          >
            {renderOptionBadge(selectedOption)}
            {!readOnly && (
              <ChevronDown className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
            )}
          </div>
        </PopoverTrigger>

        <PopoverContent
          side="bottom"
          align="start"
          sideOffset={4}
          className="p-1.5 w-64 max-h-72 flex flex-col bg-popover border border-border rounded-lg shadow-lg"
        >
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
            {searchQuery === '' && (
              <div
                onClick={() => handleSelect('')}
                className="px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded cursor-pointer flex items-center gap-2"
              >
                <X className="w-3.5 h-3.5" /> Clear
              </div>
            )}

            {filteredOptions.map((option: SelectOption) => (
              <div
                key={option.id}
                onClick={() => handleSelect(option.id)}
                className={`px-2.5 py-1.5 text-xs hover:bg-accent rounded cursor-pointer flex items-center justify-between ${
                  value === option.id ? 'bg-accent/50 font-medium' : ''
                }`}
              >
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                  style={getOptionStyle(option.color)}
                >
                  {option.displayName}
                </span>
              </div>
            ))}

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
                <span className="truncate">{m.add_option_with_name({ name: trimmedSearch })}</span>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export default SelectField
