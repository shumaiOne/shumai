import { client } from '@/ui/api/client'
import { FolderTree } from '@/ui/components/folder-tree'
import { ResizeHandle } from '@/ui/components/resize-handle'
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
import { useUiStore } from '@/ui/stores/ui'
import { useTeamContextStore } from '@/ui/stores/team-context'
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Copy, ExternalLink, Calendar, User, Link2, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import type { ShareLinkInfo } from '@shumai/dtos'
import { ProjectFolderSkeleton } from '@/ui/components/loading-skeletons'

const projectInfoQueryOptions = (projectId: string) => ({
  queryKey: ['projects', projectId],
  queryFn: async () => {
    const res = await client.api.projects[':projectId'].$get({
      param: { projectId },
    })
    if (!res.ok) throw new Error('Failed to fetch project')
    return await res.json()
  },
})

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
    fileListLeftSidebarCollapsed: isLeftSidebarCollapsed,
    setFileListLeftSidebarCollapsed: setIsLeftSidebarCollapsed,
  } = useUiStore()

  const { data: sharesData, isLoading: isSharesLoading } = useQuery({
    queryKey: ['shares', projectId],
    queryFn: async () => {
      const res = await client.api.projects[':projectId'].shares.$get({
        param: { projectId },
        query: { first: '100' },
      })
      if (!res.ok) throw new Error('Failed to fetch share links')
      return (await res.json()) as unknown as { data: ShareLinkInfo[] }
    },
    enabled: !!projectId,
  })

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
      toast.success('Share link status updated')
    },
    onError: (err) => {
      toast.error(`Error: ${err.message}`)
    },
  })

  if (!teamId || !rootFolderId || !projectInfo) {
    return <ProjectFolderSkeleton />
  }

  const shares = sharesData?.data ?? []

  const handleCopyLink = (shareId: string) => {
    const url = `${window.location.origin}/share/${shareId}`
    navigator.clipboard.writeText(url)
    toast.success('Link copied to clipboard')
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
              <h1 className="font-bold text-lg text-foreground">All Share Links</h1>
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
                <p>No share links created yet.</p>
              </div>
            ) : (
              <div className="border border-border rounded-xl bg-background overflow-hidden shadow-xs">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent bg-muted/20">
                      <TableHead className="font-semibold px-4 py-3">Name</TableHead>
                      <TableHead className="font-semibold px-4 py-3">Public Link</TableHead>
                      <TableHead className="font-semibold px-4 py-3">Creator</TableHead>
                      <TableHead className="font-semibold px-4 py-3 w-[150px]">
                        Created Date
                      </TableHead>
                      <TableHead className="font-semibold px-4 py-3 text-right w-[120px]">
                        Active
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
                                title="Click to copy link"
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
                              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <User className="h-3.5 w-3.5 text-primary" />
                              </div>
                              <span className="text-sm font-medium text-foreground truncate max-w-[150px]">
                                {share.creator?.name || 'Unknown'}
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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/projects/$projectId/shares/')({
  component: SharesPage,
  loader: ({ context: { queryClient }, params: { projectId } }) =>
    queryClient.ensureQueryData(projectInfoQueryOptions(projectId)),
  pendingComponent: () => <ProjectFolderSkeleton />,
})
