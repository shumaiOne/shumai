import { Button } from '@/ui/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/components/ui/dropdown-menu'
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Check } from 'lucide-react'
import { m } from '@/ui/paraglide/messages.js'

interface SortDropdownProps {
  sortBy: string
  sortDirection: 'asc' | 'desc'
  onSortChange: (sortBy: string, sortDirection: 'asc' | 'desc') => void
}

export function SortDropdown({ sortBy, sortDirection, onSortChange }: SortDropdownProps) {
  const handleSortByChange = (field: string) => {
    onSortChange(field, sortDirection)
  }

  const handleDirectionChange = () => {
    const newDirection = sortDirection === 'asc' ? 'desc' : 'asc'
    onSortChange(sortBy, newDirection)
  }

  const formatSortBy = (field: string) => {
    switch (field) {
      case 'name':
        return m.sort_name()
      case 'created_at':
        return m.sort_created()
      case 'updated_at':
        return m.sort_updated()
      default:
        return field
    }
  }

  const isAsc = sortDirection === 'asc'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 bg-muted/50">
          <span className="text-muted-foreground">{m.sorted_by_label()}</span>
          <span className="font-medium text-foreground">{formatSortBy(sortBy)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-2">
        <div className="text-xs font-semibold text-muted-foreground mb-2 px-2">{m.sort_by()}</div>

        {/* Field Selection */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between font-normal px-2 h-10 bg-muted/50 hover:bg-muted mb-2 border"
            >
              <span>{formatSortBy(sortBy)}</span>
              <ArrowDownWideNarrow className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-52">
            {['name', 'created_at', 'updated_at'].map((field) => (
              <DropdownMenuItem
                key={field}
                onClick={() => handleSortByChange(field)}
                className="justify-between"
              >
                {formatSortBy(field)}
                {sortBy === field && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Direction Toggle */}
        <Button
          variant="ghost"
          className="w-full justify-between font-normal px-2 h-10 bg-muted/50 hover:bg-muted border"
          onClick={handleDirectionChange}
        >
          <span className="text-muted-foreground">
            {sortBy === 'name' ? (
              isAsc ? (
                <>{m.sort_a_to_z()}</>
              ) : (
                <>{m.sort_z_to_a()}</>
              )
            ) : isAsc ? (
              <>{m.sort_oldest_to_newest()}</>
            ) : (
              <>{m.sort_newest_to_oldest()}</>
            )}
          </span>
          {isAsc ? (
            <ArrowUpNarrowWide className="h-4 w-4 opacity-50" />
          ) : (
            <ArrowDownWideNarrow className="h-4 w-4 opacity-50" />
          )}
        </Button>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
