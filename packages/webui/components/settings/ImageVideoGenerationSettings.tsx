import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { Badge } from '@/ui/components/ui/badge'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/components/ui/table'
import {
  Key,
  Plus,
  Trash2,
  AlertCircle,
  ImageIcon,
  VideoIcon,
  CheckCircle2,
  Loader2,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { m } from '@/ui/paraglide/messages.js'
import type {
  MediaGenerationSettingsResponse,
  MediaProviderStatus,
  EnabledMediaModel,
  CuratedMediaModel,
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

export function ImageVideoGenerationSettings({ teamId }: { teamId: string }) {
  const queryClient = useQueryClient()

  // Tab State
  const [activeTab, setActiveTab] = useState<'providers' | 'models'>('providers')

  // API Key Dialog State
  const [keyDialogOpen, setKeyDialogOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<MediaProviderStatus | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState('')

  // Add Model Dialog State
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addType, setAddType] = useState<'image' | 'video'>('image')
  const [addProvider, setAddProvider] = useState<string>('')
  const [selectedModelId, setSelectedModelId] = useState<string>('')
  const [customModelId, setCustomModelId] = useState<string>('')

  // Delete Model Confirmation State
  const [modelToDelete, setModelToDelete] = useState<EnabledMediaModel | null>(null)

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

  // Fetch Curated Models for Add Dialog
  const { data: curatedModels, isLoading: isLoadingCurated } = useQuery<CuratedMediaModel[]>({
    queryKey: ['teams', teamId, 'media-generation', 'curated', addType, addProvider],
    queryFn: async () => {
      if (!addProvider) return []
      const res = await client.api.teams[':teamId']['media-generation']['models']['curated'].$get({
        param: { teamId },
        query: { provider: addProvider, type: addType },
      })
      if (!res.ok) return []
      return (await res.json()) as CuratedMediaModel[]
    },
    enabled: addDialogOpen && !!addProvider,
  })

  // Mutation: Update Provider API Key
  const { mutate: updateApiKey, isPending: isSavingKey } = useMutation({
    mutationFn: async ({ provider, apiKey }: { provider: string; apiKey?: string }) => {
      const res = await client.api.teams[':teamId']['media-generation']['providers'][
        ':provider'
      ].$put({
        param: { teamId, provider },
        json: { apiKey },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        throw new Error((err as any)?.message || 'Failed to update API key')
      }
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'media-generation'] })
      toast.success(m.api_key_saved_successfully())
      setKeyDialogOpen(false)
      setEditingProvider(null)
      setApiKeyInput('')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : m.failed_to_save_api_key())
    },
  })

  // Mutation: Add Enabled Model
  const { mutate: addModel, isPending: isAddingModel } = useMutation({
    mutationFn: async (payload: {
      type: 'image' | 'video'
      provider: string
      modelId: string
      name?: string
    }) => {
      const res = await client.api.teams[':teamId']['media-generation']['models'].$post({
        param: { teamId },
        json: payload,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        throw new Error((err as any)?.message || 'Failed to add model')
      }
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'media-generation'] })
      toast.success(m.model_added_successfully())
      setAddDialogOpen(false)
      resetAddForm()
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : m.failed_to_add_model())
    },
  })

  // Mutation: Remove Enabled Model
  const { mutate: removeModel, isPending: isRemovingModel } = useMutation({
    mutationFn: async (modelId: string) => {
      const res = await client.api.teams[':teamId']['media-generation']['models'][
        ':modelId'
      ].$delete({
        param: { teamId, modelId },
      })
      if (!res.ok) throw new Error('Failed to remove model')
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'media-generation'] })
      toast.success(m.model_removed_successfully())
      setModelToDelete(null)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : m.failed_to_remove_model())
    },
  })

  const resetAddForm = () => {
    setAddType('image')
    setAddProvider('')
    setSelectedModelId('')
    setCustomModelId('')
  }

  const handleOpenKeyDialog = (provider: MediaProviderStatus) => {
    setEditingProvider(provider)
    setApiKeyInput(provider.customApiKeyOrEnv || '')
    setKeyDialogOpen(true)
  }

  const handleSaveKey = () => {
    if (!editingProvider) return
    const trimmed = apiKeyInput.trim()
    updateApiKey({
      provider: editingProvider.provider,
      apiKey: trimmed,
    })
  }

  const handleRemoveKey = () => {
    if (!editingProvider) return
    updateApiKey({
      provider: editingProvider.provider,
      apiKey: '',
    })
  }

  const handleTypeChange = (type: 'image' | 'video') => {
    if (type === addType) return
    setAddType(type)
    // Check if current provider supports the new type
    const providerObj = settings?.providers?.find((p) => p.provider === addProvider)
    if (!providerObj || !providerObj.supportedTypes.includes(type)) {
      setAddProvider('')
      setSelectedModelId('')
      setCustomModelId('')
    } else {
      setSelectedModelId('')
      setCustomModelId('')
    }
  }

  const handleAddModelSubmit = () => {
    const finalModelId =
      selectedModelId === '__custom__' ? customModelId.trim() : selectedModelId.trim()
    if (!addProvider || !finalModelId) return

    const curated = curatedModels?.find((m) => m.modelId === finalModelId)
    const finalName = curated?.name || finalModelId

    addModel({
      type: addType,
      provider: addProvider,
      modelId: finalModelId,
      name: finalName,
    })
  }

  const providers = settings?.providers || []
  const enabledModels = settings?.enabledModels || []
  const activeProvidersMap = new Map(providers.map((p) => [p.provider, p.apiKeyConfigured]))

  // Filter providers that support the currently selected addType
  const compatibleProviders = useMemo(
    () => providers.filter((p) => p.supportedTypes.includes(addType)),
    [providers, addType],
  )

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-w-0 w-full">
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as 'providers' | 'models')}
        className="w-full flex-1 flex flex-col min-h-0 min-w-0"
      >
        <TabsList className="grid w-full max-w-[400px] grid-cols-2 shrink-0">
          <TabsTrigger value="providers" onClick={() => setActiveTab('providers')}>
            {m.providers()}
          </TabsTrigger>
          <TabsTrigger value="models" onClick={() => setActiveTab('models')}>
            {m.enabled_media_models()}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Providers */}
        <TabsContent value="providers" className="flex-1 min-h-0 min-w-0 mt-4">
          <ScrollArea className="h-full pr-1 [&>div>div]:block!">
            <div className="pb-12 min-w-0 w-full">
              <Card className="border-border min-w-0 w-full">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">{m.providers()}</CardTitle>
                  <CardDescription>{m.media_providers_description()}</CardDescription>
                </CardHeader>
                <CardContent className="min-w-0">
                  <div className="space-y-2.5 min-w-0">
                    {providers.map((provider) => {
                      const displayName = PROVIDER_NAMES[provider.provider] || provider.provider
                      const isCustom = provider.status === 'configured_custom'
                      const isEnv = provider.status === 'configured_env'

                      return (
                        <div
                          key={provider.provider}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-border bg-card/50 hover:bg-card/80 transition-colors min-w-0 overflow-hidden"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 min-w-0 flex-1 overflow-hidden">
                            <div className="shrink-0 flex items-center gap-2">
                              <span className="font-medium text-sm text-foreground whitespace-nowrap">
                                {displayName}
                              </span>
                              {isCustom && (
                                <Badge
                                  variant="outline"
                                  className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[11px] shrink-0 whitespace-nowrap"
                                >
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  {m.provider_status_configured_custom()}
                                </Badge>
                              )}
                              {isEnv && (
                                <Badge
                                  variant="outline"
                                  className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 text-[11px] shrink-0 whitespace-nowrap"
                                >
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  {m.provider_status_configured_env()}
                                </Badge>
                              )}
                              {!isCustom && !isEnv && (
                                <Badge
                                  variant="outline"
                                  className="bg-muted text-muted-foreground border-border text-[11px] shrink-0 whitespace-nowrap"
                                >
                                  {m.provider_status_not_configured()}
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                              <div className="flex items-center gap-1.5 shrink-0">
                                {provider.supportedTypes.includes('image') && (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-accent/60 px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap">
                                    <ImageIcon className="w-3 h-3" />
                                    {m.media_type_image()}
                                  </span>
                                )}
                                {provider.supportedTypes.includes('video') && (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-accent/60 px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap">
                                    <VideoIcon className="w-3 h-3" />
                                    {m.media_type_video()}
                                  </span>
                                )}
                              </div>
                              <span
                                className="text-xs text-muted-foreground font-mono opacity-70 truncate min-w-0 flex-1 block"
                                title={provider.customApiKeyOrEnv || provider.defaultEnvKey}
                              >
                                {provider.customApiKeyOrEnv || provider.defaultEnvKey}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-end shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-8 whitespace-nowrap shrink-0"
                              onClick={() => handleOpenKeyDialog(provider)}
                            >
                              <Key className="w-3.5 h-3.5 mr-1.5" />
                              {provider.apiKeyConfigured ? m.edit_api_key() : m.configure_api_key()}
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Tab 2: Enabled Models */}
        <TabsContent value="models" className="flex-1 min-h-0 min-w-0 mt-4">
          <ScrollArea className="h-full pr-1 [&>div>div]:block!">
            <div className="pb-12 min-w-0 w-full">
              <Card className="border-border min-w-0 w-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base font-semibold">
                      {m.enabled_media_models()}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {m.enabled_media_models_description()}
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      resetAddForm()
                      setAddDialogOpen(true)
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    {m.add_media_model()}
                  </Button>
                </CardHeader>
                <CardContent>
                  {enabledModels.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      <p>{m.no_enabled_models()}</p>
                    </div>
                  ) : (
                    <div className="rounded-md border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[100px]">{m.model_type()}</TableHead>
                            <TableHead>{m.providers()}</TableHead>
                            <TableHead>{m.model()}</TableHead>
                            <TableHead className="w-[80px] text-right"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {enabledModels.map((model) => {
                            const isConfigured = activeProvidersMap.get(model.provider) ?? false
                            const providerDisplayName =
                              PROVIDER_NAMES[model.provider] || model.provider

                            return (
                              <TableRow key={model.id}>
                                <TableCell>
                                  {model.type === 'image' ? (
                                    <Badge
                                      variant="outline"
                                      className="bg-primary/10 text-primary border-primary/20 text-xs gap-1"
                                    >
                                      <ImageIcon className="w-3 h-3" />
                                      {m.media_type_image()}
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 text-xs gap-1"
                                    >
                                      <VideoIcon className="w-3 h-3" />
                                      {m.media_type_video()}
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="font-medium text-sm">
                                  {providerDisplayName}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs">{model.modelId}</span>
                                    {model.name && (
                                      <span className="text-xs text-muted-foreground">
                                        ({model.name})
                                      </span>
                                    )}
                                    {!isConfigured && (
                                      <div
                                        className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded"
                                        title={m.model_requires_api_key_warning()}
                                      >
                                        <AlertCircle className="w-3 h-3" />
                                        <span>{m.provider_status_not_configured()}</span>
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={() => setModelToDelete(model)}
                                    disabled={isRemovingModel}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Dialog: Configure Provider API Key */}
      <Dialog open={keyDialogOpen} onOpenChange={setKeyDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {editingProvider
                ? `${PROVIDER_NAMES[editingProvider.provider] || editingProvider.provider} API Key`
                : m.configure_api_key()}
            </DialogTitle>
            <DialogDescription>
              {editingProvider && m.default_env_var_desc({ envKey: editingProvider.defaultEnvKey })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">{m.api_key()}</label>
              <Input
                type="text"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={m.api_key_placeholder()}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">{m.api_key_description()}</p>
            </div>
          </div>
          <DialogFooter className="flex items-center justify-between w-full">
            {editingProvider?.status === 'configured_custom' ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRemoveKey}
                disabled={isSavingKey}
              >
                {m.remove_key()}
              </Button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setKeyDialogOpen(false)}
                disabled={isSavingKey}
              >
                {m.cancel()}
              </Button>
              <Button onClick={handleSaveKey} disabled={isSavingKey}>
                {isSavingKey && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                {m.save()}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Add Model */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-[720px] max-h-[90vh] flex flex-col p-6">
          <DialogHeader>
            <DialogTitle>{m.add_media_model()}</DialogTitle>
            <DialogDescription>{m.add_media_model_desc()}</DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 max-h-[calc(90vh-140px)] pr-2">
            <div className="space-y-4 py-2">
              {/* 1. Model Type Selector: 2-Card Switch */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">{m.model_type()}</label>
                <div className="grid grid-cols-2 gap-3">
                  {/* Image Card */}
                  <button
                    type="button"
                    onClick={() => handleTypeChange('image')}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                      addType === 'image'
                        ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                        : 'border-border bg-card hover:bg-accent/50 text-foreground'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-md ${
                        addType === 'image'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm">{m.media_type_image()}</div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">Text-to-image</p>
                    </div>
                  </button>

                  {/* Video Card */}
                  <button
                    type="button"
                    onClick={() => handleTypeChange('video')}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                      addType === 'video'
                        ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                        : 'border-border bg-card hover:bg-accent/50 text-foreground'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-md ${
                        addType === 'video'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <VideoIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm">{m.media_type_video()}</div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">Text-to-video</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. Provider / Model Selector: 2 Boxes Side-by-Side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Left Box: Providers */}
                <div className="rounded-lg border border-border bg-card/40 flex flex-col h-[280px] overflow-hidden">
                  <div className="p-2.5 border-b border-border flex items-center justify-between bg-muted/30 shrink-0">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      {m.providers()}
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">
                        {compatibleProviders.length}
                      </Badge>
                    </span>
                  </div>
                  <ScrollArea className="flex-1 min-h-0 overscroll-contain [&>div>div]:block!">
                    <div className="p-1 space-y-1">
                      {compatibleProviders.map((p) => {
                        const isSelected = addProvider === p.provider
                        const displayName = PROVIDER_NAMES[p.provider] || p.provider
                        return (
                          <button
                            key={p.provider}
                            type="button"
                            onClick={() => {
                              setAddProvider(p.provider)
                              setSelectedModelId('')
                              setCustomModelId('')
                            }}
                            className={`w-full flex items-center justify-between p-2 rounded-md text-xs transition-colors ${
                              isSelected
                                ? 'bg-primary text-primary-foreground font-medium'
                                : 'hover:bg-accent text-foreground'
                            }`}
                          >
                            <span className="truncate">{displayName}</span>
                            {p.apiKeyConfigured ? (
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                                  isSelected
                                    ? 'bg-primary-foreground/20 text-primary-foreground'
                                    : 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                                }`}
                              >
                                ✓
                              </span>
                            ) : (
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                                  isSelected
                                    ? 'bg-primary-foreground/20 text-primary-foreground'
                                    : 'text-muted-foreground bg-muted'
                                }`}
                              >
                                {m.provider_status_not_configured()}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </ScrollArea>
                </div>

                {/* Right Box: Models */}
                <div className="rounded-lg border border-border bg-card/40 flex flex-col h-[280px] overflow-hidden">
                  <div className="p-2.5 border-b border-border flex items-center justify-between bg-muted/30 shrink-0">
                    <span className="text-xs font-semibold text-foreground">{m.models()}</span>
                    {addProvider && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">
                        {PROVIDER_NAMES[addProvider] || addProvider}
                      </Badge>
                    )}
                  </div>
                  {!addProvider ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-muted-foreground">
                      <p className="text-xs">{m.select_provider_first()}</p>
                    </div>
                  ) : isLoadingCurated ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-4 text-muted-foreground gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-xs">{m.loading_models()}</span>
                    </div>
                  ) : (
                    <ScrollArea className="flex-1 min-h-0 overscroll-contain [&>div>div]:block!">
                      <div className="p-1 space-y-1">
                        {(curatedModels || []).map((curated) => {
                          const isSelected = selectedModelId === curated.modelId
                          return (
                            <button
                              key={curated.modelId}
                              type="button"
                              onClick={() => {
                                setSelectedModelId(curated.modelId)
                              }}
                              className={`w-full flex flex-col items-start p-2 rounded-md text-xs transition-colors text-left ${
                                isSelected
                                  ? 'bg-primary text-primary-foreground font-medium'
                                  : 'hover:bg-accent text-foreground'
                              }`}
                            >
                              <div className="w-full flex items-center justify-between">
                                <span className="truncate">{curated.name}</span>
                                {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                              </div>
                              <span
                                className={`font-mono text-[10px] truncate ${
                                  isSelected
                                    ? 'text-primary-foreground/80'
                                    : 'text-muted-foreground'
                                }`}
                              >
                                {curated.modelId}
                              </span>
                            </button>
                          )
                        })}
                        {/* Custom Model Option */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedModelId('__custom__')
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-md text-xs transition-colors border-t border-border/40 mt-1 ${
                            selectedModelId === '__custom__'
                              ? 'bg-primary text-primary-foreground font-medium'
                              : 'hover:bg-accent text-muted-foreground italic'
                          }`}
                        >
                          <span>{m.custom_model_option()}</span>
                          {selectedModelId === '__custom__' && (
                            <Check className="w-3.5 h-3.5 shrink-0" />
                          )}
                        </button>
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </div>

              {/* 3. Inputs below 2 boxes */}
              {selectedModelId === '__custom__' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    {m.custom_model_id()}
                  </label>
                  <Input
                    value={customModelId}
                    onChange={(e) => setCustomModelId(e.target.value)}
                    placeholder={m.enter_custom_model_id()}
                    className="font-mono text-sm"
                  />
                </div>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
              disabled={isAddingModel}
            >
              {m.cancel()}
            </Button>
            <Button
              onClick={handleAddModelSubmit}
              disabled={
                isAddingModel ||
                !addProvider ||
                !selectedModelId ||
                (selectedModelId === '__custom__' && !customModelId.trim())
              }
            >
              {isAddingModel && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              {m.add()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog: Confirm Model Deletion */}
      <AlertDialog
        open={!!modelToDelete}
        onOpenChange={(open) => {
          if (!open) setModelToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.remove_model_confirm()}</AlertDialogTitle>
            <AlertDialogDescription>
              {modelToDelete &&
                m.remove_model_prompt({
                  modelId: modelToDelete.modelId,
                  provider: PROVIDER_NAMES[modelToDelete.provider] || modelToDelete.provider,
                })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemovingModel}>{m.cancel()}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (modelToDelete) removeModel(modelToDelete.id)
              }}
              disabled={isRemovingModel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemovingModel && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              {m.delete()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
