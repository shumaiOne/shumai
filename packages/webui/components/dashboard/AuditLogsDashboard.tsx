import { useEffect, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useInView } from 'react-intersection-observer'
import { client } from '@/ui/api/client'
import { m } from '@/ui/paraglide/messages.js'
import { AuditAction } from '@shumai/dtos'
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
import { Input } from '@/ui/components/ui/input'
import { Button } from '@/ui/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/components/ui/popover'
import { Checkbox } from '@/ui/components/ui/checkbox'
import { Loader2, Search, Filter, Activity, X } from 'lucide-react'
import { formatTimeAgo } from '@/ui/lib/time'

const ALL_AUDIT_ACTIONS = Object.values(AuditAction)

interface MemberInfo {
  id: string
  userId?: string
  name?: string
  image?: string
  user?: {
    id: string
    name?: string
    image?: string
  }
}

interface AuditLogsDashboardProps {
  teamId: string
}

export function AuditLogsDashboard({ teamId }: AuditLogsDashboardProps) {
  const [selectedActions, setSelectedActions] = useState<AuditAction[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [itemIdFilter, setItemIdFilter] = useState<string>('')

  const { ref: loadMoreRef, inView } = useInView()

  // Fetch team members for user filter options
  const { data: membersData } = useQuery({
    queryKey: ['teams', teamId, 'members'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].members.$get({
        param: { teamId },
        query: {},
      })
      if (!res.ok) return []
      return (await res.json()) as MemberInfo[]
    },
    enabled: !!teamId,
  })

  const teamMembers = membersData || []

  // Infinite query for audit logs
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ['teams', teamId, 'audit-logs', selectedActions, selectedUserIds, itemIdFilter],
      queryFn: async ({ pageParam }) => {
        const res = await client.api.teams[':teamId']['audit-logs'].$get({
          param: { teamId },
          query: {
            first: '20',
            after: pageParam ? String(pageParam) : undefined,
            actions: selectedActions.length > 0 ? selectedActions : undefined,
            userIds: selectedUserIds.length > 0 ? selectedUserIds : undefined,
            itemId: itemIdFilter.trim() || undefined,
          },
        })
        if (!res.ok) throw new Error('Failed to fetch audit logs')
        return await res.json()
      },
      initialPageParam: '',
      getNextPageParam: (lastPage) => lastPage.pageInfo.endCursor || undefined,
      enabled: !!teamId,
    })

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  const allLogs = data?.pages.flatMap((page) => page.nodes) || []
  const totalCount = data?.pages[0]?.total ?? 0

  const toggleAction = (action: AuditAction) => {
    setSelectedActions((prev) =>
      prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action],
    )
  }

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((u) => u !== userId) : [...prev, userId],
    )
  }

  const getActionBadge = (action: string) => {
    if (action.includes('delete') || action.includes('remove') || action.includes('revoke')) {
      return (
        <Badge
          variant="outline"
          className="bg-destructive/10 text-destructive border-destructive/20 font-mono text-xs"
        >
          {action}
        </Badge>
      )
    }
    if (action.includes('create') || action.includes('add')) {
      return (
        <Badge
          variant="outline"
          className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-mono text-xs"
        >
          {action}
        </Badge>
      )
    }
    if (action.includes('update') || action.includes('reparent') || action.includes('copy')) {
      return (
        <Badge
          variant="outline"
          className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 font-mono text-xs"
        >
          {action}
        </Badge>
      )
    }
    return (
      <Badge
        variant="outline"
        className="bg-muted text-muted-foreground border-border font-mono text-xs"
      >
        {action}
      </Badge>
    )
  }

  const memberMap = new Map(teamMembers.map((m) => [m.userId || m.id, m]))

  return (
    <div className="space-y-6">
      <Card className="border border-border/50 shadow-xs">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                {m.audit_logs()}
              </CardTitle>
              <CardDescription className="mt-1">{m.audit_logs_description()}</CardDescription>
            </div>
            {totalCount > 0 && (
              <Badge variant="secondary" className="w-fit text-xs font-normal">
                {totalCount} {m.audit_logs()}
              </Badge>
            )}
          </div>

          {/* Filter Bar */}
          <div className="mt-4 flex flex-wrap items-center gap-3 pt-4 border-t border-border/40">
            {/* Action Multi-select */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-2 text-xs border-dashed">
                  <Filter className="h-3.5 w-3.5" />
                  {m.filter_by_action()}
                  {selectedActions.length > 0 && (
                    <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                      {selectedActions.length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                <div className="text-xs font-semibold text-muted-foreground px-2 py-1 mb-1">
                  {m.select_actions()}
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                  {ALL_AUDIT_ACTIONS.map((act) => (
                    <label
                      key={act}
                      className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded-md cursor-pointer text-xs"
                    >
                      <Checkbox
                        checked={selectedActions.includes(act)}
                        onCheckedChange={() => toggleAction(act)}
                      />
                      <span className="font-mono">{act}</span>
                    </label>
                  ))}
                </div>
                {selectedActions.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2 h-7 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setSelectedActions([])}
                  >
                    Clear Actions
                  </Button>
                )}
              </PopoverContent>
            </Popover>

            {/* User Multi-select */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-2 text-xs border-dashed">
                  <Filter className="h-3.5 w-3.5" />
                  {m.filter_by_user()}
                  {selectedUserIds.length > 0 && (
                    <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                      {selectedUserIds.length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                <div className="text-xs font-semibold text-muted-foreground px-2 py-1 mb-1">
                  {m.select_users()}
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                  {teamMembers.map((member) => {
                    const uId = member.userId || member.user?.id || member.id
                    const uName = member.user?.name || member.name || uId
                    const uImage = member.user?.image || member.image
                    return (
                      <label
                        key={uId}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded-md cursor-pointer text-xs"
                      >
                        <Checkbox
                          checked={selectedUserIds.includes(uId)}
                          onCheckedChange={() => toggleUser(uId)}
                        />
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={uImage || undefined} />
                          <AvatarFallback className="text-[10px]">
                            {uName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{uName}</span>
                      </label>
                    )
                  })}
                </div>
                {selectedUserIds.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2 h-7 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setSelectedUserIds([])}
                  >
                    Clear Users
                  </Button>
                )}
              </PopoverContent>
            </Popover>

            {/* Item ID Input */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={m.search_item_id()}
                value={itemIdFilter}
                onChange={(e) => setItemIdFilter(e.target.value)}
                className="pl-8 pr-8 h-9 text-xs"
              />
              {itemIdFilter && (
                <button
                  onClick={() => setItemIdFilter('')}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Reset All Filters */}
            {(selectedActions.length > 0 || selectedUserIds.length > 0 || itemIdFilter) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setSelectedActions([])
                  setSelectedUserIds([])
                  setItemIdFilter('')
                }}
              >
                Clear all
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <div className="p-8 text-center text-sm text-destructive">
              Failed to load audit logs.
            </div>
          ) : allLogs.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              {m.no_audit_logs()}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border/50">
                  <TableHead className="w-[180px] text-xs font-semibold">{m.action()}</TableHead>
                  <TableHead className="w-[200px] text-xs font-semibold">{m.user()}</TableHead>
                  <TableHead className="text-xs font-semibold">{m.item_id()}</TableHead>
                  <TableHead className="text-xs font-semibold">{m.project_id()}</TableHead>
                  <TableHead className="w-[160px] text-right text-xs font-semibold">
                    {m.timestamp()}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allLogs.map((log) => {
                  const member = log.userId ? memberMap.get(log.userId) : null
                  const userName = member?.user?.name || member?.name || log.userId || 'System'
                  const userImage = member?.user?.image || member?.image

                  return (
                    <TableRow key={log.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="py-3 font-medium">
                        {getActionBadge(log.action)}
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={userImage || undefined} />
                            <AvatarFallback className="text-[10px]">
                              {userName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium text-foreground truncate max-w-[140px]">
                            {userName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-xs font-mono text-muted-foreground">
                        {log.itemId || '-'}
                      </TableCell>
                      <TableCell className="py-3 text-xs font-mono text-muted-foreground">
                        {log.projectId || '-'}
                      </TableCell>
                      <TableCell className="py-3 text-right text-xs text-muted-foreground">
                        {formatTimeAgo(log.createdAt)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}

          {/* Infinite Scroll sentinel */}
          <div ref={loadMoreRef} className="py-4 flex justify-center">
            {isFetchingNextPage && (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
