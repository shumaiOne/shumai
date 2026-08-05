import {
  type FieldInfo as MetadataFieldInfo,
  type FieldInfo,
  FieldType,
  type SelectOption,
} from '@shumai/dtos'
import { ulid } from 'ulid'
import { client } from '@/ui/api/client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { InferRequestType, InferResponseType } from 'hono/client'
import { useFieldStore } from '@/ui/stores/fields'
import { DragDropProvider, KeyboardSensor, PointerSensor, type DragEndEvent } from '@dnd-kit/react'
import { useSortable } from '@dnd-kit/react/sortable'
import { arrayMove } from '@/ui/lib/dnd-utils'
import { PointerActivationConstraints } from '@dnd-kit/dom'
import {
  ChevronDown,
  FileText,
  GripVertical,
  Lock,
  Plus,
  Settings,
  Sparkles,
  X,
} from 'lucide-react'
import { useMemo, useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Popover, PopoverTrigger, PopoverContent } from '@/ui/components/ui/popover'
import { m } from '@/ui/paraglide/messages.js'
import {
  FIELD_TYPE_ICONS,
  PREDEFINED_COLORS,
  COLOR_MAP,
  getRandomUnusedColor,
} from './fields-manager'

import { Button } from '@/ui/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/ui/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/components/ui/dropdown-menu'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import { Switch } from '@/ui/components/ui/switch'
import { cn } from '@/ui/lib/utils'

type ManageFieldsDialogProps = {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Map scopes to UI groups
// Note: "Essentials" and "File Attributes" are typically system fields.
// "Custom Fields" are project fields.
// Since we don't have explicit "Essentials" vs "File Attributes" flag,
// we'll put all system/team fields in "Essentials" for now or split if possible.
// User said: "groups are `scope` field... can be system/team/project".
const SCOPE_GROUPS = {
  SYSTEM: 'system',
  TEAM: 'team',
  PROJECT: 'project',
}

// Icons for groups
const GROUP_ICONS: Record<string, React.ElementType> = {
  [SCOPE_GROUPS.SYSTEM]: FileText, // Placeholder
  [SCOPE_GROUPS.TEAM]: FileText, // Placeholder
  [SCOPE_GROUPS.PROJECT]: Settings,
}

type SortableFieldRowProps = {
  field: FieldInfo
  index: number
  isSelected: boolean
  onSelect: (field: FieldInfo) => void
  isSortable: boolean
}

function SortableFieldRow({
  field,
  index,
  isSelected,
  onSelect,
  isSortable,
}: SortableFieldRowProps) {
  const { ref, handleRef } = useSortable({
    id: field.id!,
    index,
    disabled: !isSortable,
  })

  const Icon = field.config?.type ? FIELD_TYPE_ICONS[field.config.type as FieldType] : null

  return (
    <div
      ref={ref}
      className={cn(
        'flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted/50',
        isSelected && 'bg-muted',
      )}
      onClick={() => onSelect(field)}
    >
      {isSortable && (
        <div ref={handleRef} className="cursor-grab">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      {!isSortable && <div className="w-4" />} {/* Spacer */}
      {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
      {field.aiAutofill && <Sparkles className="h-4 w-4 text-muted-foreground shrink-0" />}
      <div className="flex-1 text-sm font-medium truncate">{field.config?.name}</div>
    </div>
  )
}

export function ManageFieldsDialog({ projectId, open, onOpenChange }: ManageFieldsDialogProps) {
  const { fields, updateFields } = useFieldStore()
  const [selectedGroup, setSelectedGroup] = useState<string>(SCOPE_GROUPS.PROJECT)
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const queryClient = useQueryClient()
  useEffect(() => {
    if (open) {
      queryClient.invalidateQueries({ queryKey: ['fields', projectId] })
    }
  }, [open, projectId, queryClient])

  // Editor State
  const [editLabel, setEditLabel] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editConfig, setEditConfig] = useState<any>({})
  const [editAiAutofill, setEditAiAutofill] = useState(false)
  const [editDescription, setEditDescription] = useState('')

  // Creator State
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<FieldType | ''>('')
  const [newAiAutofill, setNewAiAutofill] = useState(false)
  const [newDescription, setNewDescription] = useState('')
  const [newOptions, setNewOptions] = useState<SelectOption[]>([])

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
      const newField: MetadataFieldInfo = { ...(data as MetadataFieldInfo), visible: true }
      updateFields([...fields, newField])
      setIsCreating(false)
      setSelectedFieldId(data.id!)
      resetEditor(data)
      toast.success(m.field_created_successfully())
    },
  })
  const $put = client.api.fields[':fieldId'].$put
  const { mutate: updateField } = useMutation<
    InferResponseType<typeof $put>,
    Error,
    InferRequestType<typeof $put>
  >({
    mutationFn: async (request) => {
      const res = await $put(request)
      if (!res.ok) throw new Error(m.failed_update_field())
      return (await res.json()) as MetadataFieldInfo
    },
    onSuccess: (data) => {
      const newFields = fields.map((f) =>
        f.id === data.id ? { ...f, ...(data as MetadataFieldInfo) } : f,
      )
      updateFields(newFields)
      toast.success(m.field_updated_successfully())
    },
  })
  const $delete = client.api.fields[':fieldId'].$delete
  const { mutate: deleteField } = useMutation<
    InferResponseType<typeof $delete>,
    Error,
    InferRequestType<typeof $delete>
  >({
    mutationFn: async (request) => {
      const res = await $delete(request)
      if (!res.ok) throw new Error(m.failed_delete_field())
      return null as unknown as InferResponseType<typeof $delete>
    },
    onSuccess: (_, variables) => {
      const newFields = fields.filter((f) => f.id !== variables.param.fieldId)
      updateFields(newFields)
      setSelectedFieldId(null)
      toast.success(m.field_deleted_successfully())
    },
  })

  const groups = useMemo(() => {
    // Normalize scopes to lowercase to match SCOPE_GROUPS definitions
    const presentScopes = Array.from(
      new Set(fields.map((f) => (f.scope || SCOPE_GROUPS.PROJECT).toLowerCase())),
    )
    // Ensure Project group is always present
    if (!presentScopes.includes(SCOPE_GROUPS.PROJECT)) {
      presentScopes.push(SCOPE_GROUPS.PROJECT)
    }

    return presentScopes.map((scope) => ({
      id: scope,
      label:
        scope === SCOPE_GROUPS.SYSTEM
          ? m.essentials()
          : scope === SCOPE_GROUPS.TEAM
            ? m.team_attributes()
            : scope === SCOPE_GROUPS.PROJECT
              ? m.custom_fields()
              : scope.charAt(0).toUpperCase() + scope.slice(1),
      icon: GROUP_ICONS[scope] || FileText,
    }))
  }, [fields])

  const filteredFields = useMemo(() => {
    return fields.filter((f) => (f.scope || SCOPE_GROUPS.PROJECT).toLowerCase() === selectedGroup)
  }, [fields, selectedGroup])

  const selectedField = useMemo(
    () => fields.find((f) => f.id === selectedFieldId),
    [fields, selectedFieldId],
  )

  const resetEditor = (field?: FieldInfo) => {
    if (field) {
      setEditLabel(field.config?.name || '') // Using name as label for now if label missing
      setEditConfig(field.config || {})
      setEditAiAutofill(field.aiAutofill || false)
      setEditDescription(field.description || '')
    } else {
      setEditLabel('')
      setEditConfig({})
      setEditAiAutofill(false)
      setEditDescription('')
    }
  }

  const handleSelectField = (field: FieldInfo) => {
    setIsCreating(false)
    setSelectedFieldId(field.id!)
    resetEditor(field)
  }

  const handleCreateClick = () => {
    setIsCreating(true)
    setSelectedFieldId(null)
    setNewName('')
    setNewType('')
    setNewAiAutofill(false)
    setNewDescription('')
    setNewOptions([])
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { source, target } = event.operation
    if (source && target && source.id !== target.id) {
      const oldIndex = fields.findIndex((f) => f.id === source.id)
      const newIndex = fields.findIndex((f) => f.id === target.id)
      const newFields = arrayMove(fields, oldIndex, newIndex)
      updateFields(newFields)

      // Only persist order if we are in project scope (custom fields)
      // or if the API supports ordering for other scopes.
      if (selectedGroup === SCOPE_GROUPS.PROJECT) {
        updateFieldsOrder({
          param: { projectId: projectId },
          json: newFields.map((f: MetadataFieldInfo) => ({
            fieldId: f.id!,
            visible: f.visible || false,
          })),
        })
      }
    }
  }

  const handleSaveCreation = () => {
    if (!newName || !newType) return
    const typeConfig =
      newType === FieldType.select
        ? { select: { options: newOptions } }
        : newType === FieldType.selectMulti
          ? { selectMulti: { options: newOptions } }
          : {}
    createField({
      param: { projectId: projectId },
      json: {
        config: {
          name: newName,
          type: newType,
          ...typeConfig,
        },
        label: newName,
        scope: selectedGroup === SCOPE_GROUPS.PROJECT ? undefined : selectedGroup,
        aiAutofill: newAiAutofill,
        description: newDescription,
      },
    })
  }

  const handleSaveEdit = () => {
    if (!selectedField) return
    updateField({
      param: { fieldId: selectedField.id! },
      json: {
        config: {
          ...selectedField.config,
          ...editConfig,
          name: editLabel,
        },
        aiAutofill: editAiAutofill,
        description: editDescription,
      },
    })
  }

  const handleDelete = () => {
    if (!selectedField) return
    if (confirm(m.confirm_delete_field())) {
      deleteField({ param: { fieldId: selectedField.id! } })
    }
  }

  // --- Render Helpers for Config ---

  const renderConfigEditor = () => {
    if (isCreating) {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{m.field_name()}</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={m.field_name_placeholder()}
            />
          </div>
          <div className="space-y-2">
            <Label>{m.field_type()}</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {newType ? (
                    <span className="capitalize">{newType.replace(/_/g, ' ')}</span>
                  ) : (
                    <span className="text-muted-foreground">{m.select_type()}</span>
                  )}
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-60 overflow-y-auto">
                {Object.values(FieldType).map((type) => (
                  <DropdownMenuItem
                    key={type}
                    onClick={() => {
                      setNewType(type)
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
            <Label>{m.description()}</Label>
            <Input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder={m.description_optional_placeholder()}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Switch checked={newAiAutofill} onCheckedChange={setNewAiAutofill} />
            <Label>{m.ai_autofill()}</Label>
          </div>

          {(newType === FieldType.select || newType === FieldType.selectMulti) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">{m.options()}</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const newOption: SelectOption = {
                      id: ulid(),
                      displayName: m.new_option(),
                      color: getRandomUnusedColor(newOptions),
                    }
                    setNewOptions([...newOptions, newOption])
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" /> {m.add_option()}
                </Button>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {newOptions.map((opt, idx) => (
                  <div key={opt.id || idx} className="flex items-center gap-2">
                    <Input
                      value={opt.displayName}
                      onChange={(e) => {
                        const updated = [...newOptions]
                        updated[idx] = { ...opt, displayName: e.target.value }
                        setNewOptions(updated)
                      }}
                      placeholder={m.option_name_placeholder()}
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
        </div>
      )
    }

    if (!selectedField) {
      return <div className="text-muted-foreground text-sm">{m.select_field_to_edit()}</div>
    }

    const isReadOnly = selectedField.readOnly

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Input
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            disabled={isReadOnly}
            className="font-medium"
          />
          {isReadOnly && <Lock className="h-4 w-4 text-muted-foreground ml-2" />}
        </div>

        {/* Type Specific Configs */}
        {/* For Select / Select Multi, we might want option editing */}
        {/* For now, just a placeholder or basic json editor if complex? */}
        {/* User requirement: "implement editing for all field types" */}

        {/* Generic placeholder for options */}
        <div className="text-sm text-muted-foreground">
          {m.type_label()}{' '}
          <span className="capitalize">{selectedField.config?.type?.replace(/_/g, ' ')}</span>
        </div>

        <div className="space-y-2">
          <Label>{m.description()}</Label>
          <Input
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder={m.description_optional_placeholder()}
            disabled={isReadOnly}
          />
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            checked={editAiAutofill}
            onCheckedChange={setEditAiAutofill}
            disabled={isReadOnly}
          />
          <Label>{m.ai_autofill()}</Label>
        </div>

        {/* TODO: Add specific option editors here */}
        {/* Example: Add option button for select types */}
        {(selectedField.config?.type === 'select' ||
          selectedField.config?.type === 'selectMulti') && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">{m.options()}</label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const currentOptions =
                    (selectedField.config?.type === 'select'
                      ? editConfig.select?.options
                      : editConfig.selectMulti?.options) || []
                  const newOption = {
                    id: ulid(),
                    displayName: m.new_option(),
                    color: getRandomUnusedColor(currentOptions),
                  }
                  const newOptions = [...currentOptions, newOption]

                  setEditConfig({
                    ...editConfig,
                    [selectedField.config?.type === 'select' ? 'select' : 'selectMulti']: {
                      options: newOptions,
                    },
                  })
                }}
              >
                <Plus className="h-4 w-4 mr-2" /> {m.add_option()}
              </Button>
            </div>
            <div className="space-y-2">
              {(
                (selectedField.config?.type === 'select'
                  ? editConfig.select?.options
                  : editConfig.selectMulti?.options) || []
              ).map((opt: SelectOption, idx: number) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={opt.displayName}
                    onChange={(e) => {
                      const newOpts = [
                        ...((selectedField.config?.type === 'select'
                          ? editConfig.select?.options
                          : editConfig.selectMulti?.options) || []),
                      ]
                      newOpts[idx] = { ...opt, displayName: e.target.value }
                      setEditConfig({
                        ...editConfig,
                        [selectedField.config?.type === 'select' ? 'select' : 'selectMulti']: {
                          options: newOpts,
                        },
                      })
                    }}
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
                        disabled={isReadOnly}
                      />
                    </PopoverTrigger>
                    {!isReadOnly && (
                      <PopoverContent className="p-2 w-auto" align="end">
                        <div className="flex gap-1">
                          {PREDEFINED_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              className="w-5 h-5 rounded-full border cursor-pointer hover:scale-110 transition-transform"
                              style={{ backgroundColor: COLOR_MAP[color]?.hex || color }}
                              onClick={() => {
                                const newOpts = [
                                  ...((selectedField.config?.type === 'select'
                                    ? editConfig.select?.options
                                    : editConfig.selectMulti?.options) || []),
                                ]
                                newOpts[idx] = { ...opt, color }
                                setEditConfig({
                                  ...editConfig,
                                  [selectedField.config?.type === 'select'
                                    ? 'select'
                                    : 'selectMulti']: {
                                    options: newOpts,
                                  },
                                })
                              }}
                            />
                          ))}
                        </div>
                      </PopoverContent>
                    )}
                  </Popover>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const newOpts = (
                        (selectedField.config?.type === 'select'
                          ? editConfig.select?.options
                          : editConfig.selectMulti?.options) || []
                      ).filter((_: SelectOption, i: number) => i !== idx)
                      setEditConfig({
                        ...editConfig,
                        [selectedField.config?.type === 'select' ? 'select' : 'selectMulti']: {
                          options: newOpts,
                        },
                      })
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isReadOnly && selectedField.scope?.toLowerCase() !== 'system' && (
          <div className="pt-4 flex justify-between">
            <Button
              variant="outline"
              onClick={handleDelete}
              className="text-destructive hover:bg-destructive/10"
            >
              {m.delete_field()}
            </Button>
          </div>
        )}
      </div>
    )
  }

  // --- Main Render ---

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[50rem] h-[70vh] flex flex-col p-0 gap-0">
        <div className="p-4 border-b flex items-center justify-between">
          <DialogTitle>{m.manage_fields()}</DialogTitle>
        </div>
        <div className="flex overflow-hidden h-full">
          {/* Left Column: Groups */}
          <div className="w-60 border-r bg-muted/30 p-4 space-y-1">
            <div className="font-semibold mb-4 px-2">{m.groups()}</div>
            {groups.map((group) => (
              <button
                key={group.id}
                onClick={() => {
                  setSelectedGroup(group.id)
                  setIsCreating(false)
                  setSelectedFieldId(null)
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-muted text-left',
                  selectedGroup === group.id && 'bg-muted text-foreground',
                )}
              >
                <group.icon className="h-4 w-4" />
                {group.label}
              </button>
            ))}
          </div>

          {/* Middle Column: Field List */}
          <div className="w-64 border-r flex flex-col">
            <div className="p-4 border-b flex items-center justify-between bg-background h-[57px]">
              <span className="font-medium text-sm">
                {groups.find((g) => g.id === selectedGroup)?.label}
              </span>
              {selectedGroup === SCOPE_GROUPS.PROJECT && (
                <Button size="sm" variant="outline" className="h-8" onClick={handleCreateClick}>
                  {m.new_label()} <Plus className="ml-1 h-3 w-3" />
                </Button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              <DragDropProvider
                sensors={[
                  PointerSensor.configure({
                    activationConstraints: [
                      new PointerActivationConstraints.Distance({ value: 8 }),
                    ],
                  }),
                  KeyboardSensor,
                ]}
                onDragEnd={handleDragEnd}
              >
                {filteredFields.map((field, index) => (
                  <SortableFieldRow
                    key={field.id}
                    field={field}
                    index={index}
                    isSelected={selectedFieldId === field.id}
                    onSelect={handleSelectField}
                    isSortable={selectedGroup === SCOPE_GROUPS.PROJECT}
                  />
                ))}
              </DragDropProvider>
              {filteredFields.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-8">
                  {m.no_fields_found()}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Config */}
          <div className="flex-1 bg-background flex flex-col">
            <div className="flex-1 overflow-y-auto p-6">{renderConfigEditor()}</div>
            {(isCreating || (selectedField && !selectedField.readOnly)) && (
              <div className="p-4 border-t flex justify-end gap-2 bg-muted/10">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsCreating(false)
                    if (selectedFieldId && selectedField) resetEditor(selectedField)
                  }}
                >
                  {m.cancel()}
                </Button>
                <Button onClick={isCreating ? handleSaveCreation : handleSaveEdit}>
                  {m.save()}
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
