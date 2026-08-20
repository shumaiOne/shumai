import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { Textarea } from '@/ui/components/ui/textarea'
import { Label } from '@/ui/components/ui/label'
import { client } from '@/ui/api/client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { m } from '@/ui/paraglide/messages.js'
import type { KanbanGoalInfo } from '@shumai/dtos'
import { Loader2 } from 'lucide-react'

interface KanbanCreateGoalDialogProps {
  teamId: string
  isOpen: boolean
  onClose: () => void
  goalToEdit?: KanbanGoalInfo | null
}

export function KanbanCreateGoalDialog({
  teamId,
  isOpen,
  onClose,
  goalToEdit,
}: KanbanCreateGoalDialogProps) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (goalToEdit) {
      setTitle(goalToEdit.title)
      setDescription(goalToEdit.description || '')
    } else {
      setTitle('')
      setDescription('')
    }
  }, [goalToEdit, isOpen])

  const { mutate: createGoal, isPending: isCreating } = useMutation({
    mutationFn: async () => {
      const res = await client.api.teams[':teamId'].kanban.goals.$post({
        param: { teamId },
        json: {
          title: title.trim(),
          description: description.trim() || undefined,
        },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: m.error() }))
        throw new Error((err as { message?: string }).message || m.error())
      }
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'kanban', 'goals'] })
      toast.success(m.goal_created())
      onClose()
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })

  const { mutate: updateGoal, isPending: isUpdating } = useMutation({
    mutationFn: async () => {
      if (!goalToEdit) return
      const res = await client.api.teams[':teamId'].kanban.goals[':goalId'].$patch({
        param: { teamId, goalId: goalToEdit.id },
        json: {
          title: title.trim(),
          description: description.trim() || null,
        },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: m.error() }))
        throw new Error((err as { message?: string }).message || m.error())
      }
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'kanban', 'goals'] })
      toast.success(m.goal_updated())
      onClose()
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    if (goalToEdit) {
      updateGoal()
    } else {
      createGoal()
    }
  }

  const isLoading = isCreating || isUpdating

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[720px]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{goalToEdit ? m.edit_goal() : m.create_goal()}</DialogTitle>
            <DialogDescription>
              {goalToEdit ? m.edit_goal() : m.create_first_goal()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="goal-title">{m.goal_title()}</Label>
              <Input
                id="goal-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={m.goal_title_placeholder()}
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="goal-description">{m.goal_description()}</Label>
              <Textarea
                id="goal-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={m.goal_description_placeholder()}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              {m.cancel()}
            </Button>
            <Button type="submit" disabled={!title.trim() || isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              {goalToEdit ? m.save_changes() : m.create()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
