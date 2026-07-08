import React, { useState, useEffect, useRef, useMemo } from 'react'
import { client } from '@/ui/api/client'
import { useChatStore } from '@/ui/stores/chat'
import { useDndStore } from '@/ui/stores/dnd'
import { useTeamContextStore } from '@/ui/stores/team-context'
import { useUserMetadataStore } from '@/ui/stores/user-metadata'
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, X, Send, FileText, Folder, ArrowLeft, Bot, Loader2 } from 'lucide-react'
import { Button } from '@/ui/components/ui/button'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
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
import { m } from '@/ui/paraglide/messages.js'
import { formatTimeAgo } from '@/ui/lib/time'
import { useDroppable } from '@dnd-kit/react'
import ReactMarkdown from 'react-markdown'
import { toast } from 'sonner'
import type { ChatMessage, ChatSessionInfo } from '@shumai/dtos'

function getMessageTextContent(msg: ChatMessage): string {
  const content = (msg as unknown as Record<string, unknown>).content
  if (!content) return ''

  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map((item: unknown) => {
        if (!item) return ''
        if (typeof item === 'string') {
          return item
        }
        if (typeof item === 'object') {
          const itemObj = item as Record<string, unknown>
          if (itemObj.type === 'text') {
            return (itemObj.text as string) || ''
          }
        }
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }

  return ''
}

const EMPTY_MESSAGES: ChatMessage[] = []

export const AgentChatPanel = () => {
  const { teamId } = useTeamContextStore()
  const { getMetadata } = useUserMetadataStore()
  const chatAgentId = getMetadata<string>('chat_agent_id') || ''

  const { contextItems, activeSessionId, removeContextItem, clearContext, setActiveSessionId } =
    useChatStore()

  const { activeDragItems } = useDndStore()
  const queryClient = useQueryClient()

  // Navigation states
  const [isCreatingNewChat, setIsCreatingNewChat] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null)

  // Messaging states
  const [inputPrompt, setInputPrompt] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [streamingMessage, setStreamingMessage] = useState<string>('')
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([])

  // Refs
  const messageEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Fetch active session messages
  const { data: serverMessages = EMPTY_MESSAGES, isLoading: isMessagesLoading } = useQuery({
    queryKey: ['chatMessages', activeSessionId],
    queryFn: async () => {
      if (!activeSessionId) return EMPTY_MESSAGES
      const res = await client.api.chat.sessions[':sessionId'].messages.$get({
        param: { sessionId: activeSessionId },
      })
      if (!res.ok) throw new Error('Failed to fetch messages')
      return (await res.json()) as ChatMessage[]
    },
    enabled: !!activeSessionId,
  })

  // Sync server messages to local messages
  useEffect(() => {
    if (activeSessionId) {
      setLocalMessages(serverMessages)
      setStreamingMessage('')
    } else {
      setLocalMessages(EMPTY_MESSAGES)
      setStreamingMessage('')
    }
  }, [serverMessages, activeSessionId])

  // Scroll to bottom when local messages change
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [localMessages, streamingMessage])

  // dnd-kit droppable setup
  const { ref: setDroppableRef, isDropTarget } = useDroppable({
    id: 'chat-panel-droppable',
  })

  // Infinite query for history sessions
  const {
    data: sessionsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isSessionsLoading,
  } = useInfiniteQuery({
    queryKey: ['chatSessions', teamId],
    queryFn: async ({ pageParam }) => {
      const res = await client.api.chat.sessions.$get({
        query: {
          first: '20',
          after: pageParam || undefined,
        },
      })
      if (!res.ok) throw new Error('Failed to fetch sessions')
      return (await res.json()) as { data: ChatSessionInfo[]; pageInfo: { cursor?: string } }
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.pageInfo?.cursor || undefined,
    enabled: !!teamId,
  })

  const sessions = useMemo(() => {
    return sessionsData?.pages.flatMap((page) => page.data) || []
  }, [sessionsData])

  // Delete chat session mutation
  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await client.api.chat.sessions[':sessionId'].$delete({
        param: { sessionId },
      })
      if (!res.ok) throw new Error('Failed to delete session')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatSessions', teamId] })
      toast.success(m.chat_session_deleted())
      if (activeSessionId === sessionToDelete) {
        setActiveSessionId(null)
        setIsCreatingNewChat(false)
      }
      setSessionToDelete(null)
    },
    onError: () => {
      toast.error(m.failed_delete_session())
      setSessionToDelete(null)
    },
  })

  // Send message implementation
  const handleSend = async () => {
    const trimmedText = inputPrompt.trim()
    if (!trimmedText && contextItems.length === 0) return
    if (!chatAgentId) {
      toast.error('No agent selected in settings')
      return
    }

    setIsSending(true)
    setInputPrompt('')
    setStreamingMessage('')

    // Optimistically add user message to list
    const tempUserMsg = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content: trimmedText,
      timestamp: Date.now(),
    } as unknown as ChatMessage
    setLocalMessages((prev) => [...prev, tempUserMsg])

    const currentSessionId = activeSessionId
    const currentContext = [...contextItems]

    // Clear context files/folders for this chat
    clearContext()

    try {
      const res = await client.api.chat.$post({
        json: {
          agentId: chatAgentId,
          textPrompt: trimmedText,
          assetIds: currentContext.map((c) => c.id),
          sessionId: currentSessionId || undefined,
          contextAssetId: undefined, // fallback logic handles target folder
          projectId: undefined,
        },
      })

      if (!res.ok) {
        throw new Error('Failed to send message')
      }

      const reader = res.body?.getReader()
      if (!reader) {
        throw new Error('No body reader')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6)
            try {
              const data = JSON.parse(dataStr)

              if (data.type === 'session') {
                // If we started a new session, associate it in our app
                if (!activeSessionId) {
                  setActiveSessionId(data.sessionId)
                  setIsCreatingNewChat(false)
                  queryClient.invalidateQueries({ queryKey: ['chatSessions', teamId] })
                }
              } else if (data.type === 'entry') {
                const entry = data.entry as ChatMessage
                const role = (entry as unknown as Record<string, unknown>).role
                if (role === 'assistant') {
                  const entryText = getMessageTextContent(entry)
                  setStreamingMessage(entryText || '')
                } else if (role === 'user') {
                  // Keep user message
                } else {
                  // Other message types (custom, thinking etc)
                  setLocalMessages((prev) => {
                    const filtered = prev.filter((m) => m.id !== entry.id)
                    return [...filtered, entry]
                  })
                }
              } else if (data.type === 'done') {
                // Stream is completed
                if (data.status === 'failed') {
                  toast.error(data.error || 'Chat execution failed')
                }
              }
            } catch (e) {
              console.error('Failed to parse SSE data', e)
            }
          }
        }
      }

      // Re-fetch messages to sync database state
      queryClient.invalidateQueries({ queryKey: ['chatMessages', activeSessionId] })
      queryClient.invalidateQueries({ queryKey: ['chatSessions', teamId] })
    } catch (e) {
      console.error(e)
      toast.error(m.failed_send_message())
    } finally {
      setIsSending(false)
      setStreamingMessage('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Adjust textarea height dynamically
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [inputPrompt])

  // --- RENDERING SCENE 1: History Screen ---
  if (!activeSessionId && !isCreatingNewChat) {
    return (
      <div className="flex flex-col h-full w-full bg-transparent">
        <div className="flex items-center justify-between px-2 pb-3 flex-none border-b border-border/40">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {m.chat_history()}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1"
            onClick={() => setIsCreatingNewChat(true)}
          >
            <Plus className="w-4 h-4" />
            <span>{m.new_chat()}</span>
          </Button>
        </div>

        <ScrollArea className="flex-1 min-h-0 py-2">
          {isSessionsLoading && (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isSessionsLoading && sessions.length === 0 && (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground my-8">
              <Bot className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-semibold">{m.no_history_chats()}</p>
            </div>
          )}

          <div className="space-y-1.5 px-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => setActiveSessionId(session.id)}
                className="group flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card hover:bg-accent/50 cursor-pointer transition-all duration-200"
              >
                <div className="flex flex-col flex-1 min-w-0 pr-2">
                  <span className="text-sm font-medium text-foreground truncate">
                    {formatTimeAgo(session.updatedAt)}
                  </span>
                  <span className="text-xs text-muted-foreground mt-0.5 truncate">
                    ID: {session.id}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSessionToDelete(session.id)
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          {hasNextPage && (
            <div className="p-4 flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  'Load More'
                )}
              </Button>
            </div>
          )}
        </ScrollArea>

        {/* Delete Confirmation Alert Dialog */}
        <AlertDialog
          open={!!sessionToDelete}
          onOpenChange={(open) => !open && setSessionToDelete(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{m.delete_chat_confirm_title()}</AlertDialogTitle>
              <AlertDialogDescription>{m.delete_chat_confirm_description()}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{m.cancel()}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (sessionToDelete) {
                    deleteSessionMutation.mutate(sessionToDelete)
                  }
                }}
              >
                {m.delete()}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  // --- RENDERING SCENE 2: Active Chat View (or New Chat Draft) ---
  const isDragging = activeDragItems.length > 0

  return (
    <div
      ref={setDroppableRef}
      className={`relative flex flex-col h-full w-full min-h-0 bg-transparent overflow-hidden transition-all duration-300 ${
        isDropTarget ? 'ring-2 ring-dashed ring-primary/65 bg-primary/5' : ''
      }`}
    >
      {/* Drop overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-xs flex flex-col items-center justify-center z-50 pointer-events-none p-4 text-center">
          <div className="border-2 border-dashed border-primary/50 rounded-xl p-8 flex flex-col items-center max-w-xs">
            <Plus className="w-8 h-8 text-primary mb-3 animate-bounce" />
            <p className="text-sm font-semibold text-foreground">{m.drop_files_here_context()}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center gap-3 pb-3 border-b border-border/40 flex-none">
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8"
          onClick={() => {
            setActiveSessionId(null)
            setIsCreatingNewChat(false)
          }}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-primary/10 text-primary">
            <Bot className="w-4 h-4" />
          </div>
          <span className="text-sm font-bold text-foreground">
            {isCreatingNewChat ? m.new_chat() : m.agent()}
          </span>
        </div>
      </header>

      {/* Message List area */}
      <ScrollArea className="flex-1 min-h-0 py-4 px-2">
        {isMessagesLoading && (
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        <div className="space-y-4 pr-1">
          {localMessages.map((msg) => {
            const role = (msg as unknown as Record<string, unknown>).role
            const textContent = getMessageTextContent(msg)

            if (!textContent && role === 'user') return null

            return (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${
                  role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {role !== 'user' && (
                  <div className="flex-none p-1 rounded-md bg-primary/10 text-primary mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-xs transition-all duration-200 ${
                    role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-xs'
                      : 'bg-muted text-foreground rounded-bl-xs prose prose-sm dark:prose-invert prose-p:my-1 prose-headings:my-2 prose-pre:my-1'
                  }`}
                >
                  {role === 'user' ? (
                    <p className="whitespace-pre-wrap leading-relaxed">{textContent}</p>
                  ) : (
                    <ReactMarkdown>{textContent}</ReactMarkdown>
                  )}
                </div>
              </div>
            )
          })}

          {/* Streaming/Thinking message */}
          {streamingMessage && (
            <div className="flex items-start gap-3 justify-start">
              <div className="flex-none p-1 rounded-md bg-primary/10 text-primary mt-1">
                <Bot className="w-4 h-4" />
              </div>
              <div className="max-w-[85%] rounded-2xl rounded-bl-xs px-4 py-2.5 text-sm bg-muted text-foreground prose prose-sm dark:prose-invert shadow-xs leading-relaxed">
                <ReactMarkdown>{streamingMessage}</ReactMarkdown>
              </div>
            </div>
          )}

          {isSending && !streamingMessage && (
            <div className="flex items-start gap-3 justify-start">
              <div className="flex-none p-1 rounded-md bg-primary/10 text-primary mt-1">
                <Bot className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-xs px-4 py-2.5 bg-muted text-muted-foreground shadow-xs text-xs">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Thinking...</span>
              </div>
            </div>
          )}

          <div ref={messageEndRef} />
        </div>
      </ScrollArea>

      {/* Context area */}
      {contextItems.length > 0 && (
        <div className="flex-none px-2 py-1.5 border-t border-border/30 bg-muted/20">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {m.chat_context({ count: contextItems.length })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
              onClick={clearContext}
            >
              Clear
            </Button>
          </div>
          <ScrollArea className="max-h-[140px] overflow-y-auto">
            <div className="space-y-1">
              {contextItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between bg-card border border-border/40 rounded-md px-2 py-1 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    {item.type === 'folder' ? (
                      <Folder className="w-3.5 h-3.5 text-blue-500 flex-none" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-slate-500 flex-none" />
                    )}
                    <span className="font-medium text-foreground truncate" title={item.path}>
                      {item.path}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-5 h-5 rounded-full hover:bg-accent"
                    onClick={() => removeContextItem(item.id)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Input box */}
      <div className="p-2 border-t border-border/40 flex-none bg-background flex items-end gap-2">
        <textarea
          ref={textareaRef}
          rows={1}
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={m.type_message_placeholder()}
          disabled={isSending}
          className="flex-1 resize-none bg-accent/40 border border-border/50 rounded-xl px-3 py-2 text-sm max-h-[120px] focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 disabled:opacity-50"
        />
        <Button
          size="icon"
          className="h-9 w-9 rounded-xl flex-none"
          onClick={handleSend}
          disabled={isSending || (!inputPrompt.trim() && contextItems.length === 0)}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
