import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { m } from '@/ui/paraglide/messages.js'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { Textarea } from '@/ui/components/ui/textarea'
import { Label } from '@/ui/components/ui/label'
import { Switch } from '@/ui/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/components/ui/avatar'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import { DateTimePicker } from '@/ui/components/datetime-picker'
import { toast } from 'sonner'
import {
  KanbanTaskPriority,
  type KanbanTaskDetail,
  type KanbanGoalInfo,
  type AgentInfo,
  type KanbanTaskAssetInfo,
  type UpdateKanbanTaskRequest,
  UNASSIGNED_GOAL_ID,
} from '@shumai/dtos'
import { getPriorityBadgeColor, getPriorityLabel } from '../kanban-types'
import { TaskParentSelector } from '../task-parent-selector'
import { TaskRelatedAssets } from '../task-related-assets'
import { TaskTargetFolderDialog } from './task-target-folder-dialog'
import { Bot, Folder, Target, Loader2 } from 'lucide-react'
import { cn } from '@/ui/lib/utils'

interface TaskInfoFormProps {
  teamId: string
  task: KanbanTaskDetail
  canEdit?: boolean
}

export function TaskInfoForm({ teamId, task, canEdit = true }: TaskInfoFormProps) {
  const queryClient = useQueryClient()

  // Local state for debounced text inputs
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description || '')
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false)
  const [targetFolderName, setTargetFolderName] = useState<string | null>(null)

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync with prop changes if task id changed
  useEffect(() => {
    setTitle(task.title)
    setDescription(task.description || '')
  }, [task.id, task.title, task.description])

  // Queries for selectors
  const { data: members = [] } = useQuery({
    queryKey: ['teams', teamId, 'members', 'human'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].members.$get({
        param: { teamId },
        query: { includeAgents: 'false' },
      })
      if (!res.ok) return []
      const data = await res.json()
      return Array.isArray(data) ? data : []
    },
    enabled: !!teamId,
  })

  const { data: agents = [] } = useQuery({
    queryKey: ['teams', teamId, 'agents'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].agents.$get({
        param: { teamId },
      })
      if (!res.ok) return []
      return ((await res.json()) as AgentInfo[]) || []
    },
    enabled: !!teamId,
  })

  const { data: goalsData } = useQuery({
    queryKey: ['teams', teamId, 'kanban', 'goals'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].kanban.goals.$get({
        param: { teamId },
        query: {},
      })
      if (!res.ok) return { data: [] }
      return (await res.json()) as { data: KanbanGoalInfo[] }
    },
    enabled: !!teamId,
  })

  const goals = goalsData?.data || []

  // Auto-save update mutation
  const { mutate: updateTask, isPending: isUpdating } = useMutation({
    mutationFn: async (patch: UpdateKanbanTaskRequest) => {
      const res = await client.api.teams[':teamId'].kanban.tasks[':taskId'].$patch({
        param: { teamId, taskId: task.id },
        json: patch,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: m.error() }))
        throw new Error((err as { message?: string }).message || m.error())
      }
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'kanban', 'task', task.id] })
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'kanban', 'tasks'] })
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })

  const { mutate: linkAssets } = useMutation({
    mutationFn: async (newAssets: KanbanTaskAssetInfo[]) => {
      const res = await client.api.teams[':teamId'].kanban.tasks[':taskId'].assets.$post({
        param: { teamId, taskId: task.id },
        json: { assetIds: newAssets.map((a) => a.id) },
      })
      if (!res.ok) throw new Error('Failed to link assets')
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'kanban', 'task', task.id] })
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'kanban', 'tasks'] })
      toast.success(m.asset_linked())
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })

  const { mutate: unlinkAsset } = useMutation({
    mutationFn: async (assetId: string) => {
      const res = await client.api.teams[':teamId'].kanban.tasks[':taskId'].assets[
        ':assetId'
      ].$delete({
        param: { teamId, taskId: task.id, assetId },
      })
      if (!res.ok) throw new Error('Failed to unlink asset')
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'kanban', 'task', task.id] })
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'kanban', 'tasks'] })
      toast.success(m.asset_unlinked())
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })

  // Debounced auto-save handler for text fields
  const handleTextChange = (field: 'title' | 'description', value: string) => {
    if (field === 'title') setTitle(value)
    if (field === 'description') setDescription(value)

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      if (field === 'title' && value.trim() && value.trim() !== task.title) {
        updateTask({ title: value.trim() })
      } else if (field === 'description' && value !== (task.description || '')) {
        updateTask({ description: value.trim() || null })
      }
    }, 600)
  }

  const isAgentic = task.isAgentTask

  return (
    <ScrollArea className="h-full p-5">
      <div className="space-y-6 w-full pr-3">
        {/* Title Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label
              htmlFor="task-title"
              className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
            >
              {m.task_title()}
            </Label>
            {isUpdating && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                {m.saving()}
              </span>
            )}
          </div>
          <Input
            id="task-title"
            value={title}
            onChange={(e) => handleTextChange('title', e.target.value)}
            disabled={!canEdit}
            className="text-base font-semibold h-10 bg-background"
            placeholder={m.task_title_placeholder()}
          />
        </div>

        {/* Description Textarea */}
        <div className="space-y-1.5">
          <Label
            htmlFor="task-description"
            className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
          >
            {m.task_description()}
          </Label>
          <Textarea
            id="task-description"
            value={description}
            onChange={(e) => handleTextChange('description', e.target.value)}
            disabled={!canEdit}
            rows={5}
            className="text-xs leading-relaxed bg-background"
            placeholder={m.task_description_placeholder()}
          />
        </div>

        {/* Properties Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-muted/20 border border-border/60">
          {/* Row 1: Agent Task Switch (Read-Only) */}
          <div className="sm:col-span-2 flex items-center justify-between space-x-2 rounded-md border border-border/60 bg-background/50 px-3 py-2 h-14">
            <div className="space-y-0.5 min-w-0 pr-2">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-orange-500" />
                <span>{m.task_type_agent()}</span>
              </Label>
              <p className="text-[11px] text-muted-foreground/80 line-clamp-1">
                {m.task_type_agent_desc()}
              </p>
            </div>
            <Switch checked={task.isAgentTask} disabled={true} />
          </div>

          {/* Row 2: Priority Selector and Goal Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">{m.task_priority()}</Label>
            <Select
              value={task.priority}
              onValueChange={(val) => updateTask({ priority: val as KanbanTaskPriority })}
              disabled={!canEdit}
            >
              <SelectTrigger className="w-full h-8 text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(KanbanTaskPriority).map((p) => (
                  <SelectItem key={p} value={p}>
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded text-[10px] uppercase font-medium',
                        getPriorityBadgeColor(p),
                      )}
                    >
                      {getPriorityLabel(p)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">{m.goals()}</Label>
            <Select
              value={task.goal?.id || 'none'}
              onValueChange={(val) => updateTask({ goalId: val === 'none' ? null : val })}
              disabled={!canEdit}
            >
              <SelectTrigger className="w-full h-8 text-xs bg-background">
                <SelectValue placeholder={m.no_folder_selected()} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground italic">None</span>
                </SelectItem>
                {goals
                  .filter((g) => g.id !== UNASSIGNED_GOAL_ID)
                  .map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      <div className="flex items-center gap-2">
                        <Target className="w-3.5 h-3.5 text-primary" />
                        <span>{g.title}</span>
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Row 3: Assignee Selector and Reporter Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              {isAgentic ? m.select_agent() : m.assignee()}
            </Label>
            <Select
              value={task.assignee?.id || 'none'}
              onValueChange={(val) => updateTask({ assigneeId: val === 'none' ? null : val })}
              disabled={!canEdit}
            >
              <SelectTrigger className="w-full h-8 text-xs bg-background">
                <SelectValue placeholder={m.unassigned()} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground italic">{m.unassigned()}</span>
                </SelectItem>
                {isAgentic
                  ? agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        <div className="flex items-center gap-2">
                          <Bot className="w-3.5 h-3.5 text-purple-500" />
                          <span>{a.name}</span>
                        </div>
                      </SelectItem>
                    ))
                  : members.map((mItem) => (
                      <SelectItem key={mItem.id} value={mItem.id}>
                        <div className="flex items-center gap-2">
                          <Avatar size="sm" className="w-4 h-4">
                            <AvatarImage src={mItem.image} />
                            <AvatarFallback className="text-[8px]">
                              {mItem.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span>{mItem.name}</span>
                        </div>
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">{m.reporter()}</Label>
            <Select
              value={task.reporter?.id || 'none'}
              onValueChange={(val) => updateTask({ reporterId: val === 'none' ? null : val })}
              disabled={!canEdit}
            >
              <SelectTrigger className="w-full h-8 text-xs bg-background">
                <SelectValue placeholder={m.unassigned()} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground italic">{m.unassigned()}</span>
                </SelectItem>
                {members.map((mItem) => (
                  <SelectItem key={mItem.id} value={mItem.id}>
                    <div className="flex items-center gap-2">
                      <Avatar size="sm" className="w-4 h-4">
                        <AvatarImage src={mItem.image} />
                        <AvatarFallback className="text-[8px]">
                          {mItem.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span>{mItem.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Row 4: Target Folder Selector (only for agent task) */}
          {isAgentic && (
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                {m.target_folder()}
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsFolderPickerOpen(true)}
                  disabled={!canEdit}
                  className="w-full justify-start h-8 text-xs bg-background truncate font-normal"
                >
                  <Folder className="w-3.5 h-3.5 mr-2 text-primary shrink-0" />
                  <span className="truncate">
                    {targetFolderName ||
                      (task.targetFolderId ? 'Selected Folder' : m.select_target_folder())}
                  </span>
                </Button>
              </div>
            </div>
          )}

          {/* Row 5: Start Date and Due Date */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">{m.start_date()}</Label>
            <DateTimePicker
              value={task.startDate ? new Date(task.startDate) : undefined}
              onChange={(date) => updateTask({ startDate: date ? date.toISOString() : null })}
              disabled={!canEdit}
              placeholder={m.start_date()}
              className="h-8 text-xs bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">{m.due_date()}</Label>
            <DateTimePicker
              value={task.dueDate ? new Date(task.dueDate) : undefined}
              onChange={(date) => updateTask({ dueDate: date ? date.toISOString() : null })}
              disabled={!canEdit}
              placeholder={m.due_date()}
              className="h-8 text-xs bg-background"
            />
          </div>

          {/* Row 6: Parent Tasks */}
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">{m.parent_tasks()}</Label>
            <TaskParentSelector
              teamId={teamId}
              currentTaskId={task.id}
              excludeTaskIds={task.dependents.map((d) => d.id)}
              value={task.dependencies.map((d) => d.id)}
              knownTasks={[...task.dependencies, ...task.dependents]}
              onChange={(parentIds) => updateTask({ parentIds })}
              canEdit={canEdit}
            />
          </div>

          {/* Row 7: Related Assets */}
          <div className="sm:col-span-2 pt-1">
            <TaskRelatedAssets
              teamId={teamId}
              projectId={task.projectId}
              assets={task.assets || []}
              onAddAssets={(newAssets) => linkAssets(newAssets)}
              onRemoveAsset={(assetId) => unlinkAsset(assetId)}
              disabled={!canEdit}
            />
          </div>
        </div>
      </div>

      {/* Target Folder Dialog */}
      {isFolderPickerOpen && (
        <TaskTargetFolderDialog
          teamId={teamId}
          currentProjectId={task.projectId}
          currentTargetFolderId={task.targetFolderId}
          isOpen={isFolderPickerOpen}
          onClose={() => setIsFolderPickerOpen(false)}
          onSelect={(projId, foldId, foldName) => {
            setTargetFolderName(foldName || 'Selected Folder')
            updateTask({ projectId: projId, targetFolderId: foldId })
          }}
        />
      )}
    </ScrollArea>
  )
}
