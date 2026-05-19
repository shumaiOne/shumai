import { type FieldInfo as MetadataFieldInfo, type FieldInfo, FieldType } from '@/dtos/metadata'
import { client } from '@/ui/api/client'
import { useMutation } from '@tanstack/react-query'
import { InferRequestType, InferResponseType } from 'hono/client'
import { useFieldStore } from '@/ui/stores/fields'
import { DragDropProvider, KeyboardSensor, PointerSensor, type DragEndEvent } from '@dnd-kit/react'
import { useSortable } from '@dnd-kit/react/sortable'

import { Button } from '@/ui/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/components/ui/dropdown-menu'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import { Switch } from '@/ui/components/ui/switch'
import { arrayMove } from '@/ui/lib/dnd-utils'
import { PointerActivationConstraints } from '@dnd-kit/dom'
import { ChevronDown, GripVertical, Plus, Search, Settings, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'

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

  return (
    <div ref={ref} className="flex items-center justify-between p-2 rounded-md hover:bg-muted">
      <div className="flex items-center gap-2">
        <div ref={handleRef} className="cursor-grab">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        {field.aiAutofill && <Sparkles className="h-4 w-4 text-muted-foreground" />}
        <span className="text-sm">{field.config?.name}</span>
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
  onManageFields: () => void
  onSave?: () => void
}

export function FieldsManager({ projectId, onManageFields, onSave }: FieldsManagerProps) {
  const { fields, updateFields } = useFieldStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [view, setView] = useState<'list' | 'create'>('list')
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState<FieldType | ''>('')
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
      const newField: MetadataFieldInfo = {
        ...(data as MetadataFieldInfo),
        visible: true,
      }
      const newFieldsList = [...fields, newField]
      updateFields(newFieldsList)
      setNewFieldName('')

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
    const { source, target } = event.operation
    if (source && target && source.id !== target.id) {
      const oldIndex = fields.findIndex((f) => f.id === source.id)
      const newIndex = fields.findIndex((f) => f.id === target.id)
      const newFields = arrayMove(fields, oldIndex, newIndex)
      updateFields(newFields)
      updateFieldsOrder({
        param: { projectId: projectId },
        json: newFields.map((f: MetadataFieldInfo) => ({
          fieldId: f.id!,
          visible: f.visible || false,
        })),
      })
    }
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
    createField({
      param: { projectId: projectId },
      json: {
        config: {
          name: newFieldName,
          type: newFieldType,
        },
        label: newFieldName,
        aiAutofill: newAiAutofill,
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
            <Label htmlFor="field-name">Name</Label>
            <Input
              id="field-name"
              placeholder="New Field"
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between font-normal">
                  {newFieldType ? (
                    <span className="capitalize">{newFieldType.replace(/_/g, ' ')}</span>
                  ) : (
                    <span className="text-muted-foreground border-dashed">Select field type</span>
                  )}
                  <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                {Object.values(FieldType).map((type) => (
                  <DropdownMenuItem
                    key={type}
                    onClick={() => setNewFieldType(type)}
                    className="capitalize"
                  >
                    {type.replace(/_/g, ' ')}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-2">
            <Label htmlFor="field-desc">Description</Label>
            <Input
              id="field-desc"
              placeholder="Description (Optional)"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch id="ai-autofill" checked={newAiAutofill} onCheckedChange={setNewAiAutofill} />
            <Label htmlFor="ai-autofill">AI Autofill</Label>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setView('list')
                setNewFieldName('')
                setNewFieldType('')
                setNewAiAutofill(false)
                setNewDescription('')
              }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleCreateField}
              disabled={!newFieldName || !newFieldType}
            >
              Save
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
          Fields{' '}
          <span className="text-muted-foreground text-sm font-normal">
            ({visibleCount} visible)
          </span>
        </h3>
      </div>
      <div className="relative mb-4">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search fields"
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

      <div className="mt-4 space-y-2">
        <Button variant="secondary" className="w-full" onClick={onManageFields}>
          <Settings className="h-4 w-4 mr-2" />
          Manage Fields
        </Button>
        <Button className="w-full" onClick={() => setView('create')}>
          <Plus className="h-4 w-4 mr-2" />
          New Field
        </Button>
      </div>
    </div>
  )
}
