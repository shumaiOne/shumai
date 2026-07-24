import { client } from '@/ui/api/client'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/ui/select'
import { cn } from '@/ui/lib/utils'
import { m } from '@/ui/paraglide/messages.js'
import { useChatbotStore } from '@/ui/stores/chatbot'
import { useTeamContextStore } from '@/ui/stores/team-context'
import { useDroppable } from '@dnd-kit/react'
import type { ChatMessage } from '@shumai/dtos'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowUp,
  Bot,
  Brain,
  ChevronDown,
  History,
  Loader2,
  Plus,
  Trash2,
  Wrench,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import { formatTimeAgo } from '../lib/time'

interface ChatbotSidebarProps {
  projectId: string
  contextAssetId?: string
}

export function ChatbotSidebar({ projectId, contextAssetId }: ChatbotSidebarProps) {
  const {
    isHistoryMode,
    setIsHistoryMode,
    currentSessionId,
    chatAssets,
    removeAsset,
    messages,
    historySessions,
    isStreaming,
    fetchHistorySessions,
    loadSession,
    deleteSession,
    startNewSession,
    sendMessage,
    abortActiveSession,
    selectedAgentId,
    setSelectedAgentId,
  } = useChatbotStore()

  const { teamId, ensureTeamIdForProject } = useTeamContextStore()

  useEffect(() => {
    if (projectId) {
      ensureTeamIdForProject(projectId)
    }
  }, [projectId, ensureTeamIdForProject])

  const { data: agents = [] } = useQuery({
    queryKey: ['agents', teamId],
    queryFn: async () => {
      if (!teamId) return []
      const res = await client.api.teams[':teamId'].agents.$get({
        param: { teamId },
      })
      if (!res.ok) throw new Error('failed to fetch agents')
      return res.json()
    },
    enabled: !!teamId,
  })

  const chatAgents = agents.filter((a) => a.type === 'chat' && a.enabled)

  useEffect(() => {
    if (chatAgents.length > 0) {
      const exists = chatAgents.some((a) => a.id === selectedAgentId)
      if (!exists) {
        setSelectedAgentId(chatAgents[0].id)
      }
    }
  }, [chatAgents, selectedAgentId, setSelectedAgentId])

  const [inputText, setInputText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const isFirstScrollRef = useRef(true)

  const isRestoringRef = useRef(true)

  useEffect(() => {
    isRestoringRef.current = true
    isFirstScrollRef.current = true
  }, [projectId, contextAssetId, isHistoryMode])

  // Restore scroll position on mount or when navigation changes the project/context
  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('[data-slot="scroll-area-viewport"]')
    if (!viewport) return

    const { scrollTop, isAtBottom } = useChatbotStore.getState()

    // Use a timeout to ensure the DOM has settled and scrollHeight is fully calculated
    const timer = setTimeout(() => {
      if (isAtBottom) {
        viewport.scrollTop = viewport.scrollHeight
      } else {
        viewport.scrollTop = scrollTop
      }

      // Allow scroll events triggered by this restoration to fire and be ignored before tracking
      const enableTimer = setTimeout(() => {
        isRestoringRef.current = false
      }, 50)

      return () => clearTimeout(enableTimer)
    }, 0)

    return () => clearTimeout(timer)
  }, [projectId, contextAssetId, isHistoryMode])

  // Listen to scroll events on the viewport to save scroll state
  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('[data-slot="scroll-area-viewport"]')
    if (!viewport) return

    const handleScroll = () => {
      if (isRestoringRef.current) return

      const scrollTop = viewport.scrollTop
      // We consider the user at the bottom if they are within 10px of the bottom boundary
      const isAtBottom = viewport.scrollHeight - scrollTop - viewport.clientHeight < 10
      useChatbotStore.getState().setScrollState(scrollTop, isAtBottom)
    }

    viewport.addEventListener('scroll', handleScroll)
    return () => {
      viewport.removeEventListener('scroll', handleScroll)
    }
  }, [projectId, contextAssetId, isHistoryMode])

  const { ref: setDroppableRef, isDropTarget: isOver } = useDroppable({
    id: 'chatbot-sidebar',
    data: {
      type: 'chatbot-sidebar',
    },
  })

  // Auto-scroll messages list to bottom
  useEffect(() => {
    if (!isHistoryMode) {
      const { isAtBottom } = useChatbotStore.getState()
      if (isAtBottom || isStreaming) {
        const behavior = isFirstScrollRef.current ? 'auto' : 'smooth'
        messagesEndRef.current?.scrollIntoView({ behavior })
      }
      isFirstScrollRef.current = false
    }
  }, [messages, isStreaming, isHistoryMode])

  // Fetch history when entering history mode
  useEffect(() => {
    if (isHistoryMode && teamId) {
      fetchHistorySessions(teamId)
    }
  }, [isHistoryMode, fetchHistorySessions, teamId])

  const queryClient = useQueryClient()

  const handleAssetMutation = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['search'] })
    queryClient.invalidateQueries({ queryKey: ['folders'] })
    queryClient.invalidateQueries({ queryKey: ['files'] })
    queryClient.invalidateQueries({ queryKey: ['file'] })
    queryClient.invalidateQueries({ queryKey: ['version_stacks'] })
    queryClient.invalidateQueries({ queryKey: ['projects'] })
  }, [queryClient])

  const handleSend = () => {
    if (!inputText.trim() || isStreaming || !teamId) return
    sendMessage(teamId, inputText, projectId, contextAssetId, handleAssetMutation)
    setInputText('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const getMessageText = (content: unknown): string => {
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      return content
        .map((c) => {
          if (typeof c === 'string') return c
          if (c && typeof c === 'object' && 'type' in c && c.type === 'text' && 'text' in c) {
            return String((c as { text: unknown }).text)
          }
          return ''
        })
        .join('')
    }
    return ''
  }

  const preprocessMarkdown = (text: string): string => {
    return text.replace(/<@([a-zA-Z0-9_-]+)>/g, '@$1').replace(/^\[([^\]]+)\]:/gm, '\\[$1\\]:')
  }

  const renderMessage = (msg: ChatMessage) => {
    switch (msg.role as string) {
      case 'user': {
        const msgObj = msg as unknown as Record<string, unknown>
        return (
          <div key={msg.id} className="flex justify-end w-full">
            <div className="bg-primary text-primary-foreground rounded-lg px-3 py-2 max-w-[85%] text-sm whitespace-pre-wrap shadow-xs break-words">
              {getMessageText(msgObj.content)}
            </div>
          </div>
        )
      }

      case 'assistant': {
        const msgObj = msg as unknown as Record<string, unknown>
        const content = msgObj.content as unknown[]
        if (!content) return null

        const renderedBlocks: React.ReactNode[] = []

        content.forEach((block: unknown, idx: number) => {
          if (!block || typeof block !== 'object') return

          const b = block as unknown as Record<string, unknown>

          switch (b.type) {
            case 'text': {
              const text = b.text
              if (typeof text !== 'string' || !text.trim()) return
              renderedBlocks.push(
                <div
                  key={`txt-${idx}`}
                  className="text-sm leading-[1.8] prose prose-sm dark:prose-invert max-w-none break-words"
                >
                  <Markdown
                    components={{
                      // eslint-disable-next-line @typescript-eslint/no-unused-vars
                      pre: ({ node, ...props }) => (
                        <pre
                          className="whitespace-pre-wrap break-all break-words bg-muted text-foreground p-4 rounded-md border border-border/50 font-mono text-sm"
                          {...props}
                        />
                      ),
                    }}
                  >
                    {preprocessMarkdown(text)}
                  </Markdown>
                </div>,
              )
              break
            }
            case 'thinking': {
              const thinking = b.thinking
              if (typeof thinking !== 'string' || !thinking.trim()) return
              renderedBlocks.push(
                <details
                  key={`think-${idx}`}
                  className="group border border-border/50 rounded-lg bg-muted/20 my-2 overflow-hidden"
                >
                  <summary className="flex items-center gap-2 p-2.5 text-xs font-medium text-muted-foreground select-none cursor-pointer hover:bg-muted/40 transition-colors list-none [&::-webkit-details-marker]:hidden">
                    <Brain className="h-3.5 w-3.5 text-primary/70 animate-pulse" />
                    <span>{m.role_thinking() || 'Thinking'}</span>
                    <ChevronDown className="h-3 w-3 ml-auto transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="p-3 pt-0 text-xs text-muted-foreground/90 border-t border-border/40 bg-muted/10 leading-relaxed prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap font-sans">
                    <Markdown>{preprocessMarkdown(thinking)}</Markdown>
                  </div>
                </details>,
              )
              break
            }
            case 'toolCall': {
              const toolName = String(b.name || b.toolName || m.unknown())
              const toolArgs = b.arguments || b.args
              renderedBlocks.push(
                <details
                  key={`tool-${idx}`}
                  className="group border border-border/50 rounded-lg bg-violet-500/5 my-2 overflow-hidden"
                >
                  <summary className="flex items-center gap-2 p-2.5 text-xs font-semibold text-violet-600 dark:text-violet-400 select-none cursor-pointer hover:bg-violet-500/10 transition-colors list-none [&::-webkit-details-marker]:hidden">
                    <Wrench className="h-3.5 w-3.5" />
                    <span>{m.calling_tool()}</span>
                    <span className="font-mono bg-violet-500/10 px-1.5 py-0.5 rounded text-[11px] text-violet-700 dark:text-violet-300">
                      {toolName}
                    </span>
                    <ChevronDown className="h-3 w-3 ml-auto transition-transform group-open:rotate-180" />
                  </summary>
                  {!!toolArgs && (
                    <div className="p-3 pt-0 text-[10px] text-muted-foreground/90 border-t border-border/40 bg-violet-500/5 font-sans">
                      <div className="text-[9px] text-muted-foreground/60 uppercase font-bold tracking-wider mb-1.5">
                        {m.tool_arguments() || 'Arguments'}
                      </div>
                      <pre className="font-mono bg-muted/30 p-2 rounded border border-border/30 overflow-x-auto max-h-32">
                        {JSON.stringify(toolArgs, null, 2)}
                      </pre>
                    </div>
                  )}
                </details>,
              )
              break
            }
            case 'image': {
              const mimeType = String(b.mimeType || 'image/png')
              const data = String(b.data || '')
              renderedBlocks.push(
                <div key={`img-${idx}`} className="my-2 max-w-full">
                  {data ? (
                    <img
                      src={data.startsWith('data:') ? data : `data:${mimeType};base64,${data}`}
                      alt="Attached asset"
                      className="max-h-60 rounded border border-border/50 object-contain shadow-xs"
                    />
                  ) : (
                    <div className="text-xs text-muted-foreground italic flex items-center gap-1.5 py-1">
                      {m.image_object()}
                    </div>
                  )}
                </div>,
              )
              break
            }
            default: {
              const stringified = JSON.stringify(block, null, 2)
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
          }
        })

        if (renderedBlocks.length === 0) return null

        let shouldShowFooter = false
        if (content.length > 0) {
          const lastBlock = content[content.length - 1]
          if (typeof lastBlock === 'string' && lastBlock.trim().length > 0) {
            shouldShowFooter = true
          } else if (lastBlock && typeof lastBlock === 'object') {
            const lb = lastBlock as Record<string, unknown>
            if (lb.type === 'text' && typeof lb.text === 'string' && lb.text.trim().length > 0) {
              shouldShowFooter = true
            }
          }
        }

        return (
          <div key={msg.id} className="flex flex-col w-full space-y-1">
            <div className="space-y-2 w-full">{renderedBlocks}</div>
            {shouldShowFooter && (
              <div className="text-[10px] text-muted-foreground self-start italic pt-1">
                {m.created_by_agent()}
              </div>
            )}
          </div>
        )
      }

      case 'toolResult': {
        return (
          <div
            key={msg.id}
            className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 p-2 rounded-md border border-border/50"
          >
            <span className="font-semibold">
              {m.tool_result_with_name({ name: (msg as { toolName?: string }).toolName || 'tool' })}
            </span>
          </div>
        )
      }

      case 'thinking_level_change':
      case 'custom': {
        const msgObj = msg as unknown as Record<string, unknown>
        if (msgObj.customType === 'context_display_info') {
          const details = msgObj.details as
            | { assets?: Array<{ id: string; name: string; type: string }> }
            | undefined
          const assets = details?.assets || []
          if (assets.length === 0) return null
          return (
            <div
              key={msg.id}
              className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border/50 space-y-1 my-1"
            >
              <div className="font-semibold">{m.assets_added_to_context()}</div>
              <ul className="list-disc list-inside space-y-0.5">
                {assets.map((asset) => (
                  <li key={asset.id} className="truncate">
                    {asset.name} <span className="text-muted-foreground/70">({asset.type})</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        }

        const systemContent = msgObj.content || ''
        return (
          <div
            key={msg.id}
            className="text-center text-xs text-muted-foreground italic bg-muted/20 py-1.5 rounded"
          >
            {getMessageText(systemContent)}
          </div>
        )
      }

      default:
        return null
    }
  }

  return (
    <div
      ref={setDroppableRef}
      className={cn(
        'relative flex flex-col h-full bg-background transition-colors duration-200 min-h-0',
      )}
    >
      {isOver && (
        <div className="absolute inset-0 bg-accent/30 border-2 border-primary z-50 pointer-events-none flex items-center justify-center p-6 text-center animate-in fade-in duration-150">
          <div className="bg-background/95 text-foreground px-4 py-3 rounded-xl border border-border/80 flex flex-col items-center gap-2 shadow-lg max-w-[80%] animate-in zoom-in-95 duration-150">
            <Bot className="h-6 w-6 text-primary animate-bounce" />
            <span className="text-sm font-semibold text-foreground">
              {m.chatbot_drag_drop_hint() || 'Drop assets here'}
            </span>
          </div>
        </div>
      )}

      {/* Header section */}
      <div className="flex items-center justify-between p-4 pt-[0.7rem] flex-shrink-0">
        {isHistoryMode ? (
          <>
            <div className="flex items-center gap-2 font-semibold">
              <span>{m.history()}</span>
            </div>
            <button
              onClick={() => setIsHistoryMode(false)}
              className="p-1.5 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors"
              title="Close History"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 font-semibold">
              <span>{m.shumai_agent()}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={startNewSession}
                className="p-1.5 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors"
                title={m.new_chat()}
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsHistoryMode(true)}
                className="p-1.5 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors"
                title={m.history()}
              >
                <History className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Main body view */}
      {isHistoryMode ? (
        <ScrollArea className="flex-1 p-4 min-h-0">
          {historySessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground p-4 text-center">
              <History className="h-8 w-8 mb-2 opacity-50 text-muted-foreground" />
              <p className="text-sm">{m.no_history_sessions()}</p>
            </div>
          ) : (
            <div className="space-y-2 pb-4">
              {historySessions.map((sess) => {
                const isActive = sess.id === currentSessionId
                return (
                  <div
                    key={sess.id}
                    className={cn(
                      'group relative flex items-center justify-between p-3 border rounded-lg transition-all cursor-pointer bg-card',
                      isActive ? 'border-primary' : 'border-border hover:bg-accent/30',
                    )}
                  >
                    <div
                      onClick={() => teamId && loadSession(teamId, sess.id)}
                      className="flex-1 min-w-0 pr-6"
                    >
                      <div className="text-sm font-semibold text-foreground truncate">
                        {sess.name || m.new_chat()}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {formatTimeAgo(sess.createdAt)}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (teamId && confirm(m.delete_session_confirm())) {
                          deleteSession(teamId, sess.id)
                        }
                      }}
                      className="absolute right-3 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1 rounded hover:bg-muted"
                      title="Delete Session"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      ) : (
        <>
          {/* Active Chat view */}
          <ScrollArea ref={scrollAreaRef} className="flex-1 p-4 min-h-0 [&>div>div]:!block">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-border rounded-lg text-muted-foreground p-4 text-center">
                <Bot className="h-8 w-8 mb-2 opacity-50 text-muted-foreground" />
                <p className="text-sm">{m.chatbot_drag_drop_hint()}</p>
              </div>
            ) : (
              <div className="space-y-4 pb-4">
                {messages.map(renderMessage)}
                {isStreaming &&
                  messages.length > 0 &&
                  messages[messages.length - 1].role === 'user' && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground italic">
                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                      <span>Thinking...</span>
                    </div>
                  )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Input Area (nested inside the border exactly like comment input) */}
          <div className="p-2 flex-shrink-0 bg-background">
            <div className="relative flex flex-col w-full border border-foreground/20 rounded-2xl shadow-xs transition-all duration-200 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent bg-background overflow-hidden">
              {/* Context assets list at the top inside the border */}
              {chatAssets.length > 0 && (
                <div className="flex flex-col gap-1.5 min-h-0 max-h-[160px] overflow-y-auto border-b border-border bg-muted/5 p-3 divide-y divide-border/50">
                  {chatAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className="flex items-center justify-between py-1.5 text-xs group"
                    >
                      <div className="flex items-baseline gap-1.5 min-w-0 pr-2">
                        <span className="truncate font-medium text-foreground">{asset.name}</span>
                        <span className="text-[9px] text-muted-foreground uppercase flex-shrink-0">
                          {asset.type}
                        </span>
                      </div>
                      <button
                        onClick={() => removeAsset(asset.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
                        title={m.remove_from_context()}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Textarea inside the border */}
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                rows={2}
                className="w-full bg-transparent border-none focus:ring-0 focus:outline-hidden resize-none min-h-[44px] max-h-[120px] px-3 py-2 text-sm focus-visible:outline-hidden focus:ring-transparent focus:border-transparent focus-visible:ring-0"
                disabled={isStreaming}
              />

              {/* Bottom row inside the border containing the agent selector and send button */}
              <div className="flex justify-between items-center px-3 pb-2 pt-1">
                {/* Agent selector */}
                <div className="flex items-center gap-1.5 min-w-0 max-w-[70%]">
                  {chatAgents.length > 0 ? (
                    <Select
                      value={selectedAgentId || ''}
                      onValueChange={(val) => setSelectedAgentId(val)}
                      disabled={isStreaming}
                    >
                      <SelectTrigger className="h-8 border-none bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground focus:ring-0 focus:ring-offset-0 px-2 py-0 gap-1.5 text-xs shrink-0 select-none shadow-none max-w-full">
                        <SelectValue placeholder={m.select_agent()} />
                      </SelectTrigger>
                      <SelectContent>
                        {chatAgents.map((agent) => (
                          <SelectItem key={agent.id} value={agent.id}>
                            <div className="flex items-center gap-2">
                              {agent.avatar ? (
                                <img
                                  src={agent.avatar}
                                  alt={agent.name}
                                  className="w-4 h-4 rounded-full object-cover"
                                />
                              ) : (
                                <Bot className="w-4 h-4 text-muted-foreground" />
                              )}
                              <span className="text-xs">{agent.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-muted-foreground/60 italic select-none">
                      <span>{m.no_chat_agents_warning()}</span>
                    </div>
                  )}
                </div>

                {isStreaming ? (
                  <button
                    onClick={() => {
                      if (teamId) {
                        abortActiveSession(teamId)
                      }
                    }}
                    className="p-2 rounded-full transition-all duration-200 flex items-center justify-center shrink-0 shadow-sm bg-destructive text-destructive-foreground hover:bg-destructive/90 transform hover:-translate-y-0.5"
                    title="Stop generation"
                  >
                    <div className="h-4 w-4 flex items-center justify-center">
                      <div className="h-3 w-3 bg-current rounded-[2px] bg-white" />
                    </div>
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!inputText.trim() || !selectedAgentId}
                    className={cn(
                      'p-2 rounded-full transition-all duration-200 flex items-center justify-center shrink-0 shadow-sm',
                      inputText.trim() && selectedAgentId
                        ? 'bg-primary text-primary-foreground hover:bg-primary/95 transform hover:-translate-y-0.5'
                        : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50',
                    )}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
