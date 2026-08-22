import { client } from '@/ui/api/client'
import { ChatbotSidebar } from '@/ui/components/chatbot-sidebar'
import { pickDefaultCompareVersions } from '@/ui/components/compare/compare-utils'
import { CompareViewer } from '@/ui/components/compare/compare-viewer'
import { FileViewer } from '@/ui/components/file-viewer'
import { FileViewerLeftSidebar } from '@/ui/components/file-viewer-left-sidebar'
import { FileViewerRightSidebar } from '@/ui/components/file-viewer-right-sidebar'
import { FileDetailSkeleton } from '@/ui/components/loading-skeletons'
import { ResizeHandle } from '@/ui/components/resize-handle'
import { m } from '@/ui/paraglide/messages.js'
import { useChatbotStore } from '@/ui/stores/chatbot'
import { useMemberStore } from '@/ui/stores/members'
import { useTeamContextStore } from '@/ui/stores/team-context'
import { useTopNavStore } from '@/ui/stores/top-nav'
import { useUiStore } from '@/ui/stores/ui'
import { type Annotation } from '@/ui/types'
import { useMutation } from '@tanstack/react-query'
import { createLazyFileRoute } from '@tanstack/react-router'
import { InferRequestType, InferResponseType } from 'hono/client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui/components/ui/alert-dialog'
import { Button } from '@/ui/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import { Input } from '@/ui/components/ui/input'
import { selectFileNameWithoutExtension } from '@/ui/lib/rename-utils'
import { toast } from 'sonner'
import type { MediaController } from '@/ui/components/viewers/types'
import type { AssetInfo, AssetInfoPaginatedList, CommentInfo } from '@shumai/dtos'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

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
  const { fileViewRightSidebarCollapsed } = useUiStore()
  const { isChatbotOpen } = useChatbotStore()
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
  const { members, fetchProjectMembers } = useMemberStore()

  useEffect(() => {
    ensureTeamIdForProject(projectId)
  }, [projectId, ensureTeamIdForProject])

  useEffect(() => {
    if (projectId) {
      fetchProjectMembers(projectId, true)
    }
  }, [projectId, fetchProjectMembers])

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

  const parentFolderId = fileData?.ancestorFolders?.[0]?.id ?? projectInfo?.rootFolder ?? ''

  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false)
  const [renameInput, setRenameInput] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)
  const renameSettledRef = useRef(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const $renameFile = client.api.files[':fileId'].$put
  const { mutate: renameFile, isPending: isRenaming } = useMutation<
    InferResponseType<typeof $renameFile, 200>,
    Error,
    InferRequestType<typeof $renameFile>
  >({
    mutationFn: async (request) => {
      const res = await $renameFile(request)
      if (!res.ok) throw new Error('Failed to rename file')
      return (await res.json()) as unknown as InferResponseType<typeof $renameFile, 200>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] })
      queryClient.invalidateQueries({ queryKey: ['version_stacks'] })
      toast.success(m.renamed_successfully?.() || 'Renamed successfully')
      setIsRenameDialogOpen(false)
    },
    onError: () => {
      toast.error(m.failed_to_rename?.() || 'Failed to rename')
    },
  })

  const $deleteFiles = client.api.files.$delete
  const { mutate: deleteFiles, isPending: isDeleting } = useMutation<
    void,
    Error,
    InferRequestType<typeof $deleteFiles>
  >({
    mutationFn: async (request) => {
      const res = await $deleteFiles(request)
      if (!res.ok) throw new Error('Failed to delete file')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] })
      queryClient.invalidateQueries({ queryKey: ['version_stacks'] })
      toast.success(m.deleted?.() || 'Deleted')
      setIsDeleteDialogOpen(false)
      if (parentFolderId && parentFolderId !== projectInfo?.rootFolder) {
        navigate({
          to: '/projects/$projectId/folders/$folderId',
          params: { projectId, folderId: parentFolderId },
        })
      } else {
        navigate({
          to: '/projects/$projectId',
          params: { projectId },
        })
      }
    },
    onError: () => {
      toast.error(m.failed_to_delete?.() || 'Failed to delete')
    },
  })

  const handleRenameSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!renameInput.trim() || !activeFileId) return
    renameFile({
      param: { fileId: activeFileId },
      json: { name: renameInput.trim() },
    })
  }

  const handleDeleteSubmit = () => {
    if (!activeFileId) return
    deleteFiles({
      json: { ids: [activeFileId] },
    })
  }

  useEffect(() => {
    if (fileData && projectInfo && teamId) {
      setProjectState({
        teamId,
        projectId,
        projectName: projectInfo.name ?? '',
        ancestorFolders: fileData.ancestorFolders ?? [],
        currentAsset: {
          id: activeFileId || fileId,
          name: fileData.name,
          type: 'file',
          version: versionsDataList
            ? (versionsDataList.find((v: { id: string }) => v.id === activeFileId)?.version ??
              versionsDataList.length)
            : undefined,
          proxyType: fileData.proxyType,
        },
        isRootFolder: false,
        fileId,
        downloadInfo: {
          originalKey: fileData.media?.original?.key,
          videoTranscodes: fileData.media?.videoTranscodes?.map((t) => ({
            key: t.key,
            width: t.width,
            height: t.height,
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
        onRename: () => {
          renameSettledRef.current = false
          setRenameInput(fileData?.name ?? '')
          setIsRenameDialogOpen(true)
        },
        onDelete: () => {
          setIsDeleteDialogOpen(true)
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

  useEffect(() => {
    if (!isRenameDialogOpen) return
    // Stop correcting the selection shortly after the dialog opens so user
    // edits are not disturbed. The dropdown's focus restoration settles well
    // within this window.
    const timeoutId = setTimeout(() => {
      renameSettledRef.current = true
    }, 1000)
    return () => clearTimeout(timeoutId)
  }, [isRenameDialogOpen])

  const handleRenameInputFocus = () => {
    if (renameSettledRef.current) return
    // The dialog focus scope calls select() synchronously right after the
    // focus event, and the breadcrumb dropdown restores focus ~150ms later
    // (after its exit animation), re-triggering the trap's select-all. Defer
    // the base-name selection so it runs after those select-all calls.
    setTimeout(() => {
      if (renameInputRef.current) {
        selectFileNameWithoutExtension(renameInputRef.current)
      }
    }, 0)
  }

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
        {(!fileViewRightSidebarCollapsed || isChatbotOpen) && (
          <>
            <ResizeHandle
              onResize={(delta) => {
                setRightSidebarWidth((prev) => Math.max(300, Math.min(600, prev - delta)))
              }}
              className="hidden md:block"
            />
            <div
              style={{ width: rightSidebarWidth }}
              className="flex-shrink-0 bg-background flex flex-col"
            >
              {isChatbotOpen ? (
                <ChatbotSidebar projectId={projectId} contextAssetId={activeFileId} />
              ) : (
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
                  hideAnnotationControl={sidebarFile?.proxyType === 'audio'}
                />
              )}
            </div>
          </>
        )}
      </div>

      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <form onSubmit={handleRenameSubmit}>
            <DialogHeader>
              <DialogTitle>{m.rename()}</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Input
                ref={renameInputRef}
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                placeholder={m.enter_new_name?.() || 'Enter new name'}
                onFocus={handleRenameInputFocus}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsRenameDialogOpen(false)}>
                {m.cancel()}
              </Button>
              <Button type="submit" disabled={isRenaming || !renameInput.trim()}>
                {isRenaming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {m.save()}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.delete_asset_title?.() || 'Delete Asset?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {m.delete_asset_description?.() ||
                'Deleted items can be recovered for 30 days before being permanently deleted.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.cancel()}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSubmit}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {m.delete()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export const Route = createLazyFileRoute('/projects/$projectId/files/$fileId')({
  component: FileViewPage,
})
