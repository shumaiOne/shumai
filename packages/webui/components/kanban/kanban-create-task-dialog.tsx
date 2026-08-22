import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/ui/components/ui/dialog'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { Textarea } from '@/ui/components/ui/textarea'
import { Label } from '@/ui/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/components/ui/avatar'
import { DateTimePicker } from '@/ui/components/datetime-picker'
import { Switch } from '@/ui/components/ui/switch'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { toast } from 'sonner'
import { m } from '@/ui/paraglide/messages.js'
import {
  KanbanTaskPriority,
  KanbanTaskStatus,
  type KanbanGoalInfo,
  type AgentInfo,
  type KanbanTaskAssetInfo,
} from '@shumai/dtos'
import { getPriorityBadgeColor, getPriorityLabel } from './kanban-types'
import { TaskTargetFolderDialog } from './edit-task-dialog/task-target-folder-dialog'
import { TaskParentSelector } from './task-parent-selector'
import { TaskRelatedAssets } from './task-related-assets'
import { Bot, Folder, Target, Loader2 } from 'lucide-react'
import { cn } from '@/ui/lib/utils'

interface KanbanCreateTaskDialogProps {
  teamId: string
  isOpen: boolean
  onClose: () => void
  initialStatus?: KanbanTaskStatus
  initialGoalId?: string | null
}

export function KanbanCreateTaskDialog({
  teamId,
  isOpen,
  onClose,
  initialGoalId,
}: KanbanCreateTaskDialogProps) {
  const queryClient = useQueryClient()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isAgentTask, setIsAgentTask] = useState(false)
  const [priority, setPriority] = useState<KanbanTaskPriority>(KanbanTaskPriority.MEDIUM)
  const [goalId, setGoalId] = useState<string>(initialGoalId || 'none')
  const [assigneeId, setAssigneeId] = useState<string>('none')
  const [reporterId, setReporterId] = useState<string>('none')
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null)
  const [targetFolderName, setTargetFolderName] = useState<string | null>(null)
  const [parentIds, setParentIds] = useState<string[]>([])
  const [selectedAssets, setSelectedAssets] = useState<KanbanTaskAssetInfo[]>([])
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setTitle('')
      setDescription('')
      setIsAgentTask(false)
      setPriority(KanbanTaskPriority.MEDIUM)
      setGoalId(initialGoalId || 'none')
      setAssigneeId('none')
      setReporterId('none')
      setStartDate(undefined)
      setDueDate(undefined)
      setProjectId(null)
      setTargetFolderId(null)
      setTargetFolderName(null)
      setParentIds([])
      setSelectedAssets([])
    }
  }, [isOpen, initialGoalId])

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
    enabled: !!teamId && isOpen,
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
    enabled: !!teamId && isOpen,
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
    enabled: !!teamId && isOpen,
  })

  const goals = goalsData?.data || []

  // Create task mutation
  const { mutate: createTask, isPending } = useMutation({
    mutationFn: async () => {
      const res = await client.api.teams[':teamId'].kanban.tasks.$post({
        param: { teamId },
        json: {
          title: title.trim(),
          description: description.trim() || undefined,
          isAgentTask,
          priority,
          goalId: goalId !== 'none' ? goalId : undefined,
          assigneeId: assigneeId !== 'none' ? assigneeId : undefined,
          reporterId: reporterId !== 'none' ? reporterId : undefined,
          startDate: startDate ? startDate.toISOString() : undefined,
          dueDate: dueDate ? dueDate.toISOString() : undefined,
          projectId: projectId || undefined,
          targetFolderId: targetFolderId || undefined,
          parentIds: parentIds.length > 0 ? parentIds : undefined,
          assetIds: selectedAssets.length > 0 ? selectedAssets.map((a) => a.id) : undefined,
        },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: m.error() }))
        throw new Error((err as { message?: string }).message || m.error())
      }
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'kanban', 'tasks'] })
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'kanban', 'goals'] })
      toast.success(m.task_created())
      onClose()
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || isPending) return
    createTask()
  }

  const isAgentic = isAgentTask

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{m.create_task()}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5 py-1">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="create-task-title">{m.task_title()}</Label>
              <Input
                id="create-task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={m.task_title_placeholder()}
                required
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="create-task-desc">{m.task_description()}</Label>
              <Textarea
                id="create-task-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={m.task_description_placeholder()}
                rows={3}
              />
            </div>

            {/* Properties Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Row 1: Agent Task Switch */}
              <div className="sm:col-span-2 flex items-center justify-between space-x-2 rounded-lg border border-border/80 bg-muted/30 p-2.5 h-14">
                <div className="space-y-0.5 min-w-0 pr-2">
                  <Label
                    htmlFor="create-is-agent-task"
                    className="text-xs font-medium cursor-pointer flex items-center gap-1.5"
                  >
                    <Bot className="w-3.5 h-3.5 text-purple-500" />
                    <span>{m.task_type_agent()}</span>
                  </Label>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                    {m.task_type_agent_desc()}
                  </p>
                </div>
                <Switch
                  id="create-is-agent-task"
                  checked={isAgentTask}
                  onCheckedChange={(checked) => {
                    setIsAgentTask(checked)
                    setAssigneeId('none')
                  }}
                />
              </div>

              {/* Row 2: Priority and Goal selectors */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  {m.task_priority()}
                </Label>
                <Select
                  value={priority}
                  onValueChange={(val) => setPriority(val as KanbanTaskPriority)}
                >
                  <SelectTrigger className="w-full h-9 text-xs">
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
                <Select value={goalId} onValueChange={setGoalId}>
                  <SelectTrigger className="w-full h-9 text-xs">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-muted-foreground italic">None</span>
                    </SelectItem>
                    {goals.map((g) => (
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

              {/* Row 3: Assignee and Reporter */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  {isAgentic ? m.select_agent() : m.assignee()}
                </Label>
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger className="w-full h-9 text-xs">
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
                <Select value={reporterId} onValueChange={setReporterId}>
                  <SelectTrigger className="w-full h-9 text-xs">
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsFolderPickerOpen(true)}
                    className="w-full justify-start h-9 text-xs truncate font-normal"
                  >
                    <Folder className="w-3.5 h-3.5 mr-2 text-primary shrink-0" />
                    <span className="truncate">{targetFolderName || m.select_target_folder()}</span>
                  </Button>
                </div>
              )}

              {/* Row 5: Start Date and Due Date */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  {m.start_date()}
                </Label>
                <DateTimePicker
                  value={startDate}
                  onChange={setStartDate}
                  placeholder={m.start_date()}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">{m.due_date()}</Label>
                <DateTimePicker
                  value={dueDate}
                  onChange={setDueDate}
                  placeholder={m.due_date()}
                  className="h-9 text-xs"
                />
              </div>

              {/* Row 6: Parent Tasks */}
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  {m.parent_tasks()}
                </Label>
                <TaskParentSelector teamId={teamId} value={parentIds} onChange={setParentIds} />
              </div>

              {/* Row 7: Related Assets */}
              <div className="sm:col-span-2 pt-1">
                <TaskRelatedAssets
                  teamId={teamId}
                  projectId={projectId}
                  assets={selectedAssets}
                  onAddAssets={(newAssets) => setSelectedAssets((prev) => [...prev, ...newAssets])}
                  onRemoveAsset={(assetId) =>
                    setSelectedAssets((prev) => prev.filter((a) => a.id !== assetId))
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              {m.cancel()}
            </Button>
            <Button type="submit" disabled={!title.trim() || isPending}>
              {isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              {m.create()}
            </Button>
          </DialogFooter>
        </form>

        {/* Target Folder Dialog */}
        {isFolderPickerOpen && (
          <TaskTargetFolderDialog
            teamId={teamId}
            currentProjectId={projectId}
            currentTargetFolderId={targetFolderId}
            isOpen={isFolderPickerOpen}
            onClose={() => setIsFolderPickerOpen(false)}
            onSelect={(projId, foldId, foldName) => {
              setProjectId(projId)
              setTargetFolderId(foldId)
              setTargetFolderName(foldName || 'Selected Folder')
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
