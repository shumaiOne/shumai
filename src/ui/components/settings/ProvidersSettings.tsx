import { client } from '@/ui/api/client'
import { Card, CardContent } from '@/ui/components/ui/card'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import { Field, FieldLabel, FieldDescription, FieldError } from '@/ui/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/ui/select'
import { Switch } from '@/ui/components/ui/switch'
import { Badge } from '@/ui/components/ui/badge'
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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/components/ui/dropdown-menu'
import {
  Loader2,
  Plus,
  Trash2,
  Cpu,
  Globe,
  ChevronRight,
  Info,
  DollarSign,
  Maximize2,
  Zap,
  Search,
  MoreVertical,
} from 'lucide-react'
import { useState, useMemo, useEffect } from 'react'
import { toast } from 'sonner'
import { InferResponseType } from 'hono/client'
import { providerConfigSchema, providerModelSchema } from '@/dtos/provider'
import { z } from 'zod'

const providerFormSchemaBase = z.object({
  name: z.string().min(1, 'Provider name is required'),
  config: providerConfigSchema,
  models: z.array(providerModelSchema).min(1, 'At least one model is required'),
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
      const res = await client.api.teams[':teamId'].providers[':id'].models.$get({
        param: { teamId, id: editingProviderId! },
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
      toast.success('Provider created successfully')
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`)
    },
  })

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: ProviderFormValues }) => {
      const res = await client.api.teams[':teamId'].providers[':id'].$put({
        param: { teamId, id },
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
      toast.success('Provider updated successfully')
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`)
    },
  })

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await client.api.teams[':teamId'].providers[':id'].$delete({
        param: { teamId, id },
      })
      if (!res.ok) throw new Error('Failed to delete provider')
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'providers'] })
      setEditingProviderId(null)
      setIsDeleteDialogOpen(false)
      setProviderToDelete(null)
      toast.success('Provider deleted successfully')
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`)
    },
  })

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col space-y-0">
      <div className="flex-none space-y-4 pb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-blue-600" />
            Configured AI Providers
          </h3>
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Provider
          </Button>
        </div>

        <div className="relative px-0.5">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search providers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-0"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 min-h-0 overflow-x-hidden">
        <div className="grid grid-cols-1 gap-4 py-2">
          {filteredProviders.map((provider) => (
            <Card
              key={provider.id}
              className="group cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-all hover:shadow-md overflow-hidden"
              onClick={() => setEditingProviderId(provider.id)}
            >
              <CardContent className="p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="flex-none p-3 bg-slate-100 dark:bg-slate-800 rounded-xl group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors">
                    <Globe className="w-6 h-6 text-slate-600 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white truncate">
                        {provider.name}
                      </span>
                      {provider.isBuiltin && (
                        <Badge
                          variant="secondary"
                          className="flex-none text-[10px] uppercase tracking-wider font-bold h-5"
                        >
                          Built-in
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500 mt-1">
                      <span className="flex items-center gap-1 flex-none">
                        <Zap className="w-3 h-3" />
                        {provider.config.api}
                      </span>
                      {provider.config.baseUrl && (
                        <span className="flex items-center gap-1 min-w-0">
                          <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700 flex-none" />
                          <Info className="w-3 h-3 flex-none" />
                          <span className="truncate max-w-[200px] md:max-w-[300px]">
                            {provider.config.baseUrl}
                          </span>
                        </span>
                      )}
                      <span className="flex items-center gap-1 flex-none">
                        <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700 flex-none" />
                        <Maximize2 className="w-3 h-3" />
                        {provider.modelsCount} Models
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
                        className="h-8 w-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-32">
                      <DropdownMenuItem
                        disabled={provider.isBuiltin}
                        onClick={(e) => {
                          e.stopPropagation()
                          setProviderToDelete(provider)
                          setIsDeleteDialogOpen(true)
                        }}
                        className="text-red-500 focus:text-red-500 gap-2 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <ChevronRight className="flex-none w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                </div>
              </CardContent>
            </Card>
          ))}

          {providers?.length === 0 && (
            <div className="text-center py-12 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
              <Cpu className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h4 className="text-slate-900 dark:text-white font-medium">
                No Providers Configured
              </h4>
              <p className="text-sm text-slate-500 mt-1">
                Add your first AI provider to get started.
              </p>
            </div>
          )}

          {providers && providers.length > 0 && filteredProviders.length === 0 && (
            <div className="text-center py-12">
              <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h4 className="text-slate-900 dark:text-white font-medium">No matches found</h4>
              <p className="text-sm text-slate-500 mt-1">
                Try adjusting your search for "{searchQuery}"
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery('')}
                className="mt-4 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                Clear search
              </Button>
            </div>
          )}
        </div>
      </div>

      <ProviderFormDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSubmit={(values) => createMutation.mutate(values)}
        isLoading={createMutation.isPending}
        title="Add New Provider"
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
        title={`Edit ${editingProvider?.name}`}
        existingProviderNames={existingProviderNames}
      />
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the provider "
              {providerToDelete?.name}" and all associated model configurations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setProviderToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
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
              Delete
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
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-xl">{title}</DialogTitle>
          <DialogDescription>
            Configure authentication and model details for your AI provider.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-8">
            {/* Row 1: Basic Config */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <form.Field
                name="name"
                children={(field) => {
                  const isInvalid = !!field.state.meta.errors.length && field.state.meta.isTouched
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Provider Name</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="e.g., My OpenAI"
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
                  const isInvalid = !!field.state.meta.errors.length && field.state.meta.isTouched
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Global API Protocol</FieldLabel>
                      <Select
                        onValueChange={field.handleChange}
                        value={field.state.value}
                        disabled={isBuiltin}
                      >
                        <SelectTrigger id={field.name} aria-invalid={isInvalid}>
                          <SelectValue placeholder="Select API Protocol" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="openai-completions">OpenAI Completions</SelectItem>
                          <SelectItem value="anthropic-messages">Anthropic Messages</SelectItem>
                          <SelectItem value="google-genai">Google GenAI</SelectItem>
                          <SelectItem value="bedrock-converse-stream">AWS Bedrock</SelectItem>
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
                    const isInvalid = !!field.state.meta.errors.length && field.state.meta.isTouched
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>Base URL (Optional)</FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          value={field.state.value || ''}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="https://api.openai.com/v1"
                          aria-invalid={isInvalid}
                        />
                        <FieldDescription>Override the default endpoint.</FieldDescription>
                        {isInvalid && <FieldError errors={mapErrors(field.state.meta.errors)} />}
                      </Field>
                    )
                  }}
                />
              </div>
            </div>

            {/* Row 2: API Key Card */}
            <Card className="bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <CardContent className="p-6">
                <form.Field
                  name="config.apiKey"
                  children={(field) => {
                    const isInvalid = !!field.state.meta.errors.length && field.state.meta.isTouched
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name} className="text-base font-semibold">
                          API Key
                        </FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          type="text"
                          value={field.state.value || ''}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="Enter API Key or Environment Variable"
                          aria-invalid={isInvalid}
                        />
                        <FieldDescription className="text-xs mt-2">
                          You can provide a literal value (e.g.{' '}
                          <code className="bg-slate-200 dark:bg-slate-800 px-1 rounded text-blue-600 dark:text-blue-400">
                            sk-...
                          </code>
                          ) or an Environment variable name (e.g.{' '}
                          <code className="bg-slate-200 dark:bg-slate-800 px-1 rounded text-blue-600 dark:text-blue-400">
                            MY_API_KEY
                          </code>
                          ).
                        </FieldDescription>
                        {isInvalid && <FieldError errors={mapErrors(field.state.meta.errors)} />}
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
                      <Label className="text-lg font-bold">Models Configuration</Label>
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
                        Add Model
                      </Button>
                    </div>

                    <div className="space-y-6">
                      {modelsField.state.value.map((_, index) => (
                        <div
                          key={index}
                          className="group relative p-6 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in zoom-in-95 duration-300"
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
                                    <FieldLabel htmlFor={field.name}>Model ID</FieldLabel>
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
                                      Display Name (Optional)
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
                                  className="rounded-lg border p-3 shadow-sm bg-slate-50 dark:bg-slate-900 justify-between"
                                >
                                  <FieldLabel htmlFor={field.name}>Reasoning Support</FieldLabel>
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
                                      Context Window (tokens)
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
                                      Max Output Tokens
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
                                      <DollarSign className="w-3 h-3" /> Input Cost (1M)
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
                                      <DollarSign className="w-3 h-3" /> Output Cost (1M)
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

                          {!isBuiltin && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-red-600 transition-colors shadow-sm"
                              onClick={() => modelsField.removeValue(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              />
            </div>
          </div>

          <DialogFooter className="p-6 pt-4 border-t dark:border-slate-800 gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
              children={([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
                  disabled={!canSubmit || isSubmitting || isLoading}
                >
                  {isSubmitting || isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Save Configuration'
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
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the provider and all
              associated model configurations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                onDelete?.()
                setIsDeleteDialogOpen(false)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
