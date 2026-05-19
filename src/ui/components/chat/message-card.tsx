import { client } from '@/ui/api/client'
import type { AttachmentInfo, CommentInfo } from '@/dtos/asset'
import type { UserInfo } from '@/dtos/team'
import { useQuery } from '@tanstack/react-query'
import { Download, File } from 'lucide-react'
import React from 'react'
import { Avatar, AvatarFallback } from '../ui/avatar'
import { Skeleton } from '../ui/skeleton'
import Markdown from 'react-markdown'

interface MessageCardProps {
  teamId?: string
  message: CommentInfo
  isReply?: boolean
  hasReplies?: boolean
  isLastReply?: boolean
  getUser: (id: string) => UserInfo
  onReply: (message: CommentInfo) => void
  onViewAttachment: (attachment: AttachmentInfo) => void
  rootParentId?: string
}

/* eslint-disable @typescript-eslint/naming-convention */
const AI_PLACEHOLDERS: Record<string, string> = {
  __CHAT__: 'Generating...',
  __AUTOFILL__: 'Autofilling metadata...',
  __EMBEDDING__: 'Generating embeddings...',
  __TRANSCRIPTION__: 'Transcribing...',
  __RUNNING__: 'Generating...',
}
/* eslint-enable @typescript-eslint/naming-convention */

export const MessageCard: React.FC<MessageCardProps> = ({
  teamId,
  message: initialMessage,
  isReply,
  hasReplies,
  isLastReply,
  getUser,
  onReply,
  onViewAttachment,
}) => {
  const isRunning =
    initialMessage.isAi && !!initialMessage.message && initialMessage.message in AI_PLACEHOLDERS

  const { data: polledMessage } = useQuery({
    queryKey: ['teams', teamId, 'comments', initialMessage.id],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].comments[':commentId'].$get({
        param: { teamId: teamId!, commentId: initialMessage.id! },
      })
      if (!res.ok) throw new Error('Failed to fetch comment')
      return (await res.json()) as CommentInfo
    },
    enabled: !!teamId && isRunning,
    refetchInterval: (query) => {
      const data = query.state.data as CommentInfo
      if (data && (!data.message || !(data.message in AI_PLACEHOLDERS))) {
        return false
      }
      return 2000
    },
  })

  const message = polledMessage || initialMessage
  const creator = message.creator
  const showSkeleton = message.isAi && !!message.message && message.message in AI_PLACEHOLDERS
  const loadingText = (message.message && AI_PLACEHOLDERS[message.message]) || 'Generating...'

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

  const handleReply = () => {
    onReply(message)
  }

  return (
    <div className={`relative flex gap-4 ${isReply ? 'mt-4' : 'mt-6'} group`}>
      {hasReplies && !isReply && (
        <div className="absolute left-[1rem] top-[2rem] bottom-[-1.5rem] w-0.5 bg-foreground/10 -translate-x-1/2 z-0" />
      )}

      {isReply && !isLastReply && (
        <div className="absolute left-[1rem] top-[2rem] bottom-[-1.5rem] w-0.5 bg-foreground/10 -translate-x-1/2 z-0" />
      )}

      {/* Avatar */}
      <div>
        <Avatar>
          <AvatarFallback>{creator?.name?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
        </Avatar>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-sm">{creator?.name || 'Unknown'}</span>
          <span className="text-xs text-gray-400">
            {new Date(message.createdAt!).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>

        {showSkeleton ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <span className="text-xs text-muted-foreground animate-pulse">{loadingText}</span>
          </div>
        ) : message.isAi ? (
          <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none break-words">
            <Markdown>{message.message!}</Markdown>
          </div>
        ) : (
          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words text-wrap break-all">
            {renderFormattedMessage(message.message!)}
          </div>
        )}

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {message.attachments.map((att) => {
              const isImage = att.mediaType?.startsWith('image/')
              const name = att.url?.split('/').pop()?.split('?')[0] || 'file'
              return (
                <div
                  key={att.id}
                  className="relative group rounded-lg overflow-hidden border bg-white shadow-sm hover:shadow-md transition-shadow w-48 h-32"
                  onClick={() => isImage && onViewAttachment(att)}
                >
                  {isImage ? (
                    <img
                      src={att.url}
                      alt={name}
                      className="w-full h-full object-cover cursor-pointer"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center p-2 text-center">
                      <File className="w-8 h-8 text-gray-500 mb-2" />
                      <span className="text-xs font-medium text-gray-700 break-all line-clamp-2">
                        {name}
                      </span>
                    </div>
                  )}
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noreferrer"
                    download={name}
                    className="absolute right-2 bottom-2 bg-black/60 text-white hover:bg-black/80 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              )
            })}
          </div>
        )}

        {/* Actions */}
        <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-4">
          <button
            onClick={handleReply}
            className="text-xs font-medium text-gray-500 hover:text-blue-600 flex items-center gap-1 cursor-pointer"
          >
            Reply
          </button>
        </div>
      </div>
    </div>
  )
}
