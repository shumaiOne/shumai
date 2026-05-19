import type { SearchSort } from '@/dtos/search'
import { type FieldInfo as MetadataFieldInfo } from '@/dtos/metadata'
import { Button } from '@/ui/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/ui/select'
import { ArrowDownWideNarrow } from 'lucide-react'

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
          <ArrowDownWideNarrow className="h-4 w-4 mr-1" />
          {sort ? `Sorted by ${currentField.label}` : 'Sort by'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-3" align="end">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <span className="text-sm text-muted-foreground">Sort by</span>
            <Select value={currentFieldId} onValueChange={handleFieldChange}>
              <SelectTrigger>
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

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground w-8">from</span>
            <Select value={isAsc ? 'asc' : 'desc'} onValueChange={handleOrderChange}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="asc">{dirOptions.asc}</SelectItem>
                <SelectItem value="desc">{dirOptions.desc}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
