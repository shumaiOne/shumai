import { Button } from '@/ui/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/components/ui/dropdown-menu'
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Check } from 'lucide-react'

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
        return 'Name'
      case 'created_at':
        return 'Created'
      case 'updated_at':
        return 'Updated'
      default:
        return field
    }
  }

  const isAsc = sortDirection === 'asc'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 bg-muted/50">
          <span className="text-muted-foreground">Sorted by</span>
          <span className="font-medium text-foreground">{formatSortBy(sortBy)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-2">
        <div className="text-xs font-semibold text-muted-foreground mb-2 px-2">Sort by</div>

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
                <>from A &rarr; Z</>
              ) : (
                <>from Z &rarr; A</>
              )
            ) : isAsc ? (
              <>Oldest &rarr; Newest</>
            ) : (
              <>Newest &rarr; Oldest</>
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
