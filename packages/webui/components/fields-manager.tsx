import {
  FieldType,
  AutofillSource,
  type FieldInfo,
  type FieldInfo as MetadataFieldInfo,
  type SelectOption,
} from '@shumai/dtos'
import { ulid } from 'ulid'
import { client } from '@/ui/api/client'
import { useFieldStore } from '@/ui/stores/fields'
import { DragDropProvider, KeyboardSensor, PointerSensor, type DragEndEvent } from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { InferRequestType, InferResponseType } from 'hono/client'
import { m } from '@/ui/paraglide/messages.js'

import { Button } from '@/ui/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/components/ui/popover'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import { Switch } from '@/ui/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/ui/components/ui/toggle-group'
import { reorderFieldSubset } from '@/ui/lib/dnd-utils'
import { PointerActivationConstraints } from '@dnd-kit/dom'
import {
  AlignLeft,
  Calendar,
  ChevronDown,
  GripVertical,
  Hash,
  List,
  Plus,
  Search,
  Settings,
  Sparkles,
  Bot,
  Star,
  Tags,
  ToggleLeft,
  Type,
  X,
  User,
  Users,
} from 'lucide-react'
import { useMemo, useState, useEffect } from 'react'

export const PREDEFINED_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray']

export const COLOR_MAP: Record<string, { bg: string; text: string; hex: string }> = {
  red: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', hex: '#ef4444' },
  orange: { bg: 'rgba(249, 115, 22, 0.15)', text: '#f97316', hex: '#f97316' },
  yellow: { bg: 'rgba(234, 179, 8, 0.15)', text: '#ca8a04', hex: '#eab308' },
  green: { bg: 'rgba(34, 197, 94, 0.15)', text: '#16a34a', hex: '#22c55e' },
  blue: { bg: 'rgba(59, 130, 246, 0.15)', text: '#2563eb', hex: '#3b82f6' },
  purple: { bg: 'rgba(168, 85, 247, 0.15)', text: '#9333ea', hex: '#a855f7' },
  gray: { bg: 'rgba(128, 128, 128, 0.15)', text: '#4b5563', hex: '#808080' },
  system: { bg: 'rgba(128, 128, 128, 0.1)', text: '#6b7280', hex: '#808080' },
}

export function getOptionStyle(color?: string) {
  if (!color) {
    return {
      backgroundColor: 'rgba(128, 128, 128, 0.1)',
      color: '#6b7280',
    }
  }

  const normalized = color.toLowerCase()
  const mapped = COLOR_MAP[normalized]
  if (mapped) {
    return {
      backgroundColor: mapped.bg,
      color: mapped.text,
    }
  }

  // Support hex colors (e.g. for existing custom fields)
  if (color.startsWith('#')) {
    return {
      backgroundColor: `${color}33`,
      color: color,
    }
  }

  // Fallback
  return {
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    color: color,
  }
}

export function getRandomUnusedColor(existingOptions: SelectOption[] = []): string {
  const usedColors = new Set(existingOptions.map((o) => o.color?.toLowerCase()).filter(Boolean))
  const available = PREDEFINED_COLORS.filter((color) => !usedColors.has(color.toLowerCase()))
  if (available.length > 0) {
    return available[Math.floor(Math.random() * available.length)]
  }
  return PREDEFINED_COLORS[Math.floor(Math.random() * PREDEFINED_COLORS.length)]
}

export const FIELD_TYPE_ICONS: Record<FieldType, React.ComponentType<{ className?: string }>> = {
  [FieldType.text]: Type,
  [FieldType.longText]: AlignLeft,
  [FieldType.select]: List,
  [FieldType.selectMulti]: Tags,
  [FieldType.rating]: Star,
  [FieldType.number]: Hash,
  [FieldType.toggle]: ToggleLeft,
  [FieldType.date]: Calendar,
  [FieldType.user]: User,
  [FieldType.userMulti]: Users,
}

type SortableFieldItemProps = {
  field: FieldInfo
  index: number
  onVisibilityChange: (fieldId: string, visible: boolean) => void
}

function SortableFieldItem({ field, index, onVisibilityChange }: SortableFieldItemProps) {
  const { ref, handleRef } = useSortable({
    id: field.id!,
    index,
  })

  const Icon = field.config?.type ? FIELD_TYPE_ICONS[field.config.type as FieldType] : null

  return (
    <div ref={ref} className="flex items-center justify-between p-2 rounded-md hover:bg-muted">
      <div className="flex items-center gap-2">
        <div ref={handleRef} className="cursor-grab">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
        {field.config?.autofillSource === AutofillSource.CONTENT && (
          <Sparkles className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        {field.config?.autofillSource === AutofillSource.CREATION_CONTEXT && (
          <Bot className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <span className="text-sm truncate">{field.config?.name}</span>
      </div>
      <Switch
        checked={field.visible}
        onCheckedChange={(checked: boolean) => onVisibilityChange(field.id!, checked)}
      />
    </div>
  )
}

type FieldsManagerProps = {
  projectId: string
  onManageFields?: () => void
  onSave?: () => void
}

export function FieldsManager({ projectId, onManageFields, onSave }: FieldsManagerProps) {
  const { fields, updateFields } = useFieldStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [view, setView] = useState<'list' | 'create'>('list')
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState<FieldType | ''>('')
  const [newAutofillSource, setNewAutofillSource] = useState<AutofillSource>(AutofillSource.NONE)
  const [newDescription, setNewDescription] = useState('')
  const [newOptions, setNewOptions] = useState<SelectOption[]>([])

  const queryClient = useQueryClient()
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['fields', projectId] })
  }, [projectId, queryClient])

  const $patchOrder = client.api.projects[':projectId'].fields.order.$patch
  const { mutate: updateFieldsOrder } = useMutation<
    InferResponseType<typeof $patchOrder>,
    Error,
    InferRequestType<typeof $patchOrder>
  >({
    mutationFn: async (request) => {
      const res = await $patchOrder(request)
      if (!res.ok) throw new Error(m.failed_update_fields_order())
      return null as unknown as InferResponseType<typeof $patchOrder>
    },
  })
  const $post = client.api.projects[':projectId'].fields.$post
  const { mutate: createField } = useMutation<
    InferResponseType<typeof $post>,
    Error,
    InferRequestType<typeof $post>
  >({
    mutationFn: async (request) => {
      const res = await $post(request)
      if (!res.ok) throw new Error(m.failed_create_field())
      return (await res.json()) as MetadataFieldInfo
    },
    onSuccess: (data) => {
      const newField: MetadataFieldInfo = {
        ...(data as MetadataFieldInfo),
        visible: true,
      }
      const newFieldsList = [...fields, newField]
      updateFields(newFieldsList)
      setNewFieldName('')
      setNewOptions([])

      updateFieldsOrder({
        param: { projectId: projectId },
        json: newFieldsList.map((f) => ({
          fieldId: f.id!,
          visible: f.visible || false,
        })),
      })
      onSave?.()
    },
  })

  const filteredFields = useMemo(
    () =>
      fields.filter((field) =>
        field.config?.name?.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [fields, searchQuery],
  )

  const handleDragEnd = (event: DragEndEvent) => {
    if (event.canceled) return
    const { source } = event.operation
    if (!isSortable(source)) return
    const { initialIndex, index } = source
    if (initialIndex === index) return

    // Rows are rendered from the search-filtered subset, so indices are
    // relative to `filteredFields`, not the full `fields` array.
    const newFields = reorderFieldSubset(fields, filteredFields, initialIndex, index)
    updateFields(newFields)
    updateFieldsOrder({
      param: { projectId: projectId },
      json: newFields.map((f: MetadataFieldInfo) => ({
        fieldId: f.id!,
        visible: f.visible || false,
      })),
    })
  }

  const handleVisibilityChange = (fieldId: string, visible: boolean) => {
    const newFields = fields.map((f) => (f.id === fieldId ? { ...f, visible } : f))
    updateFields(newFields)
    updateFieldsOrder({
      param: { projectId: projectId },
      json: newFields.map((f) => ({
        fieldId: f.id!,
        visible: f.visible || false,
      })),
    })
  }

  const handleCreateField = () => {
    if (!newFieldName || !newFieldType) return
    const typeConfig =
      newFieldType === FieldType.select
        ? { select: { options: newOptions } }
        : newFieldType === FieldType.selectMulti
          ? { selectMulti: { options: newOptions } }
          : {}
    createField({
      param: { projectId: projectId },
      json: {
        config: {
          name: newFieldName,
          type: newFieldType,
          autofillSource: newAutofillSource,
          ...typeConfig,
        },
        label: newFieldName,
        description: newDescription,
      },
    })
  }

  const visibleCount = fields.filter((f) => f.visible).length

  if (view === 'create') {
    return (
      <div className="w-80 p-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="field-name">{m.field_name()}</Label>
            <Input
              id="field-name"
              placeholder={m.new_field_placeholder()}
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>{m.field_type()}</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between font-normal">
                  {newFieldType ? (
                    <span className="capitalize">{newFieldType.replace(/_/g, ' ')}</span>
                  ) : (
                    <span className="text-muted-foreground border-dashed">
                      {m.select_field_type()}
                    </span>
                  )}
                  <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                {Object.values(FieldType).map((type) => (
                  <DropdownMenuItem
                    key={type}
                    onClick={() => {
                      setNewFieldType(type)
                      setNewOptions([])
                    }}
                    className="capitalize"
                  >
                    {type.replace(/_/g, ' ')}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-2">
            <Label htmlFor="field-desc">{m.description()}</Label>
            <Input
              id="field-desc"
              placeholder={m.description_optional_placeholder()}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{m.autofill_source()}</Label>
            <ToggleGroup
              type="single"
              value={newAutofillSource}
              onValueChange={(val: string) => {
                if (val) setNewAutofillSource(val as AutofillSource)
              }}
              className="justify-start border rounded-md p-1"
            >
              <ToggleGroupItem value={AutofillSource.NONE} className="text-xs px-2.5 py-1">
                {m.autofill_source_none()}
              </ToggleGroupItem>
              <ToggleGroupItem value={AutofillSource.CONTENT} className="text-xs px-2.5 py-1">
                {m.autofill_source_content()}
              </ToggleGroupItem>
              <ToggleGroupItem
                value={AutofillSource.CREATION_CONTEXT}
                className="text-xs px-2.5 py-1"
              >
                {m.autofill_source_creation_context()}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {(newFieldType === FieldType.select || newFieldType === FieldType.selectMulti) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">{m.options()}</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => {
                    const newOption: SelectOption = {
                      id: ulid(),
                      displayName: m.new_option(),
                      color: getRandomUnusedColor(newOptions),
                    }
                    setNewOptions([...newOptions, newOption])
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" /> {m.add_option()}
                </Button>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {newOptions.map((opt, idx) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <Input
                      value={opt.displayName}
                      onChange={(e) => {
                        const updated = [...newOptions]
                        updated[idx] = { ...opt, displayName: e.target.value }
                        setNewOptions(updated)
                      }}
                      placeholder={m.option_name_placeholder()}
                      className="h-8 flex-1"
                    />
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="w-6 h-6 rounded-full border shrink-0 cursor-pointer focus:outline-none hover:scale-105 transition-transform"
                          style={{
                            backgroundColor:
                              COLOR_MAP[opt.color || '']?.hex || opt.color || '#808080',
                          }}
                        />
                      </PopoverTrigger>
                      <PopoverContent className="p-2 w-auto" align="end">
                        <div className="flex gap-1">
                          {PREDEFINED_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              className="w-5 h-5 rounded-full border cursor-pointer hover:scale-110 transition-transform"
                              style={{ backgroundColor: COLOR_MAP[color]?.hex || color }}
                              onClick={() => {
                                const updated = [...newOptions]
                                updated[idx] = { ...opt, color }
                                setNewOptions(updated)
                              }}
                            />
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setNewOptions(newOptions.filter((_, i) => i !== idx))
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setView('list')
                setNewFieldName('')
                setNewFieldType('')
                setNewAutofillSource(AutofillSource.NONE)
                setNewDescription('')
                setNewOptions([])
              }}
            >
              {m.cancel()}
            </Button>
            <Button
              className="flex-1"
              onClick={handleCreateField}
              disabled={!newFieldName || !newFieldType}
            >
              {m.save()}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-80 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">
          {m.fields()}{' '}
          <span className="text-muted-foreground text-sm font-normal">
            {m.visible_count({ count: visibleCount })}
          </span>
        </h3>
      </div>
      <div className="relative mb-4">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={m.search_fields_placeholder()}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="max-h-60 overflow-y-auto pr-2">
        <DragDropProvider
          sensors={[
            PointerSensor.configure({
              activationConstraints: [new PointerActivationConstraints.Distance({ value: 8 })],
            }),
            KeyboardSensor,
          ]}
          onDragEnd={handleDragEnd}
        >
          {filteredFields.map((field, index) => (
            <SortableFieldItem
              key={field.id}
              field={field}
              index={index}
              onVisibilityChange={handleVisibilityChange}
            />
          ))}
        </DragDropProvider>
      </div>

      {onManageFields && (
        <div className="mt-4 space-y-2">
          <Button variant="secondary" className="w-full" onClick={onManageFields}>
            <Settings className="h-4 w-4 mr-2" />
            {m.manage_fields()}
          </Button>
          <Button className="w-full" onClick={() => setView('create')}>
            <Plus className="h-4 w-4 mr-2" />
            {m.new_field()}
          </Button>
        </div>
      )}
    </div>
  )
}
