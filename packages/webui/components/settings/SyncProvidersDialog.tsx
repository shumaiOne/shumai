import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import { Button } from '@/ui/components/ui/button'
import { Checkbox } from '@/ui/components/ui/checkbox'
import { Badge } from '@/ui/components/ui/badge'
import { Input } from '@/ui/components/ui/input'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import { ChevronDown, ChevronRight, Cpu, Info, Loader2, Search, Sparkles } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { toast } from 'sonner'
import { m } from '@/ui/paraglide/messages.js'
import type { SyncCheckResponse, SyncApplyRequest } from '@shumai/dtos'

interface SyncProvidersDialogProps {
  isOpen: boolean
  onClose: () => void
  teamId: string
  syncData: SyncCheckResponse | null
  onSuccess: () => void
}

export function SyncProvidersDialog({
  isOpen,
  onClose,
  teamId,
  syncData,
  onSuccess,
}: SyncProvidersDialogProps) {
  const [filterQuery, setFilterQuery] = useState('')
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(() => {
    return new Set(syncData?.providers.map((p) => p.name) || [])
  })

  // Pre-selected by default (opt-out)
  const [selectedModels, setSelectedModels] = useState<Set<string>>(() => {
    const set = new Set<string>()
    syncData?.providers.forEach((p) => {
      p.models.forEach((mItem) => {
        set.add(`${p.name}:${mItem.modelId}`)
      })
    })
    return set
  })

  const [selectedNewProviders, setSelectedNewProviders] = useState<Set<string>>(() => {
    const set = new Set<string>()
    syncData?.providers.forEach((p) => {
      if (p.isNewProvider && p.models.length > 0) {
        set.add(p.name)
      }
    })
    return set
  })

  // Sync state if syncData changes
  useMemo(() => {
    if (syncData) {
      setExpandedProviders(new Set(syncData.providers.map((p) => p.name)))
      const modelSet = new Set<string>()
      const providerSet = new Set<string>()
      syncData.providers.forEach((p) => {
        p.models.forEach((mItem) => {
          modelSet.add(`${p.name}:${mItem.modelId}`)
        })
        if (p.isNewProvider && p.models.length > 0) {
          providerSet.add(p.name)
        }
      })
      setSelectedModels(modelSet)
      setSelectedNewProviders(providerSet)
    }
  }, [syncData])

  // Filtered tree data based on filterQuery
  const filteredTree = useMemo(() => {
    if (!syncData) return []
    const q = filterQuery.trim().toLowerCase()
    if (!q) return syncData.providers

    return syncData.providers
      .map((p) => {
        const matchesProvider = p.name.toLowerCase().includes(q)
        const matchingModels = p.models.filter(
          (mItem) =>
            matchesProvider ||
            mItem.modelId.toLowerCase().includes(q) ||
            mItem.name.toLowerCase().includes(q),
        )
        if (matchingModels.length > 0) {
          return { ...p, models: matchingModels }
        }
        return null
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
  }, [syncData, filterQuery])

  // Total selected models & providers
  const totalSelectedModelsCount = selectedModels.size
  const totalSelectedProvidersCount = useMemo(() => {
    if (!syncData) return 0
    let count = 0
    for (const p of syncData.providers) {
      const hasSelectedModel = p.models.some((mItem) =>
        selectedModels.has(`${p.name}:${mItem.modelId}`),
      )
      if (hasSelectedModel) count++
    }
    return count
  }, [syncData, selectedModels])

  const toggleExpand = (providerName: string) => {
    setExpandedProviders((prev) => {
      const next = new Set(prev)
      if (next.has(providerName)) {
        next.delete(providerName)
      } else {
        next.add(providerName)
      }
      return next
    })
  }

  const toggleModel = (providerName: string, modelId: string, isNewProvider: boolean) => {
    const key = `${providerName}:${modelId}`
    setSelectedModels((prevModels) => {
      const nextModels = new Set(prevModels)
      const willBeChecked = !nextModels.has(key)

      if (willBeChecked) {
        nextModels.add(key)
      } else {
        nextModels.delete(key)
      }

      // Check new provider coupling rule
      if (isNewProvider) {
        setSelectedNewProviders((prevProviders) => {
          const nextProviders = new Set(prevProviders)
          const providerData = syncData?.providers.find((p) => p.name === providerName)
          const hasAnyModelSelected =
            providerData?.models.some((mItem) =>
              nextModels.has(`${providerName}:${mItem.modelId}`),
            ) ?? false

          if (hasAnyModelSelected) {
            nextProviders.add(providerName)
          } else {
            nextProviders.delete(providerName)
          }
          return nextProviders
        })
      }

      return nextModels
    })
  }

  const toggleNewProvider = (providerName: string) => {
    const isCurrentlyChecked = selectedNewProviders.has(providerName)
    const providerData = syncData?.providers.find((p) => p.name === providerName)
    if (!providerData) return

    setSelectedNewProviders((prev) => {
      const next = new Set(prev)
      if (isCurrentlyChecked) {
        next.delete(providerName)
      } else {
        next.add(providerName)
      }
      return next
    })

    setSelectedModels((prev) => {
      const next = new Set(prev)
      providerData.models.forEach((mItem) => {
        const key = `${providerName}:${mItem.modelId}`
        if (isCurrentlyChecked) {
          next.delete(key)
        } else {
          next.add(key)
        }
      })
      return next
    })
  }

  const handleSelectAll = () => {
    if (!syncData) return
    const modelSet = new Set<string>()
    const providerSet = new Set<string>()
    syncData.providers.forEach((p) => {
      p.models.forEach((mItem) => {
        modelSet.add(`${p.name}:${mItem.modelId}`)
      })
      if (p.isNewProvider && p.models.length > 0) {
        providerSet.add(p.name)
      }
    })
    setSelectedModels(modelSet)
    setSelectedNewProviders(providerSet)
  }

  const handleDeselectAll = () => {
    setSelectedModels(new Set())
    setSelectedNewProviders(new Set())
  }

  // Apply mutation
  const applyMutation = useMutation({
    mutationFn: async (payload: SyncApplyRequest) => {
      const res = await client.api.teams[':teamId'].providers['sync-apply'].$post({
        param: { teamId },
        json: payload,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to apply sync' }))
        throw new Error((err as { message?: string }).message || 'Failed to apply sync')
      }
      return await res.json()
    },
    onSuccess: (data) => {
      toast.success(
        m.sync_providers_success({
          modelCount: data.addedModels,
          providerCount: data.addedProviders,
        }),
      )
      onSuccess()
      onClose()
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleConfirm = async () => {
    if (!syncData || totalSelectedModelsCount === 0) return

    const providersToSync: SyncApplyRequest['providers'] = []

    for (const p of syncData.providers) {
      const selectedModelsForProvider = p.models.filter((mItem) =>
        selectedModels.has(`${p.name}:${mItem.modelId}`),
      )

      if (selectedModelsForProvider.length > 0) {
        providersToSync.push({
          name: p.name,
          isNewProvider: p.isNewProvider,
          config: p.config,
          models: selectedModelsForProvider,
        })
      }
    }

    if (providersToSync.length === 0) return

    await applyMutation.mutateAsync({
      providers: providersToSync,
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl md:max-w-4xl w-full h-[85vh] max-h-[85vh] flex flex-col p-0 overflow-hidden gap-0">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <Sparkles className="w-5 h-5 text-primary" />
            {m.sync_providers_dialog_title()}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {m.sync_providers_dialog_description()}
          </DialogDescription>
        </DialogHeader>

        {/* Notice Banner & Controls Toolbar */}
        <div className="px-6 pb-3 shrink-0 space-y-3">
          {/* Notice Banner */}
          <div className="p-3 rounded-lg bg-muted/60 border border-border/80 flex items-start gap-2.5 text-xs text-muted-foreground leading-relaxed">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <span>{m.sync_providers_dialog_description()}</span>
          </div>

          {/* Controls Toolbar */}
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder={m.sync_providers_search_placeholder()}
                className="pl-8 h-8 text-xs bg-background"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="h-8 text-xs px-2.5"
              >
                {m.sync_providers_select_all()}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDeselectAll}
                className="h-8 text-xs px-2.5"
              >
                {m.sync_providers_deselect_all()}
              </Button>
            </div>
          </div>
        </div>

        {/* Tree List Container */}
        <div className="flex-1 min-h-0 px-6 overflow-hidden">
          <ScrollArea className="h-full border border-border/60 rounded-md bg-muted/20">
            <div className="p-3 space-y-3">
              {filteredTree.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {m.no_matches_found()}
                </div>
              ) : (
                filteredTree.map((provider) => {
                  const isExpanded = expandedProviders.has(provider.name)
                  const isNew = provider.isNewProvider

                  // Determine provider check state if new
                  const checkedCount = provider.models.filter((mItem) =>
                    selectedModels.has(`${provider.name}:${mItem.modelId}`),
                  ).length
                  const allChecked = checkedCount === provider.models.length
                  const someChecked = checkedCount > 0 && !allChecked

                  return (
                    <div
                      key={provider.name}
                      className="border border-border/50 rounded-lg bg-background overflow-hidden"
                    >
                      {/* Provider Header Row */}
                      <div className="flex items-center justify-between px-3 py-2 bg-card hover:bg-muted/40 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => toggleExpand(provider.name)}
                            className="p-0.5 text-muted-foreground hover:text-foreground rounded transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>

                          {isNew ? (
                            <Checkbox
                              checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                              onCheckedChange={() => toggleNewProvider(provider.name)}
                              id={`provider-check-${provider.name}`}
                            />
                          ) : null}

                          <label
                            htmlFor={isNew ? `provider-check-${provider.name}` : undefined}
                            className="font-medium text-sm text-foreground flex items-center gap-2 cursor-pointer select-none"
                          >
                            <Cpu className="w-4 h-4 text-muted-foreground" />
                            <span>{provider.name}</span>
                          </label>
                        </div>

                        <div className="flex items-center gap-2">
                          {isNew ? (
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20"
                            >
                              {m.sync_providers_new_provider()}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 text-muted-foreground"
                            >
                              {m.sync_providers_existing_provider()}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {m.sync_providers_new_models_count({
                              count: provider.models.length,
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Model Children Rows */}
                      {isExpanded && (
                        <div className="border-t border-border/40 divide-y divide-border/30 bg-muted/10">
                          {provider.models.map((model) => {
                            const isModelChecked = selectedModels.has(
                              `${provider.name}:${model.modelId}`,
                            )
                            return (
                              <div
                                key={model.modelId}
                                className="flex items-center justify-between pl-9 pr-3 py-2 hover:bg-muted/30 transition-colors"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <Checkbox
                                    checked={isModelChecked}
                                    onCheckedChange={() =>
                                      toggleModel(provider.name, model.modelId, isNew)
                                    }
                                    id={`model-check-${provider.name}-${model.modelId}`}
                                  />
                                  <label
                                    htmlFor={`model-check-${provider.name}-${model.modelId}`}
                                    className="text-xs font-medium text-foreground cursor-pointer select-none truncate"
                                  >
                                    {model.name || model.modelId}
                                    <span className="ml-1.5 text-[11px] text-muted-foreground font-mono font-normal">
                                      {model.modelId}
                                    </span>
                                  </label>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                  {model.config.reasoning && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] px-1.5 py-0 font-normal border-amber-500/30 text-amber-600 dark:text-amber-400"
                                    >
                                      reasoning
                                    </Badge>
                                  )}
                                  <span className="text-[11px] text-muted-foreground font-mono">
                                    {Math.round(model.config.contextWindow / 1000)}k ctx
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Selected Count & Footer */}
        <DialogFooter className="p-6 pt-3 shrink-0 border-t border-border flex items-center justify-between sm:justify-between w-full">
          <div className="text-xs text-muted-foreground">
            {m.sync_providers_selected_count({
              modelCount: totalSelectedModelsCount,
              providerCount: totalSelectedProvidersCount,
            })}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={applyMutation.isPending}
            >
              {m.cancel()}
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={totalSelectedModelsCount === 0 || applyMutation.isPending}
              className="gap-2"
            >
              {applyMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {m.sync_providers_adding()}
                </>
              ) : (
                m.sync_providers_add_selected({
                  count: totalSelectedModelsCount,
                })
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
