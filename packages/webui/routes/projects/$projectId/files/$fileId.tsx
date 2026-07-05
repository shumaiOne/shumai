import { client } from '@/ui/api/client'
import { FileViewer } from '@/ui/components/file-viewer'
import { CompareViewer } from '@/ui/components/compare/compare-viewer'
import { pickDefaultCompareVersions } from '@/ui/components/compare/compare-utils'
import { FileViewerLeftSidebar } from '@/ui/components/file-viewer-left-sidebar'
import { m } from '@/ui/paraglide/messages.js'
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
import type { MediaController } from '@/ui/components/viewers/types'

function FileViewPage() {
  const { projectId, fileId } = Route.useParams()
  const search = Route.useSearch()
  const versionAssetId = search.version
  const startTime = search.start
  const activeFileId = versionAssetId || fileId
  const compareLeftId = search.cmpLeft
  const compareRightId = search.cmpRight
  const compareActiveSide = search.cmpActive ?? 'left'
  const isCompareMode = !!search.compare && !!compareLeftId && !!compareRightId

  const mediaControllerRef = useRef<MediaController | null>(null)
  const { teamId, ensureTeamIdForProject } = useTeamContextStore()
  const [rightSidebarWidth, setRightSidebarWidth] = useState(360)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [currentTime, setCurrentTime] = useState(0)
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null)
  const [compareActiveAsset, setCompareActiveAsset] = useState<AssetInfo | null>(null)
  const [seekRequest, setSeekRequest] = useState<{ second: number; nonce: number } | undefined>(
    undefined,
  )
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
    enabled: !!projectId && !!fileId && (!!versionAssetId || isCompareMode),
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
        downloadInfo: {
          originalKey: fileData.media?.original?.key,
          videoTranscodes: fileData.media?.videoTranscodes?.map((t) => ({
            key: t.key,
            width: t.width,
            height: t.height,
            isRaw: t.isRaw,
          })),
        },
        versions: versionsDataList,
        compareMode: isCompareMode,
        canCompareVersions: (versionsDataList?.length ?? 0) >= 2,
        onCompareVersions: () => {
          const pair = pickDefaultCompareVersions(versionsDataList)
          if (!pair) return
          navigate({
            to: '/projects/$projectId/files/$fileId',
            params: { projectId, fileId },
            search: (p: Record<string, unknown>) => ({
              ...p,
              version: undefined,
              compare: true,
              cmpLeft: pair.left.id,
              cmpRight: pair.right.id,
              cmpActive: 'left' as const,
            }),
          })
        },
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
    isCompareMode,
    setProjectState,
    clearProjectState,
    navigate,
  ])

  const parentFolderId = fileData?.ancestorFolders?.[0]?.id ?? projectInfo?.rootFolder ?? ''

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

  useEffect(() => {
    setCurrentTime(0)
    setSelectedCommentId(null)
    setAnnotations([])
  }, [fileData?.id])

  useEffect(() => {
    setSelectedCommentId(null)
    setAnnotations([])
  }, [compareActiveAsset?.id])

  if (isLoading && !fileData) {
    return <FileDetailSkeleton />
  }

  if (isError || !fileData || !projectInfo || !teamId) {
    return <div>{m.file_not_found()}</div>
  }

  const sidebarFile = isCompareMode ? compareActiveAsset : (fileData as unknown as AssetInfo)
  const sidebarFileId = sidebarFile?.id ?? activeFileId

  const handleSaveField = (fieldId: string, value: unknown) => {
    if (!teamId) return
    patchMetadata(
      {
        param: { fileId: sidebarFileId },
        json: [{ key: fieldId, value }] as InferRequestType<typeof $patchMetadata>['json'],
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: ['files', sidebarFileId],
          })
        },
      },
    )
  }

  const updateCompareSearch = (patch: Record<string, unknown>) => {
    navigate({
      to: '/projects/$projectId/files/$fileId',
      params: { projectId, fileId },
      search: (p: Record<string, unknown>) => ({ ...p, ...patch }),
    })
  }

  const handleCompareExit = () => {
    const activeId = compareActiveSide === 'left' ? compareLeftId : compareRightId
    updateCompareSearch({
      compare: undefined,
      cmpLeft: undefined,
      cmpRight: undefined,
      cmpActive: undefined,
      version: activeId,
    })
  }

  const handleCommentSelect = (comment: CommentInfo) => {
    setSelectedCommentId(comment.id || null)
    const newAnnotations = comment.annotations as Annotation[]
    if (newAnnotations && newAnnotations.length > 0) {
      setAnnotations(newAnnotations)
    } else {
      setAnnotations([])
    }

    if (isCompareMode) {
      if (comment.second !== null && comment.second !== undefined) {
        setSeekRequest({ second: comment.second, nonce: Date.now() })
      }
      return
    }

    if (comment.second !== null && comment.second !== undefined) {
      mediaControllerRef.current?.seekTo(comment.second)
      mediaControllerRef.current?.pause()
    } else if (newAnnotations && newAnnotations.length > 0) {
      mediaControllerRef.current?.pause()
    }
  }

  const handlePlay = () => {
    setAnnotations([])
    setSelectedCommentId(null)
  }

  return (
    <div className="h-full flex flex-1 flex-col bg-background">
      <div className="h-full flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          {isFetching && !isCompareMode && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50">
              <Loader2 className="h-8 w-8 animate-spin text-foreground" />
            </div>
          )}
          {isCompareMode && compareLeftId && compareRightId ? (
            <CompareViewer
              versions={versionsDataList ?? []}
              leftId={compareLeftId}
              rightId={compareRightId}
              activeSide={compareActiveSide}
              annotations={annotations}
              seekRequest={seekRequest}
              onActiveSideChange={(side) => updateCompareSearch({ cmpActive: side })}
              onSwitchVersion={(side, versionId) =>
                updateCompareSearch(
                  side === 'left' ? { cmpLeft: versionId } : { cmpRight: versionId },
                )
              }
              onExit={handleCompareExit}
              onActiveAssetChange={setCompareActiveAsset}
              onPlay={handlePlay}
              onTimeUpdate={setCurrentTime}
            />
          ) : (
            <FileViewer
              file={fileData as unknown as AssetInfo}
              mediaControllerRef={mediaControllerRef}
              onPlay={handlePlay}
              onTimeUpdate={setCurrentTime}
              annotations={annotations}
              startTime={startTime}
            >
              {carouselState.show && (
                <FileViewerLeftSidebar
                  projectId={projectId}
                  currentAssetId={activeFileId}
                  parentFolderId={parentFolderId}
                  initialFiles={carouselState.files}
                  initialNextCursor={carouselState.nextCursor}
                />
              )}
            </FileViewer>
          )}
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
            file={sidebarFile}
            onSaveField={handleSaveField}
            members={members}
            onCommentSelect={handleCommentSelect}
            currentTime={currentTime}
            onTyping={() => {
              if (isCompareMode) return
              mediaControllerRef.current?.pause()
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
      start: search.start ? Number(search.start) : undefined,
      compare: search.compare === true || search.compare === 'true' || undefined,
      cmpLeft: (search.cmpLeft as string) || undefined,
      cmpRight: (search.cmpRight as string) || undefined,
      cmpActive: search.cmpActive === 'right' ? 'right' : undefined,
    } as {
      version?: string
      start?: number
      compare?: boolean
      cmpLeft?: string
      cmpRight?: string
      cmpActive?: 'left' | 'right'
    }
  },
})
