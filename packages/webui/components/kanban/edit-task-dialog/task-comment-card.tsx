import React, { useState } from 'react'
import { format } from 'date-fns'
import Markdown from 'react-markdown'
import { Download, FileText, MoreHorizontal, Trash2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { m } from '@/ui/paraglide/messages.js'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/components/ui/avatar'
import { Button } from '@/ui/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui/components/ui/alert-dialog'
import { formatSize } from '@/ui/lib/format'
import type { KanbanAttachmentInfo, KanbanCommentInfo } from '@shumai/dtos'

interface TaskCommentCardProps {
  teamId: string
  taskId: string
  comment: KanbanCommentInfo
  currentUserId?: string
  isOwnerOrAdmin?: boolean
  onViewAttachment?: (attachment: KanbanAttachmentInfo) => void
}

export function TaskCommentCard({
  teamId,
  taskId,
  comment,
  currentUserId,
  isOwnerOrAdmin,
  onViewAttachment,
}: TaskCommentCardProps) {
  const queryClient = useQueryClient()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const canDelete = isOwnerOrAdmin || comment.author.id === currentUserId

  const { mutate: deleteComment, isPending: isDeleting } = useMutation({
    mutationFn: async () => {
      const res = await client.api.teams[':teamId'].kanban.tasks[':taskId'].comments[
        ':commentId'
      ].$delete({
        param: { teamId, taskId, commentId: comment.id },
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
      toast.success('Comment deleted')
      setIsDeleteDialogOpen(false)
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })

  const authorInitials = (comment.author.name || 'U')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="relative flex gap-3 p-3 rounded-xl border border-transparent bg-foreground/[0.03] dark:bg-foreground/[0.08] hover:bg-foreground/[0.06] dark:hover:bg-foreground/[0.12] transition-colors group">
      {/* Left Avatar */}
      <Avatar className="w-7 h-7 shrink-0 mt-0.5 border border-border">
        {comment.author.image && (
          <AvatarImage src={comment.author.image} alt={comment.author.name} />
        )}
        <AvatarFallback className="text-[10px] font-medium bg-muted text-muted-foreground">
          {authorInitials}
        </AvatarFallback>
      </Avatar>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Header: Author + Timestamp + Actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-xs text-foreground truncate">
              {comment.author.name}
            </span>
            <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
              {format(new Date(comment.createdAt), 'MMM d, h:mm a')}
            </span>
          </div>

          {canDelete && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button size="icon-xs" variant="ghost" className="h-5 w-5 text-muted-foreground">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive cursor-pointer text-xs"
                    onClick={() => setIsDeleteDialogOpen(true)}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    <span>{m.delete()}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Markdown Comment Body */}
        {comment.body && (
          <div className="text-xs leading-relaxed prose prose-xs dark:prose-invert max-w-none break-words text-foreground/90 font-sans">
            <Markdown>{comment.body}</Markdown>
          </div>
        )}

        {/* Attachments Section */}
        {comment.attachments && comment.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1.5">
            {comment.attachments.map((att) => {
              const isImage = att.proxyType === 'image' || att.contentType?.startsWith('image/')
              return (
                <div
                  key={att.id}
                  className="relative group/att rounded-lg border border-border bg-card overflow-hidden transition-all duration-200"
                >
                  {isImage ? (
                    <div
                      className="w-40 h-28 relative cursor-pointer overflow-hidden bg-muted/40"
                      onClick={() => onViewAttachment?.(att)}
                    >
                      <img
                        src={att.url}
                        alt={att.name}
                        className="w-full h-full object-cover group-hover/att:scale-105 transition-transform duration-200"
                      />
                      <a
                        href={att.url}
                        download={att.name}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute right-1.5 bottom-1.5 bg-black/60 hover:bg-black/80 text-white p-1 rounded-md opacity-0 group-hover/att:opacity-100 transition-opacity shadow-xs"
                        onClick={(e) => e.stopPropagation()}
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 p-2.5 max-w-[240px] bg-card hover:bg-muted/40 transition-colors">
                      <FileText className="w-7 h-7 text-primary/80 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-xs font-medium text-foreground truncate"
                          title={att.name}
                        >
                          {att.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {formatSize(att.sizeByte)}
                        </p>
                      </div>
                      <a
                        href={att.url}
                        download={att.name}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 text-muted-foreground hover:text-foreground shrink-0 rounded-md hover:bg-muted transition-colors"
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.delete_comment_confirm()}</AlertDialogTitle>
            <AlertDialogDescription>{m.delete_comment_description()}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{m.cancel()}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              disabled={isDeleting}
              onClick={() => deleteComment()}
            >
              {m.delete()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
