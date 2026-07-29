import { useEffect, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useInView } from 'react-intersection-observer'
import { client } from '@/ui/api/client'
import { m } from '@/ui/paraglide/messages.js'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/components/ui/avatar'
import { Badge } from '@/ui/components/ui/badge'
import { Loader2, MessagesSquare } from 'lucide-react'
import { formatTimeAgo } from '@/ui/lib/time'
import { AgentSessionLogsDialog } from '../agent/agent-session-logs-dialog'

interface AgentSessionsDashboardProps {
  teamId: string
}

export function AgentSessionsDashboard({ teamId }: AgentSessionsDashboardProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const { ref: loadMoreRef, inView } = useInView()

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ['teams', teamId, 'agent-sessions'],
      queryFn: async ({ pageParam }) => {
        const res = await client.api.teams[':teamId']['agent-sessions'].$get({
          param: { teamId },
          query: {
            first: '20',
            after: pageParam ? String(pageParam) : undefined,
          },
        })
        if (!res.ok) throw new Error('Failed to fetch agent sessions')
        return await res.json()
      },
      initialPageParam: '',
      getNextPageParam: (lastPage) => lastPage.pageInfo.cursor || undefined,
      enabled: !!teamId,
    })

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  const allSessions =
    data?.pages.flatMap((page) => page.data).filter((s) => s.id !== 'pending') || []
  const totalCount = data?.pages[0]?.pageInfo.total ?? allSessions.length

  const getSessionTypeBadge = (type: string) => {
    switch (type) {
      case 'comment':
        return (
          <Badge
            variant="outline"
            className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
          >
            {m.session_type_comment()}
          </Badge>
        )
      case 'chat':
        return (
          <Badge
            variant="outline"
            className="bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20"
          >
            {m.session_type_chat()}
          </Badge>
        )
      case 'naming':
        return (
          <Badge
            variant="outline"
            className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
          >
            {m.session_type_naming()}
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
            {type}
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border border-border/50 shadow-xs">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <MessagesSquare className="w-5 h-5 text-violet-500" />
                {m.sessions()} ({totalCount})
              </CardTitle>
              <CardDescription className="mt-1 text-sm text-muted-foreground">
                {m.sessions_description()}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <div className="flex h-64 items-center justify-center text-destructive">
              Failed to load agent sessions.
            </div>
          ) : allSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <MessagesSquare className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="text-base font-medium">{m.no_sessions_found()}</p>
            </div>
          ) : (
            <div className="rounded-md border border-border/50 overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead>{m.session_name()}</TableHead>
                    <TableHead>{m.creator()}</TableHead>
                    <TableHead>{m.session_type()}</TableHead>
                    <TableHead className="text-right">{m.create_time()}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allSessions.map((session) => (
                    <TableRow
                      key={session.id}
                      onClick={() => setSelectedSessionId(session.id)}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-foreground">
                            {session.name || m.untitled_session()}
                          </span>
                          <span className="text-xs font-mono text-muted-foreground/70">
                            {session.id}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={session.creator?.image || undefined} />
                            <AvatarFallback className="text-[10px]">
                              {session.creator?.name?.[0]?.toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-foreground/90">
                            {session.creator?.name || 'System / Agent'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{getSessionTypeBadge(session.type)}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {formatTimeAgo(session.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div ref={loadMoreRef} className="py-4 flex justify-center">
                {isFetchingNextPage && (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AgentSessionLogsDialog
        sessionId={selectedSessionId}
        open={!!selectedSessionId}
        onOpenChange={(open) => {
          if (!open) setSelectedSessionId(null)
        }}
      />
    </div>
  )
}
