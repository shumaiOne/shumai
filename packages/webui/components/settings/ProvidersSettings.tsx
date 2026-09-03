import { client } from '@/ui/api/client'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
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
import { Badge } from '@/ui/components/ui/badge'
import { Button } from '@/ui/components/ui/button'
import { Card, CardContent } from '@/ui/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/components/ui/dropdown-menu'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/ui/components/ui/field'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/components/ui/tabs'
import { providerConfigSchema, KNOWN_APIS } from '@shumai/dtos'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { InferResponseType } from 'hono/client'
import {
  ChevronLeft,
  ChevronRight,
  Cpu,
  Globe,
  Info,
  Loader2,
  Maximize2,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { m } from '@/ui/paraglide/messages.js'
import { ModelFormDialog, ModelFormValues } from './ModelFormDialog'

const API_PROTOCOL_LABELS: Record<(typeof KNOWN_APIS)[number], string> = {
  'openai-completions': 'OpenAI Completions',
  'mistral-conversations': 'Mistral Conversations',
  'openai-responses': 'OpenAI Responses',
  'azure-openai-responses': 'Azure OpenAI Responses',
  'openai-codex-responses': 'OpenAI Codex Responses',
  'anthropic-messages': 'Anthropic Messages',
  'bedrock-converse-stream': 'AWS Bedrock',
  'google-generative-ai': 'Google Generative AI',
  'google-vertex': 'Google Vertex',
}

type ProvidersResponse = InferResponseType<
  (typeof client.api.teams)[':teamId']['providers']['$get']
>
type Provider = ProvidersResponse[number]

type ModelsResponse = InferResponseType<(typeof client.api.providers)[':id']['models']['$get']>
type ProviderModelItem = ModelsResponse[number]

interface ProvidersSettingsProps {
  teamId: string
}

export function ProvidersSettings({ teamId }: ProvidersSettingsProps) {
  const queryClient = useQueryClient()
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [providerToDelete, setProviderToDelete] = useState<Provider | null>(null)

  // Fetch Providers
  const { data: providers, isLoading } = useQuery({
    queryKey: ['teams', teamId, 'providers'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].providers.$get({
        param: { teamId },
      })
      if (!res.ok) throw new Error('Failed to fetch providers')
      return await res.json()
    },
  })

  const editingProvider = useMemo(
    () => providers?.find((p) => p.id === editingProviderId) || null,
    [providers, editingProviderId],
  )

  const existingProviderNames = useMemo(() => providers?.map((p) => p.name) || [], [providers])

  const filteredProviders = useMemo(() => {
    if (!providers) return []
    if (!searchQuery.trim()) return providers
    const query = searchQuery.toLowerCase()
    return providers.filter((p) => p.name.toLowerCase().includes(query))
  }, [providers, searchQuery])

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: async (values: {
      name: string
      config: z.infer<typeof providerConfigSchema>
      models: ModelFormValues[]
    }) => {
      const res = await client.api.teams[':teamId'].providers.$post({
        param: { teamId },
        json: {
          name: values.name,
          config: values.config,
          models: values.models,
        },
      })
      if (!res.ok) throw new Error('Failed to create provider')
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'providers'] })
      setIsCreateDialogOpen(false)
      toast.success(m.provider_created_successfully())
    },
    onError: (error) => {
      toast.error(m.error_message({ message: error.message }))
    },
  })

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await client.api.providers[':id'].$delete({
        param: { id },
      })
      if (!res.ok) throw new Error('Failed to delete provider')
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'providers'] })
      setEditingProviderId(null)
      setIsDeleteDialogOpen(false)
      setProviderToDelete(null)
      toast.success(m.provider_deleted_successfully())
    },
    onError: (error) => {
      toast.error(m.error_message({ message: error.message }))
    },
  })

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col space-y-0">
      <div className="flex-none space-y-4 pb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Cpu className="w-5 h-5 text-primary" />
            {m.configured_ai_providers()}
          </h3>
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          >
            <Plus className="w-4 h-4" />
            {m.add_provider()}
          </Button>
        </div>

        <div className="relative px-0.5">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={m.search_providers_placeholder()}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card border-border focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="pr-4 py-2 grid grid-cols-1 gap-4">
          {filteredProviders.map((provider) => (
            <Card
              key={provider.id}
              className="group cursor-pointer hover:border-primary/50 transition-all hover:shadow-md overflow-hidden"
              onClick={() => setEditingProviderId(provider.id)}
            >
              <CardContent className="p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="flex-none p-3 bg-muted rounded-xl group-hover:bg-primary/10 transition-colors">
                    <Globe className="w-6 h-6 text-muted-foreground group-hover:text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground truncate">{provider.name}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1 flex-none">
                        <Zap className="w-3 h-3" />
                        {provider.config.api}
                      </span>
                      {provider.config.baseUrl && (
                        <span className="flex items-center gap-1 min-w-0">
                          <span className="h-1 w-1 rounded-full bg-muted-foreground/30 flex-none" />
                          <Info className="w-3 h-3 flex-none" />
                          <span className="truncate max-w-[200px] md:max-w-[300px]">
                            {provider.config.baseUrl}
                          </span>
                        </span>
                      )}
                      <span className="flex items-center gap-1 flex-none">
                        <span className="h-1 w-1 rounded-full bg-muted-foreground/30 flex-none" />
                        <Maximize2 className="w-3 h-3" />
                        {m.n_models_count({ count: provider.modelsCount })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-32">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          setProviderToDelete(provider)
                          setIsDeleteDialogOpen(true)
                        }}
                        className="text-destructive focus:text-destructive gap-2 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" /> {m.delete()}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <ChevronRight className="flex-none w-5 h-5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                </div>
              </CardContent>
            </Card>
          ))}

          {providers?.length === 0 && (
            <div className="text-center py-12 bg-muted/30 rounded-2xl border-2 border-dashed border-border">
              <Cpu className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <h4 className="text-foreground font-medium">{m.no_providers_configured()}</h4>
              <p className="text-sm text-muted-foreground mt-1">{m.add_first_provider()}</p>
            </div>
          )}

          {providers && providers.length > 0 && filteredProviders.length === 0 && (
            <div className="text-center py-12">
              <Search className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <h4 className="text-foreground font-medium">{m.no_matches_found()}</h4>
              <p className="text-sm text-muted-foreground mt-1">
                {m.try_adjusting_search({ query: searchQuery })}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery('')}
                className="mt-4 text-primary hover:text-primary/90 hover:bg-primary/10"
              >
                {m.clear_search()}
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>

      <CreateProviderDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSubmit={(values) => createMutation.mutate(values)}
        isLoading={createMutation.isPending}
        existingProviderNames={existingProviderNames}
      />

      {editingProvider && (
        <EditProviderDialog
          isOpen={!!editingProvider}
          onClose={() => setEditingProviderId(null)}
          provider={editingProvider}
          teamId={teamId}
          existingProviderNames={existingProviderNames}
        />
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.are_you_absolutely_sure()}</AlertDialogTitle>
            <AlertDialogDescription>
              {m.delete_provider_confirmation({ name: providerToDelete?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setProviderToDelete(null)}>
              {m.cancel()}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => {
                if (providerToDelete) {
                  deleteMutation.mutate(providerToDelete.id)
                }
              }}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              {m.delete()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Create Provider Dialog
// ---------------------------------------------------------------------------

interface CreateProviderDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (values: {
    name: string
    config: z.infer<typeof providerConfigSchema>
    models: ModelFormValues[]
  }) => void
  isLoading: boolean
  existingProviderNames: string[]
}

function CreateProviderDialog({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  existingProviderNames,
}: CreateProviderDialogProps) {
  const [initialModels, setInitialModels] = useState<ModelFormValues[]>([])
  const [isAddModelOpen, setIsAddModelOpen] = useState(false)
  const [editingModelIndex, setEditingModelIndex] = useState<number | null>(null)

  const schema = useMemo(() => {
    return z.object({
      name: z
        .string()
        .min(1, m.provider_name_is_required())
        .refine((name) => !existingProviderNames.includes(name), {
          message: m.provider_name_must_be_unique(),
        }),
      config: providerConfigSchema,
    })
  }, [existingProviderNames])

  const form = useForm({
    defaultValues: {
      name: '',
      config: {
        api: 'openai-completions',
        baseUrl: '',
        apiKey: '',
      },
    } as z.input<typeof schema>,
    validators: {
      onSubmit: schema,
    },
    onSubmit: async ({ value }) => {
      onSubmit({
        name: value.name,
        config: value.config as z.infer<typeof providerConfigSchema>,
        models: initialModels,
      })
    },
  })

  useEffect(() => {
    if (isOpen) {
      form.reset()
      setInitialModels([])
      setIsAddModelOpen(false)
      setEditingModelIndex(null)
    }
  }, [isOpen, form])

  const mapErrors = (errors: unknown[]) => {
    return errors.map((e) => {
      if (typeof e === 'string') return { message: e }
      if (e && typeof e === 'object' && 'message' in e) {
        return { message: String(e.message) }
      }
      return { message: String(e || '') }
    })
  }

  const handleSaveModel = (model: ModelFormValues) => {
    if (editingModelIndex !== null) {
      setInitialModels((prev) => prev.map((m, i) => (i === editingModelIndex ? model : m)))
      setEditingModelIndex(null)
    } else {
      // Prepend newly added model to the top
      setInitialModels((prev) => [model, ...prev])
      setIsAddModelOpen(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <DialogTitle className="text-xl">{m.add_new_provider()}</DialogTitle>
          <DialogDescription>{m.configure_provider_description()}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          className="flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="p-6 pt-2 space-y-6 pr-6">
                {/* General Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 rounded-2xl border bg-muted/20">
                  <form.Field
                    name="name"
                    children={(field) => {
                      const isInvalid =
                        !!field.state.meta.errors.length && field.state.meta.isTouched
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>{m.provider_name()}</FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder={m.provider_name_placeholder()}
                            aria-invalid={isInvalid}
                          />
                          {isInvalid && <FieldError errors={mapErrors(field.state.meta.errors)} />}
                        </Field>
                      )
                    }}
                  />

                  <form.Field
                    name="config.api"
                    children={(field) => {
                      const isInvalid =
                        !!field.state.meta.errors.length && field.state.meta.isTouched
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>{m.global_api_protocol()}</FieldLabel>
                          <Select
                            onValueChange={field.handleChange as (value: string) => void}
                            value={field.state.value}
                          >
                            <SelectTrigger id={field.name} aria-invalid={isInvalid}>
                              <SelectValue placeholder={m.select_api_protocol()} />
                            </SelectTrigger>
                            <SelectContent>
                              {KNOWN_APIS.map((api) => (
                                <SelectItem key={api} value={api}>
                                  {API_PROTOCOL_LABELS[api]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {isInvalid && <FieldError errors={mapErrors(field.state.meta.errors)} />}
                        </Field>
                      )
                    }}
                  />

                  <div className="md:col-span-2">
                    <form.Field
                      name="config.baseUrl"
                      children={(field) => {
                        const isInvalid =
                          !!field.state.meta.errors.length && field.state.meta.isTouched
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor={field.name}>{m.base_url_optional()}</FieldLabel>
                            <Input
                              id={field.name}
                              name={field.name}
                              value={field.state.value || ''}
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(e.target.value)}
                              placeholder="https://api.openai.com/v1"
                              aria-invalid={isInvalid}
                            />
                            <FieldDescription>{m.override_default_endpoint()}</FieldDescription>
                            {isInvalid && (
                              <FieldError errors={mapErrors(field.state.meta.errors)} />
                            )}
                          </Field>
                        )
                      }}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <form.Field
                      name="config.apiKey"
                      children={(field) => {
                        const isInvalid =
                          !!field.state.meta.errors.length && field.state.meta.isTouched
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor={field.name}>{m.api_key()}</FieldLabel>
                            <Input
                              id={field.name}
                              name={field.name}
                              type="text"
                              value={field.state.value || ''}
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(e.target.value)}
                              placeholder={m.api_key_placeholder()}
                              aria-invalid={isInvalid}
                            />
                            <FieldDescription className="text-xs mt-1">
                              {m.api_key_description()}
                            </FieldDescription>
                            {isInvalid && (
                              <FieldError errors={mapErrors(field.state.meta.errors)} />
                            )}
                          </Field>
                        )
                      }}
                    />
                  </div>
                </div>

                {/* Initial Models Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-semibold">{m.models()}</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {m.models_configuration()}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAddModelOpen(true)}
                      className="gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      {m.add_model()}
                    </Button>
                  </div>

                  {initialModels.length === 0 ? (
                    <div className="text-center py-8 rounded-xl border border-dashed text-muted-foreground text-sm">
                      {m.no_models_found()}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {initialModels.map((model, idx) => (
                        <div
                          key={model.modelId + idx}
                          className="flex items-center justify-between p-3 rounded-xl border bg-card hover:border-primary/40 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground truncate">
                                {model.name || model.modelId}
                              </span>
                              <Badge variant="secondary" className="font-mono text-[10px]">
                                {model.modelId}
                              </Badge>
                              {model.config.reasoning && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] gap-1 bg-primary/10 text-primary border-primary/20"
                                >
                                  <Zap className="w-2.5 h-2.5" /> {m.reasoning_support()}
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                              <span>
                                {model.config.contextWindow?.toLocaleString()} {m.tokens()}
                              </span>
                              <span>·</span>
                              <span>
                                ${model.config.cost?.input}/1M in · ${model.config.cost?.output}/1M
                                out
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => setEditingModelIndex(idx)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() =>
                                setInitialModels((prev) => prev.filter((_, i) => i !== idx))
                              }
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </div>

          <DialogFooter className="p-6 pt-4 border-t border-border gap-2 shrink-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              {m.cancel()}
            </Button>
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
              children={([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  className="min-w-[120px]"
                  disabled={!canSubmit || isSubmitting || isLoading}
                >
                  {isSubmitting || isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    m.add_provider()
                  )}
                </Button>
              )}
            />
          </DialogFooter>
        </form>

        {/* Sub-dialog for adding/editing a model */}
        <ModelFormDialog
          isOpen={isAddModelOpen || editingModelIndex !== null}
          onClose={() => {
            setIsAddModelOpen(false)
            setEditingModelIndex(null)
          }}
          onSubmit={handleSaveModel}
          title={editingModelIndex !== null ? m.edit_model() : m.add_model()}
          initialValues={editingModelIndex !== null ? initialModels[editingModelIndex] : null}
          defaultApi={form.getFieldValue('config.api') as string}
          existingModelIds={initialModels
            .filter((_, i) => i !== editingModelIndex)
            .map((m) => m.modelId)}
        />
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Edit Provider Dialog (Tabs: General Settings & Models)
// ---------------------------------------------------------------------------

interface EditProviderDialogProps {
  isOpen: boolean
  onClose: () => void
  provider: Provider
  teamId: string
  existingProviderNames: string[]
}

const PAGE_SIZE = 20

function EditProviderDialog({
  isOpen,
  onClose,
  provider,
  teamId,
  existingProviderNames,
}: EditProviderDialogProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'general' | 'models'>('general')
  const [modelsSearchQuery, setModelsSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  // Sub-dialogs state
  const [isAddModelOpen, setIsAddModelOpen] = useState(false)
  const [editingModel, setEditingModel] = useState<ProviderModelItem | null>(null)
  const [modelToDelete, setModelToDelete] = useState<ProviderModelItem | null>(null)

  // Fetch models for this provider
  const { data: models = [], isLoading: isModelsLoading } = useQuery({
    queryKey: ['teams', teamId, 'providers', provider.id, 'models'],
    queryFn: async () => {
      const res = await client.api.providers[':id'].models.$get({
        param: { id: provider.id },
      })
      if (!res.ok) throw new Error('Failed to fetch models')
      return await res.json()
    },
    enabled: isOpen,
  })

  // Mutations
  const updateProviderMutation = useMutation({
    mutationFn: async (values: { name: string; config: z.infer<typeof providerConfigSchema> }) => {
      const res = await client.api.providers[':id'].$put({
        param: { id: provider.id },
        json: {
          name: values.name,
          config: values.config,
        },
      })
      if (!res.ok) throw new Error('Failed to update provider')
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'providers'] })
      toast.success(m.provider_updated_successfully())
    },
    onError: (error) => {
      toast.error(m.error_message({ message: error.message }))
    },
  })

  const createModelMutation = useMutation({
    mutationFn: async (values: ModelFormValues) => {
      const res = await client.api.providers[':id'].models.$post({
        param: { id: provider.id },
        json: values,
      })
      if (!res.ok) throw new Error('Failed to create model')
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['teams', teamId, 'providers', provider.id, 'models'],
      })
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'providers'] })
      setIsAddModelOpen(false)
      setCurrentPage(1)
      toast.success(m.model_created_successfully())
    },
    onError: (error) => {
      toast.error(m.error_message({ message: error.message }))
    },
  })

  const updateModelMutation = useMutation({
    mutationFn: async ({ modelDbId, values }: { modelDbId: string; values: ModelFormValues }) => {
      const res = await client.api.providers[':id'].models[':modelDbId'].$put({
        param: { id: provider.id, modelDbId },
        json: values,
      })
      if (!res.ok) throw new Error('Failed to update model')
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['teams', teamId, 'providers', provider.id, 'models'],
      })
      setEditingModel(null)
      toast.success(m.model_updated_successfully())
    },
    onError: (error) => {
      toast.error(m.error_message({ message: error.message }))
    },
  })

  const deleteModelMutation = useMutation({
    mutationFn: async (modelDbId: string) => {
      const res = await client.api.providers[':id'].models[':modelDbId'].$delete({
        param: { id: provider.id, modelDbId },
      })
      if (!res.ok) throw new Error('Failed to delete model')
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['teams', teamId, 'providers', provider.id, 'models'],
      })
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'providers'] })
      setModelToDelete(null)
      toast.success(m.model_deleted_successfully())
    },
    onError: (error) => {
      toast.error(m.error_message({ message: error.message }))
    },
  })

  // General Settings Form
  const generalSchema = useMemo(() => {
    return z.object({
      name: z
        .string()
        .min(1, m.provider_name_is_required())
        .refine(
          (name) => {
            if (provider.name === name) return true
            return !existingProviderNames.includes(name)
          },
          { message: m.provider_name_must_be_unique() },
        ),
      config: providerConfigSchema,
    })
  }, [existingProviderNames, provider.name])

  const form = useForm({
    defaultValues: {
      name: provider.name,
      config: provider.config,
    } as z.input<typeof generalSchema>,
    validators: {
      onSubmit: generalSchema,
    },
    onSubmit: async ({ value }) => {
      updateProviderMutation.mutate({
        name: value.name,
        config: value.config as z.infer<typeof providerConfigSchema>,
      })
    },
  })

  useEffect(() => {
    if (isOpen) {
      form.reset()
      setActiveTab('general')
      setModelsSearchQuery('')
      setCurrentPage(1)
    }
  }, [isOpen, form])

  const mapErrors = (errors: unknown[]) => {
    return errors.map((e) => {
      if (typeof e === 'string') return { message: e }
      if (e && typeof e === 'object' && 'message' in e) {
        return { message: String(e.message) }
      }
      return { message: String(e || '') }
    })
  }

  // Filtered and paginated models
  const filteredModels = useMemo(() => {
    if (!modelsSearchQuery.trim()) return models
    const query = modelsSearchQuery.toLowerCase()
    return models.filter(
      (m) => m.modelId.toLowerCase().includes(query) || m.name?.toLowerCase().includes(query),
    )
  }, [models, modelsSearchQuery])

  const totalPages = Math.ceil(filteredModels.length / PAGE_SIZE) || 1
  const displayedModels = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredModels.slice(start, start + PAGE_SIZE)
  }, [filteredModels, currentPage])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl h-[88vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <DialogTitle className="text-xl">{m.edit_item({ name: provider.name })}</DialogTitle>
          <DialogDescription>{m.configure_provider_description()}</DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as 'general' | 'models')}
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="px-6 pb-2 shrink-0">
            <TabsList>
              <TabsTrigger value="general">{m.general_settings()}</TabsTrigger>
              <TabsTrigger value="models" className="gap-2">
                {m.models()}
                <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
                  {models.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab 1: General Settings */}
          <TabsContent value="general" className="flex-1 flex flex-col min-h-0 m-0">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                e.stopPropagation()
                form.handleSubmit()
              }}
              className="flex-1 flex flex-col min-h-0"
            >
              <div className="flex-1 min-h-0">
                <ScrollArea className="h-full">
                  <div className="p-6 space-y-6 pr-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5 rounded-2xl border bg-muted/10">
                      <form.Field
                        name="name"
                        children={(field) => {
                          const isInvalid =
                            !!field.state.meta.errors.length && field.state.meta.isTouched
                          return (
                            <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>{m.provider_name()}</FieldLabel>
                              <Input
                                id={field.name}
                                name={field.name}
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => field.handleChange(e.target.value)}
                                placeholder={m.provider_name_placeholder()}
                                aria-invalid={isInvalid}
                              />
                              {isInvalid && (
                                <FieldError errors={mapErrors(field.state.meta.errors)} />
                              )}
                            </Field>
                          )
                        }}
                      />

                      <form.Field
                        name="config.api"
                        children={(field) => {
                          const isInvalid =
                            !!field.state.meta.errors.length && field.state.meta.isTouched
                          return (
                            <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>
                                {m.global_api_protocol()}
                              </FieldLabel>
                              <Select
                                onValueChange={field.handleChange as (value: string) => void}
                                value={field.state.value}
                              >
                                <SelectTrigger id={field.name} aria-invalid={isInvalid}>
                                  <SelectValue placeholder={m.select_api_protocol()} />
                                </SelectTrigger>
                                <SelectContent>
                                  {KNOWN_APIS.map((api) => (
                                    <SelectItem key={api} value={api}>
                                      {API_PROTOCOL_LABELS[api]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {isInvalid && (
                                <FieldError errors={mapErrors(field.state.meta.errors)} />
                              )}
                            </Field>
                          )
                        }}
                      />

                      <div className="md:col-span-2">
                        <form.Field
                          name="config.baseUrl"
                          children={(field) => {
                            const isInvalid =
                              !!field.state.meta.errors.length && field.state.meta.isTouched
                            return (
                              <Field data-invalid={isInvalid}>
                                <FieldLabel htmlFor={field.name}>
                                  {m.base_url_optional()}
                                </FieldLabel>
                                <Input
                                  id={field.name}
                                  name={field.name}
                                  value={field.state.value || ''}
                                  onBlur={field.handleBlur}
                                  onChange={(e) => field.handleChange(e.target.value)}
                                  placeholder="https://api.openai.com/v1"
                                  aria-invalid={isInvalid}
                                />
                                <FieldDescription>{m.override_default_endpoint()}</FieldDescription>
                                {isInvalid && (
                                  <FieldError errors={mapErrors(field.state.meta.errors)} />
                                )}
                              </Field>
                            )
                          }}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <form.Field
                          name="config.apiKey"
                          children={(field) => {
                            const isInvalid =
                              !!field.state.meta.errors.length && field.state.meta.isTouched
                            return (
                              <Field data-invalid={isInvalid}>
                                <FieldLabel htmlFor={field.name}>{m.api_key()}</FieldLabel>
                                <Input
                                  id={field.name}
                                  name={field.name}
                                  type="text"
                                  value={field.state.value || ''}
                                  onBlur={field.handleBlur}
                                  onChange={(e) => field.handleChange(e.target.value)}
                                  placeholder={m.api_key_placeholder()}
                                  aria-invalid={isInvalid}
                                />
                                <FieldDescription className="text-xs mt-1">
                                  {m.api_key_description()}
                                </FieldDescription>
                                {isInvalid && (
                                  <FieldError errors={mapErrors(field.state.meta.errors)} />
                                )}
                              </Field>
                            )
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </div>

              <DialogFooter className="p-6 pt-4 border-t border-border gap-2 shrink-0">
                <Button type="button" variant="outline" onClick={onClose}>
                  {m.cancel()}
                </Button>
                <form.Subscribe
                  selector={(state) => [state.canSubmit, state.isSubmitting]}
                  children={([canSubmit, isSubmitting]) => (
                    <Button
                      type="submit"
                      className="min-w-[120px]"
                      disabled={!canSubmit || isSubmitting || updateProviderMutation.isPending}
                    >
                      {isSubmitting || updateProviderMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        m.save_changes()
                      )}
                    </Button>
                  )}
                />
              </DialogFooter>
            </form>
          </TabsContent>

          {/* Tab 2: Models Management */}
          <TabsContent value="models" className="flex-1 flex flex-col min-h-0 m-0">
            {/* Search and Add Header */}
            <div className="p-6 pb-3 flex items-center justify-between gap-3 shrink-0">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={m.search_models_placeholder()}
                  value={modelsSearchQuery}
                  onChange={(e) => {
                    setModelsSearchQuery(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="pl-9 h-9"
                />
              </div>

              <Button
                size="sm"
                onClick={() => setIsAddModelOpen(true)}
                className="gap-1.5 shrink-0"
              >
                <Plus className="w-4 h-4" />
                {m.add_model()}
              </Button>
            </div>

            {/* Models List */}
            <div className="flex-1 min-h-0 px-6">
              <ScrollArea className="h-full pr-4">
                {isModelsLoading ? (
                  <div className="flex h-48 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : displayedModels.length === 0 ? (
                  <div className="text-center py-12 border border-dashed rounded-xl text-muted-foreground text-sm">
                    {m.no_models_found()}
                  </div>
                ) : (
                  <div className="space-y-2 pb-4">
                    {displayedModels.map((model) => (
                      <div
                        key={model.id}
                        className="group flex items-center justify-between p-3.5 rounded-xl border bg-card hover:border-primary/40 transition-colors"
                      >
                        <div className="min-w-0 flex-1 pr-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground text-sm">
                              {model.name || model.modelId}
                            </span>
                            <Badge
                              variant="secondary"
                              className="font-mono text-[10px] px-1.5 py-0.5"
                            >
                              {model.modelId}
                            </Badge>
                            {model.config?.reasoning && (
                              <Badge
                                variant="outline"
                                className="text-[10px] gap-1 bg-primary/10 text-primary border-primary/20 h-5"
                              >
                                <Zap className="w-2.5 h-2.5" /> {m.reasoning_support()}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span>
                              {model.config?.contextWindow?.toLocaleString()} {m.tokens()}
                            </span>
                            <span>·</span>
                            <span>max {model.config?.maxTokens?.toLocaleString()}</span>
                            <span>·</span>
                            <span>
                              ${model.config?.cost?.input ?? 0}/1M in · $
                              {model.config?.cost?.output ?? 0}/1M out
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => setEditingModel(model)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setModelToDelete(model)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-border flex items-center justify-between shrink-0 px-6">
                <span className="text-xs text-muted-foreground">
                  {m.page_info({ current: currentPage, total: totalPages })}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="h-8 gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    {m.previous()}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="h-8 gap-1"
                  >
                    {m.next()}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Sub-dialog for adding a new model */}
        {isAddModelOpen && (
          <ModelFormDialog
            isOpen={isAddModelOpen}
            onClose={() => setIsAddModelOpen(false)}
            onSubmit={(values) => createModelMutation.mutate(values)}
            title={m.add_model()}
            isLoading={createModelMutation.isPending}
            defaultApi={provider.config.api}
            existingModelIds={models.map((m) => m.modelId)}
          />
        )}

        {/* Sub-dialog for editing an existing model */}
        {editingModel && (
          <ModelFormDialog
            isOpen={!!editingModel}
            onClose={() => setEditingModel(null)}
            onSubmit={(values) =>
              updateModelMutation.mutate({ modelDbId: editingModel.id, values })
            }
            title={m.edit_model()}
            isLoading={updateModelMutation.isPending}
            initialValues={{
              modelId: editingModel.modelId,
              name: editingModel.name,
              config: editingModel.config,
            }}
            defaultApi={provider.config.api}
            existingModelIds={models.filter((m) => m.id !== editingModel.id).map((m) => m.modelId)}
          />
        )}

        {/* Alert Dialog for confirming model deletion */}
        <AlertDialog
          open={!!modelToDelete}
          onOpenChange={(open) => !open && setModelToDelete(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{m.are_you_absolutely_sure()}</AlertDialogTitle>
              <AlertDialogDescription>
                {m.delete_model_confirmation({
                  name: modelToDelete?.name || modelToDelete?.modelId || '',
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setModelToDelete(null)}>
                {m.cancel()}
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                onClick={() => {
                  if (modelToDelete) {
                    deleteModelMutation.mutate(modelToDelete.id)
                  }
                }}
              >
                {deleteModelMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                {m.delete()}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  )
}
