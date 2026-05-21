import { client } from '@/ui/api/client'
import type { AttachmentInfo, CommentInfo } from '@/dtos/asset'
import type { UserInfo } from '@/dtos/team'
import { useQuery } from '@tanstack/react-query'
import { Download, File, Terminal } from 'lucide-react'
import React from 'react'
import { Avatar, AvatarFallback } from '../ui/avatar'
import { Skeleton } from '../ui/skeleton'
import Markdown from 'react-markdown'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import { Button } from '@/ui/components/ui/button'

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

interface AgentLogEntry {
  id: string
  sessionId: string
  timestamp?: string
  entry: {
    type: string
    timestamp?: string
    message?: {
      role: string
      content?:
        | string
        | Array<{ type: string; text?: string; data?: string; mimeType?: string } | string>
      toolName?: string
      toolCallId?: string
      isError?: boolean
    }
  }
}

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
    !!initialMessage.sessionId &&
    !!initialMessage.message &&
    initialMessage.message in AI_PLACEHOLDERS

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
  const showSkeleton =
    !!message.sessionId && !!message.message && message.message in AI_PLACEHOLDERS
  const loadingText = (message.message && AI_PLACEHOLDERS[message.message]) || 'Generating...'

  const [isLogsOpen, setIsLogsOpen] = React.useState(false)

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

  const { data: logs, isLoading: isLogsLoading } = useQuery({
    queryKey: ['teams', teamId, 'agent-sessions', message.sessionId, 'entries'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId']['agent-sessions'][':sessionId'].entries.$get({
        param: { teamId: teamId!, sessionId: message.sessionId! },
      })
      if (!res.ok) throw new Error('Failed to fetch session logs')
      return await res.json()
    },
    enabled: isLogsOpen && !!message.sessionId && !!teamId,
  })

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
        ) : message.sessionId ? (
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
        <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-4">
          <button
            onClick={handleReply}
            className="text-xs font-medium text-gray-500 hover:text-blue-600 flex items-center gap-1 cursor-pointer"
          >
            Reply
          </button>
        </div>
      </div>

      {/* Logs Dialog */}
      <Dialog open={isLogsOpen} onOpenChange={setIsLogsOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col p-6 overflow-hidden bg-background/95 backdrop-blur-md border border-foreground/15 shadow-2xl">
          <DialogHeader className="pb-4 border-b border-foreground/15">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Terminal className="w-5 h-5 text-violet-500" />
              Agent Session Logs
            </DialogTitle>
            <DialogDescription>
              Step-by-step execution trace of the agent's background tasks and tool calls.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1 py-4 space-y-4 min-h-0 select-text">
            {isLogsLoading ? (
              <div className="space-y-4">
                <div className="flex gap-4">
                  <Skeleton className="h-5 w-5 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                </div>
                <div className="flex gap-4">
                  <Skeleton className="h-5 w-5 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                </div>
              </div>
            ) : logs && logs.length > 0 ? (
              <div className="flex flex-col">
                {(logs as unknown as AgentLogEntry[]).map((entry) => {
                  const timestampStr = entry.entry?.timestamp || entry.timestamp
                  const timestamp = timestampStr ? new Date(timestampStr).toLocaleTimeString() : ''
                  if (entry.entry && typeof entry.entry === 'object') {
                    const piEntry = entry.entry
                    if (piEntry.type === 'message' && piEntry.message) {
                      const msg = piEntry.message
                      let badgeColor =
                        'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                      let roleName = msg.role

                      if (msg.role === 'user') {
                        badgeColor =
                          'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                        roleName = 'User'
                      } else if (msg.role === 'assistant') {
                        badgeColor =
                          'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300'
                        roleName = 'Agent'
                      } else if (msg.role === 'toolResult') {
                        badgeColor = msg.isError
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                        roleName = `Tool: ${msg.toolName || 'Unknown'}`
                      } else if (msg.role === 'thought') {
                        badgeColor =
                          'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                        roleName = 'Thinking'
                      }

                      // Extract text content
                      let textContent = ''
                      if (typeof msg.content === 'string') {
                        textContent = msg.content
                      } else if (Array.isArray(msg.content)) {
                        textContent = msg.content
                          .map((item) => {
                            if (typeof item === 'string') return item
                            const obj = item as { type?: string; text?: string }
                            if (obj?.type === 'text') return obj.text || ''
                            if (obj?.type === 'image') return '[Image Object]'
                            return JSON.stringify(item)
                          })
                          .join('\n')
                      }

                      return (
                        <div key={entry.id} className="relative pl-6 pb-6 last:pb-0">
                          {/* Timeline Line */}
                          <div className="absolute left-[9px] top-2 bottom-0 w-0.5 bg-foreground/10 last:hidden" />

                          {/* Timeline Node */}
                          <div
                            className={`absolute left-0 top-1.5 h-5 w-5 rounded-full border-4 border-background flex items-center justify-center ${
                              msg.role === 'user'
                                ? 'bg-blue-500'
                                : msg.role === 'assistant'
                                  ? 'bg-violet-500'
                                  : msg.role === 'toolResult'
                                    ? msg.isError
                                      ? 'bg-red-500'
                                      : 'bg-emerald-500'
                                    : 'bg-amber-500'
                            }`}
                          />

                          <div className="flex flex-col gap-1.5 bg-muted/30 dark:bg-muted/10 p-3 rounded-lg border border-foreground/5 backdrop-blur-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${badgeColor}`}
                              >
                                {roleName}
                              </span>
                              <span className="text-[10px] text-muted-foreground/60">
                                {timestamp}
                              </span>
                            </div>

                            {textContent && (
                              <div className="text-xs text-foreground/80 dark:text-foreground/95 leading-relaxed font-mono whitespace-pre-wrap break-words">
                                {textContent}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    }
                  }

                  // Fallback for non-message entries or arbitrary entries
                  return (
                    <div key={entry.id} className="relative pl-6 pb-6 last:pb-0">
                      <div className="absolute left-[9px] top-2 bottom-0 w-0.5 bg-foreground/10 last:hidden" />
                      <div className="absolute left-0 top-1.5 h-5 w-5 rounded-full border-4 border-background bg-gray-400" />
                      <div className="bg-muted/30 p-3 rounded-lg border border-foreground/5">
                        <div className="text-[10px] text-muted-foreground/60">{timestamp}</div>
                        <pre className="text-xs text-foreground/80 font-mono whitespace-pre-wrap break-words">
                          {JSON.stringify(entry.entry, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Terminal className="w-8 h-8 text-muted-foreground/40 mb-2 animate-pulse" />
                <p className="text-sm font-medium">No logs found for this session.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  The session might have been initialized but has not produced any entries yet.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
