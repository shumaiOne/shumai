import { type AssetInfo } from '@/dtos/asset'
import { type FieldInfo as MetadataFieldInfo } from '@/dtos/metadata'
import type { SearchCondition } from '@/dtos/search'
import { client } from '@/ui/api/client'
import { Button } from '@/ui/components/ui/button'
import { Dialog, DialogContent } from '@/ui/components/ui/dialog'
import { Input } from '@/ui/components/ui/input'
import { formatSize } from '@/ui/lib/format'
import { cn } from '@/ui/lib/utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileIcon,
  FolderIcon,
  Loader2,
  Search,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { FilterPanel } from './filter-panel'

interface SearchFilterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
  projectId: string
  assetId: string
  fields: MetadataFieldInfo[]
  initialConditions: SearchCondition[]
  onApply: (conditions: SearchCondition[]) => void
}

export function SearchFilterDialog({
  open,
  onOpenChange,
  teamId,
  projectId,
  assetId,
  fields,
  initialConditions,
  onApply,
}: SearchFilterDialogProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const initialKeyword = useMemo(() => {
    const cond = initialConditions.find((c) => c.field === 'name' && c.operator === 'contains')
    return cond ? String(cond.value) : ''
  }, [initialConditions])

  const initialOtherConditions = useMemo(() => {
    return initialConditions.filter((c) => !(c.field === 'name' && c.operator === 'contains'))
  }, [initialConditions])

  const [conditions, setConditions] = useState<SearchCondition[]>(initialOtherConditions)
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(true)
  const [searchInput, setSearchInput] = useState(initialKeyword)
  const [debouncedSearchInput, setDebouncedSearchInput] = useState(initialKeyword)

  // Sync back if changed from outside
  useEffect(() => {
    if (open) {
      setSearchInput(initialKeyword)
      setDebouncedSearchInput(initialKeyword)
      setConditions(initialOtherConditions)
    }
  }, [open, initialKeyword, initialOtherConditions])

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchInput(searchInput)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const combinedConditions = useMemo(() => {
    const result: SearchCondition[] = [...conditions]
    if (debouncedSearchInput.trim()) {
      result.push({
        field: 'name',
        operator: 'contains',
        value: debouncedSearchInput.trim(),
      })
    }
    return result
  }, [debouncedSearchInput, conditions])

  const hasActiveCriteria = useMemo(() => {
    return (
      debouncedSearchInput.trim() !== '' ||
      conditions.some((c) => String(c.value || '').trim() !== '')
    )
  }, [debouncedSearchInput, conditions])

  const { mutate: saveAsCollection, isPending: isSaving } = useMutation({
    mutationFn: async () => {
      let name = debouncedSearchInput.trim()
      if (!name && conditions.length > 0) {
        const first = conditions[0]
        const field = fields.find((f) => f.id === first.field)
        const fieldName = field?.config?.name || first.field
        name = `${fieldName} ${first.operator} ${first.value}`
      }
      if (!name) name = 'Untitled Collection'

      const res = await client.api.teams[':teamId'].projects[':projectId'].collections.$post({
        param: { teamId, projectId },
        json: {
          name,
          filter: {
            conditions: combinedConditions,
            recursively: true,
          },
        },
      })
      if (!res.ok) throw new Error('Failed to save collection')
      return await res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['collections', teamId, projectId] })
      toast.success('Collection saved')
      onOpenChange(false)
      navigate({
        to: '/projects/$projectId/collections/$collectionId',
        params: { projectId, collectionId: data.id },
      })
    },
    onError: (err) => {
      toast.error(`Error: ${err.message}`)
    },
  })

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['search-preview', teamId, assetId, combinedConditions],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].folders[':folderId'].search.$post({
        param: { teamId, folderId: assetId },
        json: {
          assetType: undefined,
          conditions: combinedConditions,
          recursively: true,
          first: 20,
        },
      })
      if (!res.ok) throw new Error('Search failed')
      return (await res.json()) as { data: AssetInfo[] }
    },
    enabled: open && hasActiveCriteria,
    staleTime: 500,
  })

  const handleApply = () => {
    const finalConditions = [...conditions]
    if (searchInput.trim()) {
      finalConditions.push({
        field: 'name',
        operator: 'contains',
        value: searchInput.trim(),
      })
    }
    onApply(finalConditions)
    onOpenChange(false)
  }

  const handleClearFilters = () => {
    setConditions([])
    setSearchInput('')
  }

  const handleResultClick = (item: AssetInfo) => {
    if (item.type === 'folder') {
      navigate({
        to: '/projects/$projectId/folders/$folderId',
        params: { projectId, folderId: item.id! },
      })
    } else {
      navigate({
        to: '/projects/$projectId/files/$fileId',
        params: { projectId, fileId: item.versionStack ? item.versionStack.id : item.id! },
        search: { version: undefined },
      })
    }
    onOpenChange(false)
  }

  const activeFiltersCount = conditions.filter((c) => c.value !== '').length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] p-0 gap-0 overflow-hidden bg-background border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-5 pt-8 border-b border-border bg-muted/30 flex flex-col gap-3">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleApply()
            }}
            className="relative mt-2"
          >
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search records by name..."
              className="w-full pl-4 pr-24 py-3 bg-background border-border rounded-xl text-sm h-12 focus-visible:ring-2 focus-visible:ring-primary/20 shadow-sm"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-20 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="submit"
              className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-lg flex items-center justify-center transition-colors shadow-sm"
            >
              Search
            </button>
          </form>

          <div
            onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
            className="flex items-center justify-between py-1.5 px-1 mt-1 rounded-lg hover:bg-accent/50 cursor-pointer select-none transition-colors group"
          >
            <div className="flex items-center gap-2">
              {isFiltersExpanded ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
              )}
              <span className="text-xs font-semibold text-foreground/80">Filters</span>

              {activeFiltersCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                  {activeFiltersCount} active
                </span>
              )}
            </div>

            {(activeFiltersCount > 0 || searchInput) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleClearFilters()
                }}
                className="text-[11px] font-medium text-destructive hover:text-destructive/80 underline underline-offset-2 transition-colors"
              >
                Reset
              </button>
            )}
          </div>

          {isFiltersExpanded && (
            <div className="mt-1 p-4 bg-muted/40 border border-border rounded-xl flex flex-col gap-3 animate-in slide-in-from-top-1 duration-200">
              <FilterPanel
                fields={fields}
                conditions={conditions}
                onChange={setConditions}
                excludeFields={['name']}
                hidePrefix={true}
                className="p-0 bg-transparent space-y-2"
              />
            </div>
          )}
        </div>

        {/* Results Body ported from Demo */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 bg-background">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 font-mono">
              Search Results
            </span>
            {isLoading && (
              <span className="inline-flex items-center gap-1.5 text-xs text-primary">
                <Loader2 className="h-3 w-3 animate-spin" />
                Querying database...
              </span>
            )}
          </div>

          <div className="flex flex-col border border-border rounded-xl divide-y divide-border overflow-hidden">
            {!hasActiveCriteria ? (
              <div className="py-20 text-center flex flex-col items-center justify-center bg-muted/20">
                <Search className="w-10 h-10 text-muted-foreground/30 mb-2" />
                <h3 className="text-sm font-semibold text-foreground/80">Ready to Search</h3>
                <p className="text-xs text-muted-foreground max-w-sm mt-1 mx-auto">
                  Enter a name or add a filter rule to start discovering assets.
                </p>
              </div>
            ) : isLoading ? (
              Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="p-3.5 flex items-center gap-3 animate-pulse bg-muted/10">
                  <div className="w-11 h-11 rounded-xl bg-muted shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-1/3" />
                    <div className="h-3 bg-muted/50 rounded w-1/4" />
                  </div>
                </div>
              ))
            ) : searchResults?.data?.length === 0 ? (
              <div className="py-12 px-4 text-center flex flex-col items-center justify-center bg-muted/20">
                <AlertCircle className="w-10 h-10 text-muted-foreground/30 mb-2" />
                <h3 className="text-sm font-semibold text-foreground/80">
                  No records matched your criteria
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mt-1 mx-auto">
                  Try adjusting spelling or removing filter rows.
                </p>
              </div>
            ) : (
              searchResults?.data?.map((record) => (
                <div
                  key={record.id}
                  onClick={() => handleResultClick(record)}
                  className="p-3.5 flex items-center gap-3 hover:bg-muted/40 transition-colors group/record cursor-pointer"
                >
                  <div
                    className={cn(
                      'shrink-0 w-11 h-11 rounded-xl shadow-xs flex items-center justify-center text-white font-bold relative group-hover/record:scale-105 transition-transform bg-muted overflow-hidden',
                      record.type === 'folder' ? 'bg-primary/5' : '',
                    )}
                  >
                    {record.preview?.thumbnailUrl ? (
                      <img
                        src={record.preview.thumbnailUrl}
                        alt=""
                        className="w-full h-full object-cover rounded-xl"
                      />
                    ) : record.type === 'folder' ? (
                      <FolderIcon className="h-6 w-6 text-primary/70" />
                    ) : (
                      <FileIcon className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="truncate">
                        <span className="font-medium text-sm text-foreground group-hover/record:text-primary transition-colors block truncate">
                          {record.name}
                        </span>
                        <span className="text-xs text-muted-foreground block mt-0.5 truncate">
                          {record.type === 'folder'
                            ? 'Folder'
                            : `Size: ${formatSize(record.sizeByte || 0)}`}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono shrink-0">
                        {new Date(record.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer ported from Demo */}
        <div className="p-4 border-t border-border bg-muted/30 flex items-center justify-between shrink-0">
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span>
              Matched{' '}
              <strong className="font-mono font-bold text-foreground">
                {searchResults?.data?.length || 0}
              </strong>{' '}
              items
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="xs"
              className="h-8 text-[10px] font-semibold uppercase tracking-wider"
              disabled={!hasActiveCriteria || isSaving}
              onClick={() => saveAsCollection()}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save as collection'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
