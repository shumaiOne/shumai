import type { AttachmentInfo, CommentInfo } from '@shumai/dtos'
import type { UserInfo } from '@shumai/dtos'
import { client } from '@/ui/api/client'
import { Button } from '@/ui/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import { Separator } from '@/ui/components/ui/separator'
import { formatTimeAgo } from '@/ui/lib/time'
import { useQuery } from '@tanstack/react-query'
import { Download, File, Terminal } from 'lucide-react'
import React from 'react'
import Markdown from 'react-markdown'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { DrawAnnotation } from '../ui/icons'
import { Skeleton } from '../ui/skeleton'
import { formatTimestamp } from '../viewers/utils'

interface MessageCardProps {
  teamId?: string
  message: CommentInfo
  isReply?: boolean
  hasReplies?: boolean
  isLastReply?: boolean
  getUser: (id: string) => UserInfo
  onReply: (message: CommentInfo) => void
  onViewAttachment: (attachment: AttachmentInfo) => void
  isSelected?: boolean
  onSelect?: () => void
  frameRate?: number
  rootParentId?: string
}

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
  onViewAttachment,
  isSelected,
  onSelect,
  frameRate,
}) => {
  const message = initialMessage
  const hasDrawInfo =
    !!message.annotations && Array.isArray(message.annotations) && message.annotations.length > 0
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
    queryKey: ['agent-sessions', message.sessionId, 'entries'],
    queryFn: async () => {
      const res = await client.api['agent-sessions'][':sessionId'].entries.$get({
        param: { sessionId: message.sessionId! },
      })
      if (!res.ok) throw new Error('Failed to fetch session logs')
      return await res.json()
    },
    enabled: isLogsOpen && !!message.sessionId,
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
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-sm">{creator?.name || 'Unknown'}</span>
          <span className="text-xs text-gray-400">
            {new Date(message.createdAt!).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>

        <div className="flow-root mt-1">
          {message.second !== null && message.second !== undefined && frameRate && (
            <div className="float-left select-none bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 px-2.5 py-1 mt-[2px] mr-2 rounded-sm text-xs leading-none font-mono font-bold flex items-center gap-1">
              {formatTimestamp(message.second, frameRate)}
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
            <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none break-words">
              <Markdown>{preprocessMarkdown(message.message!)}</Markdown>
            </div>
          ) : (
            <div className="text-sm leading-relaxed whitespace-pre-wrap break-words text-wrap break-all">
              {renderFormattedMessage(message.message!)}
            </div>
          )}
        </div>

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
                {logs.map((entry) => {
                  const piEntry = entry.entry as Record<string, unknown> | null
                  const timestampStr =
                    piEntry?.timestamp || (entry as Record<string, unknown>).timestamp
                  let timestamp = ''
                  if (typeof timestampStr === 'string' || typeof timestampStr === 'number') {
                    const dateObj = new Date(timestampStr)
                    if (!isNaN(dateObj.getTime())) {
                      timestamp = formatTimeAgo(dateObj.toISOString())
                    }
                  }

                  if (piEntry && typeof piEntry === 'object') {
                    if (piEntry.type === 'message' && piEntry.message) {
                      const msg = piEntry.message as Record<string, unknown>
                      let badgeColor =
                        'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                      let roleName: string = String(msg.role || '')

                      if (msg.role === 'user') {
                        badgeColor =
                          'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300'
                        roleName = 'User'
                      } else if (msg.role === 'assistant') {
                        badgeColor =
                          'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300'
                        roleName = 'Agent'
                      } else if (msg.role === 'toolResult') {
                        badgeColor = msg.isError
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                        roleName = `Tool Result: ${String(msg.toolName || 'Unknown')}`
                      } else if (msg.role === 'thought') {
                        badgeColor =
                          'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                        roleName = 'Thinking'
                      }

                      const renderToolCallArguments = (args: unknown) => {
                        let parsedArgs: unknown = args
                        if (typeof args === 'string') {
                          try {
                            parsedArgs = JSON.parse(args)
                          } catch {
                            // ignore
                          }
                        }

                        if (
                          parsedArgs &&
                          typeof parsedArgs === 'object' &&
                          !Array.isArray(parsedArgs)
                        ) {
                          const obj = parsedArgs as Record<string, unknown>
                          return (
                            <div className="mt-1 space-y-1.5 pt-3">
                              {Object.entries(obj).map(([key, value]) => {
                                const valueStr =
                                  value && typeof value === 'object'
                                    ? JSON.stringify(value, null, 2)
                                    : String(value)
                                return (
                                  <div key={key} className="text-xs leading-relaxed break-words">
                                    <span className="font-semibold text-violet-600 dark:text-violet-400">
                                      {key}:
                                    </span>{' '}
                                    <span className="text-foreground/90 font-mono whitespace-pre-wrap">
                                      {valueStr}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          )
                        }

                        return (
                          <div className="text-xs font-mono whitespace-pre-wrap">
                            {String(args)}
                          </div>
                        )
                      }

                      const renderMessageContent = () => {
                        const content = msg.content
                        if (!content) return null

                        if (typeof content === 'string') {
                          if (!content.trim()) return null
                          return (
                            <div className="text-xs text-foreground/80 dark:text-foreground/95 leading-relaxed prose prose-sm dark:prose-invert max-w-none break-words">
                              <Markdown>{preprocessMarkdown(content)}</Markdown>
                            </div>
                          )
                        }

                        if (Array.isArray(content)) {
                          const renderedBlocks: React.ReactNode[] = []

                          content.forEach((item, idx) => {
                            if (!item) return

                            if (typeof item === 'string') {
                              if (!item.trim()) return
                              renderedBlocks.push(
                                <div
                                  key={`str-${idx}`}
                                  className="text-xs text-foreground/80 dark:text-foreground/95 leading-relaxed prose prose-sm dark:prose-invert max-w-none break-words"
                                >
                                  <Markdown>{preprocessMarkdown(item)}</Markdown>
                                </div>,
                              )
                              return
                            }

                            if (typeof item === 'object') {
                              const itemObj = item as Record<string, unknown>
                              const type = itemObj.type
                              if (type === 'text') {
                                const text = itemObj.text
                                if (typeof text !== 'string' || !text.trim()) return
                                renderedBlocks.push(
                                  <div
                                    key={`txt-${idx}`}
                                    className="text-xs text-foreground/80 dark:text-foreground/95 leading-relaxed prose prose-sm dark:prose-invert max-w-none break-words"
                                  >
                                    <Markdown>{preprocessMarkdown(text)}</Markdown>
                                  </div>,
                                )
                                return
                              }

                              if (type === 'toolCall') {
                                const toolName = String(
                                  itemObj.name || itemObj.toolName || 'Unknown',
                                )
                                const toolArgs = itemObj.arguments || itemObj.args
                                renderedBlocks.push(
                                  <div key={`tool-${idx}`} className="text-xs space-y-2 py-1">
                                    <div className="font-semibold text-violet-600 dark:text-violet-400 flex items-center gap-1.5">
                                      Calling Tool:{' '}
                                      <span className="font-mono bg-violet-500/10 px-1 py-0.5 rounded text-[11px]">
                                        {toolName}
                                      </span>
                                    </div>
                                    {!!toolArgs && (
                                      <div className="space-y-1 pt-3">
                                        <div className="text-[10px] text-muted-foreground/60 uppercase font-bold tracking-wider">
                                          Arguments
                                        </div>
                                        {renderToolCallArguments(toolArgs)}
                                      </div>
                                    )}
                                  </div>,
                                )
                                return
                              }

                              if (type === 'image') {
                                renderedBlocks.push(
                                  <div
                                    key={`img-${idx}`}
                                    className="text-xs text-muted-foreground italic flex items-center gap-1.5 py-1"
                                  >
                                    [Image Object]
                                  </div>,
                                )
                                return
                              }

                              // Fallback for other object types
                              const stringified = JSON.stringify(item, null, 2)
                              if (stringified === '{}') return
                              renderedBlocks.push(
                                <pre
                                  key={`other-${idx}`}
                                  className="text-xs text-foreground/80 font-mono whitespace-pre-wrap break-words bg-muted/20 p-2 rounded"
                                >
                                  {stringified}
                                </pre>,
                              )
                            }
                          })

                          if (renderedBlocks.length === 0) return null

                          return (
                            <div className="space-y-3 w-full">
                              {renderedBlocks.map((block, index) => (
                                <React.Fragment key={index}>
                                  {index > 0 && <Separator className="my-3 opacity-50" />}
                                  {block}
                                </React.Fragment>
                              ))}
                            </div>
                          )
                        }

                        return null
                      }

                      return (
                        <div key={entry.id} className="relative pl-6 pb-6 last:pb-0">
                          {/* Timeline Line */}
                          <div className="absolute left-[9px] top-2 bottom-0 w-0.5 bg-foreground/10 last:hidden" />

                          {/* Timeline Node */}
                          <div
                            className={`absolute left-0 top-1.5 h-5 w-5 rounded-full border-4 border-background flex items-center justify-center ${
                              msg.role === 'user'
                                ? 'bg-slate-500'
                                : msg.role === 'assistant'
                                  ? 'bg-violet-500'
                                  : msg.role === 'toolResult'
                                    ? msg.isError
                                      ? 'bg-red-500'
                                      : 'bg-emerald-500'
                                    : 'bg-amber-500'
                            }`}
                          />

                          <div className="flex flex-col gap-1.5 bg-muted/30 dark:bg-muted/10 p-3 rounded-lg border border-foreground/5 backdrop-blur-xs w-full">
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

                            {renderMessageContent()}
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
