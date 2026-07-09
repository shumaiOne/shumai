import { createLazyFileRoute } from '@tanstack/react-router'
import { client } from '@/ui/api/client'
import { FolderTree } from '@/ui/components/folder-tree'
import { ResizeHandle } from '@/ui/components/resize-handle'
import { m } from '@/ui/paraglide/messages.js'
import { Switch } from '@/ui/components/ui/switch'
import { Button } from '@/ui/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/components/ui/table'
import { Avatar, AvatarImage, AvatarFallback } from '@/ui/components/ui/avatar'
import { useUiStore } from '@/ui/stores/ui'
import { useTeamContextStore } from '@/ui/stores/team-context'
import {
  useMutation,
  useInfiniteQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { Copy, ExternalLink, Calendar, Link2, Share2, Loader2 } from 'lucide-react'
import { useInView } from 'react-intersection-observer'
import { toast } from 'sonner'
import type { ShareLinkInfo } from '@shumai/dtos'
import { ProjectFolderSkeleton } from '@/ui/components/loading-skeletons'
import { projectInfoQueryOptions } from './index'

const getInitials = (name?: string) => {
  if (!name) return '??'
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function SharesPage() {
  const { projectId } = Route.useParams()
  const { teamId, ensureTeamIdForProject } = useTeamContextStore()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  useEffect(() => {
    ensureTeamIdForProject(projectId)
  }, [projectId, ensureTeamIdForProject])

  const { data: projectInfo } = useSuspenseQuery(projectInfoQueryOptions(projectId))

  const rootFolderId = projectInfo?.rootFolder
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(240)

  const {
    shareConfigLeftSidebarCollapsed: isLeftSidebarCollapsed,
    setShareConfigLeftSidebarCollapsed: setIsLeftSidebarCollapsed,
  } = useUiStore()

  const {
    data: sharesData,
    isLoading: isSharesLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['shares', projectId],
    queryFn: async ({ pageParam }) => {
      const res = await client.api.projects[':projectId'].shares.$get({
        param: { projectId },
        query: { first: '20', after: pageParam as string },
      })
      if (!res.ok) throw new Error('Failed to fetch share links')
      return (await res.json()) as unknown as {
        data: ShareLinkInfo[]
        pageInfo: { cursor?: string; total?: number }
      }
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.pageInfo?.cursor || undefined,
    enabled: !!projectId,
  })

  const { ref: inViewRef, inView } = useInView()

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  const shares = useMemo(() => sharesData?.pages.flatMap((p) => p.data) || [], [sharesData])

  const { mutate: toggleVisibility } = useMutation({
    mutationFn: async ({ id, isDisabled }: { id: string; isDisabled: boolean }) => {
      const res = await client.api.shares[':shareId'].$put({
        param: { shareId: id },
        json: { isDisabled },
      })
      if (!res.ok) throw new Error('Failed to update share link')
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shares', projectId] })
      toast.success(m.share_link_status_updated())
    },
    onError: (err) => {
      toast.error(m.error_message({ message: err.message }))
    },
  })

  if (!teamId || !rootFolderId || !projectInfo) {
    return <ProjectFolderSkeleton />
  }

  const handleCopyLink = (shareId: string) => {
    const url = `${window.location.origin}/share/${shareId}`
    navigator.clipboard.writeText(url)
    toast.success(m.link_copied())
  }

  return (
    <div className="flex flex-1 flex-col bg-background min-h-0">
      <div className="flex flex-1 overflow-hidden relative">
        {!isLeftSidebarCollapsed && (
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsLeftSidebarCollapsed(true)}
          />
        )}

        {!isLeftSidebarCollapsed && (
          <>
            <div className="bg-background" style={{ width: leftSidebarWidth }}>
              <FolderTree
                teamId={teamId}
                projectId={projectId}
                projectName={projectInfo.name ?? ''}
                rootFolderId={rootFolderId}
              />
            </div>
            <ResizeHandle
              onResize={(delta) => {
                setLeftSidebarWidth((prev) => Math.max(180, Math.min(400, prev + delta)))
              }}
              className="hidden md:block"
            />
          </>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-0 bg-card overflow-hidden">
          <header className="h-14 border-b flex items-center justify-between px-6 shrink-0 bg-background/50 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-primary" />
              <h1 className="font-bold text-lg text-foreground">{m.all_share_links()}</h1>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-6">
            {isSharesLoading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : shares.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
                <Link2 className="h-10 w-10 text-muted-foreground/50" />
                <p>{m.no_share_links_yet()}</p>
              </div>
            ) : (
              <div className="border border-border rounded-xl bg-background overflow-hidden shadow-xs">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent bg-muted/20">
                      <TableHead className="font-semibold px-4 py-3">{m.name()}</TableHead>
                      <TableHead className="font-semibold px-4 py-3">{m.public_link()}</TableHead>
                      <TableHead className="font-semibold px-4 py-3">{m.creator()}</TableHead>
                      <TableHead className="font-semibold px-4 py-3 w-[150px]">
                        {m.created_date()}
                      </TableHead>
                      <TableHead className="font-semibold px-4 py-3 text-right w-[120px]">
                        {m.active()}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shares.map((share) => {
                      const shareUrl = `${window.location.origin}/share/${share.id}`
                      return (
                        <TableRow key={share.id} className="hover:bg-muted/10 transition-colors">
                          <TableCell className="font-medium px-4 py-3.5">
                            <span
                              className="cursor-pointer hover:underline text-foreground"
                              onClick={() =>
                                navigate({
                                  to: '/projects/$projectId/shares/$shareId',
                                  params: { projectId, shareId: share.id },
                                })
                              }
                            >
                              {share.name}
                            </span>
                          </TableCell>
                          <TableCell className="px-4 py-3.5 max-w-[300px]">
                            <div className="flex items-center gap-2 group">
                              <span
                                className="truncate text-xs font-mono bg-muted/50 text-muted-foreground px-2 py-1 rounded-md border border-border cursor-pointer hover:bg-muted transition-colors flex-1"
                                onClick={() => handleCopyLink(share.id)}
                                title={m.click_to_copy_link()}
                              >
                                {shareUrl}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleCopyLink(share.id)}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                              <a
                                href={shareUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-muted-foreground hover:text-foreground inline-flex items-center"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                {share.creator?.image && (
                                  <AvatarImage
                                    src={share.creator.image}
                                    alt={share.creator.name}
                                    className="object-cover"
                                  />
                                )}
                                <AvatarFallback className="text-[10px]">
                                  {getInitials(share.creator?.name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium text-foreground truncate max-w-[150px]">
                                {share.creator?.name || m.unknown()}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3.5 text-muted-foreground text-sm">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
                              <span>{new Date(share.createdAt).toLocaleDateString()}</span>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3.5 text-right">
                            <div className="flex justify-end">
                              <Switch
                                checked={!share.isDisabled}
                                onCheckedChange={(checked) =>
                                  toggleVisibility({ id: share.id, isDisabled: !checked })
                                }
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                <div ref={inViewRef} className="h-10 w-full flex items-center justify-center">
                  {isFetchingNextPage && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export const Route = createLazyFileRoute('/projects/$projectId/shares/')({
  component: SharesPage,
})
