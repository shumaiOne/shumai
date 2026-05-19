import { InferRequestType, InferResponseType } from 'hono/client'
import { useMutation } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { BreadcrumbNav } from '@/ui/components/breadcrumb-nav'
import { FileViewer } from '@/ui/components/file-viewer'
import { FileViewerLeftSidebar } from '@/ui/components/file-viewer-left-sidebar'
import { FileViewerRightSidebar } from '@/ui/components/file-viewer-right-sidebar'
import { ResizeHandle } from '@/ui/components/resize-handle'
import { useMemberStore } from '@/ui/stores/members'
import { useTeamContextStore } from '@/ui/stores/team-context'
import { useUiStore } from '@/ui/stores/ui'
import { type Annotation } from '@/ui/types'

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import type { CommentInfo, AssetInfo } from '@/dtos/asset'
import type Player from 'video.js/dist/types/player'

function FileViewPage() {
  const { projectId, fileId } = Route.useParams()
  const videoRef = useRef<Player | null>(null)
  const {
    fileViewRightSidebarCollapsed: isRightSidebarCollapsed,
    setFileViewRightSidebarCollapsed: setIsRightSidebarCollapsed,
    fileViewLeftSidebarCollapsed: isLeftSidebarCollapsed,
    setFileViewLeftSidebarCollapsed: setIsLeftSidebarCollapsed,
  } = useUiStore()
  const { teamId, ensureTeamIdForProject } = useTeamContextStore()
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(280)
  const [rightSidebarWidth, setRightSidebarWidth] = useState(360)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const $patchMetadata = client.api.teams[':teamId'].files[':fileId'].metadata.$patch
  const { mutate: patchMetadata } = useMutation<
    InferResponseType<typeof $patchMetadata>,
    Error,
    InferRequestType<typeof $patchMetadata>
  >({
    mutationFn: async (request) => {
      const res = await $patchMetadata(request)
      if (!res.ok) throw new Error('Failed to patch metadata')
      return (await res.json()) as unknown as InferResponseType<typeof $patchMetadata>
    },
  })
  const queryClient = useQueryClient()
  const { members, fetchMembers } = useMemberStore()

  useEffect(() => {
    ensureTeamIdForProject(projectId)
  }, [projectId, ensureTeamIdForProject])

  useEffect(() => {
    if (teamId) {
      fetchMembers(teamId, true)
    }
  }, [teamId, fetchMembers])

  const {
    data: fileData,
    isLoading,
    isError,
    isFetching,
  } = useQuery({
    queryKey: ['teams', teamId, 'files', fileId],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].files[':fileId'].$get({
        param: { teamId: teamId!, fileId: fileId },
      })
      if (!res.ok) throw new Error('Failed to fetch file')
      return await res.json()
    },
    enabled: !!teamId,
    placeholderData: keepPreviousData,
  })

  const { data: projectInfo } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: async () => {
      const res = await client.api.projects[':projectId'].$get({
        param: { projectId: projectId },
      })
      if (!res.ok) throw new Error('Failed to fetch project')
      return await res.json()
    },
  })

  if (isLoading && !fileData) {
    return <div>Loading...</div>
  }

  if (isError || !fileData || !projectInfo || !teamId) {
    return <div>File not found.</div>
  }

  const handleSaveField = (fieldId: string, value: unknown) => {
    if (!teamId) return
    patchMetadata(
      {
        param: { teamId: teamId, fileId: fileId },
        json: [{ key: fieldId, value }] as InferRequestType<typeof $patchMetadata>['json'],
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: ['teams', teamId, 'files', fileId],
          })
        },
      },
    )
  }

  const handleCommentSelect = (comment: CommentInfo) => {
    const newAnnotations = comment.annotations as Annotation[]
    if (newAnnotations && newAnnotations.length > 0) {
      setAnnotations(newAnnotations)
      if (videoRef.current) {
        videoRef.current.pause()
      }
    } else {
      setAnnotations([])
    }
  }

  const handlePlay = () => {
    setAnnotations([])
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <BreadcrumbNav
        teamId={teamId}
        projectId={projectId}
        projectName={projectInfo.name ?? ''}
        ancestorFolders={fileData.ancestorFolders ?? []}
        currentAsset={{
          name: fileData.name,
          type: 'file',
          version: fileData.type === 'version_stack' ? fileData.fileCount : undefined,
        }}
        isRootFolder={false}
        isLeftSidebarCollapsed={isLeftSidebarCollapsed}
        onLeftSidebarToggle={() => setIsLeftSidebarCollapsed(!isLeftSidebarCollapsed)}
        isRightSidebarCollapsed={isRightSidebarCollapsed}
        onRightSidebarToggle={() => setIsRightSidebarCollapsed(!isRightSidebarCollapsed)}
      />
      <div className="flex flex-1 overflow-hidden">
        {!isLeftSidebarCollapsed && (
          <>
            <div style={{ width: leftSidebarWidth }} className="flex-shrink-0">
              <FileViewerLeftSidebar
                teamId={teamId!}
                projectId={projectId}
                currentAssetId={fileId}
                parentFolderId={
                  fileData.ancestorFolders?.[fileData.ancestorFolders.length - 1]?.id ??
                  projectInfo.rootFolder ??
                  ''
                }
                onCollapse={() => setIsLeftSidebarCollapsed(true)}
              />
            </div>
            <ResizeHandle
              onResize={(delta) => {
                setLeftSidebarWidth((prev) => Math.max(200, Math.min(500, prev + delta)))
              }}
              className="hidden md:block"
            />
          </>
        )}
        <div className="flex-1 relative">
          {isFetching && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50">
              <Loader2 className="h-8 w-8 animate-spin text-foreground" />
            </div>
          )}
          <FileViewer
            file={fileData as unknown as AssetInfo}
            videoRef={videoRef}
            onPlay={handlePlay}
            annotations={annotations}
          />
        </div>
        {!isRightSidebarCollapsed && (
          <>
            <ResizeHandle
              onResize={(delta) => {
                setRightSidebarWidth((prev) => Math.max(240, Math.min(600, prev - delta)))
              }}
              className="hidden md:block"
            />
            <div style={{ width: rightSidebarWidth }} className="flex-shrink-0">
              <FileViewerRightSidebar
                teamId={teamId!}
                projectId={projectId}
                file={fileData as unknown as AssetInfo}
                onSaveField={handleSaveField}
                members={members}
                onCommentSelect={handleCommentSelect}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export const Route = createFileRoute('/projects/$projectId/files/$fileId')({
  component: FileViewPage,
})
