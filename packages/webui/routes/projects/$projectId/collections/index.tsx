import { client } from '@/ui/api/client'
import { FolderTree } from '@/ui/components/folder-tree'
import { ResizeHandle } from '@/ui/components/resize-handle'
import { m } from '@/ui/src/paraglide/messages.js'
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
import { useInfiniteQuery, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { Bookmark, Calendar, LayoutGrid, Loader2 } from 'lucide-react'
import { useInView } from 'react-intersection-observer'
import type { CollectionInfo } from '@shumai/dtos'
import { ProjectFolderSkeleton } from '@/ui/components/loading-skeletons'

const getInitials = (name?: string) => {
  if (!name) return '??'
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

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

function CollectionsPage() {
  const { projectId } = Route.useParams()
  const { teamId, ensureTeamIdForProject } = useTeamContextStore()
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

  const {
    data: collectionsData,
    isLoading: isCollectionsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['collections', projectId],
    queryFn: async ({ pageParam }) => {
      const res = await client.api.projects[':projectId'].collections.$get({
        param: { projectId },
        query: { first: '20', after: pageParam as string },
      })
      if (!res.ok) throw new Error('Failed to fetch collections')
      return (await res.json()) as unknown as {
        data: CollectionInfo[]
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

  const collections = useMemo(
    () => collectionsData?.pages.flatMap((p) => p.data) || [],
    [collectionsData],
  )

  if (!teamId || !rootFolderId || !projectInfo) {
    return <ProjectFolderSkeleton />
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
              <Bookmark className="h-5 w-5 text-primary" />
              <h1 className="font-bold text-lg text-foreground">{m.all_collections()}</h1>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-6">
            {isCollectionsLoading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : collections.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
                <LayoutGrid className="h-10 w-10 text-muted-foreground/50" />
                <p>No collections created yet.</p>
              </div>
            ) : (
              <div className="border border-border rounded-xl bg-background overflow-hidden shadow-xs">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent bg-muted/20">
                      <TableHead className="font-semibold px-4 py-3">Collection Name</TableHead>
                      <TableHead className="font-semibold px-4 py-3">Creator</TableHead>
                      <TableHead className="font-semibold px-4 py-3 w-[200px]">
                        Created Date
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {collections.map((collection) => (
                      <TableRow
                        key={collection.id}
                        className="hover:bg-muted/10 transition-colors cursor-pointer"
                        onClick={() =>
                          navigate({
                            to: '/projects/$projectId/collections/$collectionId',
                            params: { projectId, collectionId: collection.id },
                          })
                        }
                      >
                        <TableCell className="font-medium px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <Bookmark className="h-4 w-4 text-primary shrink-0" />
                            <span className="text-foreground font-semibold hover:underline">
                              {collection.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              {collection.creator?.image && (
                                <AvatarImage
                                  src={collection.creator.image}
                                  alt={collection.creator.name}
                                  className="object-cover"
                                />
                              )}
                              <AvatarFallback className="text-[10px]">
                                {getInitials(collection.creator?.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium text-foreground truncate max-w-[200px]">
                              {collection.creator?.name || 'Unknown'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3.5 text-muted-foreground text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
                            <span>{new Date(collection.createdAt).toLocaleDateString()}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
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

export const Route = createFileRoute('/projects/$projectId/collections/')({
  component: CollectionsPage,
  loader: ({ context: { queryClient }, params: { projectId } }) =>
    queryClient.ensureQueryData(projectInfoQueryOptions(projectId)),
  pendingComponent: () => <ProjectFolderSkeleton />,
})
