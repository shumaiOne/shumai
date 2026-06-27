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
import { Switch } from '@/ui/components/ui/switch'
import { providerConfigSchema, providerModelSchema, KNOWN_APIS } from '@shumai/dtos'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { InferResponseType } from 'hono/client'
import {
  ChevronRight,
  Cpu,
  DollarSign,
  Globe,
  Info,
  Loader2,
  Maximize2,
  MoreVertical,
  Plus,
  Search,
  Trash2,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { m } from '@/ui/paraglide/messages.js'

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

const providerFormSchemaBase = z.object({
  name: z.string().min(1, m.provider_name_is_required()),
  config: providerConfigSchema,
  models: z.array(providerModelSchema).min(1, m.at_least_one_model_required()),
})

type ProviderFormValues = z.infer<typeof providerFormSchemaBase>

type ProvidersResponse = InferResponseType<
  (typeof client.api.teams)[':teamId']['providers']['$get']
>
type Provider = ProvidersResponse[number]

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

  // Fetch models for editing
  const { data: editingModels, isLoading: isModelsLoading } = useQuery({
    queryKey: ['teams', teamId, 'providers', editingProviderId, 'models'],
    queryFn: async () => {
      const res = await client.api.providers[':id'].models.$get({
        param: { id: editingProviderId! },
      })
      if (!res.ok) throw new Error('Failed to fetch models')
      return await res.json()
    },
    enabled: !!editingProviderId,
  })

  const existingProviderNames = useMemo(() => providers?.map((p) => p.name) || [], [providers])

  const filteredProviders = useMemo(() => {
    if (!providers) return []
    if (!searchQuery.trim()) return providers
    const query = searchQuery.toLowerCase()
    return providers.filter((p) => p.name.toLowerCase().includes(query))
  }, [providers, searchQuery])

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: async (values: ProviderFormValues) => {
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

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: ProviderFormValues }) => {
      const res = await client.api.providers[':id'].$put({
        param: { id },
        json: {
          config: values.config,
          models: values.models,
        },
      })
      if (!res.ok) throw new Error('Failed to update provider')
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'providers'] })
      setEditingProviderId(null)
      toast.success(m.provider_updated_successfully())
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
                      {provider.isBuiltin && (
                        <Badge
                          variant="secondary"
                          className="flex-none text-[10px] uppercase tracking-wider font-bold h-5"
                        >
                          {m.built_in()}
                        </Badge>
                      )}
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
                        {editingProviderId === provider.id && isModelsLoading && (
                          <Loader2 className="w-3 h-3 animate-spin ml-1" />
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <DropdownMenu>
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

      <ProviderFormDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSubmit={(values) => createMutation.mutate(values)}
        isLoading={createMutation.isPending}
        title={m.add_new_provider()}
        existingProviderNames={existingProviderNames}
      />

      <ProviderFormDialog
        isOpen={!!editingProvider && !isModelsLoading && !!editingModels}
        onClose={() => setEditingProviderId(null)}
        onSubmit={(values) => updateMutation.mutate({ id: editingProvider!.id, values })}
        onDelete={() => deleteMutation.mutate(editingProvider!.id)}
        isLoading={updateMutation.isPending || deleteMutation.isPending}
        initialValues={
          editingProvider && editingModels
            ? {
                name: editingProvider.name,
                config: editingProvider.config,
                models: editingModels,
              }
            : undefined
        }
        isBuiltin={editingProvider?.isBuiltin}
        title={editingProvider ? m.edit_item({ name: editingProvider.name }) : ''}
        existingProviderNames={existingProviderNames}
      />
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

interface ProviderFormDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (values: ProviderFormValues) => void
  onDelete?: () => void
  isLoading: boolean
  initialValues?: ProviderFormValues
  isBuiltin?: boolean
  title: string
  existingProviderNames: string[]
}

function ProviderFormDialog({
  isOpen,
  onClose,
  onSubmit,
  onDelete,
  isLoading,
  initialValues,
  isBuiltin,
  title,
  existingProviderNames,
}: ProviderFormDialogProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const schema = useMemo(() => {
    return providerFormSchemaBase.extend({
      name: z
        .string()
        .min(1, 'Provider name is required')
        .refine(
          (name) => {
            if (initialValues?.name === name) return true
            return !existingProviderNames.includes(name)
          },
          { message: 'Provider name must be unique' },
        ),
    })
  }, [existingProviderNames, initialValues])

  const form = useForm({
    defaultValues: (initialValues || {
      name: '',
      config: {
        api: 'openai-completions',
        baseUrl: '',
        apiKey: '',
      },
      models: [
        {
          modelId: '',
          name: '',
          config: {
            api: 'openai-completions',
            reasoning: false,
            input: ['text'],
            contextWindow: 128000,
            maxTokens: 4096,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          },
        },
      ],
    }) as z.input<typeof schema>,
    validators: {
      onChange: schema,
    },
    onSubmit: async ({ value }) => {
      onSubmit(value as ProviderFormValues)
    },
  })

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      form.reset()
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <DialogTitle className="text-xl">{title}</DialogTitle>
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
              <div className="p-6 pt-2 space-y-8 pr-6">
                {/* Row 1: Basic Config */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-2xl border">
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
                            disabled={isBuiltin}
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
                            disabled={isBuiltin}
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
                </div>

                {/* Row 2: API Key Card */}
                <Card className="rounded-2xl border bg-transparent">
                  <CardContent className="p-6 pt-2">
                    <form.Field
                      name="config.apiKey"
                      children={(field) => {
                        const isInvalid =
                          !!field.state.meta.errors.length && field.state.meta.isTouched
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor={field.name} className="text-base font-semibold">
                              {m.api_key()}
                            </FieldLabel>
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
                            <FieldDescription className="text-xs mt-2">
                              {m.api_key_description()}
                            </FieldDescription>
                            {isInvalid && (
                              <FieldError errors={mapErrors(field.state.meta.errors)} />
                            )}
                          </Field>
                        )
                      }}
                    />
                  </CardContent>
                </Card>

                {/* Models Section */}
                <div className="space-y-4">
                  <form.Field
                    name="models"
                    mode="array"
                    children={(modelsField) => (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-lg font-bold">{m.models_configuration()}</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              modelsField.pushValue({
                                modelId: '',
                                name: '',
                                config: {
                                  api: form.getFieldValue('config.api'),
                                  reasoning: false,
                                  input: ['text'],
                                  contextWindow: 128000,
                                  maxTokens: 4096,
                                  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                                },
                              })
                            }
                            className="gap-2"
                          >
                            <Plus className="w-4 h-4" />
                            {m.add_model()}
                          </Button>
                        </div>

                        <div className="space-y-6">
                          {modelsField.state.value.map((_, index) => (
                            <div
                              key={index}
                              className="group relative p-6 bg-transparent rounded-2xl border shadow-sm animate-in fade-in zoom-in-95 duration-300"
                            >
                              {/* Row 1: ID and Name */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <form.Field
                                  name={`models[${index}].modelId`}
                                  children={(field) => {
                                    const isInvalid =
                                      !!field.state.meta.errors.length && field.state.meta.isTouched
                                    return (
                                      <Field data-invalid={isInvalid}>
                                        <FieldLabel htmlFor={field.name}>{m.model_id()}</FieldLabel>
                                        <Input
                                          id={field.name}
                                          name={field.name}
                                          value={field.state.value}
                                          onBlur={field.handleBlur}
                                          onChange={(e) => field.handleChange(e.target.value)}
                                          placeholder="gpt-4o"
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
                                  name={`models[${index}].name`}
                                  children={(field) => {
                                    const isInvalid =
                                      !!field.state.meta.errors.length && field.state.meta.isTouched
                                    return (
                                      <Field data-invalid={isInvalid}>
                                        <FieldLabel htmlFor={field.name}>
                                          {m.display_name_optional()}
                                        </FieldLabel>
                                        <Input
                                          id={field.name}
                                          name={field.name}
                                          value={field.state.value}
                                          onBlur={field.handleBlur}
                                          onChange={(e) => field.handleChange(e.target.value)}
                                          placeholder="e.g., GPT-4o"
                                          aria-invalid={isInvalid}
                                          disabled={isBuiltin}
                                        />
                                        {isInvalid && (
                                          <FieldError errors={mapErrors(field.state.meta.errors)} />
                                        )}
                                      </Field>
                                    )
                                  }}
                                />
                              </div>

                              {/* Row 2: Reasoning and Context Window */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                <form.Field
                                  name={`models[${index}].config.reasoning`}
                                  children={(field) => (
                                    <Field
                                      orientation="horizontal"
                                      className="rounded-lg border border-border p-3 shadow-sm bg-muted/50 justify-between"
                                    >
                                      <FieldLabel htmlFor={field.name}>
                                        {m.reasoning_support()}
                                      </FieldLabel>
                                      <Switch
                                        id={field.name}
                                        checked={field.state.value}
                                        onCheckedChange={field.handleChange}
                                        disabled={isBuiltin}
                                      />
                                    </Field>
                                  )}
                                />
                                <form.Field
                                  name={`models[${index}].config.contextWindow`}
                                  children={(field) => {
                                    const isInvalid =
                                      !!field.state.meta.errors.length && field.state.meta.isTouched
                                    return (
                                      <Field data-invalid={isInvalid}>
                                        <FieldLabel htmlFor={field.name} className="text-xs">
                                          {m.context_window_tokens()}
                                        </FieldLabel>
                                        <Input
                                          id={field.name}
                                          name={field.name}
                                          type="number"
                                          value={field.state.value}
                                          onBlur={field.handleBlur}
                                          onChange={(e) =>
                                            field.handleChange(parseInt(e.target.value) || 0)
                                          }
                                          aria-invalid={isInvalid}
                                          disabled={isBuiltin}
                                        />
                                        {isInvalid && (
                                          <FieldError errors={mapErrors(field.state.meta.errors)} />
                                        )}
                                      </Field>
                                    )
                                  }}
                                />
                              </div>

                              {/* Row 3: Constraints and Cost */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                                <form.Field
                                  name={`models[${index}].config.maxTokens`}
                                  children={(field) => {
                                    const isInvalid =
                                      !!field.state.meta.errors.length && field.state.meta.isTouched
                                    return (
                                      <Field data-invalid={isInvalid}>
                                        <FieldLabel htmlFor={field.name} className="text-xs">
                                          {m.max_output_tokens()}
                                        </FieldLabel>
                                        <Input
                                          id={field.name}
                                          name={field.name}
                                          type="number"
                                          value={field.state.value}
                                          onBlur={field.handleBlur}
                                          onChange={(e) =>
                                            field.handleChange(parseInt(e.target.value) || 0)
                                          }
                                          aria-invalid={isInvalid}
                                          disabled={isBuiltin}
                                        />
                                        {isInvalid && (
                                          <FieldError errors={mapErrors(field.state.meta.errors)} />
                                        )}
                                      </Field>
                                    )
                                  }}
                                />
                                <form.Field
                                  name={`models[${index}].config.cost.input`}
                                  children={(field) => {
                                    const isInvalid =
                                      !!field.state.meta.errors.length && field.state.meta.isTouched
                                    return (
                                      <Field data-invalid={isInvalid}>
                                        <FieldLabel
                                          htmlFor={field.name}
                                          className="text-xs flex items-center gap-1"
                                        >
                                          <DollarSign className="w-3 h-3" /> {m.input_cost_1m()}
                                        </FieldLabel>
                                        <Input
                                          id={field.name}
                                          name={field.name}
                                          type="number"
                                          step="0.01"
                                          value={field.state.value}
                                          onBlur={field.handleBlur}
                                          onChange={(e) =>
                                            field.handleChange(parseFloat(e.target.value) || 0)
                                          }
                                          aria-invalid={isInvalid}
                                          disabled={isBuiltin}
                                        />
                                        {isInvalid && (
                                          <FieldError errors={mapErrors(field.state.meta.errors)} />
                                        )}
                                      </Field>
                                    )
                                  }}
                                />
                                <form.Field
                                  name={`models[${index}].config.cost.output`}
                                  children={(field) => {
                                    const isInvalid =
                                      !!field.state.meta.errors.length && field.state.meta.isTouched
                                    return (
                                      <Field data-invalid={isInvalid}>
                                        <FieldLabel
                                          htmlFor={field.name}
                                          className="text-xs flex items-center gap-1"
                                        >
                                          <DollarSign className="w-3 h-3" /> {m.output_cost_1m()}
                                        </FieldLabel>
                                        <Input
                                          id={field.name}
                                          name={field.name}
                                          type="number"
                                          step="0.01"
                                          value={field.state.value}
                                          onBlur={field.handleBlur}
                                          onChange={(e) =>
                                            field.handleChange(parseFloat(e.target.value) || 0)
                                          }
                                          aria-invalid={isInvalid}
                                          disabled={isBuiltin}
                                        />
                                        {isInvalid && (
                                          <FieldError errors={mapErrors(field.state.meta.errors)} />
                                        )}
                                      </Field>
                                    )
                                  }}
                                />
                              </div>

                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-background border border-border text-muted-foreground hover:text-destructive transition-colors shadow-sm"
                                onClick={() => modelsField.removeValue(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  />
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
                    m.save_configuration()
                  )}
                </Button>
              )}
            />
          </DialogFooter>
        </form>
      </DialogContent>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.are_you_absolutely_sure()}</AlertDialogTitle>
            <AlertDialogDescription>
              {m.delete_provider_confirmation({ name: initialValues?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)}>
              {m.cancel()}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => {
                onDelete?.()
                setIsDeleteDialogOpen(false)
              }}
            >
              {m.delete()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
