import React, { useEffect, useState } from 'react'
import { client } from '@/ui/api/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/components/ui/avatar'
import { Badge } from '@/ui/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/components/ui/table'
import { m } from '@/ui/paraglide/messages.js'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Bot, Calendar, Loader2, MessageSquareCode } from 'lucide-react'
import { useInView } from 'react-intersection-observer'
import { AgentSessionLogsDialog } from '../chat/AgentSessionLogsDialog'

interface AgentSessionsDashboardProps {
  teamId: string
}

export function AgentSessionsDashboard({ teamId }: AgentSessionsDashboardProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [selectedSessionName, setSelectedSessionName] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const { ref, inView } = useInView()

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useInfiniteQuery({
      queryKey: ['agent-sessions-list', teamId],
      queryFn: async ({ pageParam }) => {
        const res = await client.api.teams[':teamId']['agent-sessions'].$get({
          param: { teamId },
          query: {
            first: '20',
            after: pageParam || undefined,
          },
        })
        if (!res.ok) throw new Error('Failed to fetch agent sessions')
        return await res.json()
      },
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) =>
        lastPage.pageInfo.cursor && lastPage.data.length > 0 ? lastPage.pageInfo.cursor : undefined,
      enabled: !!teamId,
    })

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  const rawSessions = data?.pages.flatMap((page) => page.data) ?? []
  const sessions = rawSessions.filter((s) => s.name?.trim().toLowerCase() !== 'pending')
  const totalSessions = data?.pages[0]?.pageInfo?.total ?? sessions.length

  const handleRowClick = (sessionId: string, sessionName?: string | null) => {
    setSelectedSessionId(sessionId)
    setSelectedSessionName(sessionName || null)
    setIsDialogOpen(true)
  }

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'chat':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
      case 'comment':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
      case 'naming':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
      default:
        return 'bg-muted text-muted-foreground border-border'
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <MessageSquareCode className="w-6 h-6 text-primary" />
            {m.agent_sessions()}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{m.agent_sessions_description()}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 text-xs font-semibold rounded-full">
            {totalSessions} {totalSessions === 1 ? 'Session' : 'Sessions'}
          </Badge>
        </div>
      </div>

      {/* Main Sessions List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin mb-3 text-primary" />
          <p className="text-sm">{m.loading()}</p>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-16 text-destructive">
          <p className="text-sm font-medium">{m.failed_to_load()}</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border/60 p-8">
          <MessageSquareCode className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-base font-semibold text-foreground mb-1">{m.no_sessions_found()}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold">{m.session_name()}</TableHead>
                <TableHead className="font-semibold">{m.creator()}</TableHead>
                <TableHead className="font-semibold">{m.session_type()}</TableHead>
                <TableHead className="font-semibold">{m.create_time()}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => {
                const displayName = session.name || session.id
                const creatorName = session.creator?.name || 'System'
                const creatorAvatar = session.creator?.avatar
                const agentName = session.agent?.name

                return (
                  <TableRow
                    key={session.id}
                    onClick={() => handleRowClick(session.id, session.name)}
                    className="cursor-pointer transition-colors hover:bg-accent/50"
                  >
                    <TableCell className="font-medium">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold text-foreground truncate max-w-xs sm:max-w-md">
                          {displayName}
                        </span>
                        {agentName && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Bot className="w-3.5 h-3.5 text-muted-foreground/70" />
                            {agentName}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          {creatorAvatar ? (
                            <AvatarImage src={creatorAvatar} alt={creatorName} />
                          ) : null}
                          <AvatarFallback className="text-[10px] bg-muted">
                            {creatorName.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium text-foreground">{creatorName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[11px] px-2.5 py-0.5 capitalize font-medium ${getTypeBadgeVariant(
                          session.type,
                        )}`}
                      >
                        {session.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground/70" />
                        {formatDate(session.createdAt)}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          {/* Infinite Scroll Sentinel */}
          <div ref={ref} className="py-4 flex justify-center border-t border-border/40">
            {isFetchingNextPage ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>{m.loading()}</span>
              </div>
            ) : hasNextPage ? (
              <span className="text-xs text-muted-foreground/60">Scroll to load more</span>
            ) : (
              <span className="text-xs text-muted-foreground/40">All sessions loaded</span>
            )}
          </div>
        </div>
      )}

      {/* Session Entries Modal Dialog */}
      <AgentSessionLogsDialog
        sessionId={selectedSessionId}
        sessionName={selectedSessionName}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </div>
  )
}
