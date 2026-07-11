import { useEffect, useRef, useState } from 'react'
import { useDroppable } from '@dnd-kit/react'
import { useChatbotStore } from '@/ui/stores/chatbot'
import { Bot, Send, History, Plus, Trash2, Loader2, ArrowLeft } from 'lucide-react'
import { cn } from '@/ui/lib/utils'
import { m } from '@/ui/paraglide/messages.js'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import Markdown from 'react-markdown'
import type { ChatMessage } from '@shumai/dtos'

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
        'flex flex-col h-full bg-background transition-colors duration-200 min-h-0 border-l border-border',
        isOver && 'bg-accent/50 ring-2 ring-primary ring-inset',
      )}
    >
      {/* Header section */}
      <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
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
                        {m.shumai_agent()}
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

          {/* Context assets above input area */}
          <div className="p-4 border-t border-border flex-shrink-0 bg-background flex flex-col gap-2 min-h-0">
            {chatAssets.length > 0 && (
              <div className="flex flex-col gap-1.5 min-h-0 max-h-[160px] overflow-y-auto border border-border rounded-md bg-muted/10 p-2 divide-y divide-border/50">
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

            {/* Input area */}
            <div className="flex items-end gap-2">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                rows={2}
                className="flex-1 min-h-[44px] max-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                disabled={isStreaming}
              />
              <button
                onClick={handleSend}
                disabled={isStreaming || !inputText.trim()}
                className="h-9 w-9 flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 shadow-sm"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
