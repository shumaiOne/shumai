import type { SearchCondition, SearchConditionOperator } from '@shumai/dtos'
import { type FieldInfo } from '@shumai/dtos'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { DebouncedInput } from '@/ui/components/ui/debounced-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/ui/select'
import { cn } from '@/ui/lib/utils'
import { Trash2 } from 'lucide-react'

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
  const allFields = [
    ...SYSTEM_FIELDS,
    ...fields.map((f) => ({
      id: f.id!,
      label: f.config?.name || f.description || 'Unknown',
      type: getFieldType(f),
      options: f.config?.select?.options,
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
  if (field.config?.type === 'select') return 'select'
  if (field.config?.type === 'selectMulti') return 'selectMulti'
  if (field.config?.type === 'number') return 'number'
  if (field.config?.type === 'date') return 'date'
  if (field.config?.type === 'rating') return 'number'
  if (field.config?.type === 'toggle') return 'toggle'
  return 'text'
}

function getDefaultOperator(type: string): SearchConditionOperator {
  switch (type) {
    case 'selectMulti':
      return 'hasAny' as SearchConditionOperator
    case 'number':
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FieldType = any

function ConditionValueInput({
  field,
  value,
  onChange,
}: {
  field: FieldType
  value: unknown
  onChange: (val: unknown) => void
}) {
  if (!field) return <Input disabled />

  if (field.type === 'select' && field.options) {
    return (
      <Select value={value as string} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select option" />
        </SelectTrigger>
        <SelectContent>
          {field.options.map((opt: FieldType) => (
            <SelectItem key={opt.id} value={opt.id}>
              {opt.displayName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (field.type === 'selectMulti' && field.options) {
    const selected = Array.isArray(value) ? value : []
    return (
      <Select
        value={selected[0] || ''}
        onValueChange={(val) => {
          if (selected.includes(val)) {
            onChange(selected.filter((v) => v !== val))
          } else {
            onChange([...selected, val])
          }
        }}
      >
        <SelectTrigger>
          <SelectValue
            placeholder={selected.length > 0 ? `${selected.length} selected` : 'Select options'}
          />
        </SelectTrigger>
        <SelectContent>
          {field.options.map((opt: FieldType) => (
            <SelectItem key={opt.id} value={opt.id}>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.includes(opt.id)}
                  readOnly
                  className="pointer-events-none"
                />
                {opt.displayName}
              </div>
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
