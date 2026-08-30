import { client } from '@/ui/api/client'
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
import type { CommentInfo, UserInfo } from '@shumai/dtos'
import type { MemberInfo } from '@/ui/stores/members'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, FileText, MoreHorizontal, Trash2 } from 'lucide-react'
import React from 'react'
import Markdown from 'react-markdown'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { DrawAnnotation } from '../ui/icons'
import { Skeleton } from '../ui/skeleton'
import { formatTimecode } from '../viewers/video/utils'
import { m } from '@/ui/paraglide/messages.js'
import { useUiStore } from '@/ui/stores/ui'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'
import { AgentSessionLogsDialog } from '../agent/agent-session-logs-dialog'
import { isImageFileName } from '@/ui/lib/media'

interface MessageCardProps {
  teamId?: string
  message: CommentInfo
  isReply?: boolean
  hasReplies?: boolean
  isLastReply?: boolean
  getUser: (id: string) => MemberInfo | UserInfo
  onReply: (message: CommentInfo) => void
  isSelected?: boolean
  onSelect?: () => void
  frameRate?: number
  startTimecode?: string
  formatTimestamp?: (second: number) => string
  rootParentId?: string
}

const UnfilledCircleCheck: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </svg>
)

const FilledCircleCheck: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <path
      d="m9 12 2 2 4-4"
      fill="none"
      stroke="white"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

/* eslint-disable @typescript-eslint/naming-convention */
const AI_PLACEHOLDERS: Record<string, string> = {
  __CHAT__: 'Generating...',
  __AUTOFILL__: 'Autofilling metadata...',
  __EMBEDDING__: 'Generating embeddings...',
  __RUNNING__: 'Generating...',
}

export const MessageCard: React.FC<MessageCardProps> = ({
  teamId,
  message: initialMessage,
  isReply,
  hasReplies,
  isLastReply,
  getUser,
  onReply,
  isSelected,
  onSelect,
  frameRate,
  startTimecode,
  formatTimestamp,
}) => {
  const message = initialMessage
  const hasDrawInfo =
    !!message.annotations && Array.isArray(message.annotations) && message.annotations.length > 0
  const creator = message.creator
  const showSkeleton =
    !!message.sessionId && !!message.message && message.message in AI_PLACEHOLDERS
  const loadingText = (message.message && AI_PLACEHOLDERS[message.message]) || 'Generating...'

  const [isLogsOpen, setIsLogsOpen] = React.useState(false)
  const [previewImage, setPreviewImage] = React.useState<{ url: string; name: string } | null>(null)

  const { videoTimeDisplayMode } = useUiStore()
  const displayTime = React.useMemo(() => {
    if (message.second === null || message.second === undefined) return ''
    if (formatTimestamp) {
      return formatTimestamp(message.second)
    }
    if (!frameRate) return ''
    const frameIndex = Math.round(message.second * frameRate)
    return formatTimecode(frameIndex, frameRate, videoTimeDisplayMode, startTimecode)
  }, [message.second, frameRate, videoTimeDisplayMode, startTimecode, formatTimestamp])

  const { data: me } = useQuery({
    queryKey: ['teams', teamId, 'me'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].me.$get({
        param: { teamId: teamId! },
      })
      if (!res.ok) throw new Error('Failed to fetch current member info')
      return await res.json()
    },
    enabled: !!teamId,
    staleTime: 300000,
  })

  const isAdmin = me?.role === 'owner'

  const queryClient = useQueryClient()
  const { mutate: toggleComplete } = useMutation({
    mutationFn: async () => {
      const res = await client.api.comments[':commentId'].complete.$post({
        param: { commentId: message.id },
        json: { isCompleted: !message.isCompleted },
      })
      if (!res.ok) throw new Error('Failed to update comment completion status')
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey.includes('comments'),
      })
    },
  })

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false)

  const { mutate: deleteComment, isPending: isDeleting } = useMutation({
    mutationFn: async () => {
      const res = await client.api.comments[':commentId'].$delete({
        param: { commentId: message.id },
      })
      if (!res.ok) throw new Error('Failed to delete comment')
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey.includes('comments'),
      })
      setIsDeleteDialogOpen(false)
    },
  })

  const canDelete = React.useMemo(() => {
    if (!me) return false
    if (me.role === 'owner') return true
    if (message.creator?.id === me.id) return true
    return false
  }, [me, message.creator?.id])

  const renderFormattedMessage = (text: string) => {
    const parts = text.split(/(<@[a-zA-Z0-9_-]+>)/g)
    return parts.map((part, index) => {
      if (part.match(/^<@[a-zA-Z0-9_-]+>$/)) {
        const userId = part.slice(2, -1)
        const mentionedUser = message.mentions?.find((m) => m.id === userId) || getUser(userId)
        return (
          <span key={index} className="text-primary font-medium hover:underline cursor-pointer">
            @{mentionedUser?.name || 'Unknown'}
          </span>
        )
      }
      return <span key={index}>{part}</span>
    })
  }

  const preprocessMarkdown = (text: string): string => {
    return text.replace(/<@([a-zA-Z0-9_-]+)>/g, '@$1').replace(/^\[([^\]]+)\]:/gm, '\\[$1\\]:')
  }

  const handleReply = () => {
    onReply(message)
  }

  return (
    <div
      onClick={onSelect}
      className={`relative flex gap-4 ${isReply ? 'mt-[-1px]' : 'mt-3'} mr-3 group p-3 py-4 border transition-all duration-200 cursor-pointer ${
        isReply
          ? isLastReply
            ? 'rounded-b-xl rounded-t-none'
            : 'rounded-none'
          : hasReplies
            ? 'rounded-t-xl rounded-b-none'
            : 'rounded-xl'
      } ${
        isSelected
          ? 'z-20 border-blue-500/40 dark:border-blue-400/40 bg-blue-500/10 dark:bg-blue-400/10 shadow-sm'
          : 'z-10 border-transparent bg-foreground/2 dark:bg-foreground/10 hover:bg-foreground/4 dark:hover:bg-foreground/15'
      }`}
    >
      {/* Left Column: Avatar & Thread Lines */}
      <div className="flex flex-col items-center shrink-0 w-8 relative">
        {/* Thread line above avatar (for replies) */}
        {isReply && (
          <div className="absolute top-[-1rem] h-8 w-0.5 bg-foreground/10 left-1/2 -translate-x-1/2 z-0" />
        )}

        {/* Thread line under avatar (for parent comments with replies, or intermediate replies) */}
        {((hasReplies && !isReply) || (isReply && !isLastReply)) && (
          <div className="absolute top-4 bottom-[-1rem] w-0.5 bg-foreground/10 left-1/2 -translate-x-1/2 z-0" />
        )}

        <Avatar className="z-10 relative">
          {creator?.image && (
            <AvatarImage src={creator.image} alt={creator.name || ''} className="object-cover" />
          )}
          <AvatarFallback className="bg-rose-400 text-black">
            {creator?.name?.[0]?.toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between w-full mb-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{creator?.name || 'Unknown'}</span>
            <span className="text-xs text-gray-400">
              {new Date(message.createdAt!).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          {canDelete && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="h-6 w-6 cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4 text-foreground/70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsDeleteDialogOpen(true)
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>{m.delete()}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        <div className="flow-root mt-1">
          {message.second !== null && message.second !== undefined && frameRate && (
            <div className="float-left select-none bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 px-2.5 py-1 mt-[2px] mr-2 rounded-sm text-xs leading-none font-mono font-bold flex items-center gap-1">
              {displayTime}
            </div>
          )}

          {hasDrawInfo && (
            <div
              className="float-left select-none bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 px-1 py-1 mt-[2px] mr-2 rounded-sm text-xs leading-none font-bold flex items-center gap-1"
              title="Contains drawing annotations"
            >
              <DrawAnnotation className="w-3.5 h-3.5" />
            </div>
          )}

          {showSkeleton ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <span className="text-xs text-muted-foreground animate-pulse">{loadingText}</span>
            </div>
          ) : message.sessionId ? (
            <div className="text-sm leading-[1.8] prose prose-sm dark:prose-invert max-w-none break-words">
              <Markdown>{preprocessMarkdown(message.message!)}</Markdown>
            </div>
          ) : (
            <div className="text-sm leading-[1.8] whitespace-pre-wrap break-words text-wrap break-all">
              {renderFormattedMessage(message.message!)}
            </div>
          )}
        </div>

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-col gap-1.5 mt-3 w-full max-w-full overflow-hidden">
            {message.attachments.map((att) => {
              const rawName = att.url?.split('/').pop()?.split('?')[0] || 'file'
              const name = decodeURIComponent(rawName)
              const isImage = isImageFileName(name)
              return (
                <div
                  key={att.id}
                  className={`group relative flex items-center w-full max-w-full rounded-lg border border-border bg-card hover:bg-muted/40 transition-colors overflow-hidden ${
                    isImage ? 'h-18 p-1.5 gap-2.5 cursor-pointer' : 'h-9 px-2.5 gap-2.5'
                  }`}
                  onClick={() => {
                    if (isImage) {
                      setPreviewImage({ url: att.url, name })
                    } else {
                      window.open(att.url, '_blank', 'noreferrer')
                    }
                  }}
                >
                  {isImage ? (
                    <div className="h-full aspect-square rounded-md overflow-hidden bg-muted/40 shrink-0">
                      <img
                        src={att.url}
                        alt={name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    </div>
                  ) : (
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}

                  <div className="min-w-0 flex-1 overflow-hidden">
                    <p
                      className="text-xs font-medium text-foreground truncate block w-full"
                      title={name}
                    >
                      {name}
                    </p>
                  </div>

                  <a
                    href={att.url}
                    target="_blank"
                    rel="noreferrer"
                    download={name}
                    className="p-1 text-muted-foreground hover:text-foreground shrink-0 rounded-md hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                    title={m.download()}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                </div>
              )
            })}
          </div>
        )}

        {/* Agent Footer */}
        {message.sessionId && (
          <div className="mt-3 pt-2 border-t border-foreground/5 flex items-center justify-between text-xs text-muted-foreground/60">
            <span className="flex items-center gap-1.5 font-medium text-muted-foreground/80">
              Created by Agent
            </span>
            {isAdmin && (
              <Button
                variant="outline"
                size="xs"
                onClick={() => setIsLogsOpen(true)}
                className="cursor-pointer border-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 hover:text-violet-700 hover:border-violet-500/30 font-semibold"
              >
                Logs
              </Button>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-2 flex items-center justify-between w-full">
          <button
            onClick={handleReply}
            className="text-xs font-medium text-gray-500 hover:text-blue-600 flex items-center gap-1 cursor-pointer"
          >
            {m.reply()}
          </button>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleComplete()
                  }}
                  className={`flex items-center justify-center p-1 rounded-full transition-colors cursor-pointer ${
                    message.isCompleted
                      ? 'text-green-500 hover:text-green-600 hover:bg-green-500/10'
                      : 'text-gray-400 hover:text-green-500 hover:bg-green-500/10'
                  }`}
                >
                  {message.isCompleted ? (
                    <FilledCircleCheck className="w-5 h-5" />
                  ) : (
                    <UnfilledCircleCheck className="w-5 h-5" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {message.isCompleted ? m.mark_as_incomplete() : m.mark_as_complete()}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Logs Dialog */}
      <AgentSessionLogsDialog
        sessionId={message.sessionId}
        open={isLogsOpen}
        onOpenChange={setIsLogsOpen}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.delete_comment_confirm()}</AlertDialogTitle>
            <AlertDialogDescription>{m.delete_comment_description()}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isDeleting}
              onClick={(e) => {
                e.stopPropagation()
                setIsDeleteDialogOpen(false)
              }}
            >
              {m.cancel()}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              disabled={isDeleting}
              onClick={(e) => {
                e.stopPropagation()
                deleteComment()
              }}
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
