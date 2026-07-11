import { ScrollArea } from '@/ui/components/ui/scroll-area'
import { cn } from '@/ui/lib/utils'
import { m } from '@/ui/paraglide/messages.js'
import { useChatbotStore } from '@/ui/stores/chatbot'
import { useDroppable } from '@dnd-kit/react'
import type { ChatMessage } from '@shumai/dtos'
import { ArrowLeft, ArrowUp, Bot, History, Loader2, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'

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
  } = useChatbotStore()

  const [inputText, setInputText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { ref: setDroppableRef, isDropTarget: isOver } = useDroppable({
    id: 'chatbot-sidebar',
    data: {
      type: 'chatbot-sidebar',
    },
  })

  // Auto-scroll messages list to bottom
  useEffect(() => {
    if (!isHistoryMode) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isStreaming, isHistoryMode])

  // Fetch history when entering history mode
  useEffect(() => {
    if (isHistoryMode) {
      fetchHistorySessions()
    }
  }, [isHistoryMode, fetchHistorySessions])

  const handleSend = () => {
    if (!inputText.trim() || isStreaming) return
    sendMessage(inputText, projectId, contextAssetId)
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
    if (
      msg.role === 'custom' &&
      (msg as { customType?: string }).customType === 'context_display_info'
    ) {
      const details = msg.details as
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

    const isUser = msg.role === 'user'
    const isAssistant = msg.role === 'assistant'
    const isTool = msg.role === 'toolResult'
    const isSystem = (msg.role as string) === 'thinking_level_change' || msg.role === 'custom'

    if (isUser) {
      return (
        <div key={msg.id} className="flex justify-end w-full">
          <div className="bg-primary text-primary-foreground rounded-lg px-3 py-2 max-w-[85%] text-sm whitespace-pre-wrap shadow-xs break-words">
            {getMessageText(msg.content)}
          </div>
        </div>
      )
    }

    if (isAssistant) {
      return (
        <div key={msg.id} className="flex flex-col w-full space-y-1">
          <div className="text-sm leading-[1.8] prose prose-sm dark:prose-invert max-w-none break-words">
            <Markdown>{preprocessMarkdown(getMessageText(msg.content))}</Markdown>
          </div>
          <div className="text-[10px] text-muted-foreground self-start italic">
            {m.created_by_agent()}
          </div>
        </div>
      )
    }

    if (isTool) {
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

    if (isSystem) {
      const systemContent = 'content' in msg ? msg.content : ''
      return (
        <div
          key={msg.id}
          className="text-center text-xs text-muted-foreground italic bg-muted/20 py-1.5 rounded"
        >
          {getMessageText(systemContent)}
        </div>
      )
    }

    return null
  }

  return (
    <div
      ref={setDroppableRef}
      className={cn(
        'relative flex flex-col h-full bg-background transition-colors duration-200 min-h-0 border-l border-border',
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
      <div className="flex items-center justify-between p-4 flex-shrink-0">
        {isHistoryMode ? (
          <>
            <div className="flex items-center gap-2 font-semibold">
              <History className="h-5 w-5 text-primary" />
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
              <Bot className="h-5 w-5 text-primary" />
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
                      isActive
                        ? 'border-primary ring-1 ring-primary'
                        : 'border-border hover:bg-accent/30',
                    )}
                  >
                    <div onClick={() => loadSession(sess.id)} className="flex-1 min-w-0 pr-6">
                      <div className="text-sm font-semibold text-foreground truncate">
                        {sess.name || m.new_chat()}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {new Date(sess.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm(m.delete_session_confirm())) {
                          deleteSession(sess.id)
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
          <ScrollArea className="flex-1 p-4 min-h-0">
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

              {/* Bottom row inside the border containing the send button */}
              <div className="flex justify-end items-center px-3 pb-2 pt-1">
                <button
                  onClick={handleSend}
                  disabled={isStreaming || !inputText.trim()}
                  className={cn(
                    'p-2 rounded-full transition-all duration-200 flex items-center justify-center shrink-0 shadow-sm',
                    inputText.trim() && !isStreaming
                      ? 'bg-primary text-primary-foreground hover:bg-primary/95 transform hover:-translate-y-0.5'
                      : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50',
                  )}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
