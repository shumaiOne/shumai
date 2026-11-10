import { client } from '@/ui/api/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import { Skeleton } from '@/ui/components/ui/skeleton'
import { formatTimeAgo } from '@/ui/lib/time'
import { m } from '@/ui/paraglide/messages.js'
import type { EntryRecord } from '@earendil-works/pi-durable'
import { getShumaiMessage, serializeContextToXml } from '@shumai/dtos'
import { useQuery } from '@tanstack/react-query'
import { Terminal } from 'lucide-react'
import Markdown from 'react-markdown'

interface AgentSessionLogsDialogProps {
  sessionId?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function EntryLog({ entry }: { entry: EntryRecord }) {
  const application = getShumaiMessage(entry)
  const message = entry.model?.[0]
  const timestamp = application?.timestamp ?? message?.timestamp
  const content = application
    ? `${application.displayText}\n\n${serializeContextToXml(application.context)}`
    : message && typeof message.content === 'string'
      ? message.content
      : (Array.isArray(message?.content) ? message.content : [])
          .filter((block) => block.type === 'text')
          .map((block) => block.text)
          .join('\n')
  const role =
    application || message?.role === 'user'
      ? m.role_user()
      : message?.role === 'assistant'
        ? m.role_agent()
        : message?.role === 'toolResult'
          ? m.tool_result_with_name({ name: message.toolName })
          : entry.kind
  return (
    <div className="min-w-0 rounded-lg border border-border bg-muted/30 p-3 space-y-2 [overflow-wrap:anywhere]">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{role}</span>
        <span>
          {m.entry_id()}: {entry.id}
        </span>
        {timestamp !== undefined && <span>{formatTimeAgo(new Date(timestamp).toISOString())}</span>}
      </div>
      {content && (
        <div className="text-xs whitespace-pre-wrap break-words [&_pre]:whitespace-pre-wrap [&_pre]:break-all">
          <Markdown>{content}</Markdown>
        </div>
      )}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer font-mono">{entry.kind}</summary>
        <pre className="mt-2 whitespace-pre-wrap break-all">{JSON.stringify(entry, null, 2)}</pre>
      </details>
    </div>
  )
}

export function AgentSessionLogsDialog({
  sessionId,
  open,
  onOpenChange,
}: AgentSessionLogsDialogProps) {
  const { data: entries, isLoading } = useQuery({
    queryKey: ['agent-sessions', sessionId, 'entries'],
    queryFn: async () => {
      if (!sessionId) return []
      const response = await client.api['agent-sessions'][':sessionId'].entries.$get({
        param: { sessionId },
      })
      if (!response.ok) throw new Error('Failed to fetch session logs')
      return (await response.json()) as EntryRecord[]
    },
    enabled: open && !!sessionId,
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl h-[80dvh] max-h-[80dvh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            {m.agent_session_logs()}
          </DialogTitle>
          <DialogDescription>{m.agent_logs_description()}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <div className="space-y-3 pr-3 py-2">
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              entries?.map((entry) => <EntryLog key={entry.id} entry={entry} />)
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
