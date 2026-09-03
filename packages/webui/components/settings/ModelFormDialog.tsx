import { ScrollArea } from '@/ui/components/ui/scroll-area'
import { Button } from '@/ui/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/ui/components/ui/field'
import { Input } from '@/ui/components/ui/input'
import { Switch } from '@/ui/components/ui/switch'
import { createModelRequestSchema } from '@shumai/dtos'
import { useForm } from '@tanstack/react-form'
import { DollarSign, Loader2 } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { z } from 'zod'
import { m } from '@/ui/paraglide/messages.js'

export type ModelFormValues = z.infer<typeof createModelRequestSchema>

export interface ModelFormDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (values: ModelFormValues) => void
  initialValues?: ModelFormValues | null
  title: string
  isLoading?: boolean
  defaultApi?: string
  existingModelIds?: string[]
}

export function ModelFormDialog({
  isOpen,
  onClose,
  onSubmit,
  initialValues,
  title,
  isLoading = false,
  defaultApi,
  existingModelIds = [],
}: ModelFormDialogProps) {
  const schema = useMemo(() => {
    return createModelRequestSchema.extend({
      modelId: z
        .string()
        .min(1, m.model_id())
        .refine(
          (id) => {
            if (initialValues?.modelId === id) return true
            return !existingModelIds.includes(id)
          },
          { message: 'Model ID already exists for this provider' },
        ),
    })
  }, [existingModelIds, initialValues])

  const form = useForm({
    defaultValues: (initialValues || {
      modelId: '',
      name: '',
      config: {
        api: defaultApi,
        reasoning: false,
        input: ['text'],
        contextWindow: 128000,
        maxTokens: 4096,
        cost: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
        },
      },
    }) as z.input<typeof schema>,
    validators: {
      onSubmit: schema,
    },
    onSubmit: async ({ value }) => {
      onSubmit(value as ModelFormValues)
    },
  })

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
      <DialogContent className="sm:max-w-xl h-[85vh] max-h-[700px] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <DialogTitle className="text-xl">{title}</DialogTitle>
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
                {/* Basic Model Info */}
                <div className="space-y-4">
                  <form.Field
                    name="modelId"
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
                            placeholder="e.g., gpt-4o, claude-3-5-sonnet-20241022"
                            aria-invalid={isInvalid}
                          />
                          {isInvalid && <FieldError errors={mapErrors(field.state.meta.errors)} />}
                        </Field>
                      )
                    }}
                  />

                  <form.Field
                    name="name"
                    children={(field) => {
                      const isInvalid =
                        !!field.state.meta.errors.length && field.state.meta.isTouched
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>{m.display_name_optional()}</FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            value={field.state.value || ''}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder="e.g., GPT-4o"
                            aria-invalid={isInvalid}
                          />
                          {isInvalid && <FieldError errors={mapErrors(field.state.meta.errors)} />}
                        </Field>
                      )
                    }}
                  />
                </div>

                {/* Parameters & Reasoning */}
                <div className="space-y-4 pt-2 border-t border-border">
                  <h4 className="text-sm font-semibold text-foreground">{m.parameters()}</h4>
                  <form.Field
                    name="config.reasoning"
                    children={(field) => (
                      <Field
                        orientation="horizontal"
                        className="rounded-lg border border-border p-3 shadow-sm bg-muted/40 justify-between flex items-center"
                      >
                        <FieldLabel htmlFor={field.name} className="cursor-pointer">
                          {m.reasoning_support()}
                        </FieldLabel>
                        <Switch
                          id={field.name}
                          checked={field.state.value}
                          onCheckedChange={field.handleChange}
                        />
                      </Field>
                    )}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <form.Field
                      name="config.contextWindow"
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
                              onChange={(e) => field.handleChange(parseInt(e.target.value) || 0)}
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
                      name="config.maxTokens"
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
                              onChange={(e) => field.handleChange(parseInt(e.target.value) || 0)}
                              aria-invalid={isInvalid}
                            />
                            {isInvalid && (
                              <FieldError errors={mapErrors(field.state.meta.errors)} />
                            )}
                          </Field>
                        )
                      }}
                    />
                  </div>
                </div>

                {/* Pricing Section */}
                <div className="space-y-4 pt-2 border-t border-border">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-primary" />
                    {m.pricing()}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <form.Field
                      name="config.cost.input"
                      children={(field) => {
                        const isInvalid =
                          !!field.state.meta.errors.length && field.state.meta.isTouched
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor={field.name} className="text-xs">
                              {m.input_cost_1m()}
                            </FieldLabel>
                            <Input
                              id={field.name}
                              name={field.name}
                              type="number"
                              step="0.0001"
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(parseFloat(e.target.value) || 0)}
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
                      name="config.cost.output"
                      children={(field) => {
                        const isInvalid =
                          !!field.state.meta.errors.length && field.state.meta.isTouched
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor={field.name} className="text-xs">
                              {m.output_cost_1m()}
                            </FieldLabel>
                            <Input
                              id={field.name}
                              name={field.name}
                              type="number"
                              step="0.0001"
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(parseFloat(e.target.value) || 0)}
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
                      name="config.cost.cacheRead"
                      children={(field) => {
                        const isInvalid =
                          !!field.state.meta.errors.length && field.state.meta.isTouched
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor={field.name} className="text-xs">
                              {m.cache_read_cost_1m()}
                            </FieldLabel>
                            <Input
                              id={field.name}
                              name={field.name}
                              type="number"
                              step="0.0001"
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(parseFloat(e.target.value) || 0)}
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
                      name="config.cost.cacheWrite"
                      children={(field) => {
                        const isInvalid =
                          !!field.state.meta.errors.length && field.state.meta.isTouched
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor={field.name} className="text-xs">
                              {m.cache_write_cost_1m()}
                            </FieldLabel>
                            <Input
                              id={field.name}
                              name={field.name}
                              type="number"
                              step="0.0001"
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(parseFloat(e.target.value) || 0)}
                              aria-invalid={isInvalid}
                            />
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
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              {m.cancel()}
            </Button>
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
              children={([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  className="min-w-[100px]"
                  disabled={!canSubmit || isSubmitting || isLoading}
                >
                  {isSubmitting || isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    m.save_changes()
                  )}
                </Button>
              )}
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
