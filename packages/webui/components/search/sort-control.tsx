import { type FieldInfo as MetadataFieldInfo } from '@shumai/dtos'
import type { SearchSort } from '@shumai/dtos'
import { ArrowDownUp } from 'lucide-react'
import { Button } from '@/ui/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/ui/select'

interface SortControlProps {
  fields: MetadataFieldInfo[]
  sort?: SearchSort
  onSortChange: (sort?: SearchSort) => void
  disabled?: boolean
}

const SYSTEM_FIELDS = [
  { id: 'custom', label: 'Custom' },
  { id: 'name', label: 'Name' },
  { id: 'createdAt', label: 'Date Created' },
  { id: 'updatedAt', label: 'Date Modified' },
  { id: 'sizeByte', label: 'Size' },
]

export function SortControl({ fields, sort, onSortChange, disabled }: SortControlProps) {
  const allFields = [
    ...SYSTEM_FIELDS,
    ...fields.map((f) => ({
      id: f.id!,
      label: f.config?.name || f.description || 'Unknown',
    })),
  ]

  // Default to Custom if no sort selected
  const currentFieldId = sort?.field || 'custom'
  const currentField = allFields.find((f) => f.id === currentFieldId) || allFields[0]

  const isAsc = sort?.order === 'asc'

  const getDirectionOptions = (fieldId: string) => {
    if (fieldId === 'name') {
      return { asc: 'A → Z', desc: 'Z → A' }
    }
    if (['createdAt', 'updatedAt'].includes(fieldId)) {
      return { asc: 'Oldest → Newest', desc: 'Newest → Oldest' }
    }
    if (fieldId === 'sizeByte') {
      return { asc: 'Smallest → Largest', desc: 'Largest → Smallest' }
    }
    return { asc: 'Ascending', desc: 'Descending' }
  }

  const dirOptions = getDirectionOptions(currentFieldId)

  const handleFieldChange = (fieldId: string) => {
    onSortChange({
      field: fieldId,
      order: sort?.order || 'desc',
    })
  }

  const handleOrderChange = (val: string) => {
    onSortChange({
      field: currentFieldId,
      order: val === 'asc' ? 'asc' : 'desc',
    })
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={sort ? 'secondary' : 'ghost'}
          size="sm"
          className="h-8"
          disabled={disabled}
        >
          {sort ? `Sorted by ${currentField.label}` : 'Sort by'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-3" align="end">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <span className="text-sm text-muted-foreground">Sort by</span>
            <Select value={currentFieldId} onValueChange={handleFieldChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {allFields.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {currentFieldId !== 'custom' && (
            <div className="grid gap-2">
              <span className="text-sm text-muted-foreground">Order</span>
              <Button
                variant="outline"
                className="w-full justify-between font-normal"
                onClick={() => handleOrderChange(isAsc ? 'desc' : 'asc')}
              >
                <span>{isAsc ? dirOptions.asc : dirOptions.desc}</span>
                <ArrowDownUp className="size-4 opacity-50" />
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
