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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { toast } from 'sonner'
import { m } from '@/ui/paraglide/messages.js'
import {
  KanbanTaskPriority,
  KanbanTaskStatus,
  KanbanTaskType,
  type KanbanGoalInfo,
  type AgentInfo,
} from '@shumai/dtos'
import { getPriorityBadgeColor, getPriorityLabel } from './kanban-types'
import { TaskTargetFolderDialog } from './edit-task-dialog/task-target-folder-dialog'
import { Bot, User, Target, Folder, Loader2 } from 'lucide-react'
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
  const [type, setType] = useState<KanbanTaskType>(KanbanTaskType.MANUAL)
  const [priority, setPriority] = useState<KanbanTaskPriority>(KanbanTaskPriority.MEDIUM)
  const [goalId, setGoalId] = useState<string>(initialGoalId || 'none')
  const [assigneeId, setAssigneeId] = useState<string>('none')
  const [reporterId, setReporterId] = useState<string>('none')
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null)
  const [targetFolderName, setTargetFolderName] = useState<string | null>(null)
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setTitle('')
      setDescription('')
      setType(KanbanTaskType.MANUAL)
      setPriority(KanbanTaskPriority.MEDIUM)
      setGoalId(initialGoalId || 'none')
      setAssigneeId('none')
      setReporterId('none')
      setStartDate(undefined)
      setDueDate(undefined)
      setProjectId(null)
      setTargetFolderId(null)
      setTargetFolderName(null)
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
          type,
          priority,
          goalId: goalId !== 'none' ? goalId : undefined,
          assigneeId: assigneeId !== 'none' ? assigneeId : undefined,
          reporterId: reporterId !== 'none' ? reporterId : undefined,
          startDate: startDate ? startDate.toISOString() : undefined,
          dueDate: dueDate ? dueDate.toISOString() : undefined,
          projectId: projectId || undefined,
          targetFolderId: targetFolderId || undefined,
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

  const isAgentic = type === KanbanTaskType.AGENTIC

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
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

            {/* Type & Priority Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{m.task_type()}</Label>
                <Select
                  value={type}
                  onValueChange={(val) => {
                    setType(val as KanbanTaskType)
                    setAssigneeId('none')
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={KanbanTaskType.MANUAL}>
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5" />
                        <span>{m.task_type_manual()}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value={KanbanTaskType.AGENTIC}>
                      <div className="flex items-center gap-2">
                        <Bot className="w-3.5 h-3.5 text-purple-500" />
                        <span>{m.task_type_agentic()}</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{m.task_priority()}</Label>
                <Select
                  value={priority}
                  onValueChange={(val) => setPriority(val as KanbanTaskPriority)}
                >
                  <SelectTrigger className="h-9 text-xs">
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
            </div>

            {/* Assignee & Reporter Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{isAgentic ? m.select_agent() : m.assignee()}</Label>
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger className="h-9 text-xs">
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
                <Label>{m.reporter()}</Label>
                <Select value={reporterId} onValueChange={setReporterId}>
                  <SelectTrigger className="h-9 text-xs">
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
            </div>

            {/* Goal & Target Folder Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{m.goals()}</Label>
                <Select value={goalId} onValueChange={setGoalId}>
                  <SelectTrigger className="h-9 text-xs">
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

              <div className="space-y-1.5">
                <Label>{m.target_folder()}</Label>
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
            </div>

            {/* Dates Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{m.start_date()}</Label>
                <DateTimePicker
                  value={startDate}
                  onChange={setStartDate}
                  placeholder={m.start_date()}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label>{m.due_date()}</Label>
                <DateTimePicker
                  value={dueDate}
                  onChange={setDueDate}
                  placeholder={m.due_date()}
                  className="h-9 text-xs"
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
