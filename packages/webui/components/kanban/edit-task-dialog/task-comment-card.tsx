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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/components/ui/dialog'
import { formatSize } from '@/ui/lib/format'
import { isImageFileName } from '@/ui/lib/media'
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
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null)

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
          <div className="flex flex-col gap-1.5 pt-1.5 w-full">
            {comment.attachments.map((att) => {
              const isImage = isImageFileName(att.name || att.url)
              return (
                <div
                  key={att.id}
                  className={`group/att relative flex items-center w-full rounded-lg border border-border bg-card hover:bg-muted/40 transition-colors ${
                    isImage ? 'h-18 p-1.5 gap-2.5 cursor-pointer' : 'h-9 px-2.5 gap-2.5'
                  }`}
                  onClick={() => {
                    if (isImage) {
                      setPreviewImage({ url: att.url, name: att.name })
                      onViewAttachment?.(att)
                    } else {
                      window.open(att.url, '_blank', 'noreferrer')
                    }
                  }}
                >
                  {isImage ? (
                    <div className="h-full aspect-square rounded-md overflow-hidden bg-muted/40 shrink-0">
                      <img
                        src={att.url}
                        alt={att.name}
                        className="w-full h-full object-cover group-hover/att:scale-105 transition-transform duration-200"
                      />
                    </div>
                  ) : (
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate" title={att.name}>
                      {att.name}
                    </p>
                    {att.sizeByte !== undefined && att.sizeByte > 0 && (
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {formatSize(att.sizeByte)}
                      </p>
                    )}
                  </div>

                  <a
                    href={att.url}
                    download={att.name}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 text-muted-foreground hover:text-foreground shrink-0 rounded-md hover:bg-muted transition-colors opacity-0 group-hover/att:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                    title="Download"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
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

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent
          className="w-auto max-w-[80vw] sm:max-w-[80vw] max-h-[80vh] p-2 sm:p-3 bg-background/95 backdrop-blur-sm border-border flex flex-col items-center justify-center overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{previewImage?.name || 'Image Preview'}</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="flex flex-col items-center justify-center max-w-[80vw] max-h-[80vh] overflow-hidden">
              <img
                src={previewImage.url}
                alt={previewImage.name}
                className="max-w-[80vw] max-h-[calc(80vh-2.5rem)] w-auto h-auto object-contain rounded-md"
              />
              <p className="text-xs text-muted-foreground truncate max-w-full px-2 pt-1.5 text-center">
                {previewImage.name}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
