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
import { useUiStore } from '@/ui/stores/ui'
import { useDroppable } from '@dnd-kit/react'
import type { AssetInfo, ChatMessage, ShumaiMessageContext } from '@shumai/dtos'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Bot,
  Brain,
  ChevronDown,
  Download,
  FileIcon,
  Folder,
  History,
  Loader2,
  Plus,
  Trash2,
  Wrench,
  XIcon,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import { formatTimeAgo } from '../lib/time'
import { ChatInput } from './chat/message-input'
import { DrawAnnotation } from './ui/icons'
import { formatTimecode } from './viewers/video/utils'
import { isImageFileName } from '@/ui/lib/media'

interface ChatbotSidebarProps {
  projectId: string
  contextAssetId?: string
  file?: AssetInfo | null
  currentTime?: number
  frameRate?: number
  startTimecode?: string
  formatTimestamp?: (second: number) => string
  onTyping?: () => void
  onSelectMessage?: (message: ChatMessage) => void
  selectedMessageId?: string | null
}

export function ChatbotSidebar({
  projectId,
  contextAssetId,
  file,
  currentTime,
  frameRate,
  startTimecode,
  formatTimestamp,
  onTyping,
  onSelectMessage,
  selectedMessageId,
}: ChatbotSidebarProps) {
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
    inputText,
    setInputText,
  } = useChatbotStore()

  const { teamId, ensureTeamIdForProject } = useTeamContextStore()
  const { videoTimeDisplayMode } = useUiStore()
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null)

  useEffect(() => {
    if (projectId) {
      ensureTeamIdForProject(projectId)
    }
  }, [projectId, ensureTeamIdForProject])

  const { data: agents = [], isSuccess } = useQuery({
    queryKey: ['chat-agents', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const res = await client.api.projects[':projectId']['chat-agents'].$get({
        param: { projectId },
      })
      if (!res.ok) throw new Error('failed to fetch agents')
      return res.json()
    },
    enabled: !!projectId,
  })

  const chatAgents = agents.filter((a) => a.type === 'chat' && a.enabled)

  useEffect(() => {
    if (!isSuccess) return

    if (chatAgents.length > 0) {
      const exists = chatAgents.some((a) => a.id === selectedAgentId)
      if (!exists) {
        setSelectedAgentId(chatAgents[0].id)
      }
    } else if (selectedAgentId !== null) {
      setSelectedAgentId(null)
    }
  }, [isSuccess, chatAgents, selectedAgentId, setSelectedAgentId])

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
      case 'user':
      case 'custom': {
        const msgObj = msg as unknown as Record<string, unknown>
        if (msg.role === 'custom' && msgObj.customType === 'context_display_info') {
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
        if (msg.role === 'user' || msgObj.customType === 'shumai_message') {
          const details = msgObj.details as ShumaiMessageContext | undefined
          const referencedAssets = details?.referencedAssets || []
          const attachedFiles = details?.attachedFiles || []
          const position = details?.position
          const hasAnnotations =
            details?.annotation || (details?.annotations && details.annotations.length > 0)
          const isCurrentAssetMatch =
            !details?.currentAsset?.id ||
            (contextAssetId && details.currentAsset.id === contextAssetId) ||
            (file?.id && details.currentAsset.id === file.id)
          const isSelected = selectedMessageId === msg.id
          let timeStr = ''
          if (position?.type === 'time') {
            if (formatTimestamp) {
              timeStr = formatTimestamp(position.seconds)
            } else if (frameRate) {
              const frameIndex = Math.round(position.seconds * frameRate)
              timeStr = formatTimecode(frameIndex, frameRate, videoTimeDisplayMode, startTimecode)
            } else {
              const mins = Math.floor(position.seconds / 60)
              const secs = Math.floor(position.seconds % 60)
              timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
            }
          } else if (position?.type === 'page') {
            timeStr = `Page ${position.page}`
          }
          const messageText = getMessageText(msgObj.content)
          const hasAttachmentsOrAssets = attachedFiles.length > 0 || referencedAssets.length > 0
          const handleCardClick = () => {
            if (isCurrentAssetMatch && onSelectMessage) {
              onSelectMessage(msg)
            }
          }
          return (
            <div
              key={msg.id}
              onClick={handleCardClick}
              className={cn(
                'flex flex-col items-end w-full group transition-all duration-150',
                isCurrentAssetMatch && (hasAnnotations || position) && 'cursor-pointer',
              )}
            >
              <div
                className={cn(
                  'bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm whitespace-pre-wrap shadow-xs break-words transition-all',
                  hasAttachmentsOrAssets ? 'w-full' : 'max-w-[85%]',
                  isSelected && 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-background',
                )}
              >
                <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {hasAnnotations && (
                    <span
                      className="inline-flex items-center align-middle mr-1.5 p-0.5 rounded bg-primary-foreground/20 text-primary-foreground"
                      title={m.contains_drawing_annotations?.() || 'Contains drawing annotations'}
                    >
                      <DrawAnnotation className="w-3.5 h-3.5" />
                    </span>
                  )}
                  {position && (
                    <span className="inline-flex items-center align-middle mr-1.5 px-1.5 py-0.5 rounded text-xs font-mono font-bold bg-primary-foreground/20 text-primary-foreground">
                      {timeStr}
                    </span>
                  )}
                  {messageText && <span>{messageText}</span>}
                </div>

                {attachedFiles.length > 0 && (
                  <div className="mt-2.5 w-full">
                    <div className="text-xs font-medium text-primary-foreground/70 mb-1">
                      {m.attachments?.() || 'Attachments'}
                    </div>
                    <div className="flex flex-col gap-1.5 w-full">
                      {attachedFiles.map((att) => {
                        const name = att.name || 'file'
                        const isImage =
                          isImageFileName(name) ||
                          att.mediaType === 'image' ||
                          att.mimeType?.startsWith('image/')
                        return (
                          <div
                            key={att.id}
                            className={cn(
                              'group/att relative flex items-center w-full max-w-full rounded-lg border border-primary-foreground/15 bg-primary-foreground/10 hover:bg-primary-foreground/15 transition-colors overflow-hidden',
                              isImage ? 'h-18 p-1.5 gap-2.5 cursor-pointer' : 'h-9 px-2.5 gap-2.5',
                            )}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (att.url) {
                                if (isImage) {
                                  setPreviewImage({ url: att.url, name })
                                } else {
                                  window.open(att.url, '_blank', 'noreferrer')
                                }
                              }
                            }}
                          >
                            {isImage && att.url ? (
                              <div className="h-full aspect-square rounded-md overflow-hidden bg-black/20 shrink-0">
                                <img
                                  src={att.url}
                                  alt={name}
                                  className="w-full h-full object-cover group-hover/att:scale-105 transition-transform duration-200"
                                />
                              </div>
                            ) : (
                              <FileIcon className="w-4 h-4 text-primary-foreground/70 shrink-0" />
                            )}
                            <div className="min-w-0 flex-1 overflow-hidden">
                              <p
                                className="text-xs font-medium text-primary-foreground truncate block w-full"
                                title={name}
                              >
                                {name}
                              </p>
                            </div>
                            {att.url && (
                              <a
                                href={att.url}
                                target="_blank"
                                rel="noreferrer"
                                download={name}
                                className="p-1 text-primary-foreground/70 hover:text-primary-foreground shrink-0 rounded-md hover:bg-primary-foreground/20 transition-colors opacity-0 group-hover/att:opacity-100"
                                onClick={(e) => e.stopPropagation()}
                                title={m.download?.() || 'Download'}
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {referencedAssets.length > 0 && (
                  <div className="mt-2.5 w-full">
                    <div className="text-xs font-medium text-primary-foreground/70 mb-1">
                      {m.assets?.() || 'Assets'}
                    </div>
                    <div className="flex flex-col gap-1.5 w-full">
                      {referencedAssets.map((asset) => (
                        <div
                          key={asset.id}
                          className="flex items-center justify-between w-full h-9 px-2.5 rounded-lg border border-primary-foreground/15 bg-primary-foreground/10 hover:bg-primary-foreground/15 transition-colors overflow-hidden"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {asset.type === 'folder' ? (
                              <Folder className="w-4 h-4 text-primary-foreground/70 shrink-0" />
                            ) : (
                              <FileIcon className="w-4 h-4 text-primary-foreground/70 shrink-0" />
                            )}
                            <span
                              className="text-xs font-medium truncate text-primary-foreground"
                              title={asset.name}
                            >
                              {asset.name}
                            </span>
                          </div>
                          <span className="text-[10px] text-primary-foreground/60 uppercase shrink-0 font-mono ml-2">
                            {asset.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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

      {/* Header */}
      <div className="h-12 border-b border-border flex items-center justify-between px-4 flex-shrink-0 bg-background/50 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          {isHistoryMode && (
            <button
              onClick={() => setIsHistoryMode(false)}
              className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Back to Chat"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <Bot className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">
            {isHistoryMode ? m.history() : m.shumai_agent()}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!isHistoryMode ? (
            <>
              <button
                onClick={startNewSession}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title={m.new_chat()}
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsHistoryMode(true)}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title={m.history()}
              >
                <History className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                startNewSession()
                setIsHistoryMode(false)
              }}
              className="flex items-center gap-1 text-xs bg-primary text-primary-foreground px-2.5 py-1 rounded-md hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{m.new_chat()}</span>
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {isHistoryMode ? (
        <ScrollArea className="flex-1 p-3">
          {historySessions.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-8">
              {m.no_history_sessions() || 'No past chat sessions found'}
            </div>
          ) : (
            <div className="space-y-1">
              {historySessions.map((session) => {
                const isCurrent = session.id === currentSessionId
                return (
                  <div
                    key={session.id}
                    onClick={() => {
                      if (teamId) {
                        loadSession(teamId, session.id)
                        setIsHistoryMode(false)
                      }
                    }}
                    className={cn(
                      'group flex items-center justify-between p-2.5 rounded-lg text-xs cursor-pointer transition-all border border-transparent',
                      isCurrent
                        ? 'bg-accent/80 text-accent-foreground font-medium border-border/40'
                        : 'hover:bg-muted/60 text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="truncate text-foreground font-medium text-xs">
                        {session.name || m.untitled_session() || 'Chat Session'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatTimeAgo(session.updatedAt)}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (teamId) {
                          deleteSession(teamId, session.id)
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1 rounded hover:bg-muted cursor-pointer"
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
                  (messages[messages.length - 1].role === 'user' ||
                    (
                      messages[messages.length - 1] as unknown as {
                        customType?: string
                      }
                    ).customType === 'shumai_message') && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground italic">
                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                      <span>Thinking...</span>
                    </div>
                  )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          <div className="p-2 flex-shrink-0 bg-background">
            <ChatInput
              projectId={projectId}
              value={inputText}
              onChangeText={setInputText}
              placeholder={m.type_a_message?.() || 'Type a message...'}
              disabled={!selectedAgentId}
              isStreaming={isStreaming}
              onAbort={() => {
                if (teamId) {
                  abortActiveSession(teamId)
                }
              }}
              allowMentions={false}
              allowAttachments={true}
              workspaceAssets={chatAssets}
              onRemoveWorkspaceAsset={removeAsset}
              allowMarkup={true}
              canMarkup={!!file && ['image', 'video', 'pdf'].includes(file.proxyType || '')}
              markupDisabledTooltip={
                !file
                  ? m.open_file_to_add_markup?.() || 'Open a supported file to add markup'
                  : m.markup_not_supported_for_this_file?.() ||
                    'Markup is not supported for this file type'
              }
              allowTimestamp={file?.proxyType === 'video' || file?.proxyType === 'pdf'}
              currentTime={currentTime}
              frameRate={frameRate || file?.media?.metadata?.frameRate || 30}
              startTimecode={startTimecode || file?.media?.metadata?.startTimecode}
              formatTimestamp={
                formatTimestamp ||
                (file?.proxyType === 'pdf' ? (sec: number) => `Page ${Math.round(sec)}` : undefined)
              }
              onTyping={onTyping}
              onSendMessage={(
                text,
                attachmentIds,
                annotations,
                _replyToId,
                second,
                attachedFilesMeta,
              ) => {
                if (!teamId) return
                sendMessage(
                  teamId,
                  text,
                  projectId,
                  contextAssetId,
                  handleAssetMutation,
                  attachmentIds,
                  annotations,
                  second,
                  attachedFilesMeta,
                )
              }}
              bottomLeftExtra={
                <div className="flex items-center gap-1.5 min-w-0 max-w-full">
                  {chatAgents.length > 0 ? (
                    <Select
                      value={selectedAgentId || ''}
                      onValueChange={(val) => setSelectedAgentId(val)}
                      disabled={isStreaming}
                    >
                      <SelectTrigger className="h-8 border-none bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground focus:ring-0 focus:ring-offset-0 px-2 py-0 gap-1.5 text-xs shrink-0 select-none shadow-none max-w-full cursor-pointer">
                        <SelectValue placeholder={m.select_agent()} />
                      </SelectTrigger>
                      <SelectContent>
                        {chatAgents.map((agent) => (
                          <SelectItem key={agent.id} value={agent.id} className="cursor-pointer">
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
              }
            />
          </div>
        </>
      )}

      {previewImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <button className="absolute top-4 right-4 text-white/70 hover:text-white hover:bg-white/20 rounded-full p-2 transition-colors z-50 cursor-pointer">
            <XIcon className="w-8 h-8" />
          </button>
          <div className="w-full h-full flex items-center justify-center p-2">
            <img
              src={previewImage.url}
              alt={previewImage.name}
              className="max-w-full max-h-[85vh] object-contain rounded shadow-2xl cursor-zoom-out"
              onClick={(e) => {
                e.stopPropagation()
                setPreviewImage(null)
              }}
            />
          </div>
          <div className="absolute bottom-6 text-white text-sm font-medium bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm">
            {previewImage.name}
          </div>
        </div>
      )}
    </div>
  )
}
