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
import { useMemo } from 'react'
import { m } from '@/ui/paraglide/messages.js'

interface SortControlProps {
  fields: MetadataFieldInfo[]
  sort?: SearchSort
  onSortChange: (sort?: SearchSort) => void
  disabled?: boolean
}

export function SortControl({ fields, sort, onSortChange, disabled }: SortControlProps) {
  const allFields = useMemo(() => {
    const sys = [
      { id: 'custom', label: m.sort_custom() },
      { id: 'name', label: m.sort_name() },
      { id: 'createdAt', label: m.sort_date_created() },
      { id: 'updatedAt', label: m.sort_date_modified() },
      { id: 'sizeByte', label: m.sort_size() },
    ]
    const custom = fields.map((f) => ({
      id: f.id!,
      label: f.config?.name || f.description || m.unknown(),
    }))
    return [...sys, ...custom]
  }, [fields])

  // Default to Custom if no sort selected
  const currentFieldId = sort?.field || 'custom'
  const currentField = allFields.find((f) => f.id === currentFieldId) || allFields[0]

  const isAsc = sort?.order === 'asc'

  const getDirectionOptions = (fieldId: string) => {
    if (fieldId === 'name') {
      return { asc: m.sort_a_to_z(), desc: m.sort_z_to_a() }
    }
    if (['createdAt', 'updatedAt'].includes(fieldId)) {
      return { asc: m.sort_oldest_to_newest(), desc: m.sort_newest_to_oldest() }
    }
    if (fieldId === 'sizeByte') {
      return { asc: m.sort_smallest_to_largest(), desc: m.sort_largest_to_smallest() }
    }
    return { asc: m.ascending(), desc: m.descending() }
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
          {sort ? m.sorted_by({ field: currentField.label }) : m.sort_by()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-3" align="end">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <span className="text-sm text-muted-foreground">{m.sort_by()}</span>
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
              <span className="text-sm text-muted-foreground">{m.order()}</span>
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
