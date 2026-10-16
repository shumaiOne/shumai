import { type AssetInfo } from '@shumai/dtos'
import { type FieldInfo as MetadataFieldInfo } from '@shumai/dtos'
import type { SearchCondition } from '@shumai/dtos'
import { client } from '@/ui/api/client'
import { Button } from '@/ui/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/components/ui/dialog'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import { Switch } from '@/ui/components/ui/switch'
import { cn } from '@/ui/lib/utils'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { AlertCircle, ChevronDown, ChevronUp, Loader2, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useInView } from 'react-intersection-observer'
import { toast } from 'sonner'
import { FileCard } from '@/ui/components/file-browser/file-card'
import { FolderCard } from '@/ui/components/file-browser/folder-card'
import { FilterPanel } from './filter-panel'
import { m } from '@/ui/paraglide/messages.js'

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
  const [triggerQuery, setTriggerQuery] = useState(initialKeyword)
  const [isSemantic, setIsSemantic] = useState<boolean>(false)

  const { data: teamSettings } = useQuery({
    queryKey: ['team-settings', teamId],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].settings.$get({
        param: { teamId },
      })
      if (!res.ok) throw new Error(m.failed_load_settings())
      return (await res.json()) as { semanticSearchEnabled: boolean }
    },
    enabled: open,
  })

  const semanticSearchEnabled = teamSettings?.semanticSearchEnabled ?? false

  // Sync back if changed from outside, clear on close
  useEffect(() => {
    if (open) {
      setSearchInput(initialKeyword)
      setTriggerQuery(initialKeyword)
      setConditions(initialOtherConditions)
      setIsSemantic(false)
    } else {
      setSearchInput('')
      setTriggerQuery('')
      setConditions([])
      setIsSemantic(false)
    }
  }, [open, initialKeyword, initialOtherConditions])

  const combinedConditions = useMemo(() => {
    const result: SearchCondition[] = [...conditions]
    const activeText = triggerQuery
    if (activeText.trim() && !isSemantic) {
      result.push({
        field: 'name',
        operator: 'contains',
        value: activeText.trim(),
      })
    }
    return result
  }, [isSemantic, triggerQuery, conditions])

  const hasActiveCriteria = useMemo(() => {
    const activeText = triggerQuery
    return activeText.trim() !== '' || conditions.some((c) => String(c.value || '').trim() !== '')
  }, [triggerQuery, conditions])

  const { mutate: saveAsCollection, isPending: isSaving } = useMutation({
    mutationFn: async () => {
      const activeText = triggerQuery
      let name = activeText.trim()
      if (!name && conditions.length > 0) {
        const first = conditions[0]
        const field = fields.find((f) => f.id === first.field)
        const fieldName = field?.config?.name || first.field
        name = `${fieldName} ${first.operator} ${first.value}`
      }
      if (!name) name = m.untitled_collection()

      const res = await client.api.projects[':projectId'].collections.$post({
        param: { projectId },
        json: {
          name,
          filter: {
            sourceFolderId: assetId,
            searchFilter: {
              conditions: combinedConditions,
              recursively: true,
              query: activeText.trim(),
              isSemantic: isSemantic,
            },
          },
        },
      })
      if (!res.ok) throw new Error(m.failed_save_collection())
      return await res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['collections', projectId] })
      toast.success(m.collection_saved())
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

  const { ref, inView } = useInView()

  const {
    data: searchResults,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    error: searchError,
  } = useInfiniteQuery({
    queryKey: ['search-preview', teamId, assetId, combinedConditions, isSemantic, triggerQuery],
    queryFn: async ({ pageParam }) => {
      const activeText = triggerQuery
      const res = await client.api.folders[':folderId'].search.$post({
        param: { folderId: assetId },
        json: {
          assetType: undefined,
          conditions: combinedConditions,
          recursively: true,
          query: activeText.trim(),
          isSemantic: isSemantic,
          first: 20,
          after: pageParam as string | undefined,
        },
      })
      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({}))) as Record<string, unknown>
        throw new Error((errorData.message as string) || m.search_failed())
      }
      return (await res.json()) as {
        data: AssetInfo[]
        pageInfo?: { total?: number; cursor?: string }
      }
    },
    enabled: open && hasActiveCriteria,
    staleTime: 500,
    retry: false,
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.pageInfo?.cursor || undefined,
  })

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  const flattenedResults = useMemo(() => {
    return searchResults?.pages.flatMap((page) => page.data) || []
  }, [searchResults])

  const totalCount = searchResults?.pages[0]?.pageInfo?.total || 0

  const formatMatchedCount = (count: number) => {
    if (count === 10001) return '10000+'
    return count.toString()
  }

  const handleApply = () => {
    onApply(combinedConditions)
    onOpenChange(false)
  }

  const handleClearFilters = () => {
    setConditions([])
  }

  const handleResultClick = (item: AssetInfo) => {
    if (item.type === 'folder') {
      window.open(`/projects/${projectId}/folders/${item.id}`, '_blank', 'noopener,noreferrer')
    } else {
      const fileId = item.versionStack ? item.versionStack.id : item.id!
      const searchParams = new URLSearchParams()
      if (item.startTime !== undefined && item.startTime !== null && item.startTime > 0) {
        searchParams.set('start', String(item.startTime))
      }
      const query = searchParams.toString() ? `?${searchParams.toString()}` : ''
      window.open(`/projects/${projectId}/files/${fileId}${query}`, '_blank', 'noopener,noreferrer')
    }
  }

  const activeFiltersCount = conditions.filter((c) => c.value !== '').length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl lg:max-w-5xl p-0 gap-0 overflow-hidden bg-background border-border rounded-2xl shadow-2xl flex flex-col h-[85vh]">
        <DialogHeader className="px-6 pt-3 pb-0 text-left">
          <DialogTitle className="text-lg font-bold">{m.search_dialog_title()}</DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 pt-4 border-b border-border bg-muted/30 flex flex-col gap-3">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setTriggerQuery(searchInput.trim())
            }}
            className="flex flex-col gap-3 mt-2"
          >
            <div className="relative">
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={
                  isSemantic ? m.search_by_content_placeholder() : m.search_by_name_placeholder()
                }
                className="w-full pl-4 pr-24 py-3 bg-background border-border rounded-xl text-sm h-12 focus-visible:ring-2 focus-visible:ring-primary/20 shadow-sm"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('')
                    setTriggerQuery('')
                  }}
                  className="absolute right-20 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="submit"
                className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-lg flex items-center justify-center transition-colors shadow-sm"
              >
                {m.search_button()}
              </button>
            </div>

            <div className="flex items-center gap-3 py-1">
              <div className="flex items-center gap-2 bg-background border border-border px-3 py-1.5 rounded-lg shadow-sm">
                <Switch
                  id="semantic-search-switch"
                  checked={isSemantic}
                  onCheckedChange={(checked) => {
                    setIsSemantic(checked)
                    setSearchInput('')
                    setTriggerQuery('')
                    setConditions([])
                  }}
                  disabled={!semanticSearchEnabled}
                />
                <Label
                  htmlFor="semantic-search-switch"
                  className={cn(
                    'text-xs font-semibold select-none cursor-pointer',
                    !semanticSearchEnabled && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  {m.semantic_search()}
                </Label>
              </div>
              {!semanticSearchEnabled && (
                <span className="text-[10px] text-muted-foreground italic">
                  {m.semantic_search_requires_embedding()}
                </span>
              )}
            </div>
          </form>

          <div className="flex items-center justify-between py-1.5 px-1 mt-1 select-none">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                className="flex items-center gap-2 py-1 px-1.5 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors group text-left"
              >
                {isFiltersExpanded ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                )}
                <span className="text-xs font-semibold text-foreground/80">{m.filters()}</span>
              </button>

              {activeFiltersCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                  {activeFiltersCount} {m.active_filters()}
                </span>
              )}
            </div>

            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleClearFilters()
                }}
                className="text-[11px] font-medium text-destructive hover:text-destructive/80 underline underline-offset-2 transition-colors"
              >
                {m.reset()}
              </button>
            )}
          </div>

          {isFiltersExpanded && (
            <ScrollArea className="mt-1 max-h-[28vh] rounded-xl border border-border bg-muted/40">
              <div className="p-4 flex flex-col gap-3 animate-in slide-in-from-top-1 duration-200">
                <FilterPanel
                  fields={fields}
                  conditions={conditions}
                  onChange={setConditions}
                  excludeFields={['name']}
                  hidePrefix={true}
                  className="p-0 bg-transparent space-y-2"
                />
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Results Body ported from Demo */}
        <ScrollArea className="flex-1 min-h-0 bg-background [&>div>div]:block!">
          <div className="p-4 md:p-5 min-w-0">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 font-mono">
                {m.search_results()}
              </span>
              {isLoading && (
                <span className="inline-flex items-center gap-1.5 text-xs text-primary">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {isSemantic ? m.semantic_search_slow() : m.querying_database()}
                </span>
              )}
            </div>

            {!hasActiveCriteria ? (
              <div className="border border-border rounded-xl py-20 text-center flex flex-col items-center justify-center bg-muted/20 px-4">
                <Search className="w-10 h-10 text-muted-foreground/30 mb-2" />
                <h3 className="text-sm font-semibold text-foreground/80">{m.ready_to_search()}</h3>
                <p className="text-xs text-muted-foreground max-w-sm mt-1 mx-auto">
                  {m.type_query_instruction()}
                </p>
                {isSemantic && (
                  <p className="text-xs text-muted-foreground/80 max-w-md mt-4 mx-auto border-t border-border/60 pt-3">
                    {m.semantic_search_note()}
                  </p>
                )}
              </div>
            ) : searchError ? (
              <div className="border border-border rounded-xl py-12 px-4 text-center flex flex-col items-center justify-center bg-muted/20">
                <AlertCircle className="w-10 h-10 text-destructive/50 mb-2" />
                <h3 className="text-sm font-semibold text-foreground/80">{m.search_failed()}</h3>
                <p className="text-xs text-muted-foreground max-w-sm mt-1 mx-auto">
                  {searchError.message.includes('Embedding agent not configured')
                    ? m.enable_embedding_agent_hint()
                    : searchError.message}
                </p>
              </div>
            ) : isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col rounded-xl border border-border bg-card p-2 space-y-2 animate-pulse"
                  >
                    <div className="aspect-square w-full rounded-lg bg-muted/60" />
                    <div className="p-1 space-y-1.5">
                      <div className="h-4 bg-muted/60 rounded w-3/4" />
                      <div className="h-3 bg-muted/40 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : flattenedResults.length === 0 ? (
              <div className="border border-border rounded-xl py-12 px-4 text-center flex flex-col items-center justify-center bg-muted/20">
                <AlertCircle className="w-10 h-10 text-muted-foreground/30 mb-2" />
                <h3 className="text-sm font-semibold text-foreground/80">
                  {m.no_records_matched()}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mt-1 mx-auto">
                  {m.try_adjusting_spelling()}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {flattenedResults.map((record) => {
                    const itemKey =
                      record.startTime != null && record.endTime != null
                        ? `${record.id}-${record.startTime}-${record.endTime}`
                        : record.id
                    if (record.type === 'folder') {
                      return (
                        <FolderCard
                          key={itemKey}
                          item={record}
                          hideCheckbox
                          hideActions
                          disabled
                          onSelect={() => handleResultClick(record)}
                        />
                      )
                    }
                    return (
                      <FileCard
                        key={itemKey}
                        teamId={teamId}
                        item={record}
                        hideCheckbox
                        hideActions
                        disabled
                        onSelect={() => handleResultClick(record)}
                      />
                    )
                  })}
                </div>
                {(hasNextPage || isFetchingNextPage) && (
                  <div ref={ref} className="p-4 flex justify-center items-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        {/* Footer ported from Demo */}
        <div className="p-4 border-t border-border bg-muted/30 flex items-center justify-between shrink-0">
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span>{m.matched_items({ count: formatMatchedCount(totalCount) })}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="xs"
              className="h-8 text-[10px] font-semibold uppercase tracking-wider mr-1"
              disabled={!hasActiveCriteria || isSaving || isSemantic}
              onClick={() => saveAsCollection()}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  {m.saving_ellipsis()}
                </>
              ) : (
                m.save_as_collection()
              )}
            </Button>

            <Button
              size="xs"
              className="h-8 text-[10px] font-semibold uppercase tracking-wider"
              onClick={isSemantic ? () => onOpenChange(false) : handleApply}
            >
              {isSemantic ? m.close() : m.apply_and_close()}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
