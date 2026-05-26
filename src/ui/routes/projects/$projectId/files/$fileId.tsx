import { InferRequestType, InferResponseType } from 'hono/client'
import { useMutation } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { FileViewer } from '@/ui/components/file-viewer'
import { FileViewerLeftSidebar } from '@/ui/components/file-viewer-left-sidebar'
import { FileViewerRightSidebar } from '@/ui/components/file-viewer-right-sidebar'
import { ResizeHandle } from '@/ui/components/resize-handle'
import { useMemberStore } from '@/ui/stores/members'
import { useTeamContextStore } from '@/ui/stores/team-context'
import { useUiStore } from '@/ui/stores/ui'
import { useTopNavStore } from '@/ui/stores/top-nav'
import { type Annotation } from '@/ui/types'

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import type { CommentInfo, AssetInfo } from '@/dtos/asset'
import type Player from 'video.js/dist/types/player'

function FileViewPage() {
  const { projectId, fileId } = Route.useParams()
  const search = Route.useSearch()
  const versionAssetId = (search as { version?: string }).version
  const activeFileId = versionAssetId || fileId

  const videoRef = useRef<Player | null>(null)
  const {
    fileViewRightSidebarCollapsed: isRightSidebarCollapsed,
    fileViewLeftSidebarCollapsed: isLeftSidebarCollapsed,
    setFileViewLeftSidebarCollapsed: setIsLeftSidebarCollapsed,
  } = useUiStore()
  const { teamId, ensureTeamIdForProject } = useTeamContextStore()
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(280)
  const [rightSidebarWidth, setRightSidebarWidth] = useState(360)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const $patchMetadata = client.api.files[':fileId'].metadata.$patch
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
    data: stackData,
    isLoading: isStackLoading,
    isError: isStackError,
    isFetching: isStackFetching,
  } = useQuery({
    queryKey: ['files', fileId],
    queryFn: async () => {
      const res = await client.api.files[':fileId'].$get({
        param: { fileId: fileId },
      })
      if (!res.ok) throw new Error('Failed to fetch stack')
      return await res.json()
    },
    enabled: !!teamId,
    placeholderData: keepPreviousData,
  })

  const {
    data: versionData,
    isLoading: isVersionLoading,
    isError: isVersionError,
    isFetching: isVersionFetching,
  } = useQuery({
    queryKey: ['files', versionAssetId],
    queryFn: async () => {
      const res = await client.api.files[':fileId'].$get({
        param: { fileId: versionAssetId! },
      })
      if (!res.ok) throw new Error('Failed to fetch version')
      return await res.json()
    },
    enabled: !!teamId && !!versionAssetId,
    placeholderData: keepPreviousData,
  })

  const { data: versionsList } = useQuery({
    queryKey: ['version_stacks', fileId, 'versions'],
    queryFn: async () => {
      const res = await client.api.version_stacks[':stackId'].versions.$get({
        param: { stackId: fileId },
      })
      if (!res.ok) throw new Error('Failed to fetch versions')
      return await res.json()
    },
    enabled: !!projectId && !!fileId && !!versionAssetId,
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

  const navigate = useNavigate()
  const { setProjectState, clearProjectState } = useTopNavStore()

  const isLoading = isStackLoading || (!!versionAssetId && isVersionLoading)
  const isError = isStackError || (!!versionAssetId && isVersionError)
  const isFetching = isStackFetching || (!!versionAssetId && isVersionFetching)
  const fileData = versionData || stackData
  const versionsDataList = versionAssetId ? versionsList : stackData?.versionStack?.versions

  useEffect(() => {
    if (fileData && projectInfo && teamId) {
      setProjectState({
        teamId,
        projectId,
        projectName: projectInfo.name ?? '',
        ancestorFolders: fileData.ancestorFolders ?? [],
        currentAsset: {
          name: fileData.name,
          type: 'file',
          version: versionsDataList
            ? (versionsDataList.find((v: { id: string }) => v.id === activeFileId)?.version ??
              versionsDataList.length)
            : undefined,
        },
        isRootFolder: false,
        fileId,
        versions: versionsDataList,
        onFolderClick: (id: string) => {
          navigate({
            to: '/projects/$projectId/folders/$folderId',
            params: { projectId, folderId: id },
          })
        },
      })
    }

    return () => clearProjectState()
  }, [
    teamId,
    projectId,
    projectInfo,
    fileData,
    versionsDataList,
    activeFileId,
    fileId,
    setProjectState,
    clearProjectState,
    navigate,
  ])

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
        param: { fileId: activeFileId },
        json: [{ key: fieldId, value }] as InferRequestType<typeof $patchMetadata>['json'],
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: ['files', activeFileId],
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
    <div className="flex flex-1 flex-col bg-background">
      <div className="flex flex-1 overflow-hidden">
        {!isLeftSidebarCollapsed && (
          <>
            <div style={{ width: leftSidebarWidth }} className="flex-shrink-0">
              <FileViewerLeftSidebar
                projectId={projectId}
                currentAssetId={activeFileId}
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
  validateSearch: (search: Record<string, unknown>) => {
    return {
      version: (search.version as string) || undefined,
    }
  },
})
