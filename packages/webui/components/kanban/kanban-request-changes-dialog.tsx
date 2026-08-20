import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import { Button } from '@/ui/components/ui/button'
import { Textarea } from '@/ui/components/ui/textarea'
import { Label } from '@/ui/components/ui/label'
import { client } from '@/ui/api/client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { m } from '@/ui/paraglide/messages.js'
import { KanbanTaskStatus } from '@shumai/dtos'
import { Loader2, MessageSquareReply } from 'lucide-react'

interface KanbanRequestChangesDialogProps {
  teamId: string
  taskId: string | null
  taskTitle?: string
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function KanbanRequestChangesDialog({
  teamId,
  taskId,
  taskTitle,
  isOpen,
  onClose,
  onSuccess,
}: KanbanRequestChangesDialogProps) {
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')

  const { mutate: submitRequestChanges, isPending } = useMutation({
    mutationFn: async () => {
      if (!taskId) return
      const res = await client.api.teams[':teamId'].kanban.tasks[':taskId'].$patch({
        param: { teamId, taskId },
        json: { status: KanbanTaskStatus.TODO, reason: reason.trim() },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: m.error() }))
        throw new Error((err as { message?: string }).message || m.error())
      }
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'kanban', 'tasks'] })
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'kanban', 'task', taskId] })
      toast.success(m.changes_requested())
      setReason('')
      onSuccess?.()
      onClose()
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim() || !taskId) return
    submitRequestChanges()
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setReason('')
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <MessageSquareReply className="w-4 h-4" />
              </div>
              <DialogTitle>{m.request_changes()}</DialogTitle>
            </div>
            <DialogDescription>
              {taskTitle
                ? `${m.changes_requested_reason()}: ${taskTitle}`
                : m.changes_requested_reason()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="change-reason">{m.changes_requested_reason()}</Label>
            <Textarea
              id="change-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={m.changes_requested_placeholder()}
              rows={4}
              required
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              {m.cancel()}
            </Button>
            <Button type="submit" disabled={!reason.trim() || isPending}>
              {isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              {m.request_changes()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
