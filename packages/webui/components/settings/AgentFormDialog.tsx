import { client } from '@/ui/api/client'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import { Badge } from '@/ui/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import { Field, FieldLabel, FieldError } from '@/ui/components/ui/field'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/ui/select'
import { Switch } from '@/ui/components/ui/switch'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useStore } from '@tanstack/react-form'
import { Check, ChevronDown, Loader2, Puzzle, Search, Server, Terminal, Zap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { m } from '@/ui/paraglide/messages.js'
import { toast } from 'sonner'
import { AgentInfo, AgentType, ThinkingLevel, thinkingLevelSchema } from '@shumai/dtos'
import { usePermissions } from '@/ui/hooks/use-permissions'
import { Textarea } from '@/ui/components/ui/textarea'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import { z } from 'zod'
import { cn } from '@/ui/lib/utils'
import { AVAILABLE_AVATARS } from './avatars'

interface AgentFormDialogProps {
  isOpen: boolean
  onClose: () => void
  teamId: string
  type?: AgentType
  initialValues?: AgentInfo
  title: string
}

const agentFormSchema = z.object({
  name: z.string().min(1, m.name_is_required()),
  type: z.enum(['chat', 'autofill', 'embedding']),
  permission: z.enum(['owner', 'editor', 'reviewer']),
  avatar: z.string().optional(),
  providerId: z.string().optional(),
  modelId: z.string().optional(),
  soul: z.string().optional(),
  thinkingLevel: thinkingLevelSchema.optional(),
  systemPrompt: z.string().optional(),
  skills: z.array(z.string()).optional(),
  mcpServerIds: z.array(z.string()).optional(),
  deniedTools: z.array(z.string()).optional(),
})

const BUILTIN_TOOLS = [
  {
    id: 'bash',
    name: () => m.agent_tool_bash_name(),
    description: () => m.agent_tool_bash_desc(),
  },
  {
    id: 'read_skill',
    name: () => m.agent_tool_read_skill_name(),
    description: () => m.agent_tool_read_skill_desc(),
  },
  {
    id: 'read_asset',
    name: () => m.agent_tool_read_asset_name(),
    description: () => m.agent_tool_read_asset_desc(),
  },
  {
    id: 'list_assets',
    name: () => m.agent_tool_list_assets_name(),
    description: () => m.agent_tool_list_assets_desc(),
  },
  {
    id: 'create_folder',
    name: () => m.agent_tool_create_folder_name(),
    description: () => m.agent_tool_create_folder_desc(),
  },
  {
    id: 'create_file',
    name: () => m.agent_tool_create_file_name(),
    description: () => m.agent_tool_create_file_desc(),
  },
  {
    id: 'create_version',
    name: () => m.agent_tool_create_version_name(),
    description: () => m.agent_tool_create_version_desc(),
  },
]

type AgentFormValues = z.infer<typeof agentFormSchema>

export function AgentFormDialog({
  isOpen,
  onClose,
  teamId,
  type,
  initialValues,
  title,
}: AgentFormDialogProps) {
  const queryClient = useQueryClient()
  const { canAdmin } = usePermissions()

  // Fetch Providers
  const { data: providers } = useQuery({
    queryKey: ['teams', teamId, 'providers'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].providers.$get({
        param: { teamId },
      })
      if (!res.ok) throw new Error('Failed to fetch providers')
      return await res.json()
    },
    enabled: isOpen,
  })

  // Fetch Skills
  const { data: skillsData } = useQuery({
    queryKey: ['teams', teamId, 'skills'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].skills.$get({
        param: { teamId },
      })
      if (!res.ok) throw new Error('Failed to fetch skills')
      return await res.json()
    },
    enabled: isOpen,
  })

  const allSkills = skillsData?.skills || []

  // Fetch MCP Servers
  const { data: mcpData } = useQuery({
    queryKey: ['teams', teamId, 'mcp', 'servers'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].mcp.servers.$get({
        param: { teamId },
      })
      if (!res.ok) throw new Error('Failed to fetch MCP servers')
      return await res.json()
    },
    enabled: isOpen,
  })

  const allMcpServers = mcpData?.servers || []

  const schema = useMemo(() => {
    return agentFormSchema.superRefine((data, ctx) => {
      if (data.type === 'chat' || data.type === 'autofill') {
        if (!data.providerId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: m.provider_is_required(),
            path: ['providerId'],
          })
        }
        if (!data.modelId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: m.model_is_required(),
            path: ['modelId'],
          })
        }
      }
    })
  }, [])

  const form = useForm({
    defaultValues: {
      name: initialValues?.name || '',
      type: initialValues?.type || type || 'chat',
      permission: initialValues?.permission || 'reviewer',
      avatar: initialValues?.avatar || AVAILABLE_AVATARS[0].id,
      providerId: initialValues?.providerId || '',
      modelId: initialValues?.modelId || '',
      soul: initialValues?.soul || '',
      thinkingLevel: initialValues?.thinkingLevel || 'off',
      systemPrompt: initialValues?.systemPrompt || '',
      skills: initialValues?.skills?.map((s) => s.skillId) || ([] as string[]),
      mcpServerIds: initialValues?.mcpServerIds || ([] as string[]),
      deniedTools: initialValues?.deniedTools || ([] as string[]),
    } as AgentFormValues,
    validators: {
      onChange: schema,
    },
    onSubmit: async ({ value }) => {
      try {
        if (initialValues?.id) {
          await updateMutation.mutateAsync({ id: initialValues.id, values: value })
        } else {
          await createMutation.mutateAsync(value)
        }
      } catch {
        // Error handled by mutation
      }
    },
  })

  // Fetch models for selected provider
  const selectedProviderId = useStore(form.store, (s) => s.values.providerId)
  const { data: models, isLoading: isModelsLoading } = useQuery({
    queryKey: ['teams', teamId, 'providers', selectedProviderId, 'models'],
    queryFn: async () => {
      const res = await client.api.providers[':id'].models.$get({
        param: { id: selectedProviderId! },
      })
      if (!res.ok) throw new Error('Failed to fetch models')
      return await res.json()
    },
    enabled: !!selectedProviderId && isOpen,
  })

  const [providerSearchQuery, setProviderSearchQuery] = useState('')
  const [isProviderSelectOpen, setIsProviderSelectOpen] = useState(false)

  // Sort providers alphabetically by name
  const sortedProviders = useMemo(() => {
    if (!providers) return []
    return [...providers].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
  }, [providers])

  // Filter providers based on search query
  const filteredProviders = useMemo(() => {
    if (!providerSearchQuery.trim()) return sortedProviders
    const q = providerSearchQuery.toLowerCase()
    return sortedProviders.filter((p) => p.name.toLowerCase().includes(q))
  }, [sortedProviders, providerSearchQuery])

  const [modelSearchQuery, setModelSearchQuery] = useState('')
  const [isModelSelectOpen, setIsModelSelectOpen] = useState(false)

  // Sort models alphabetically by display name / modelId
  const sortedModels = useMemo(() => {
    if (!models) return []
    return [...models].sort((a, b) => {
      const nameA = (a.name || a.modelId).toLowerCase()
      const nameB = (b.name || b.modelId).toLowerCase()
      return nameA.localeCompare(nameB)
    })
  }, [models])

  // Filter models based on search query
  const filteredModels = useMemo(() => {
    if (!modelSearchQuery.trim()) return sortedModels
    const q = modelSearchQuery.toLowerCase()
    return sortedModels.filter(
      (m) => m.modelId.toLowerCase().includes(q) || (m.name && m.name.toLowerCase().includes(q)),
    )
  }, [sortedModels, modelSearchQuery])

  const createMutation = useMutation({
    mutationFn: async (values: AgentFormValues) => {
      const res = await client.api.teams[':teamId'].agents.$post({
        param: { teamId },
        json: values,
      })
      if (!res.ok) throw new Error('Failed to create agent')
      return await res.json()
    },
    onSuccess: () => {
      onClose()
      queryClient.invalidateQueries({ queryKey: ['agents', teamId] })
      toast.success(m.agent_created_successfully())
    },
    onError: (error) => {
      toast.error(m.error_message({ message: error.message }))
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: AgentFormValues }) => {
      const res = await client.api.agents[':agentId'].$put({
        param: { agentId: id },
        json: values,
      })
      if (!res.ok) throw new Error('Failed to update agent')
      return await res.json()
    },
    onSuccess: () => {
      onClose()
      queryClient.invalidateQueries({ queryKey: ['agents', teamId] })
      toast.success(m.agent_updated_successfully())
    },
    onError: (error) => {
      toast.error(m.error_message({ message: error.message }))
    },
  })

  useEffect(() => {
    if (isOpen) {
      form.reset()
      setProviderSearchQuery('')
      setIsProviderSelectOpen(false)
      setModelSearchQuery('')
      setIsModelSelectOpen(false)
    }
  }, [isOpen, initialValues, type])

  const agentType = useStore(form.store, (s) => s.values.type)
  const isAiType = agentType === 'chat' || agentType === 'autofill'
  const isChatType = agentType === 'chat'

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
      <DialogContent className="sm:max-w-3xl h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 flex-shrink-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{m.configure_agent_description()}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          className="flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-6 pt-2 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <form.Field
                  name="name"
                  children={(field) => {
                    const isInvalid = !!field.state.meta.errors.length && field.state.meta.isTouched
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel>{m.agent_name()}</FieldLabel>
                        <Input
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder={m.agent_name_placeholder()}
                          aria-invalid={isInvalid}
                        />
                        {isInvalid && <FieldError errors={mapErrors(field.state.meta.errors)} />}
                      </Field>
                    )
                  }}
                />

                <form.Field
                  name="type"
                  children={(field) => (
                    <Field>
                      <FieldLabel>{m.agent_type()}</FieldLabel>
                      <Select
                        value={field.state.value}
                        onValueChange={(val) => field.handleChange(val as AgentType)}
                        disabled={true}
                      >
                        <SelectTrigger className="bg-muted/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="chat">{m.agent_type_chat()}</SelectItem>
                          <SelectItem value="autofill">{m.agent_type_autofill()}</SelectItem>
                          <SelectItem value="embedding">{m.agent_type_embedding()}</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />

                {isChatType && (
                  <form.Field
                    name="permission"
                    children={(field) => (
                      <Field>
                        <FieldLabel>{m.skill_permission()}</FieldLabel>
                        <Select
                          value={field.state.value || 'reviewer'}
                          onValueChange={(val) =>
                            field.handleChange(val as 'owner' | 'editor' | 'reviewer')
                          }
                          disabled={!canAdmin}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="reviewer">{m.permission_all_users()}</SelectItem>
                            <SelectItem value="editor">
                              {m.permission_owner_and_editor()}
                            </SelectItem>
                            <SelectItem value="owner">{m.permission_owner_only()}</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                  />
                )}

                <form.Field
                  name="avatar"
                  children={(field) => (
                    <Field className="md:col-span-2">
                      <FieldLabel>{m.agent_avatar()}</FieldLabel>
                      <div className="flex gap-4 mt-2">
                        {AVAILABLE_AVATARS.map((preset) => {
                          const isSelected = field.state.value === preset.id
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => field.handleChange(preset.id)}
                              className={cn(
                                'relative w-14 h-14 rounded-full overflow-hidden border-2 transition-all hover:scale-105',
                                isSelected
                                  ? 'border-primary ring-2 ring-primary ring-offset-2'
                                  : 'border-border hover:border-muted-foreground',
                              )}
                            >
                              <img
                                src={preset.src}
                                className="w-full h-full object-cover"
                                alt={m.preset_avatar_option()}
                              />
                            </button>
                          )
                        })}
                        {field.state.value &&
                          !AVAILABLE_AVATARS.some((p) => p.id === field.state.value) && (
                            <button
                              type="button"
                              className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-primary ring-2 ring-primary ring-offset-2 scale-105"
                            >
                              <img
                                src={field.state.value}
                                className="w-full h-full object-cover"
                                alt={m.current_custom_avatar()}
                              />
                            </button>
                          )}
                      </div>
                    </Field>
                  )}
                />
              </div>

              {isAiType && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-muted/50 rounded-xl border border-border">
                    <form.Field
                      name="providerId"
                      children={(field) => {
                        const isInvalid =
                          !!field.state.meta.errors.length && field.state.meta.isTouched
                        const selectedProvider = providers?.find((p) => p.id === field.state.value)

                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel>{m.provider()}</FieldLabel>
                            <Popover
                              open={isProviderSelectOpen}
                              onOpenChange={(open) => {
                                setIsProviderSelectOpen(open)
                                if (!open) setProviderSearchQuery('')
                              }}
                              modal={true}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={isProviderSelectOpen}
                                  aria-invalid={isInvalid}
                                  className={cn(
                                    'w-full justify-between font-normal h-10 px-3 bg-background border-border hover:bg-accent/50',
                                    isInvalid && 'border-destructive ring-destructive',
                                  )}
                                >
                                  <span className="truncate">
                                    {selectedProvider ? (
                                      <span className="font-medium text-foreground truncate">
                                        {selectedProvider.name}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">
                                        {m.select_provider()}
                                      </span>
                                    )}
                                  </span>
                                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-[--radix-popover-trigger-width] min-w-[320px] max-h-[360px] p-0 flex flex-col overflow-hidden"
                                align="start"
                                side="bottom"
                                sideOffset={4}
                                onWheel={(e) => e.stopPropagation()}
                              >
                                <div className="relative p-2 pb-1.5 border-b border-border shrink-0">
                                  <Search className="absolute left-4.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                  <Input
                                    placeholder={m.search_providers_placeholder()}
                                    value={providerSearchQuery}
                                    onChange={(e) => setProviderSearchQuery(e.target.value)}
                                    className="pl-8 h-8 text-xs bg-muted/40"
                                    autoFocus
                                  />
                                </div>
                                <ScrollArea
                                  className="w-full p-1"
                                  style={{
                                    height:
                                      filteredProviders.length === 0
                                        ? '96px'
                                        : `${Math.min(filteredProviders.length * 38 + 8, 256)}px`,
                                  }}
                                  onWheel={(e) => e.stopPropagation()}
                                >
                                  {filteredProviders.length === 0 ? (
                                    <div className="flex items-center justify-center h-full py-6 text-xs text-muted-foreground">
                                      {m.no_providers_found()}
                                    </div>
                                  ) : (
                                    <div className="space-y-0.5 pr-2">
                                      {filteredProviders.map((p) => {
                                        const isSelected = field.state.value === p.id
                                        return (
                                          <div
                                            key={p.id}
                                            onClick={() => {
                                              field.handleChange(p.id)
                                              form.setFieldValue('modelId', '')
                                              setModelSearchQuery('')
                                              setIsProviderSelectOpen(false)
                                              setProviderSearchQuery('')
                                            }}
                                            className={cn(
                                              'flex items-center justify-between px-2.5 py-2 rounded-md text-xs cursor-pointer transition-colors',
                                              isSelected
                                                ? 'bg-accent text-accent-foreground font-medium'
                                                : 'hover:bg-muted/60 text-foreground',
                                            )}
                                          >
                                            <span className="truncate flex-1 pr-2">{p.name}</span>
                                            {isSelected && (
                                              <Check className="w-4 h-4 text-primary shrink-0" />
                                            )}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </ScrollArea>
                              </PopoverContent>
                            </Popover>
                            {isInvalid && (
                              <FieldError errors={mapErrors(field.state.meta.errors)} />
                            )}
                          </Field>
                        )
                      }}
                    />

                    <form.Field
                      name="modelId"
                      children={(field) => {
                        const isInvalid =
                          !!field.state.meta.errors.length && field.state.meta.isTouched
                        const selectedModel = models?.find((m) => m.id === field.state.value)

                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel className="flex items-center gap-2">
                              {m.model()}
                              {isModelsLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                            </FieldLabel>
                            <Popover
                              open={isModelSelectOpen}
                              onOpenChange={(open) => {
                                setIsModelSelectOpen(open)
                                if (!open) setModelSearchQuery('')
                              }}
                              modal={true}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={isModelSelectOpen}
                                  aria-invalid={isInvalid}
                                  disabled={!selectedProviderId || isModelsLoading}
                                  className={cn(
                                    'w-full justify-between font-normal h-10 px-3 bg-background border-border hover:bg-accent/50',
                                    isInvalid && 'border-destructive ring-destructive',
                                  )}
                                >
                                  <span className="truncate flex items-center gap-2">
                                    {selectedModel ? (
                                      <>
                                        <span className="truncate font-medium text-foreground">
                                          {selectedModel.name || selectedModel.modelId}
                                        </span>
                                        {selectedModel.name &&
                                          selectedModel.name !== selectedModel.modelId && (
                                            <Badge
                                              variant="secondary"
                                              className="font-mono text-[10px] px-1.5 py-0 shrink-0"
                                            >
                                              {selectedModel.modelId}
                                            </Badge>
                                          )}
                                      </>
                                    ) : (
                                      <span className="text-muted-foreground">
                                        {m.select_model()}
                                      </span>
                                    )}
                                  </span>
                                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-[--radix-popover-trigger-width] min-w-[320px] max-h-[360px] p-0 flex flex-col overflow-hidden"
                                align="start"
                                side="bottom"
                                sideOffset={4}
                                onWheel={(e) => e.stopPropagation()}
                              >
                                <div className="relative p-2 pb-1.5 border-b border-border shrink-0">
                                  <Search className="absolute left-4.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                  <Input
                                    placeholder={m.search_models_placeholder()}
                                    value={modelSearchQuery}
                                    onChange={(e) => setModelSearchQuery(e.target.value)}
                                    className="pl-8 h-8 text-xs bg-muted/40"
                                    autoFocus
                                  />
                                </div>
                                <ScrollArea
                                  className="w-full p-1"
                                  style={{
                                    height:
                                      filteredModels.length === 0
                                        ? '96px'
                                        : `${Math.min(filteredModels.length * 38 + 8, 256)}px`,
                                  }}
                                  onWheel={(e) => e.stopPropagation()}
                                >
                                  {filteredModels.length === 0 ? (
                                    <div className="flex items-center justify-center h-full py-6 text-xs text-muted-foreground">
                                      {m.no_models_found()}
                                    </div>
                                  ) : (
                                    <div className="space-y-0.5 pr-2">
                                      {filteredModels.map((m) => {
                                        const isSelected = field.state.value === m.id
                                        return (
                                          <div
                                            key={m.id}
                                            onClick={() => {
                                              field.handleChange(m.id)
                                              setIsModelSelectOpen(false)
                                              setModelSearchQuery('')
                                            }}
                                            className={cn(
                                              'flex items-center justify-between px-2.5 py-2 rounded-md text-xs cursor-pointer transition-colors',
                                              isSelected
                                                ? 'bg-accent text-accent-foreground font-medium'
                                                : 'hover:bg-muted/60 text-foreground',
                                            )}
                                          >
                                            <div className="min-w-0 flex-1 pr-2">
                                              <div className="flex items-center gap-2">
                                                <span className="truncate">
                                                  {m.name || m.modelId}
                                                </span>
                                                {m.name && m.name !== m.modelId && (
                                                  <span className="font-mono text-[10px] text-muted-foreground truncate">
                                                    ({m.modelId})
                                                  </span>
                                                )}
                                                {m.config?.reasoning && (
                                                  <Badge
                                                    variant="outline"
                                                    className="text-[9px] px-1 py-0 h-4 gap-0.5 bg-primary/10 text-primary border-primary/20 shrink-0"
                                                  >
                                                    <Zap className="w-2.5 h-2.5" />
                                                  </Badge>
                                                )}
                                              </div>
                                            </div>
                                            {isSelected && (
                                              <Check className="w-4 h-4 text-primary shrink-0" />
                                            )}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </ScrollArea>
                              </PopoverContent>
                            </Popover>
                            {isInvalid && (
                              <FieldError errors={mapErrors(field.state.meta.errors)} />
                            )}
                          </Field>
                        )
                      }}
                    />

                    <div className="md:col-span-2">
                      <form.Field
                        name="thinkingLevel"
                        children={(field) => {
                          const thinkingLabels: Record<string, string> = {
                            off: m.thinking_disable(),
                            low: m.thinking_low(),
                            medium: m.thinking_medium(),
                            high: m.thinking_high(),
                          }
                          return (
                            <Field>
                              <FieldLabel>{m.thinking_level()}</FieldLabel>
                              <Select
                                value={field.state.value}
                                onValueChange={(val) => field.handleChange(val as ThinkingLevel)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {thinkingLevelSchema.options.map((level) => (
                                    <SelectItem key={level} value={level}>
                                      {thinkingLabels[level] || level}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </Field>
                          )
                        }}
                      />
                    </div>
                  </div>

                  <form.Field
                    name="soul"
                    children={(field) => (
                      <Field>
                        <FieldLabel>{m.agent_soul()}</FieldLabel>
                        <Textarea
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder={m.agent_soul_placeholder()}
                          className="min-h-[120px]"
                        />
                      </Field>
                    )}
                  />

                  <div className="space-y-4">
                    <Label className="text-base font-bold flex items-center gap-2">
                      <Puzzle className="w-5 h-5 text-primary" />
                      {m.skills()}
                    </Label>

                    <div className="space-y-2">
                      <form.Field
                        name="skills"
                        children={(skillsField) => (
                          <>
                            {allSkills.map((skill) => {
                              const isEnabled = skillsField.state.value?.includes(skill.id) || false
                              return (
                                <div
                                  key={skill.id}
                                  className="flex items-center justify-between p-3 bg-muted/30 border border-border rounded-lg"
                                >
                                  <div className="flex items-center gap-3">
                                    <Puzzle className="w-4 h-4 text-muted-foreground" />
                                    <div className="flex flex-col">
                                      <span className="text-sm font-medium">{skill.name}</span>
                                      {skill.description && (
                                        <span className="text-[10px] text-muted-foreground line-clamp-1">
                                          {skill.description}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">
                                      {isEnabled ? m.enabled() : m.disabled()}
                                    </span>
                                    <Switch
                                      checked={isEnabled}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          skillsField.handleChange([
                                            ...(skillsField.state.value || []),
                                            skill.id,
                                          ])
                                        } else {
                                          skillsField.handleChange(
                                            (skillsField.state.value || []).filter(
                                              (id) => id !== skill.id,
                                            ),
                                          )
                                        }
                                      }}
                                    />
                                  </div>
                                </div>
                              )
                            })}
                            {allSkills.length === 0 && (
                              <div className="text-center py-8 border-2 border-dashed border-border rounded-xl">
                                <p className="text-sm text-muted-foreground">
                                  {m.no_skills_available()}
                                </p>
                              </div>
                            )}
                          </>
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-4 border-t border-border pt-6">
                    <Label className="text-base font-bold flex items-center gap-2">
                      <Server className="w-5 h-5 text-primary" />
                      {m.mcp_servers()}
                    </Label>

                    <div className="space-y-2">
                      <form.Field
                        name="mcpServerIds"
                        children={(mcpField) => (
                          <>
                            {allMcpServers.map((mcpServer) => {
                              const isEnabled =
                                mcpField.state.value?.includes(mcpServer.id) || false
                              const needsAuth =
                                mcpServer.status === 'needs_auth' ||
                                (!mcpServer.hasCredential && mcpServer.authType === 'oauth')

                              return (
                                <div
                                  key={mcpServer.id}
                                  className="flex items-center justify-between p-3 bg-muted/30 border border-border rounded-lg"
                                >
                                  <div className="flex items-center gap-3">
                                    <Server className="w-4 h-4 text-muted-foreground" />
                                    <div className="flex flex-col">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">
                                          {mcpServer.name}
                                        </span>
                                        <Badge variant="outline" className="text-[10px]">
                                          {mcpServer.toolCount ?? 0} tools
                                        </Badge>
                                        {needsAuth && (
                                          <Badge
                                            variant="secondary"
                                            className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20"
                                          >
                                            {m.mcp_status_needs_auth()}
                                          </Badge>
                                        )}
                                      </div>
                                      <span className="text-[10px] font-mono text-muted-foreground line-clamp-1">
                                        {mcpServer.url}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">
                                      {isEnabled ? m.enabled() : m.disabled()}
                                    </span>
                                    <Switch
                                      checked={isEnabled}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          mcpField.handleChange([
                                            ...(mcpField.state.value || []),
                                            mcpServer.id,
                                          ])
                                        } else {
                                          mcpField.handleChange(
                                            (mcpField.state.value || []).filter(
                                              (id) => id !== mcpServer.id,
                                            ),
                                          )
                                        }
                                      }}
                                    />
                                  </div>
                                </div>
                              )
                            })}
                            {allMcpServers.length === 0 && (
                              <div className="text-center py-6 border-2 border-dashed border-border rounded-xl">
                                <p className="text-xs text-muted-foreground">
                                  {m.no_mcp_servers_installed()}
                                </p>
                              </div>
                            )}
                          </>
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-4 border-t border-border pt-6">
                    <Label className="text-base font-bold flex items-center gap-2">
                      <Terminal className="w-5 h-5 text-primary" />
                      {m.agent_tools()}
                    </Label>
                    <p className="text-xs text-muted-foreground">{m.agent_tools_description()}</p>

                    <div className="space-y-2">
                      <form.Field
                        name="deniedTools"
                        children={(deniedToolsField) => {
                          const currentDenied = deniedToolsField.state.value || []
                          return (
                            <>
                              {BUILTIN_TOOLS.map((tool) => {
                                const isEnabled = !currentDenied.includes(tool.id)
                                return (
                                  <div
                                    key={tool.id}
                                    className="flex items-center justify-between p-3 bg-muted/30 border border-border rounded-lg"
                                  >
                                    <div className="flex items-center gap-3">
                                      <Terminal className="w-4 h-4 text-muted-foreground" />
                                      <div className="flex flex-col">
                                        <span className="text-sm font-medium">{tool.name()}</span>
                                        <span className="text-[10px] text-muted-foreground line-clamp-1">
                                          {tool.description()}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-muted-foreground">
                                        {isEnabled ? m.enabled() : m.disabled()}
                                      </span>
                                      <Switch
                                        checked={isEnabled}
                                        disabled={!canAdmin}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            deniedToolsField.handleChange(
                                              currentDenied.filter((id) => id !== tool.id),
                                            )
                                          } else {
                                            deniedToolsField.handleChange([
                                              ...currentDenied,
                                              tool.id,
                                            ])
                                          }
                                        }}
                                      />
                                    </div>
                                  </div>
                                )
                              })}
                            </>
                          )
                        }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 pt-4 border-t border-border flex-shrink-0">
            <Button variant="outline" onClick={onClose} type="button">
              {m.cancel()}
            </Button>
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
              children={([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[120px]"
                  disabled={
                    !canSubmit ||
                    isSubmitting ||
                    createMutation.isPending ||
                    updateMutation.isPending
                  }
                >
                  {(isSubmitting || createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  )}
                  {initialValues ? m.save_changes() : m.create_agent()}
                </Button>
              )}
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
