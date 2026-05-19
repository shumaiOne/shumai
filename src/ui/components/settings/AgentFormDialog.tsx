import { client } from '@/ui/api/client'
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
import { Field, FieldLabel, FieldError } from '@/ui/components/ui/field'
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
import { Loader2, Puzzle } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { AgentInfo, AgentType } from '@/dtos/agent'
import { Textarea } from '@/ui/components/ui/textarea'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import { z } from 'zod'

interface AgentFormDialogProps {
  isOpen: boolean
  onClose: () => void
  teamId: string
  type?: AgentType
  initialValues?: AgentInfo
  title: string
}

const agentFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['chat', 'autofill', 'embedding', 'transcription']),
  avatar: z.string().optional(),
  providerId: z.string().optional(),
  modelId: z.string().optional(),
  soul: z.string().optional(),
  thinkingLevel: z.string().optional(),
  systemPrompt: z.string().optional(),
  skills: z.array(z.string()).optional(),
})

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

  const schema = useMemo(() => {
    return agentFormSchema.superRefine((data, ctx) => {
      if (data.type === 'chat' || data.type === 'autofill') {
        if (!data.providerId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Provider is required',
            path: ['providerId'],
          })
        }
        if (!data.modelId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Model is required',
            path: ['modelId'],
          })
        }
      }
    })
  }, [])

  const form = useForm({
    defaultValues: {
      name: initialValues?.name || '',
      type: type || initialValues?.type || 'chat',
      avatar: initialValues?.avatar || '',
      providerId: initialValues?.providerId || '',
      modelId: initialValues?.modelId || '',
      soul: initialValues?.soul || '',
      thinkingLevel: initialValues?.thinkingLevel || 'medium',
      systemPrompt: initialValues?.systemPrompt || '',
      skills: initialValues?.skills?.map((s) => s.skillId) || ([] as string[]),
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
      const res = await client.api.teams[':teamId'].providers[':id'].models.$get({
        param: { teamId, id: selectedProviderId! },
      })
      if (!res.ok) throw new Error('Failed to fetch models')
      return await res.json()
    },
    enabled: !!selectedProviderId && isOpen,
  })

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
      toast.success('Agent created successfully')
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: AgentFormValues }) => {
      const res = await client.api.teams[':teamId'].agents[':agentId'].$put({
        param: { teamId, agentId: id },
        json: values,
      })
      if (!res.ok) throw new Error('Failed to update agent')
      return await res.json()
    },
    onSuccess: () => {
      onClose()
      queryClient.invalidateQueries({ queryKey: ['agents', teamId] })
      toast.success('Agent updated successfully')
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`)
    },
  })

  useEffect(() => {
    if (isOpen) {
      form.reset()
    }
  }, [isOpen, initialValues, type])

  const agentType = useStore(form.store, (s) => s.values.type)
  const isAiType = agentType === 'chat' || agentType === 'autofill'

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
          <DialogDescription>
            Configure your AI agent's personality and capabilities.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          className="flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          <ScrollArea className="flex-1 h-full">
            <div className="p-6 pt-2 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <form.Field
                  name="name"
                  children={(field) => {
                    const isInvalid = !!field.state.meta.errors.length && field.state.meta.isTouched
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel>Agent Name</FieldLabel>
                        <Input
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="e.g., Support Assistant"
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
                      <FieldLabel>Agent Type</FieldLabel>
                      <Select
                        value={field.state.value}
                        onValueChange={(val) => field.handleChange(val as AgentType)}
                        disabled={true}
                      >
                        <SelectTrigger className="bg-slate-50 dark:bg-slate-900/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="chat">Chat</SelectItem>
                          <SelectItem value="autofill">Autofill</SelectItem>
                          <SelectItem value="embedding">Embedding</SelectItem>
                          <SelectItem value="transcription">Transcription</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />
              </div>

              {isAiType && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <form.Field
                      name="providerId"
                      children={(field) => {
                        const isInvalid =
                          !!field.state.meta.errors.length && field.state.meta.isTouched
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel>Provider</FieldLabel>
                            <Select
                              value={field.state.value}
                              onValueChange={(val) => {
                                field.handleChange(val)
                                form.setFieldValue('modelId', '')
                              }}
                            >
                              <SelectTrigger aria-invalid={isInvalid}>
                                <SelectValue placeholder="Select Provider" />
                              </SelectTrigger>
                              <SelectContent>
                                {providers?.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name}
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

                    <form.Field
                      name="modelId"
                      children={(field) => {
                        const isInvalid =
                          !!field.state.meta.errors.length && field.state.meta.isTouched
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel className="flex items-center gap-2">
                              Model
                              {isModelsLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                            </FieldLabel>
                            <Select
                              value={field.state.value}
                              onValueChange={field.handleChange}
                              disabled={!selectedProviderId || isModelsLoading}
                            >
                              <SelectTrigger aria-invalid={isInvalid}>
                                <SelectValue placeholder="Select Model" />
                              </SelectTrigger>
                              <SelectContent>
                                {models?.map((m) => (
                                  <SelectItem key={m.id} value={m.id}>
                                    {m.name || m.modelId}
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
                        name="thinkingLevel"
                        children={(field) => (
                          <Field>
                            <FieldLabel>Thinking Level</FieldLabel>
                            <Select value={field.state.value} onValueChange={field.handleChange}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Low (Fast)</SelectItem>
                                <SelectItem value="medium">Medium (Balanced)</SelectItem>
                                <SelectItem value="high">High (Reasoning)</SelectItem>
                              </SelectContent>
                            </Select>
                          </Field>
                        )}
                      />
                    </div>
                  </div>

                  <form.Field
                    name="soul"
                    children={(field) => (
                      <Field>
                        <FieldLabel>Agent Soul (Personality)</FieldLabel>
                        <Textarea
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="Describe the agent's personality, tone, and behavior..."
                          className="min-h-[120px]"
                        />
                      </Field>
                    )}
                  />

                  <div className="space-y-4">
                    <Label className="text-base font-bold flex items-center gap-2">
                      <Puzzle className="w-5 h-5 text-blue-600" />
                      Skills
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
                                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
                                >
                                  <div className="flex items-center gap-3">
                                    <Puzzle className="w-4 h-4 text-slate-400" />
                                    <div className="flex flex-col">
                                      <span className="text-sm font-medium">{skill.name}</span>
                                      {skill.description && (
                                        <span className="text-[10px] text-slate-500 line-clamp-1">
                                          {skill.description}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500">
                                      {isEnabled ? 'Enabled' : 'Disabled'}
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
                              <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                <p className="text-sm text-slate-400">No skills available.</p>
                              </div>
                            )}
                          </>
                        )}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 pt-4 border-t dark:border-slate-800 flex-shrink-0">
            <Button variant="outline" onClick={onClose} type="button">
              Cancel
            </Button>
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
              children={([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
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
                  {initialValues ? 'Save Changes' : 'Create Agent'}
                </Button>
              )}
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
