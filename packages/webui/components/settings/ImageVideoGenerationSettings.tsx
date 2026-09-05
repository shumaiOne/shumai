import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { Badge } from '@/ui/components/ui/badge'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/ui/select'
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
}

export function ImageVideoGenerationSettings({ teamId }: { teamId: string }) {
  const queryClient = useQueryClient()

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
  const [modelDisplayName, setModelDisplayName] = useState<string>('')

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
    setModelDisplayName('')
  }

  const handleOpenKeyDialog = (provider: MediaProviderStatus) => {
    setEditingProvider(provider)
    setApiKeyInput(provider.customApiKeyOrEnv || '')
    setKeyDialogOpen(true)
  }

  const handleSaveKey = () => {
    if (!editingProvider) return
    updateApiKey({
      provider: editingProvider.provider,
      apiKey: apiKeyInput.trim() || undefined,
    })
  }

  const handleAddModelSubmit = () => {
    const finalModelId =
      selectedModelId === '__custom__' ? customModelId.trim() : selectedModelId.trim()
    if (!addProvider || !finalModelId) return

    addModel({
      type: addType,
      provider: addProvider,
      modelId: finalModelId,
      name: modelDisplayName.trim() || undefined,
    })
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const providers = settings?.providers || []
  const enabledModels = settings?.enabledModels || []
  const activeProvidersMap = new Map(providers.map((p) => [p.provider, p.apiKeyConfigured]))

  // Filter providers that support the currently selected addType
  const compatibleProviders = providers.filter((p) => p.supportedTypes.includes(addType))

  return (
    <ScrollArea className="h-full pr-1">
      <div className="space-y-8 pb-12">
        {/* Section 1: Media Providers */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold">{m.media_providers()}</CardTitle>
            <CardDescription>{m.media_providers_description()}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {providers.map((provider) => {
                const displayName = PROVIDER_NAMES[provider.provider] || provider.provider
                const isCustom = provider.status === 'configured_custom'
                const isEnv = provider.status === 'configured_env'

                return (
                  <div
                    key={provider.provider}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-border bg-card/50 hover:bg-card/80 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 min-w-0 flex-1">
                      <div className="min-w-[160px] flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground truncate">
                          {displayName}
                        </span>
                        {isCustom && (
                          <Badge
                            variant="outline"
                            className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[11px] shrink-0"
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            {m.provider_status_configured_custom()}
                          </Badge>
                        )}
                        {isEnv && (
                          <Badge
                            variant="outline"
                            className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 text-[11px] shrink-0"
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            {m.provider_status_configured_env()}
                          </Badge>
                        )}
                        {!isCustom && !isEnv && (
                          <Badge
                            variant="outline"
                            className="bg-muted text-muted-foreground border-border text-[11px] shrink-0"
                          >
                            {m.provider_status_not_configured()}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          {provider.supportedTypes.includes('image') && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-accent/60 px-1.5 py-0.5 rounded">
                              <ImageIcon className="w-3 h-3" />
                              {m.media_type_image()}
                            </span>
                          )}
                          {provider.supportedTypes.includes('video') && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-accent/60 px-1.5 py-0.5 rounded">
                              <VideoIcon className="w-3 h-3" />
                              {m.media_type_video()}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground font-mono opacity-70">
                          {provider.defaultEnvKey}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8 whitespace-nowrap"
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

        {/* Section 2: Enabled Models */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base font-semibold">{m.enabled_media_models()}</CardTitle>
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
                      <TableHead>Model</TableHead>
                      <TableHead className="w-[80px] text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enabledModels.map((model) => {
                      const isConfigured = activeProvidersMap.get(model.provider) ?? false
                      const providerDisplayName = PROVIDER_NAMES[model.provider] || model.provider

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
                {editingProvider &&
                  m.api_key_or_env_var_hint({ envKey: editingProvider.defaultEnvKey })}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">
                  {m.api_key_or_env_var()}
                </label>
                <Input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={
                    editingProvider
                      ? m.api_key_or_env_var_placeholder({ envKey: editingProvider.defaultEnvKey })
                      : ''
                  }
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setKeyDialogOpen(false)}
                disabled={isSavingKey}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveKey} disabled={isSavingKey}>
                {isSavingKey && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Add Model */}
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{m.add_media_model()}</DialogTitle>
              <DialogDescription>
                Select the media generation type, provider, and model to enable.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-3">
              {/* Type Select */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">{m.model_type()}</label>
                <Select
                  value={addType}
                  onValueChange={(val: 'image' | 'video') => {
                    setAddType(val)
                    setAddProvider('')
                    setSelectedModelId('')
                    setCustomModelId('')
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4" />
                        <span>{m.media_type_image()}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="video">
                      <div className="flex items-center gap-2">
                        <VideoIcon className="w-4 h-4" />
                        <span>{m.media_type_video()}</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Provider Select */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">{m.select_provider()}</label>
                <Select
                  value={addProvider}
                  onValueChange={(val) => {
                    setAddProvider(val)
                    setSelectedModelId('')
                    setCustomModelId('')
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={m.select_provider()} />
                  </SelectTrigger>
                  <SelectContent>
                    {compatibleProviders.map((p) => (
                      <SelectItem key={p.provider} value={p.provider}>
                        <div className="flex items-center justify-between w-full gap-4">
                          <span>{PROVIDER_NAMES[p.provider] || p.provider}</span>
                          {!p.apiKeyConfigured && (
                            <span className="text-[11px] text-muted-foreground">
                              ({m.provider_status_not_configured()})
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Model Select */}
              {addProvider && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">{m.select_model()}</label>
                  {isLoadingCurated ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Loading models...</span>
                    </div>
                  ) : (
                    <Select
                      value={selectedModelId}
                      onValueChange={(val) => {
                        setSelectedModelId(val)
                        if (val !== '__custom__') {
                          const found = curatedModels?.find((m) => m.modelId === val)
                          if (found) setModelDisplayName(found.name)
                        } else {
                          setModelDisplayName('')
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={m.select_model()} />
                      </SelectTrigger>
                      <SelectContent>
                        {curatedModels?.map((curated) => (
                          <SelectItem key={curated.modelId} value={curated.modelId}>
                            <div className="flex items-center justify-between w-full gap-2">
                              <span>{curated.name}</span>
                              <span className="font-mono text-[11px] text-muted-foreground">
                                {curated.modelId}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                        <SelectItem value="__custom__">
                          <span className="italic text-muted-foreground">
                            {m.custom_model_option()}
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* Custom Model ID Input */}
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

              {/* Display Name Input */}
              {addProvider && selectedModelId && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    {m.model_display_name()}
                  </label>
                  <Input
                    value={modelDisplayName}
                    onChange={(e) => setModelDisplayName(e.target.value)}
                    placeholder={m.model_display_name_placeholder()}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setAddDialogOpen(false)}
                disabled={isAddingModel}
              >
                Cancel
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
                Add
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
                {modelToDelete && (
                  <span>
                    Remove model <strong className="font-mono">{modelToDelete.modelId}</strong> (
                    {PROVIDER_NAMES[modelToDelete.provider] || modelToDelete.provider}) from enabled
                    models?
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isRemovingModel}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (modelToDelete) removeModel(modelToDelete.id)
                }}
                disabled={isRemovingModel}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isRemovingModel && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ScrollArea>
  )
}
