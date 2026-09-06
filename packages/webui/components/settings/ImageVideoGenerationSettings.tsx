import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { Badge } from '@/ui/components/ui/badge'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import { Switch } from '@/ui/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import {
  Plus,
  Trash2,
  AlertCircle,
  ImageIcon,
  VideoIcon,
  CheckCircle2,
  Loader2,
  Search,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { m } from '@/ui/paraglide/messages.js'
import { cn } from '@/ui/lib/utils'
import type {
  MediaGenerationSettingsResponse,
  MediaProviderStatus,
  EnabledMediaModel,
  CuratedMediaModel,
  MediaModelType,
} from '@shumai/dtos'

const PROVIDER_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  google: 'Google',
  'google-vertex': 'Google Vertex AI',
  xai: 'xAI',
  fal: 'Fal',
  replicate: 'Replicate',
  'black-forest-labs': 'Black Forest Labs',
  klingai: 'Kling AI',
  togetherai: 'Together AI',
  fireworks: 'Fireworks AI',
  deepinfra: 'DeepInfra',
  luma: 'Luma',
  'amazon-bedrock': 'Amazon Bedrock',
  alibaba: 'Alibaba',
  bytedance: 'ByteDance',
  minimax: 'MiniMax',
  prodia: 'Prodia',
  azure: 'Azure OpenAI',
}

interface StagedModelItem {
  type: MediaModelType
  modelId: string
  name?: string
  isCustom?: boolean
}

export function ImageVideoGenerationSettings({ teamId }: { teamId: string }) {
  const queryClient = useQueryClient()
  const [selectedProvider, setSelectedProvider] = useState<MediaProviderStatus | null>(null)

  // Fetch Media Generation Settings
  const { data: settings, isLoading } = useQuery<MediaGenerationSettingsResponse>({
    queryKey: ['teams', teamId, 'media-generation'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId']['media-generation'].$get({
        param: { teamId },
      })
      if (!res.ok) throw new Error('Failed to fetch media generation settings')
      return (await res.json()) as MediaGenerationSettingsResponse
    },
  })

  const providers = settings?.providers || []
  const enabledModels = settings?.enabledModels || []

  // Keep selectedProvider up to date when settings refetch
  const currentSelectedProvider = useMemo(() => {
    if (!selectedProvider) return null
    return providers.find((p) => p.provider === selectedProvider.provider) || selectedProvider
  }, [selectedProvider, providers])

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-w-0 w-full">
      <ScrollArea className="h-full pr-1 [&>div>div]:block!">
        <div className="pb-12 min-w-0 w-full">
          <Card className="border-border min-w-0 w-full">
            <CardHeader>
              <CardTitle className="text-base font-semibold">{m.media_providers()}</CardTitle>
              <CardDescription>{m.media_providers_description()}</CardDescription>
            </CardHeader>
            <CardContent className="min-w-0">
              <div className="space-y-2.5 min-w-0">
                {providers.map((provider) => {
                  const displayName = PROVIDER_NAMES[provider.provider] || provider.provider
                  const isCustom = provider.status === 'configured_custom'
                  const isEnv = provider.status === 'configured_env'

                  const imageCount = enabledModels.filter(
                    (m) => m.provider === provider.provider && m.type === 'image',
                  ).length
                  const videoCount = enabledModels.filter(
                    (m) => m.provider === provider.provider && m.type === 'video',
                  ).length

                  return (
                    <div
                      key={provider.provider}
                      onClick={() => setSelectedProvider(provider)}
                      className="group cursor-pointer flex items-center justify-between gap-4 p-3.5 rounded-xl border border-border bg-card/50 hover:bg-card/80 hover:border-primary/50 transition-all shadow-none hover:shadow-xs min-w-0"
                    >
                      <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                        {/* Row 1: Provider Name + Env / Custom Key */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-semibold text-sm text-foreground truncate">
                            {displayName}
                          </span>
                          <span
                            className="text-xs text-muted-foreground font-mono opacity-60 truncate"
                            title={provider.customApiKeyOrEnv || provider.defaultEnvKey}
                          >
                            {provider.customApiKeyOrEnv || provider.defaultEnvKey}
                          </span>
                        </div>

                        {/* Row 2: All labels (configured status, n image enabled, n video enabled) */}
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          {isCustom && (
                            <Badge
                              variant="outline"
                              className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] shrink-0 font-normal gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              {m.provider_status_configured_custom()}
                            </Badge>
                          )}
                          {isEnv && (
                            <Badge
                              variant="outline"
                              className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 text-[10px] shrink-0 font-normal gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              {m.provider_status_configured_env()}
                            </Badge>
                          )}
                          {!isCustom && !isEnv && (
                            <Badge
                              variant="outline"
                              className="bg-muted text-muted-foreground border-border text-[10px] shrink-0 font-normal"
                            >
                              {m.provider_status_not_configured()}
                            </Badge>
                          )}

                          {provider.supportedTypes.includes('image') && (
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border shrink-0 font-normal transition-colors',
                                imageCount > 0
                                  ? 'bg-primary/10 text-primary border-primary/20'
                                  : 'bg-muted/50 text-muted-foreground border-border/60',
                              )}
                            >
                              <ImageIcon className="w-3 h-3" />
                              {m.image_models_count({ count: imageCount })}
                            </span>
                          )}
                          {provider.supportedTypes.includes('video') && (
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border shrink-0 font-normal transition-colors',
                                videoCount > 0
                                  ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                                  : 'bg-muted/50 text-muted-foreground border-border/60',
                              )}
                            >
                              <VideoIcon className="w-3 h-3" />
                              {m.video_models_count({ count: videoCount })}
                            </span>
                          )}
                        </div>
                      </div>

                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      {/* Provider Details Dialog */}
      {currentSelectedProvider && (
        <ProviderDetailsDialog
          isOpen={!!currentSelectedProvider}
          onClose={() => setSelectedProvider(null)}
          provider={currentSelectedProvider}
          teamId={teamId}
          enabledModels={enabledModels}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'media-generation'] })
          }}
        />
      )}
    </div>
  )
}

interface ProviderDetailsDialogProps {
  isOpen: boolean
  onClose: () => void
  provider: MediaProviderStatus
  teamId: string
  enabledModels: EnabledMediaModel[]
  onSuccess: () => void
}

function ProviderDetailsDialog({
  isOpen,
  onClose,
  provider,
  teamId,
  enabledModels,
  onSuccess,
}: ProviderDetailsDialogProps) {
  // Smart default: open to 'models' if key is configured, else 'api-key'
  const [activeTab, setActiveTab] = useState<'api-key' | 'models'>(() =>
    provider.apiKeyConfigured ? 'models' : 'api-key',
  )

  // Staged API Key state
  const [stagedApiKey, setStagedApiKey] = useState(provider.customApiKeyOrEnv || '')

  // Staged Models state
  const [stagedModels, setStagedModels] = useState<StagedModelItem[]>(() =>
    enabledModels
      .filter((m) => m.provider === provider.provider)
      .map((m) => ({
        type: m.type,
        modelId: m.modelId,
        name: m.name,
      })),
  )

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('')
  const [modalityFilter, setModalityFilter] = useState<'all' | 'image' | 'video'>('all')

  // Custom Model Form state
  const [customModelId, setCustomModelId] = useState('')
  const [customType, setCustomType] = useState<MediaModelType>(
    provider.supportedTypes[0] || 'image',
  )

  // Reset states if provider or dialog open status changes
  useEffect(() => {
    setActiveTab(provider.apiKeyConfigured ? 'models' : 'api-key')
    setStagedApiKey(provider.customApiKeyOrEnv || '')
    setStagedModels(
      enabledModels
        .filter((m) => m.provider === provider.provider)
        .map((m) => ({
          type: m.type,
          modelId: m.modelId,
          name: m.name,
        })),
    )
    setSearchQuery('')
    setModalityFilter('all')
    setCustomModelId('')
    setCustomType(provider.supportedTypes[0] || 'image')
  }, [provider.provider, provider.customApiKeyOrEnv, provider.apiKeyConfigured, enabledModels])

  // Fetch Curated Models for this Provider
  const { data: curatedModels = [], isLoading: isLoadingCurated } = useQuery<CuratedMediaModel[]>({
    queryKey: ['teams', teamId, 'media-generation', 'curated', provider.provider],
    queryFn: async () => {
      const res = await client.api.teams[':teamId']['media-generation']['models']['curated'].$get({
        param: { teamId },
        query: { provider: provider.provider },
      })
      if (!res.ok) return []
      return (await res.json()) as CuratedMediaModel[]
    },
    enabled: isOpen,
  })

  // Mutation: Save provider configuration (API Key + Models)
  const { mutate: saveProviderConfig, isPending: isSaving } = useMutation({
    mutationFn: async () => {
      const res = await client.api.teams[':teamId']['media-generation']['providers'][
        ':provider'
      ].$put({
        param: { teamId, provider: provider.provider },
        json: {
          apiKey: stagedApiKey.trim(),
          models: stagedModels.map((m) => ({
            type: m.type,
            modelId: m.modelId,
            name: m.name || m.modelId,
          })),
        },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        throw new Error((err as any)?.message || 'Failed to update provider')
      }
      return await res.json()
    },
    onSuccess: () => {
      toast.success(m.provider_updated_successfully())
      onSuccess()
      onClose()
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : m.failed_to_update_provider())
    },
  })

  // Determine curated vs custom models
  const curatedModelIds = useMemo(
    () => new Set(curatedModels.map((m) => m.modelId)),
    [curatedModels],
  )

  const customModels = useMemo(
    () => stagedModels.filter((m) => !curatedModelIds.has(m.modelId)),
    [stagedModels, curatedModelIds],
  )

  // Combine curated models and custom models for rendering
  const allDisplayModels = useMemo(() => {
    const list: Array<{
      type: MediaModelType
      modelId: string
      name: string
      isCustom: boolean
      isToggledOn: boolean
    }> = []

    // 1. Add curated models (default disabled unless in stagedModels)
    for (const curated of curatedModels) {
      const isToggledOn = stagedModels.some(
        (m) => m.modelId === curated.modelId && m.type === curated.type,
      )
      list.push({
        type: curated.type,
        modelId: curated.modelId,
        name: curated.name,
        isCustom: false,
        isToggledOn,
      })
    }

    // 2. Add custom models (always toggled on while in stagedModels)
    for (const custom of customModels) {
      list.push({
        type: custom.type,
        modelId: custom.modelId,
        name: custom.name || custom.modelId,
        isCustom: true,
        isToggledOn: true,
      })
    }

    return list
  }, [curatedModels, stagedModels, customModels])

  // Filter models by search query and modality filter
  const filteredModels = useMemo(() => {
    return allDisplayModels.filter((model) => {
      if (modalityFilter !== 'all' && model.type !== modalityFilter) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchName = model.name.toLowerCase().includes(q)
        const matchId = model.modelId.toLowerCase().includes(q)
        if (!matchName && !matchId) return false
      }
      return true
    })
  }, [allDisplayModels, modalityFilter, searchQuery])

  // Toggle model handler
  const handleToggleModel = (
    model: { type: MediaModelType; modelId: string; name: string; isCustom: boolean },
    checked: boolean,
  ) => {
    if (checked) {
      // Enable model
      setStagedModels((prev) => [
        ...prev,
        {
          type: model.type,
          modelId: model.modelId,
          name: model.name,
          isCustom: model.isCustom,
        },
      ])
    } else {
      // Disable model (for curated, turns off; for custom, removes from stagedModels)
      setStagedModels((prev) =>
        prev.filter((m) => !(m.modelId === model.modelId && m.type === model.type)),
      )
    }
  }

  // Remove custom model
  const handleRemoveCustomModel = (modelId: string, type: MediaModelType) => {
    setStagedModels((prev) => prev.filter((m) => !(m.modelId === modelId && m.type === type)))
  }

  // Add custom model handler
  const handleAddCustomModel = () => {
    const trimmed = customModelId.trim()
    if (!trimmed) return

    // Check duplicate
    const alreadyStaged = stagedModels.some((m) => m.modelId === trimmed && m.type === customType)
    if (alreadyStaged) {
      toast.error(m.failed_to_add_model())
      return
    }

    setStagedModels((prev) => [
      ...prev,
      {
        type: customType,
        modelId: trimmed,
        name: trimmed,
        isCustom: true,
      },
    ])
    setCustomModelId('')
  }

  const displayName = PROVIDER_NAMES[provider.provider] || provider.provider

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl md:max-w-3xl h-[88vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <span>{displayName}</span>
            {provider.status === 'configured_custom' && (
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-normal"
              >
                {m.provider_status_configured_custom()}
              </Badge>
            )}
            {provider.status === 'configured_env' && (
              <Badge
                variant="outline"
                className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 text-[10px] font-normal"
              >
                {m.provider_status_configured_env()}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {m.default_env_var_desc({ envKey: provider.defaultEnvKey })}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as 'api-key' | 'models')}
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="px-6 pb-2 shrink-0">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="api-key" onClick={() => setActiveTab('api-key')}>
                {m.api_key()}
              </TabsTrigger>
              <TabsTrigger value="models" onClick={() => setActiveTab('models')}>
                {m.models()} ({stagedModels.length})
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab 1: API Key Config */}
          <TabsContent value="api-key" className="flex-1 flex flex-col min-h-0 m-0">
            <div className="flex-1 min-h-0">
              <ScrollArea className="h-full">
                <div className="p-6 space-y-4 pr-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="provider-api-key"
                        className="text-xs font-medium text-foreground"
                      >
                        {m.api_key()}
                      </label>
                      {stagedApiKey && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7 text-destructive hover:bg-destructive/10 hover:text-destructive gap-1 px-2"
                          onClick={() => setStagedApiKey('')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {m.clear_custom_key()}
                        </Button>
                      )}
                    </div>
                    <Input
                      id="provider-api-key"
                      type="text"
                      value={stagedApiKey}
                      onChange={(e) => setStagedApiKey(e.target.value)}
                      placeholder={m.api_key_or_env_var_placeholder({
                        envKey: provider.defaultEnvKey,
                      })}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {m.api_key_or_env_var_hint({ envKey: provider.defaultEnvKey })}
                    </p>
                  </div>
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Tab 2: Models List */}
          <TabsContent value="models" className="flex-1 flex flex-col min-h-0 m-0">
            {/* Unconfigured Warning Notice */}
            {!provider.apiKeyConfigured && !stagedApiKey && (
              <div className="px-6 pb-2 shrink-0">
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">{m.provider_status_not_configured()}</p>
                    <p className="text-[11px] opacity-90 mt-0.5">
                      {m.provider_not_configured_warning()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Filter Bar: Search + Modality Filter */}
            <div className="px-6 pb-3 flex items-center justify-between gap-3 shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={m.search_models_placeholder()}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              {provider.supportedTypes.length > 1 && (
                <div className="flex rounded-md border border-border overflow-hidden shrink-0 h-9">
                  <button
                    type="button"
                    onClick={() => setModalityFilter('all')}
                    className={cn(
                      'px-3 text-xs transition-colors',
                      modalityFilter === 'all'
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'bg-muted/40 hover:bg-muted text-muted-foreground',
                    )}
                  >
                    {m.all_modalities()}
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalityFilter('image')}
                    className={cn(
                      'px-3 text-xs transition-colors flex items-center gap-1.5',
                      modalityFilter === 'image'
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'bg-muted/40 hover:bg-muted text-muted-foreground',
                    )}
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    {m.media_type_image()}
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalityFilter('video')}
                    className={cn(
                      'px-3 text-xs transition-colors flex items-center gap-1.5',
                      modalityFilter === 'video'
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'bg-muted/40 hover:bg-muted text-muted-foreground',
                    )}
                  >
                    <VideoIcon className="w-3.5 h-3.5" />
                    {m.media_type_video()}
                  </button>
                </div>
              )}
            </div>

            {/* Models List */}
            <div className="flex-1 min-h-0 px-6">
              <ScrollArea className="h-full pr-4">
                {isLoadingCurated ? (
                  <div className="flex h-48 items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-xs">{m.loading_models()}</span>
                  </div>
                ) : filteredModels.length === 0 ? (
                  <div className="text-center py-12 border border-dashed rounded-xl text-muted-foreground text-sm">
                    {m.no_models_found()}
                  </div>
                ) : (
                  <div className="space-y-2 pb-4">
                    {filteredModels.map((model) => (
                      <div
                        key={`${model.type}-${model.modelId}`}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-xl border transition-all text-xs',
                          model.isToggledOn
                            ? 'border-primary/40 bg-primary/5'
                            : 'border-border bg-card hover:border-primary/30',
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-3">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] px-1.5 py-0.5 gap-1 shrink-0 font-normal',
                              model.type === 'image'
                                ? 'bg-primary/10 text-primary border-primary/20'
                                : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
                            )}
                          >
                            {model.type === 'image' ? (
                              <ImageIcon className="w-3 h-3" />
                            ) : (
                              <VideoIcon className="w-3 h-3" />
                            )}
                            {model.type === 'image' ? m.media_type_image() : m.media_type_video()}
                          </Badge>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-foreground text-sm truncate flex items-center gap-1.5">
                              <span className="truncate">{model.name}</span>
                              {model.isCustom && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] h-4 px-1 font-normal shrink-0"
                                >
                                  {m.custom_model_option().replace('...', '')}
                                </Badge>
                              )}
                            </div>
                            <p className="font-mono text-[11px] text-muted-foreground truncate mt-0.5">
                              {model.modelId}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {model.isCustom && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveCustomModel(model.modelId, model.type)}
                              title={m.delete()}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Switch
                            checked={model.isToggledOn}
                            onCheckedChange={(checked) => handleToggleModel(model, checked)}
                            aria-label={`Toggle ${model.name}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Minimal Add Custom Model Form */}
            <div className="px-6 py-3 border-t border-border shrink-0 bg-muted/10">
              <div className="flex items-center gap-2">
                {provider.supportedTypes.length > 1 && (
                  <div className="flex rounded-md border border-border overflow-hidden shrink-0 h-8">
                    <button
                      type="button"
                      onClick={() => setCustomType('image')}
                      className={cn(
                        'px-2.5 py-1 text-xs transition-colors',
                        customType === 'image'
                          ? 'bg-primary text-primary-foreground font-medium'
                          : 'bg-muted/40 hover:bg-muted text-muted-foreground',
                      )}
                    >
                      {m.media_type_image()}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomType('video')}
                      className={cn(
                        'px-2.5 py-1 text-xs transition-colors',
                        customType === 'video'
                          ? 'bg-primary text-primary-foreground font-medium'
                          : 'bg-muted/40 hover:bg-muted text-muted-foreground',
                      )}
                    >
                      {m.media_type_video()}
                    </button>
                  </div>
                )}
                <Input
                  type="text"
                  value={customModelId}
                  onChange={(e) => setCustomModelId(e.target.value)}
                  placeholder={m.enter_custom_model_id()}
                  className="font-mono text-xs h-8 flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddCustomModel()
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs shrink-0 gap-1"
                  onClick={handleAddCustomModel}
                  disabled={!customModelId.trim()}
                >
                  <Plus className="w-3.5 h-3.5" />
                  {m.add()}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Global Footer with Cancel and Save */}
        <DialogFooter className="px-6 py-4 border-t border-border shrink-0 flex items-center justify-between sm:justify-between w-full m-0 bg-card">
          <div className="text-xs text-muted-foreground">
            {stagedModels.length} {m.models().toLowerCase()}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSaving}>
              {m.cancel()}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => saveProviderConfig()}
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              {m.save()}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
