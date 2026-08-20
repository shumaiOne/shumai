import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { m } from '@/ui/paraglide/messages.js'
import { Button } from '@/ui/components/ui/button'
import { Textarea } from '@/ui/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/components/ui/avatar'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Loader2, MessageSquare, Send } from 'lucide-react'
import type { KanbanCommentInfo } from '@shumai/dtos'

interface TaskCommentThreadProps {
  teamId: string
  taskId: string
  initialComments?: KanbanCommentInfo[]
}

export function TaskCommentThread({ teamId, taskId, initialComments }: TaskCommentThreadProps) {
  const queryClient = useQueryClient()
  const [commentBody, setCommentBody] = useState('')

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
  })

  const comments = commentsData?.data || []

  const { mutate: addComment, isPending: isAdding } = useMutation({
    mutationFn: async () => {
      const res = await client.api.teams[':teamId'].kanban.tasks[':taskId'].comments.$post({
        param: { teamId, taskId },
        json: { body: commentBody.trim() },
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
      setCommentBody('')
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentBody.trim() || isAdding) return
    addComment()
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Comments List */}
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3.5 pr-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-xs text-muted-foreground">
              <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
              <p>{m.no_comments_yet()}</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-2.5 text-xs">
                <Avatar size="sm" className="w-6 h-6 shrink-0 mt-0.5 border border-border">
                  <AvatarImage src={comment.author.image} />
                  <AvatarFallback className="text-[10px]">
                    {comment.author.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0 bg-muted/40 border border-border/60 rounded-lg p-2.5 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground truncate">
                      {comment.author.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                      {format(new Date(comment.createdAt), 'MM/dd HH:mm')}
                    </span>
                  </div>
                  <p className="text-xs text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">
                    {comment.body}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Composer */}
      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-border/60 bg-card/80 space-y-2 shrink-0"
      >
        <Textarea
          value={commentBody}
          onChange={(e) => setCommentBody(e.target.value)}
          placeholder={m.comment_placeholder()}
          rows={3}
          className="text-xs resize-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              if (commentBody.trim()) addComment()
            }
          }}
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">Cmd+Enter to send</span>
          <Button
            type="submit"
            size="xs"
            disabled={!commentBody.trim() || isAdding}
            className="gap-1.5 h-7 px-3 text-xs"
          >
            {isAdding ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>{m.add_comment()}</span>
          </Button>
        </div>
      </form>
    </div>
  )
}
