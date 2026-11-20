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
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { AlertCircle, ChevronDown, ChevronUp, Loader2, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useInView } from 'react-intersection-observer'
import { toast } from 'sonner'
import { FilterPanel } from './filter-panel'
import { SearchImagePicker, type SearchImage } from './search-image-picker'
import { SearchResultCards } from './search-result-cards'
import { useSemanticSearchEnabled } from './use-semantic-search-enabled'
import { searchByImage } from './search-by-image'
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

  const [attachedImage, setAttachedImage] = useState<SearchImage | null>(null)
  const [imageSubmitted, setImageSubmitted] = useState(false)
  const submittedImage = imageSubmitted ? attachedImage : null
  const semanticSearchEnabled = useSemanticSearchEnabled(teamId, open)

  // Sync back if changed from outside, clear on close
  useEffect(() => {
    setAttachedImage(null)
    setImageSubmitted(false)
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

  const hasActiveCriteria = attachedImage
    ? Boolean(submittedImage && semanticSearchEnabled)
    : triggerQuery.trim() !== '' || conditions.some((c) => String(c.value || '').trim() !== '')

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
    refetch,
    hasNextPage,
    error: searchError,
  } = useInfiniteQuery({
    queryKey: [
      'search-preview',
      teamId,
      assetId,
      combinedConditions,
      isSemantic,
      triggerQuery,
      submittedImage?.id,
    ],
    queryFn: async ({ pageParam, signal }) => {
      if (submittedImage) {
        return searchByImage(
          assetId,
          {
            image: submittedImage.base64,
            conditions: combinedConditions,
            operator: 'AND',
            first: 20,
            after: pageParam || undefined,
          },
          signal,
        )
      }
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
    gcTime: submittedImage ? 0 : undefined,
    retry: false,
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.pageInfo?.cursor || undefined,
  })

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage && !searchError) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage, searchError])

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
              if (attachedImage) {
                if (!semanticSearchEnabled) return
                if (imageSubmitted) void refetch()
                else setImageSubmitted(true)
              } else {
                setTriggerQuery(searchInput.trim())
              }
            }}
            className="flex flex-col gap-3 mt-2"
          >
            <div className="relative">
              {attachedImage ? (
                <div className="flex h-12 items-center gap-2 rounded-xl border bg-background pl-2 pr-36 shadow-sm">
                  <img
                    alt=""
                    src={`data:image/jpeg;base64,${attachedImage.base64}`}
                    className="size-8 rounded-sm object-cover"
                  />
                  <span className="truncate text-sm">{attachedImage.name}</span>
                </div>
              ) : (
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={
                    isSemantic ? m.search_by_content_placeholder() : m.search_by_name_placeholder()
                  }
                  className={cn(
                    'h-12 w-full rounded-xl border-border bg-background py-3 pl-4 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-primary/20',
                    isSemantic && semanticSearchEnabled ? 'pr-36' : 'pr-28',
                  )}
                />
              )}
              <div className="absolute inset-y-1.5 right-1.5 flex items-center gap-1">
                {(searchInput || attachedImage) && (
                  <button
                    type="button"
                    aria-label={attachedImage ? m.image_search_remove() : m.clear_search()}
                    onClick={() => {
                      setAttachedImage(null)
                      setImageSubmitted(false)
                      setSearchInput('')
                      setTriggerQuery('')
                    }}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                )}
                {isSemantic && semanticSearchEnabled && (
                  <SearchImagePicker
                    onSelect={(image) => {
                      setAttachedImage(image)
                      setImageSubmitted(false)
                      setSearchInput('')
                      setTriggerQuery('')
                    }}
                  />
                )}
                <button
                  type="submit"
                  className="flex h-full items-center justify-center rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  {m.search_button()}
                </button>
              </div>
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
                    setAttachedImage(null)
                    setImageSubmitted(false)
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
                  {attachedImage ? m.image_search_submit_instruction() : m.type_query_instruction()}
                </p>
                {isSemantic && !attachedImage && (
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
                  {!attachedImage && m.try_adjusting_spelling()}
                </p>
              </div>
            ) : (
              <>
                <SearchResultCards
                  results={flattenedResults}
                  teamId={teamId}
                  projectId={projectId}
                />
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
