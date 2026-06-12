import {
  type FieldInfo as MetadataFieldInfo,
  type FieldInfo,
  FieldType,
  type SelectOption,
} from '@shumai/dtos'
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
import { FIELD_TYPE_ICONS, PREDEFINED_COLORS, COLOR_MAP } from './fields-manager'

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

const GROUP_LABELS: Record<string, string> = {
  [SCOPE_GROUPS.SYSTEM]: 'Essentials',
  [SCOPE_GROUPS.TEAM]: 'Team Attributes', // Assuming this, user screenshot said "File Attributes" but maybe that's system?
  [SCOPE_GROUPS.PROJECT]: 'Custom Fields',
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

  const $patchOrder = client.api.projects[':projectId'].fields.order.$patch
  const { mutate: updateFieldsOrder } = useMutation<
    InferResponseType<typeof $patchOrder>,
    Error,
    InferRequestType<typeof $patchOrder>
  >({
    mutationFn: async (request) => {
      const res = await $patchOrder(request)
      if (!res.ok) throw new Error('Failed to update fields order')
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
      if (!res.ok) throw new Error('Failed to create field')
      return (await res.json()) as MetadataFieldInfo
    },
    onSuccess: (data) => {
      const newField: MetadataFieldInfo = { ...(data as MetadataFieldInfo), visible: true }
      updateFields([...fields, newField])
      setIsCreating(false)
      setSelectedFieldId(data.id!)
      resetEditor(data)
      toast.success('Field created successfully')
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
      if (!res.ok) throw new Error('Failed to update field')
      return (await res.json()) as MetadataFieldInfo
    },
    onSuccess: (data) => {
      const newFields = fields.map((f) =>
        f.id === data.id ? { ...f, ...(data as MetadataFieldInfo) } : f,
      )
      updateFields(newFields)
      toast.success('Field updated successfully')
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
      if (!res.ok) throw new Error('Failed to delete field')
      return null as unknown as InferResponseType<typeof $delete>
    },
    onSuccess: (_, variables) => {
      const newFields = fields.filter((f) => f.id !== variables.param.fieldId)
      updateFields(newFields)
      setSelectedFieldId(null)
      toast.success('Field deleted successfully')
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
      label: GROUP_LABELS[scope] || scope.charAt(0).toUpperCase() + scope.slice(1),
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
    createField({
      param: { projectId: projectId },
      json: {
        config: {
          name: newName,
          type: newType,
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
    if (confirm('Are you sure you want to delete this field?')) {
      deleteField({ param: { fieldId: selectedField.id! } })
    }
  }

  // --- Render Helpers for Config ---

  const renderConfigEditor = () => {
    if (isCreating) {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Field Name</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Status"
            />
          </div>
          <div className="space-y-2">
            <Label>Field Type</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {newType ? (
                    <span className="capitalize">{newType.replace(/_/g, ' ')}</span>
                  ) : (
                    <span className="text-muted-foreground">Select type</span>
                  )}
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-60 overflow-y-auto">
                {Object.values(FieldType).map((type) => (
                  <DropdownMenuItem
                    key={type}
                    onClick={() => setNewType(type)}
                    className="capitalize"
                  >
                    {type.replace(/_/g, ' ')}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Description (Optional)"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Switch checked={newAiAutofill} onCheckedChange={setNewAiAutofill} />
            <Label>AI Autofill</Label>
          </div>
        </div>
      )
    }

    if (!selectedField) {
      return <div className="text-muted-foreground text-sm">Select a field to edit options</div>
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
          Type: <span className="capitalize">{selectedField.config?.type?.replace(/_/g, ' ')}</span>
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <Input
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder="Description (Optional)"
            disabled={isReadOnly}
          />
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            checked={editAiAutofill}
            onCheckedChange={setEditAiAutofill}
            disabled={isReadOnly}
          />
          <Label>AI Autofill</Label>
        </div>

        {/* TODO: Add specific option editors here */}
        {/* Example: Add option button for select types */}
        {(selectedField.config?.type === 'select' ||
          selectedField.config?.type === 'selectMulti') && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Options</label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // Logic to add option
                  const newOption = {
                    id: crypto.randomUUID(),
                    displayName: 'New Option',
                    color: '#808080',
                  }
                  const currentOptions =
                    (selectedField.config?.type === 'select'
                      ? editConfig.select?.options
                      : editConfig.selectMulti?.options) || []
                  const newOptions = [...currentOptions, newOption]

                  setEditConfig({
                    ...editConfig,
                    [selectedField.config?.type === 'select' ? 'select' : 'selectMulti']: {
                      options: newOptions,
                    },
                  })
                }}
              >
                <Plus className="h-4 w-4 mr-2" /> Add option
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
              Delete field
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
          <DialogTitle>Manage Fields</DialogTitle>
        </div>
        <div className="flex overflow-hidden h-full">
          {/* Left Column: Groups */}
          <div className="w-60 border-r bg-muted/30 p-4 space-y-1">
            <div className="font-semibold mb-4 px-2">Groups</div>
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
                  New <Plus className="ml-1 h-3 w-3" />
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
                  No fields found
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
                  Cancel
                </Button>
                <Button onClick={isCreating ? handleSaveCreation : handleSaveEdit}>Save</Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
