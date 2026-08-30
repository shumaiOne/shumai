import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import { Separator } from '@/ui/components/ui/separator'
import { Skeleton } from '@/ui/components/ui/skeleton'
import { formatTimeAgo } from '@/ui/lib/time'
import { m } from '@/ui/paraglide/messages.js'
import { Terminal } from 'lucide-react'
import Markdown from 'react-markdown'
import { serializeContextToXml, type ShumaiMessageContext } from '@shumai/dtos'

interface AgentSessionLogsDialogProps {
  sessionId?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const preprocessMarkdown = (text: string): string => {
  return text.replace(/<@([a-zA-Z0-9_-]+)>/g, '@$1').replace(/^\[([^\]]+)\]:/gm, '\\[$1\\]:')
}

export function AgentSessionLogsDialog({
  sessionId,
  open,
  onOpenChange,
}: AgentSessionLogsDialogProps) {
  const { data: logs, isLoading: isLogsLoading } = useQuery({
    queryKey: ['agent-sessions', sessionId, 'entries'],
    queryFn: async () => {
      if (!sessionId) return []
      const res = await client.api['agent-sessions'][':sessionId'].entries.$get({
        param: { sessionId },
      })
      if (!res.ok) throw new Error('Failed to fetch session logs')
      return await res.json()
    },
    enabled: open && !!sessionId,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col p-6 overflow-hidden bg-background/95 backdrop-blur-md border border-foreground/15 shadow-2xl">
        <DialogHeader className="pb-4 border-b border-foreground/15">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Terminal className="w-5 h-5 text-violet-500" />
            {m.agent_session_logs()}
          </DialogTitle>
          <DialogDescription>{m.agent_logs_description()}</DialogDescription>
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
                  if (piEntry.type === 'custom_message') {
                    if (piEntry.customType === 'context') return null
                    if (piEntry.customType === 'shumai_message') {
                      const xml = serializeContextToXml(piEntry.details as ShumaiMessageContext)
                      const text = typeof piEntry.content === 'string' ? piEntry.content : ''
                      const fullText = xml ? `${text}\n\n${xml}`.trim() : text
                      const badgeColor = 'bg-primary/10 text-primary'
                      const roleName = m.role_user()

                      return (
                        <div key={entry.id} className="relative pl-6 pb-6 last:pb-0">
                          {/* Timeline Line */}
                          <div className="absolute left-[9px] top-2 bottom-0 w-0.5 bg-foreground/10 last:hidden" />

                          {/* Timeline Node */}
                          <div className="absolute left-0 top-1.5 h-5 w-5 rounded-full border-4 border-background flex items-center justify-center bg-primary" />

                          <div className="flex flex-col gap-1.5 bg-muted/30 dark:bg-muted/10 p-3 rounded-lg border border-foreground/5 backdrop-blur-xs w-full">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${badgeColor}`}
                                >
                                  {roleName}
                                </span>
                                <span
                                  className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded border border-foreground/10 select-all"
                                  title={m.entry_id()}
                                >
                                  {m.entry_id()}: {entry.id}
                                </span>
                              </div>
                              <span className="text-[10px] text-muted-foreground/60 shrink-0">
                                {timestamp}
                              </span>
                            </div>

                            <div className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed font-sans">
                              {fullText}
                            </div>
                          </div>
                        </div>
                      )
                    }
                  }

                  if (piEntry.type === 'message' && piEntry.message) {
                    const msg = piEntry.message as Record<string, unknown>
                    let badgeColor = 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                    let roleName: string = String(msg.role || '')

                    if (msg.role === 'user') {
                      badgeColor = 'bg-primary/10 text-primary'
                      roleName = m.role_user()
                    } else if (msg.role === 'assistant') {
                      badgeColor =
                        'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300'
                      roleName = m.role_agent()
                    } else if (msg.role === 'toolResult') {
                      badgeColor = msg.isError
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                      roleName = m.tool_result_with_name({
                        name: String(msg.toolName || m.unknown()),
                      })
                    } else if (msg.role === 'thought') {
                      badgeColor =
                        'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                      roleName = m.role_thinking()
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
                        <div className="text-xs font-mono whitespace-pre-wrap">{String(args)}</div>
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
                                itemObj.name || itemObj.toolName || m.unknown(),
                              )
                              const toolArgs = itemObj.arguments || itemObj.args
                              renderedBlocks.push(
                                <div key={`tool-${idx}`} className="text-xs space-y-2 py-1">
                                  <div className="font-semibold text-violet-600 dark:text-violet-400 flex items-center gap-1.5">
                                    {m.calling_tool()}{' '}
                                    <span className="font-mono bg-violet-500/10 px-1 py-0.5 rounded text-[11px]">
                                      {toolName}
                                    </span>
                                  </div>
                                  {!!toolArgs && (
                                    <div className="space-y-1 pt-3">
                                      <div className="text-[10px] text-muted-foreground/60 uppercase font-bold tracking-wider">
                                        {m.tool_arguments()}
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
                                  {m.image_object()}
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
                              ? 'bg-primary'
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
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${badgeColor}`}
                              >
                                {roleName}
                              </span>
                              <span
                                className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded border border-foreground/10 select-all"
                                title={m.entry_id()}
                              >
                                {m.entry_id()}: {entry.id}
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground/60 shrink-0">
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
                      <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                        <span
                          className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded border border-foreground/10 select-all"
                          title="Entry ID"
                        >
                          ID: {entry.id}
                        </span>
                        <div className="text-[10px] text-muted-foreground/60">{timestamp}</div>
                      </div>
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
              <p className="text-sm font-medium">{m.no_logs_found()}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">{m.session_no_entries_yet()}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
