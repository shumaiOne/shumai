import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { m } from '@/ui/paraglide/messages.js'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import { toast } from 'sonner'
import { Loader2, MessageSquare } from 'lucide-react'
import { TaskCommentCard } from './task-comment-card'
import { TaskCommentInput } from './task-comment-input'
import type { KanbanAttachmentPayload, KanbanCommentInfo } from '@shumai/dtos'

interface TaskCommentThreadProps {
  teamId: string
  taskId: string
  initialComments?: KanbanCommentInfo[]
}

export function TaskCommentThread({ teamId, taskId, initialComments }: TaskCommentThreadProps) {
  const queryClient = useQueryClient()

  // Query Current User Info
  const { data: me } = useQuery({
    queryKey: ['teams', teamId, 'me'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].me.$get({
        param: { teamId },
      })
      if (!res.ok) throw new Error('Failed to fetch me')
      return await res.json()
    },
    enabled: !!teamId,
  })

  const isOwnerOrAdmin = me?.role?.toLowerCase() === 'owner' || me?.role?.toLowerCase() === 'editor'

  // Query Comments
  const { data: commentsData, isLoading } = useQuery({
    queryKey: ['teams', teamId, 'kanban', 'tasks', taskId, 'comments'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].kanban.tasks[':taskId'].comments.$get({
        param: { teamId, taskId },
      })
      if (!res.ok) throw new Error('Failed to fetch comments')
      return (await res.json()) as { data: KanbanCommentInfo[] }
    },
    initialData: initialComments ? { data: initialComments } : undefined,
    enabled: !!teamId && !!taskId,
    refetchInterval: 4000,
  })

  const comments = commentsData?.data || []

  // Add Comment Mutation
  const { mutateAsync: addComment, isPending: isAdding } = useMutation({
    mutationFn: async ({
      body,
      attachments,
    }: {
      body: string
      attachments?: KanbanAttachmentPayload[]
    }) => {
      const res = await client.api.teams[':teamId'].kanban.tasks[':taskId'].comments.$post({
        param: { teamId, taskId },
        json: { body, attachments },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: m.error() }))
        throw new Error((err as { message?: string }).message || m.error())
      }
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['teams', teamId, 'kanban', 'tasks', taskId, 'comments'],
      })
      queryClient.invalidateQueries({
        queryKey: ['teams', teamId, 'kanban', 'task', taskId],
      })
      queryClient.invalidateQueries({
        queryKey: ['teams', teamId, 'kanban', 'tasks'],
      })
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })

  const handleSendMessage = async (text: string, attachments?: KanbanAttachmentPayload[]) => {
    await addComment({ body: text, attachments })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Comments List */}
      <ScrollArea className="flex-1 min-h-0 p-3.5 [&>div>div]:block!">
        <div className="space-y-3 pr-1 pb-2 w-full max-w-full">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-xs text-muted-foreground/80 space-y-2">
              <div className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 opacity-40" />
              </div>
              <p className="font-medium">{m.no_comments_yet()}</p>
            </div>
          ) : (
            comments.map((comment) => (
              <TaskCommentCard
                key={comment.id}
                teamId={teamId}
                taskId={taskId}
                comment={comment}
                currentUserId={me?.id}
                isOwnerOrAdmin={isOwnerOrAdmin}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Composer Input Box */}
      <div className="p-3 border-t border-border/60 bg-card/60 shrink-0">
        <TaskCommentInput
          teamId={teamId}
          onSendMessage={handleSendMessage}
          isSubmitting={isAdding}
        />
      </div>
    </div>
  )
}
