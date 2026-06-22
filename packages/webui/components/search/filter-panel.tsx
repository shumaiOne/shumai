import { Button } from '@/ui/components/ui/button'
import { DebouncedInput } from '@/ui/components/ui/debounced-input'
import { Input } from '@/ui/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/ui/select'
import { cn } from '@/ui/lib/utils'
import type { SearchCondition, SearchConditionOperator } from '@shumai/dtos'
import { type FieldInfo } from '@shumai/dtos'
import { Check, ChevronDown, Trash2 } from 'lucide-react'
import { getOptionStyle } from '../fields-manager'
import RatingField from '../fields/rating-field'
import { useEffect, useMemo } from 'react'
import { useMemberStore } from '@/ui/stores/members'
import { useTeamId } from '@/ui/hooks/use-team-id'

interface FilterPanelProps {
  fields: FieldInfo[]
  conditions: SearchCondition[]
  onChange: (conditions: SearchCondition[]) => void
  className?: string
  excludeFields?: string[]
  hidePrefix?: boolean
}

const SYSTEM_FIELDS = [
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'createdAt', label: 'Created At', type: 'date' },
  { id: 'updatedAt', label: 'Updated At', type: 'date' },
  { id: 'sizeByte', label: 'Size', type: 'number' },
]

export function FilterPanel({
  fields,
  conditions,
  onChange,
  className,
  excludeFields,
  hidePrefix,
}: FilterPanelProps) {
  const teamId = useTeamId()
  const { members, fetchMembers } = useMemberStore()

  useEffect(() => {
    if (teamId) {
      fetchMembers(teamId)
    }
  }, [teamId, fetchMembers])

  const memberOptions = useMemo(() => {
    return members.map((m) => ({
      id: m.id,
      displayName: m.name,
      color: 'system',
    }))
  }, [members])

  const allFields = [
    ...SYSTEM_FIELDS,
    ...fields.map((f) => ({
      id: f.id!,
      label: f.config?.name || f.description || 'Unknown',
      type: getFieldType(f),
      options:
        f.config?.type === 'user' || f.config?.type === 'userMulti'
          ? memberOptions
          : f.config?.select?.options || f.config?.selectMulti?.options,
      config: f.config,
    })),
  ].filter((f) => !excludeFields?.includes(f.id))

  const handleAddCondition = () => {
    onChange([
      ...conditions,
      {
        field: allFields[0]?.id || 'name',
        operator: 'eq',
        value: '',
      },
    ])
  }

  const handleRemoveCondition = (index: number) => {
    const newConditions = [...conditions]
    newConditions.splice(index, 1)
    onChange(newConditions)
  }

  const handleConditionChange = (index: number, key: keyof SearchCondition, value: unknown) => {
    const newConditions = [...conditions]
    newConditions[index] = { ...newConditions[index], [key]: value } as SearchCondition

    // Reset operator/value if field changes
    if (key === 'field') {
      const field = allFields.find((f) => f.id === value)
      if (field) {
        newConditions[index].operator = getDefaultOperator(field.type)
        newConditions[index].value = ''
      }
    }

    // Convert value format when switching between single/multi-select operators
    if (key === 'operator') {
      const field = allFields.find((f) => f.id === newConditions[index].field)
      if (field && (field.type === 'select' || field.type === 'selectMulti')) {
        const oldOperator = conditions[index].operator
        const newOperator = value as SearchConditionOperator
        const wasMulti = isMultiSelectOperator(field.type, oldOperator)
        const isMulti = isMultiSelectOperator(field.type, newOperator)

        if (wasMulti && !isMulti) {
          // Multi -> Single: take first item or empty string
          const arr = Array.isArray(newConditions[index].value)
            ? (newConditions[index].value as string[])
            : []
          newConditions[index].value = arr[0] || ''
        } else if (!wasMulti && isMulti) {
          // Single -> Multi: wrap in array if non-empty
          const str = newConditions[index].value as string
          newConditions[index].value = str ? [str] : []
        }
      }
    }

    onChange(newConditions)
  }

  return (
    <div className={cn('p-2 space-y-4 min-w-[100px]', className)}>
      {conditions.map((condition, index) => (
        <div key={index} className="flex items-center gap-2">
          {!hidePrefix && (
            <div className="w-16 text-sm text-muted-foreground font-medium text-right">
              {index === 0 ? 'Where' : 'and'}
            </div>
          )}
          <div className="flex-1 flex items-center gap-2">
            <Select
              value={condition.field}
              onValueChange={(val) => handleConditionChange(index, 'field', val)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select field" />
              </SelectTrigger>
              <SelectContent>
                {allFields.map((field) => (
                  <SelectItem key={field.id} value={field.id}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={condition.operator}
              onValueChange={(val) => handleConditionChange(index, 'operator', val)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Operator" />
              </SelectTrigger>
              <SelectContent>
                {getOperators(
                  allFields.find((f) => f.id === condition.field) || {
                    id: '',
                    label: '',
                    type: 'text',
                  },
                ).map((op) => (
                  <SelectItem key={op.value} value={op.value}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex-1">
              {condition.operator !== 'isEmpty' && condition.operator !== 'isNotEmpty' && (
                <ConditionValueInput
                  field={allFields.find((f) => f.id === condition.field)}
                  operator={condition.operator}
                  value={condition.value}
                  onChange={(val) => handleConditionChange(index, 'value', val)}
                />
              )}
            </div>

            <Button variant="ghost" size="icon" onClick={() => handleRemoveCondition(index)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          className="text-muted-foreground hover:text-foreground"
          onClick={handleAddCondition}
        >
          + Add condition
        </Button>
      </div>
    </div>
  )
}

function getFieldType(field: FieldInfo): string {
  if (field.config?.type === 'select' || field.config?.type === 'user') return 'select'
  if (field.config?.type === 'selectMulti' || field.config?.type === 'userMulti')
    return 'selectMulti'
  if (field.config?.type === 'number') return 'number'
  if (field.config?.type === 'date') return 'date'
  if (field.config?.type === 'rating') return 'rating'
  if (field.config?.type === 'toggle') return 'toggle'
  return 'text'
}

function getDefaultOperator(type: string): SearchConditionOperator {
  switch (type) {
    case 'selectMulti':
      return 'hasAny' as SearchConditionOperator
    case 'number':
    case 'rating':
    case 'date':
      return 'eq'
    default:
      return 'eq' as SearchConditionOperator
  }
}

function getOperators(field: { id: string; label: string; type: string }): {
  value: SearchConditionOperator
  label: string
}[] {
  const type = field.type
  const id = field.id

  if (id === 'name') {
    return [
      { value: 'eq' as SearchConditionOperator, label: 'is' },
      { value: 'neq' as SearchConditionOperator, label: 'is not' },
      { value: 'contains' as SearchConditionOperator, label: 'contains' },
      { value: 'notContains' as SearchConditionOperator, label: 'does not contain' },
      { value: 'isEmpty' as SearchConditionOperator, label: 'is empty' },
      { value: 'isNotEmpty' as SearchConditionOperator, label: 'is not empty' },
    ]
  }

  switch (type) {
    case 'text':
      return [
        { value: 'eq' as SearchConditionOperator, label: 'is' },
        { value: 'neq' as SearchConditionOperator, label: 'is not' },
        { value: 'isEmpty' as SearchConditionOperator, label: 'is empty' },
        { value: 'isNotEmpty' as SearchConditionOperator, label: 'is not empty' },
      ]
    case 'number':
    case 'rating':
      return [
        { value: 'eq' as SearchConditionOperator, label: '=' },
        { value: 'neq' as SearchConditionOperator, label: '≠' },
        { value: 'gt' as SearchConditionOperator, label: '>' },
        { value: 'lt' as SearchConditionOperator, label: '<' },
        { value: 'lte' as SearchConditionOperator, label: '≤' },
        { value: 'gte' as SearchConditionOperator, label: '≥' },
        { value: 'isEmpty' as SearchConditionOperator, label: 'is empty' },
        { value: 'isNotEmpty' as SearchConditionOperator, label: 'is not empty' },
      ]
    case 'select':
      return [
        { value: 'eq' as SearchConditionOperator, label: 'is' },
        { value: 'neq' as SearchConditionOperator, label: 'is not' },
        { value: 'in' as SearchConditionOperator, label: 'is any of' },
        { value: 'notIn' as SearchConditionOperator, label: 'is none of' },
        { value: 'isEmpty' as SearchConditionOperator, label: 'is empty' },
        { value: 'isNotEmpty' as SearchConditionOperator, label: 'is not empty' },
      ]
    case 'selectMulti':
      return [
        { value: 'hasAny' as SearchConditionOperator, label: 'has any of' },
        { value: 'hasAll' as SearchConditionOperator, label: 'has all of' },
        { value: 'eq' as SearchConditionOperator, label: 'is exactly' },
        { value: 'hasNone' as SearchConditionOperator, label: 'has none of' },
        { value: 'isEmpty' as SearchConditionOperator, label: 'is empty' },
        { value: 'isNotEmpty' as SearchConditionOperator, label: 'is not empty' },
      ]
    case 'date':
      return [
        { value: 'eq' as SearchConditionOperator, label: 'is' },
        { value: 'isWithin' as SearchConditionOperator, label: 'is within' },
        { value: 'lt' as SearchConditionOperator, label: 'is before' },
        { value: 'gt' as SearchConditionOperator, label: 'is after' },
        { value: 'lte' as SearchConditionOperator, label: 'is on or before' },
        { value: 'gte' as SearchConditionOperator, label: 'is on or after' },
        { value: 'neq' as SearchConditionOperator, label: 'is not' },
        { value: 'isEmpty' as SearchConditionOperator, label: 'is empty' },
        { value: 'isNotEmpty' as SearchConditionOperator, label: 'is not empty' },
      ]
    case 'toggle':
      return [{ value: 'eq' as SearchConditionOperator, label: 'is' }]
    default:
      return [{ value: 'eq' as SearchConditionOperator, label: 'is' }]
  }
}

interface SelectOptionItem {
  id: string
  displayName: string
  color?: string
}

interface FilterField {
  id: string
  label: string
  type: string
  options?: SelectOptionItem[]
  config?: FieldInfo['config']
}

function isMultiSelectOperator(fieldType: string, operator: SearchConditionOperator): boolean {
  if (fieldType === 'select') {
    return operator === 'in' || operator === 'notIn'
  }
  if (fieldType === 'selectMulti') {
    return operator !== 'eq'
  }
  return false
}

function MultiSelectValueInput({
  options,
  selected,
  onChange,
}: {
  options: SelectOptionItem[]
  selected: string[]
  onChange: (val: string[]) => void
}) {
  const selectedOptions = options.filter((opt) => selected.includes(opt.id))

  const toggleOption = (optionId: string) => {
    let newVal
    if (selected.includes(optionId)) {
      newVal = selected.filter((id) => id !== optionId)
    } else {
      newVal = [...selected, optionId]
    }
    onChange(newVal)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex min-h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-xs hover:bg-accent/50 focus:outline-hidden focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-left"
        >
          <div className="flex flex-wrap gap-1 items-center max-w-[90%]">
            {selectedOptions.length === 0 ? (
              <span className="text-muted-foreground">Select options...</span>
            ) : (
              selectedOptions.map((option) => (
                <span
                  key={option.id}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border border-transparent whitespace-nowrap h-[20px]"
                  style={getOptionStyle(option.color)}
                >
                  {option.displayName}
                </span>
              ))
            )}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-1 bg-popover border border-border rounded-lg shadow-xl max-h-60 overflow-auto"
        align="start"
      >
        {options.map((option) => {
          const isSelected = selected.includes(option.id)
          return (
            <div
              key={option.id}
              onClick={() => toggleOption(option.id)}
              className="px-3 py-2 hover:bg-accent cursor-pointer flex items-center justify-between rounded-sm"
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
        })}
      </PopoverContent>
    </Popover>
  )
}

function ConditionValueInput({
  field,
  operator,
  value,
  onChange,
}: {
  field: FilterField | undefined
  operator: SearchConditionOperator
  value: unknown
  onChange: (val: unknown) => void
}) {
  if (!field) return <Input disabled />

  if ((field.type === 'select' || field.type === 'selectMulti') && field.options) {
    if (isMultiSelectOperator(field.type, operator)) {
      const selected = Array.isArray(value) ? (value as string[]) : []
      return (
        <MultiSelectValueInput
          options={field.options}
          selected={selected}
          onChange={(val) => onChange(val)}
        />
      )
    }
    // Single-select
    return (
      <Select value={value as string} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select option" />
        </SelectTrigger>
        <SelectContent>
          {field.options.map((opt) => (
            <SelectItem key={opt.id} value={opt.id}>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                style={getOptionStyle(opt.color)}
              >
                {opt.displayName}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (field.type === 'date') {
    const relativeDates = [
      { value: 'today', label: 'Today' },
      { value: 'yesterday', label: 'Yesterday' },
      { value: 'tomorrow', label: 'Tomorrow' },
      { value: 'one week ago', label: 'One week ago' },
      { value: 'one week from now', label: 'One week from now' },
      { value: 'one month ago', label: 'One month ago' },
      { value: 'one month from now', label: 'One month from now' },
    ]

    const isRelative = relativeDates.some((rd) => rd.value === value)

    return (
      <div className="flex gap-2">
        <Select
          value={isRelative ? (value as string) : 'exact'}
          onValueChange={(val) => {
            if (val === 'exact') onChange('')
            else onChange(val)
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Date type" />
          </SelectTrigger>
          <SelectContent>
            {relativeDates.map((rd) => (
              <SelectItem key={rd.value} value={rd.value}>
                {rd.label}
              </SelectItem>
            ))}
            <SelectItem value="exact">Exact date...</SelectItem>
          </SelectContent>
        </Select>
        {!isRelative && (
          <Input
            type="date"
            className="flex-1"
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </div>
    )
  }

  if (field.type === 'number') {
    return (
      <DebouncedInput
        type="number"
        value={value as string}
        onChange={(val) => onChange(Number(val))}
      />
    )
  }

  if (field.type === 'rating') {
    return (
      <RatingField
        value={Number(value) || 0}
        config={field.config || { name: field.label, type: 'rating' }}
        onSave={onChange}
      />
    )
  }

  if (field.type === 'toggle') {
    return (
      <Select
        value={value === true ? 'true' : 'false'}
        onValueChange={(val) => onChange(val === 'true')}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">Checked</SelectItem>
          <SelectItem value="false">Unchecked</SelectItem>
        </SelectContent>
      </Select>
    )
  }

  return (
    <DebouncedInput
      type="text"
      placeholder="Enter a value"
      value={value as string}
      onChange={onChange}
    />
  )
}
