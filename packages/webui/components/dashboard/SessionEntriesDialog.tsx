import React from 'react'
import { client } from '@/ui/api/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import { Separator } from '@/ui/components/ui/separator'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Terminal } from 'lucide-react'
import Markdown from 'react-markdown'
import { m } from '@/ui/paraglide/messages.js'

interface SessionEntriesDialogProps {
  sessionId: string | null
  sessionName?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const preprocessMarkdown = (text: string): string => {
  return text.replace(/<@([a-zA-Z0-9_-]+)>/g, '@$1').replace(/^\[([^\]]+)\]:/gm, '\\[$1\\]:')
}

export function SessionEntriesDialog({
  sessionId,
  sessionName,
  open,
  onOpenChange,
}: SessionEntriesDialogProps) {
  const { data: logs, isLoading } = useQuery({
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

  const renderToolCallArguments = (args: unknown) => {
    if (!args) return null
    if (typeof args === 'object') {
      const obj = args as Record<string, unknown>
      if (Object.keys(obj).length === 0) return null

      if (obj.code && typeof obj.code === 'string') {
        return (
          <div className="space-y-1">
            <pre className="text-xs font-mono bg-muted/40 p-2 rounded border border-foreground/5 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
              {obj.code}
            </pre>
          </div>
        )
      }

      if (obj.prompt && typeof obj.prompt === 'string') {
        return (
          <div className="space-y-1">
            <div className="text-xs text-foreground/90 bg-muted/40 p-2 rounded border border-foreground/5 whitespace-pre-wrap break-words">
              {obj.prompt}
            </div>
          </div>
        )
      }

      return (
        <div className="space-y-1.5">
          {Object.entries(obj).map(([key, value]) => {
            const valStr =
              typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
            return (
              <div
                key={key}
                className="text-xs bg-muted/30 p-2 rounded border border-foreground/5 flex flex-col gap-1"
              >
                <span className="font-mono text-[11px] text-muted-foreground font-semibold">
                  {key}:
                </span>
                <pre className="font-mono text-[11px] text-foreground/90 whitespace-pre-wrap break-words">
                  {valStr}
                </pre>
              </div>
            )
          })}
        </div>
      )
    }

    return <div className="text-xs font-mono whitespace-pre-wrap">{String(args)}</div>
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl h-[85vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Terminal className="w-5 h-5 text-primary" />
            {m.agent_session_logs()}
            {sessionName && (
              <span className="text-xs font-normal text-muted-foreground ml-2 truncate max-w-md">
                ({sessionName})
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {m.agent_logs_description()}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 min-w-0 mt-4">
          <ScrollArea className="h-full w-full pr-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mb-2" />
                <p className="text-xs">{m.loading()}</p>
              </div>
            ) : logs && logs.length > 0 ? (
              <div className="relative border-l-2 border-muted pl-4 ml-2 space-y-6 py-2">
                {logs.map((entry) => {
                  const entryData = entry.entry as Record<string, unknown> | null
                  const timestamp = entryData?.timestamp
                    ? new Date(String(entryData.timestamp)).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })
                    : ''

                  if (entryData && typeof entryData === 'object' && 'role' in entryData) {
                    const msg = entryData as {
                      role: string
                      content?: unknown
                      isError?: boolean
                    }

                    let roleName = msg.role
                    let badgeColor = 'bg-primary/10 text-primary border-primary/20'
                    let dotColor = 'bg-primary'

                    if (msg.role === 'user') {
                      roleName = m.role_user()
                      badgeColor = 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                      dotColor = 'bg-blue-500'
                    } else if (msg.role === 'agent' || msg.role === 'assistant') {
                      roleName = m.role_agent()
                      badgeColor = 'bg-purple-500/10 text-purple-500 border-purple-500/20'
                      dotColor = 'bg-purple-500'
                    } else if (msg.role === 'toolResult') {
                      roleName = msg.isError ? 'Error' : m.tool_result()
                      badgeColor = msg.isError
                        ? 'bg-red-500/10 text-red-500 border-red-500/20'
                        : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      dotColor = msg.isError ? 'bg-red-500' : 'bg-emerald-500'
                    } else if (msg.role === 'thinking') {
                      roleName = m.role_thinking()
                      badgeColor = 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                      dotColor = 'bg-amber-500'
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
                              const toolName = String(itemObj.name || itemObj.toolName || 'tool')
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
                                    <div className="space-y-1 pt-2">
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
                      <div key={entry.id} className="relative pl-2">
                        <div
                          className={`absolute -left-[21px] top-2.5 h-3 w-3 rounded-full border-2 border-background ${dotColor}`}
                        />

                        <div className="flex flex-col gap-1.5 bg-muted/30 dark:bg-muted/10 p-3 rounded-lg border border-foreground/5 backdrop-blur-xs w-full">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider border ${badgeColor}`}
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

                  return (
                    <div key={entry.id} className="relative pl-2">
                      <div className="absolute -left-[21px] top-2.5 h-3 w-3 rounded-full border-2 border-background bg-gray-400" />
                      <div className="bg-muted/30 p-3 rounded-lg border border-foreground/5">
                        <div className="text-[10px] text-muted-foreground/60 mb-1">{timestamp}</div>
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
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {m.session_no_entries_yet()}
                </p>
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
