import { client } from '@/ui/api/client'
import { FileViewer } from '@/ui/components/file-viewer'
import { FileViewerLeftSidebar } from '@/ui/components/file-viewer-left-sidebar'
import { FileViewerRightSidebar } from '@/ui/components/file-viewer-right-sidebar'
import { ResizeHandle } from '@/ui/components/resize-handle'
import { FileDetailSkeleton } from '@/ui/components/loading-skeletons'
import { useMemberStore } from '@/ui/stores/members'
import { useTeamContextStore } from '@/ui/stores/team-context'
import { useTopNavStore } from '@/ui/stores/top-nav'
import { type Annotation } from '@/ui/types'
import { useMutation } from '@tanstack/react-query'
import { InferRequestType, InferResponseType } from 'hono/client'

import type { AssetInfo, AssetInfoPaginatedList, CommentInfo } from '@shumai/dtos'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type Player from 'video.js/dist/types/player'

function FileViewPage() {
  const { projectId, fileId } = Route.useParams()
  const search = Route.useSearch()
  const versionAssetId = (search as { version?: string }).version
  const activeFileId = versionAssetId || fileId

  const videoRef = useRef<Player | null>(null)
  const { teamId, ensureTeamIdForProject } = useTeamContextStore()
  const [rightSidebarWidth, setRightSidebarWidth] = useState(360)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [currentTime, setCurrentTime] = useState(0)
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null)
  const [carouselState, setCarouselState] = useState<{
    show: boolean
    files: AssetInfo[]
    nextCursor?: string
    folderId?: string
  }>({ show: false, files: [], nextCursor: undefined, folderId: undefined })
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

  const parentFolderId =
    fileData?.ancestorFolders?.[fileData.ancestorFolders.length - 1]?.id ??
    projectInfo?.rootFolder ??
    ''

  useEffect(() => {
    if (!parentFolderId || !activeFileId) return
    if (carouselState.folderId === parentFolderId) {
      return
    }

    let isMounted = true

    const fetchCarouselData = async () => {
      try {
        let cursor = ''
        let found = false
        const allFiles: AssetInfo[] = []
        let lastCursor: string | undefined = undefined

        for (let batch = 0; batch < 5; batch++) {
          const res = await client.api.folders[':folderId'].search.$post({
            param: { folderId: parentFolderId },
            json: {
              assetType: 'file',
              after: cursor,
              first: 200,
              recursively: false,
              conditions: [],
            },
          })
          if (!res.ok) {
            throw new Error('Failed to search parent folder for carousel')
          }
          const result = (await res.json()) as unknown as AssetInfoPaginatedList
          const batchFiles = (result.data || []) as AssetInfo[]
          allFiles.push(...batchFiles)

          if (batchFiles.some((f) => f.id === activeFileId)) {
            found = true
            lastCursor = result.pageInfo?.cursor || undefined
            break
          }
          if (!result.pageInfo?.cursor || batchFiles.length < 200) {
            break
          }
          cursor = result.pageInfo.cursor
        }

        if (isMounted) {
          if (found) {
            setCarouselState({
              show: true,
              files: allFiles,
              nextCursor: lastCursor,
              folderId: parentFolderId,
            })
          } else {
            setCarouselState({
              show: false,
              files: [],
              nextCursor: undefined,
              folderId: parentFolderId,
            })
          }
        }
      } catch (err) {
        console.error(err)
        if (isMounted) {
          setCarouselState({
            show: false,
            files: [],
            nextCursor: undefined,
            folderId: parentFolderId,
          })
        }
      }
    }

    fetchCarouselData()

    return () => {
      isMounted = false
    }
  }, [parentFolderId, activeFileId, carouselState.folderId])

  if (isLoading && !fileData) {
    return <FileDetailSkeleton />
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
    setSelectedCommentId(comment.id || null)
    const newAnnotations = comment.annotations as Annotation[]
    if (newAnnotations && newAnnotations.length > 0) {
      setAnnotations(newAnnotations)
    } else {
      setAnnotations([])
    }

    if (comment.second !== null && comment.second !== undefined) {
      if (videoRef.current) {
        videoRef.current.currentTime(comment.second)
        videoRef.current.pause()
      }
    } else if (newAnnotations && newAnnotations.length > 0) {
      if (videoRef.current) {
        videoRef.current.pause()
      }
    }
  }

  const handlePlay = () => {
    setAnnotations([])
    setSelectedCommentId(null)
  }

  return (
    <div className="h-full flex flex-1 flex-col bg-background">
      <div className="h-full flex flex-1 overflow-hidden">
        {carouselState.show && (
          <FileViewerLeftSidebar
            projectId={projectId}
            currentAssetId={activeFileId}
            parentFolderId={parentFolderId}
            initialFiles={carouselState.files}
            initialNextCursor={carouselState.nextCursor}
          />
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
            onTimeUpdate={setCurrentTime}
            annotations={annotations}
          />
        </div>
        <ResizeHandle
          onResize={(delta) => {
            setRightSidebarWidth((prev) => Math.max(300, Math.min(600, prev - delta)))
          }}
          className="hidden md:block"
        />
        <div style={{ width: rightSidebarWidth }} className="flex-shrink-0">
          <FileViewerRightSidebar
            teamId={teamId}
            projectId={projectId}
            file={fileData as unknown as AssetInfo}
            onSaveField={handleSaveField}
            members={members}
            onCommentSelect={handleCommentSelect}
            currentTime={currentTime}
            onTyping={() => {
              if (videoRef.current) {
                videoRef.current.pause()
              }
            }}
            selectedCommentId={selectedCommentId}
          />
        </div>
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
