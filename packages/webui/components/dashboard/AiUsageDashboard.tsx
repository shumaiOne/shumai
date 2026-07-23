import { useState } from 'react'
import { useQuery, useQueries } from '@tanstack/react-query'
import type { Timeframe } from '@shumai/dtos'
import { client } from '@/ui/api/client'
import { m } from '@/ui/paraglide/messages.js'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/ui/components/ui/toggle-group'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/components/ui/avatar'
import { Loader2 } from 'lucide-react'

interface AiUsageDashboardProps {
  teamId: string
}

export function AiUsageDashboard({ teamId }: AiUsageDashboardProps) {
  const [viewMode, setViewMode] = useState<'team' | 'members'>('team')
  const [timeframe, setTimeframe] = useState<Timeframe>('1h')

  // Query team-level usage
  const { data: teamUsageData, isLoading: isTeamLoading } = useQuery({
    queryKey: ['teams', teamId, 'ai-usage', timeframe, 'team'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId']['ai-usage'].$get({
        param: { teamId },
        query: { timeframe },
      })
      if (!res.ok) throw new Error('Failed to fetch team AI usage')
      return await res.json()
    },
    enabled: !!teamId && viewMode === 'team',
  })

  // Query member list for members view
  const { data: members, isLoading: isMembersListLoading } = useQuery({
    queryKey: ['teams', teamId, 'members'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].members.$get({
        param: { teamId },
        query: {},
      })
      if (!res.ok) throw new Error('Failed to fetch team members')
      return await res.json()
    },
    enabled: !!teamId && viewMode === 'members',
  })

  // Query each member's AI usage in parallel
  const memberUsageQueries = useQueries({
    queries: (members || []).map((member) => ({
      queryKey: ['teams', teamId, 'ai-usage', timeframe, member.id],
      queryFn: async () => {
        const res = await client.api.teams[':teamId']['ai-usage'].$get({
          param: { teamId },
          query: { timeframe, userId: member.id },
        })
        if (!res.ok) throw new Error(`Failed to fetch AI usage for member ${member.id}`)
        return await res.json()
      },
      enabled: !!teamId && viewMode === 'members',
    })),
  })

  const isMembersLoading = isMembersListLoading || memberUsageQueries.some((q) => q.isLoading)

  const getInitials = (name?: string) => {
    if (!name) return 'U'
    const names = name.split(' ')
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  const localizeRole = (role?: string) => {
    if (!role) return ''
    switch (role.toLowerCase()) {
      case 'owner':
        return m.owner()
      case 'editor':
        return m.editor()
      case 'reviewer':
        return m.reviewer()
      default:
        return role
    }
  }

  const formatTokens = (val?: number) => (val ?? 0).toLocaleString()
  const formatCost = (val?: number) => `$${(val ?? 0).toFixed(6)}`

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6">
        <div>
          <CardTitle className="text-xl font-semibold tracking-tight">{m.ai_usage()}</CardTitle>
          <CardDescription className="text-sm text-muted-foreground mt-1">
            {m.ai_usage_description()}
          </CardDescription>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(val) => {
              if (val) setViewMode(val as 'team' | 'members')
            }}
            className="border rounded-lg p-1 bg-muted/30"
          >
            <ToggleGroupItem value="team" className="px-3 py-1.5 text-xs font-medium">
              {m.team_view()}
            </ToggleGroupItem>
            <ToggleGroupItem value="members" className="px-3 py-1.5 text-xs font-medium">
              {m.members_view()}
            </ToggleGroupItem>
          </ToggleGroup>

          <ToggleGroup
            type="single"
            value={timeframe}
            onValueChange={(val) => {
              if (val) setTimeframe(val as Timeframe)
            }}
            className="border rounded-lg p-1 bg-muted/30"
          >
            <ToggleGroupItem value="1h" className="px-2.5 py-1.5 text-xs font-medium">
              1h
            </ToggleGroupItem>
            <ToggleGroupItem value="24h" className="px-2.5 py-1.5 text-xs font-medium">
              24h
            </ToggleGroupItem>
            <ToggleGroupItem value="7d" className="px-2.5 py-1.5 text-xs font-medium">
              7d
            </ToggleGroupItem>
            <ToggleGroupItem value="30d" className="px-2.5 py-1.5 text-xs font-medium">
              30d
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardHeader>

      <CardContent>
        {viewMode === 'team' ? (
          isTeamLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{m.team()}</TableHead>
                    <TableHead className="text-right">{m.input_tokens()}</TableHead>
                    <TableHead className="text-right">{m.output_tokens()}</TableHead>
                    <TableHead className="text-right">{m.cache_read_tokens()}</TableHead>
                    <TableHead className="text-right">{m.total_tokens()}</TableHead>
                    <TableHead className="text-right">{m.cost()}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">{m.team()}</TableCell>
                    <TableCell className="text-right">
                      {formatTokens(teamUsageData?.team?.inputTokens)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatTokens(teamUsageData?.team?.outputTokens)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatTokens(teamUsageData?.team?.cacheReadTokens)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatTokens(teamUsageData?.team?.totalTokens)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCost(teamUsageData?.team?.cost)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )
        ) : isMembersLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{m.members()}</TableHead>
                  <TableHead>{m.role()}</TableHead>
                  <TableHead className="text-right">{m.input_tokens()}</TableHead>
                  <TableHead className="text-right">{m.output_tokens()}</TableHead>
                  <TableHead className="text-right">{m.cache_read_tokens()}</TableHead>
                  <TableHead className="text-right">{m.total_tokens()}</TableHead>
                  <TableHead className="text-right">{m.cost()}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(members || []).map((member, idx) => {
                  const usageResult = memberUsageQueries[idx]?.data?.member
                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 rounded-full">
                            {member.image && (
                              <AvatarImage
                                src={member.image}
                                alt={member.name}
                                className="object-cover"
                              />
                            )}
                            <AvatarFallback className="bg-primary/20 text-xs">
                              {getInitials(member.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium leading-none">{member.name}</span>
                            <span className="text-xs text-muted-foreground mt-0.5">
                              {member.email}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {localizeRole(member.role)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatTokens(usageResult?.inputTokens)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatTokens(usageResult?.outputTokens)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatTokens(usageResult?.cacheReadTokens)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatTokens(usageResult?.totalTokens)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCost(usageResult?.cost)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
